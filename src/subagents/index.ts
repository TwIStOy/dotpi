import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { registerAgents } from "./agent-types.js"
import { AgentManager } from "./agent-manager.js"
import { registerAgentTool } from "./tools/agent-tool.js"
import { registerGetResultTool } from "./tools/get-result-tool.js"
import { registerSteerTool } from "./tools/steer-tool.js"
import { registerAgentsCommand } from "./commands/agents-command.js"
import {
  emitAgentCompleted,
  emitAgentFailed,
  emitAgentStarted,
  emitReady,
} from "./events.js"
import { AgentWidget, createWidgetUpdater } from "./ui/agent-widget.js"
import { recordToNotification, formatTaskNotification, registerNotificationRenderer } from "./ui/notifications.js"
import type { AgentRecord } from "./types.js"

export default function initSubagents(pi: ExtensionAPI): void {
  registerAgents(new Map())

  let widget: AgentWidget | undefined

  const manager = new AgentManager(
    (record) => {
      if (record.status === "error") {
        emitAgentFailed(pi, record)
      } else {
        emitAgentCompleted(pi, record)
      }

      widget?.updateAgent(record)

      if (record.result && !record.resultConsumed) {
        const notification = formatTaskNotification(record)
        const footer = record.outputFile ? `\nFull transcript available at: ${record.outputFile}` : ""
        pi.sendMessage({
          customType: "subagent-notification",
          content: notification + footer,
          display: true,
          details: recordToNotification(record),
        }, { deliverAs: "followUp" })
      }
    },
    4,
    (record) => {
      emitAgentStarted(pi, record)
      widget?.updateAgent(record)
    },
  )

  registerNotificationRenderer(pi)

  pi.on("session_start", async (_event, ctx) => {
    manager.clearCompleted()

    if (ctx.hasUI) {
      widget = new AgentWidget()
      ctx.ui.setWidget("subagents", (tui, theme) => {
        widget!.bindTui(tui, theme)
        return widget!
      })
      manager.setActivityHooks({
        onToolActivity: (record, activity) => {
          widget!.updateActivity(record.id, {
            activeTool: activity.type === "start" ? activity.toolName : null,
            activeToolCount: activity.type === "start" ? 1 : 0,
          })
        },
        onTurnEnd: (record, turnCount) => {
          widget!.updateActivity(record.id, { turnCount })
        },
        onTextDelta: (record, _delta, fullText) => {
          widget!.updateActivity(record.id, { responseText: fullText.slice(-200) })
        },
      })
    }

    emitReady(pi)
  })

  pi.on("session_shutdown", async () => {
    manager.abortAll()
    widget?.dispose()
    widget = undefined
  })

  registerAgentTool(pi, manager)
  registerGetResultTool(pi, manager)
  registerSteerTool(pi, manager)
  registerAgentsCommand(pi, manager)
}
