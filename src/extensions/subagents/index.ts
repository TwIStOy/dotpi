import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerAgents } from "./agent-types.js";
import { AgentManager } from "./agent-manager.js";
import { registerAgentTool } from "./tools/agent-tool.js";
import { registerGetResultTool } from "./tools/get-result-tool.js";
import { registerSteerTool } from "./tools/steer-tool.js";
import { registerAgentsCommand } from "./commands/agents-command.js";
import {
  emitAgentCompleted,
  emitAgentFailed,
  emitAgentStarted,
  emitReady,
} from "./events.js";
import { AgentWidget, type AgentActivity } from "./ui/agent-widget.js";
import {
  recordToNotification,
  formatTaskNotification,
  registerNotificationRenderer,
} from "./ui/notifications.js";
import { ScheduleEngine } from "./schedule.js";
import {
  loadCustomAgents,
  collectExtensionAgentDirs,
} from "./custom-agents.js";

export default function initSubagents(pi: ExtensionAPI): void {
  registerAgents(new Map());

  const agentActivity = new Map<string, AgentActivity>();

  const manager = new AgentManager(
    (record) => {
      if (record.status === "error") {
        emitAgentFailed(pi, record);
      } else {
        emitAgentCompleted(pi, record);
      }

      agentActivity.delete(record.id);
      widget.markFinished(record.id);
      widget.update();

      if (record.result && !record.resultConsumed) {
        const notification = formatTaskNotification(record);
        const footer = record.outputFile
          ? `\nFull transcript available at: ${record.outputFile}`
          : "";
        pi.sendMessage(
          {
            customType: "subagent-notification",
            content: notification + footer,
            display: true,
            details: recordToNotification(record),
          },
          { deliverAs: "followUp" },
        );
      }
    },
    4,
    (record) => {
      emitAgentStarted(pi, record);
      widget.update();
    },
  );

  const widget = new AgentWidget(manager, agentActivity);

  const scheduler = new ScheduleEngine(process.cwd());

  registerNotificationRenderer(pi);

  pi.on("tool_execution_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      widget.setUICtx(ctx.ui as any);
      widget.onTurnStart();
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    manager.clearCompleted();

    const settings = (ctx as any).settingsManager;
    const extraDirs = settings
      ? collectExtensionAgentDirs(
          settings.getProjectSettings?.()?.extensions ?? [],
          settings.getPackages?.() ?? [],
          ctx.cwd,
        )
      : [];
    const customAgents = loadCustomAgents(ctx.cwd, extraDirs);
    registerAgents(customAgents);

    scheduler.bind(manager, pi);
    scheduler.load();
    scheduler.start();

    emitReady(pi);
  });

  pi.on("session_shutdown", async () => {
    manager.abortAll();
    scheduler.dispose();
    widget.dispose();
  });

  registerAgentTool(pi, manager, widget, agentActivity);

  registerGetResultTool(pi, manager);
  registerSteerTool(pi, manager);
  registerAgentsCommand(pi, manager, scheduler);
}
