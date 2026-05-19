import { truncateToWidth } from "@earendil-works/pi-tui"
import type { AgentRecord } from "../types.js"
import { formatDuration, formatTokens, formatTurns } from "../formatting.js"
import { getLifetimeTotal, getSessionContextPercent } from "../usage.js"
import type { ToolActivity } from "../agent-runner.js"
import type { AgentManager } from "../agent-manager.js"

export interface AgentActivity {
  activeTools: Map<string, ActiveTool>
  toolUses: number
  responseText: string
  session?: { getSessionStats(): { tokens: { input: number; output: number; cacheWrite: number }; contextUsage?: { percent: number | null } } }
  turnCount: number
  maxTurns?: number
  lifetimeUsage: { input: number; output: number; cacheWrite: number }
}

type Theme = {
  fg(color: string, text: string): string
  bold(text: string): string
}

type UICtx = {
  setWidget(
    key: string,
    content: undefined | ((tui: any, theme: Theme) => { render(): string[]; invalidate(): void }),
    options?: { placement?: "aboveEditor" | "belowEditor" },
  ): void
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const MAX_WIDGET_LINES = 12
const ERROR_STATUSES = new Set(["error", "aborted", "steered", "stopped"])

const TOOL_DISPLAY: Record<string, string> = {
  read: "reading",
  bash: "running command",
  edit: "editing",
  write: "writing",
  grep: "searching",
  find: "finding files",
  ls: "listing",
}

function extractToolLabel(toolName: string, args: any): string {
  if (!args || typeof args !== "object") return TOOL_DISPLAY[toolName] ?? toolName
  switch (toolName) {
    case "read":
      return args.path ? `reading ${shortenPath(String(args.path))}` : "reading"
    case "bash":
      if (args.command) {
        const cmd = String(args.command).split("\n")[0].trim()
        return cmd.length > 50 ? `running ${cmd.slice(0, 50)}…` : `running ${cmd}`
      }
      return "running command"
    case "edit":
      return args.path ? `editing ${shortenPath(String(args.path))}` : "editing"
    case "write":
      return args.path ? `writing ${shortenPath(String(args.path))}` : "writing"
    case "grep":
      return args.pattern ? `searching /${String(args.pattern).slice(0, 30)}/` : "searching"
    case "find":
      return args.pattern ? `finding *${String(args.pattern).slice(0, 30)}*` : "finding files"
    case "ls":
      return args.path ? `listing ${shortenPath(String(args.path))}` : "listing"
    default:
      return TOOL_DISPLAY[toolName] ?? toolName
  }
}

function shortenPath(p: string): string {
  const parts = p.split("/")
  if (parts.length <= 3) return p
  return "…/" + parts.slice(-2).join("/")
}

interface ActiveTool {
  name: string
  label: string
}

function describeActivity(activeTools: Map<string, ActiveTool>, responseText?: string): string {
  if (activeTools.size > 0) {
    const labels = [...activeTools.values()].map(t => t.label)
    return labels.join(", ") + "…"
  }
  if (responseText && responseText.trim().length > 0) {
    const line = responseText.split("\n").find(l => l.trim())?.trim() ?? ""
    if (line.length <= 60) return line
    return line.slice(0, 60) + "…"
  }
  return "thinking…"
}

function formatSessionTokens(tokens: number, percent: number | null, theme: Theme, compactions = 0): string {
  const tokenStr = formatTokens(tokens)
  const annot: string[] = []
  if (percent !== null) {
    const color = percent >= 85 ? "error" : percent >= 70 ? "warning" : "dim"
    annot.push(theme.fg(color, `${Math.round(percent)}%`))
  }
  if (compactions > 0) {
    annot.push(theme.fg("dim", `↻${compactions}`))
  }
  if (annot.length === 0) return tokenStr
  return `${tokenStr} (${annot.join(" · ")})`
}

export class AgentWidget {
  private uiCtx: UICtx | undefined
  private widgetFrame = 0
  private widgetInterval: ReturnType<typeof setInterval> | undefined
  private finishedTurnAge = new Map<string, number>()
  private static readonly ERROR_LINGER_TURNS = 2
  private widgetRegistered = false
  private tui: any | undefined

  constructor(
    private manager: AgentManager,
    private agentActivity: Map<string, AgentActivity>,
  ) {}

  setUICtx(ctx: UICtx) {
    if (ctx !== this.uiCtx) {
      this.uiCtx = ctx
      this.widgetRegistered = false
      this.tui = undefined
    }
  }

  onTurnStart() {
    for (const [id, age] of this.finishedTurnAge) {
      this.finishedTurnAge.set(id, age + 1)
    }
    this.update()
  }

  ensureTimer() {
    if (!this.widgetInterval) {
      this.widgetInterval = setInterval(() => this.update(), 80)
    }
  }

  private shouldShowFinished(agentId: string, status: string): boolean {
    const age = this.finishedTurnAge.get(agentId) ?? 0
    const maxAge = ERROR_STATUSES.has(status) ? AgentWidget.ERROR_LINGER_TURNS : 1
    return age < maxAge
  }

  markFinished(agentId: string) {
    if (!this.finishedTurnAge.has(agentId)) {
      this.finishedTurnAge.set(agentId, 0)
    }
  }

  private renderFinishedLine(a: AgentRecord, theme: Theme): string {
    const name = a.type
    const duration = formatDuration(a.startedAt, a.completedAt)
    let icon: string
    let statusText: string
    if (a.status === "completed") {
      icon = theme.fg("success", "✓")
      statusText = ""
    } else if (a.status === "steered") {
      icon = theme.fg("warning", "✓")
      statusText = theme.fg("warning", " (turn limit)")
    } else if (a.status === "stopped") {
      icon = theme.fg("dim", "■")
      statusText = theme.fg("dim", " stopped")
    } else if (a.status === "error") {
      icon = theme.fg("error", "✗")
      const errMsg = a.error ? `: ${a.error.slice(0, 60)}` : ""
      statusText = theme.fg("error", ` error${errMsg}`)
    } else {
      icon = theme.fg("error", "✗")
      statusText = theme.fg("warning", " aborted")
    }
    const parts: string[] = []
    const activity = this.agentActivity.get(a.id)
    if (activity) parts.push(formatTurns(activity.turnCount, activity.maxTurns))
    if (a.toolUses > 0) parts.push(`${a.toolUses} tool use${a.toolUses === 1 ? "" : "s"}`)
    parts.push(duration)
    return `${icon} ${theme.fg("dim", name)} ${theme.fg("dim", a.description.slice(0, 30))} ${theme.fg("dim", "·")} ${theme.fg("dim", parts.join(" · "))}${statusText}`
  }

  private renderWidget(tui: any, theme: Theme): string[] {
    const allAgents = this.manager.listAgents()
    const running = allAgents.filter(a => a.status === "running")
    const queued = allAgents.filter(a => a.status === "queued")
    const finished = allAgents.filter(a =>
      a.status !== "running" && a.status !== "queued" && a.completedAt
      && this.shouldShowFinished(a.id, a.status),
    )

    const hasActive = running.length > 0 || queued.length > 0
    const hasFinished = finished.length > 0
    if (!hasActive && !hasFinished) return []

    const w = tui.terminal.columns
    const truncate = (line: string) => truncateToWidth(line, w)
    const headingColor = hasActive ? "accent" : "dim"
    const headingIcon = hasActive ? "●" : "○"
    const frame = SPINNER[this.widgetFrame % SPINNER.length]

    const finishedLines: string[] = []
    for (const a of finished) {
      finishedLines.push(truncate(theme.fg("dim", "├─") + " " + this.renderFinishedLine(a, theme)))
    }

    const runningLines: string[][] = []
    for (const a of running) {
      const name = a.type
      const elapsed = formatDuration(a.startedAt)
      const bg = this.agentActivity.get(a.id)
      const toolUses = bg?.toolUses ?? a.toolUses
      const tokens = getLifetimeTotal(bg?.lifetimeUsage)
      const contextPercent = getSessionContextPercent(bg?.session)
      const tokenText = tokens > 0 ? formatSessionTokens(tokens, contextPercent, theme, a.compactionCount) : ""
      const parts: string[] = []
      if (bg) parts.push(formatTurns(bg.turnCount, bg.maxTurns))
      if (toolUses > 0) parts.push(`${toolUses} tool use${toolUses === 1 ? "" : "s"}`)
      if (tokenText) parts.push(tokenText)
      parts.push(elapsed)
      const statsText = parts.join(" · ")
      const activity = bg ? describeActivity(bg.activeTools, bg.responseText) : "thinking…"

      runningLines.push([
        truncate(theme.fg("dim", "├─") + ` ${theme.fg("accent", frame)} ${theme.bold(name)} ${theme.fg("muted", a.description.slice(0, 30))} ${theme.fg("dim", "·")} ${theme.fg("dim", statsText)}`),
        truncate(theme.fg("dim", "│ ") + theme.fg("dim", ` ⎿ ${activity}`)),
      ])
    }

    const queuedLine = queued.length > 0
      ? truncate(theme.fg("dim", "├─") + ` ${theme.fg("muted", "◦")} ${theme.fg("dim", `${queued.length} queued`)}`)
      : undefined

    const maxBody = MAX_WIDGET_LINES - 1
    const totalBody = finishedLines.length + runningLines.length * 2 + (queuedLine ? 1 : 0)
    const lines: string[] = [truncate(theme.fg(headingColor, headingIcon) + " " + theme.fg(headingColor, "Agents"))]

    if (totalBody <= maxBody) {
      lines.push(...finishedLines)
      for (const pair of runningLines) lines.push(...pair)
      if (queuedLine) lines.push(queuedLine)

      if (lines.length > 1) {
        const last = lines.length - 1
        lines[last] = lines[last].replace("├─", "└─")
        if (runningLines.length > 0 && !queuedLine) {
          if (last >= 2) {
            lines[last - 1] = lines[last - 1].replace("├─", "└─")
            lines[last] = lines[last].replace("│ ", "  ")
          }
        }
      }
    } else {
      let budget = maxBody - 1
      let hiddenRunning = 0
      let hiddenFinished = 0

      for (const pair of runningLines) {
        if (budget >= 2) {
          lines.push(...pair)
          budget -= 2
        } else {
          hiddenRunning++
        }
      }
      if (queuedLine && budget >= 1) {
        lines.push(queuedLine)
        budget--
      }
      for (const fl of finishedLines) {
        if (budget >= 1) {
          lines.push(fl)
          budget--
        } else {
          hiddenFinished++
        }
      }
      const overflowParts: string[] = []
      if (hiddenRunning > 0) overflowParts.push(`${hiddenRunning} running`)
      if (hiddenFinished > 0) overflowParts.push(`${hiddenFinished} finished`)
      const overflowText = overflowParts.join(", ")
      lines.push(truncate(theme.fg("dim", "└─") + ` ${theme.fg("dim", `+${hiddenRunning + hiddenFinished} more (${overflowText})`)}`))
    }

    return lines
  }

  update() {
    if (!this.uiCtx) return
    const allAgents = this.manager.listAgents()

    let runningCount = 0
    let queuedCount = 0
    let hasFinished = false
    for (const a of allAgents) {
      if (a.status === "running") { runningCount++ }
      else if (a.status === "queued") { queuedCount++ }
      else if (a.completedAt && this.shouldShowFinished(a.id, a.status)) { hasFinished = true }
    }
    const hasActive = runningCount > 0 || queuedCount > 0

    if (!hasActive && !hasFinished) {
      if (this.widgetRegistered) {
        this.uiCtx.setWidget("agents", undefined)
        this.widgetRegistered = false
        this.tui = undefined
      }
      if (this.widgetInterval) { clearInterval(this.widgetInterval); this.widgetInterval = undefined }
      for (const [id] of this.finishedTurnAge) {
        if (!allAgents.some(a => a.id === id)) this.finishedTurnAge.delete(id)
      }
      return
    }

    this.widgetFrame++

    if (!this.widgetRegistered) {
      this.uiCtx.setWidget("agents", (tui, theme) => {
        this.tui = tui
        return {
          render: () => this.renderWidget(tui, theme),
          invalidate: () => {
            this.widgetRegistered = false
            this.tui = undefined
          },
        }
      }, { placement: "aboveEditor" })
      this.widgetRegistered = true
    } else {
      this.tui?.requestRender()
    }
  }

  dispose() {
    if (this.widgetInterval) {
      clearInterval(this.widgetInterval)
      this.widgetInterval = undefined
    }
    if (this.uiCtx) {
      this.uiCtx.setWidget("agents", undefined)
    }
    this.widgetRegistered = false
    this.tui = undefined
  }
}

export function createActivityTracker(
  widget: AgentWidget,
  agentActivity: Map<string, AgentActivity>,
  record: AgentRecord,
) {
  const activity: AgentActivity = {
    activeTools: new Map(),
    toolUses: 0,
    responseText: "",
    turnCount: 0,
    lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 },
  }
  agentActivity.set(record.id, activity)

  return {
    onToolActivity: (act: ToolActivity) => {
      if (act.type === "start") {
        const label = extractToolLabel(act.toolName, act.args)
        activity.activeTools.set(act.toolCallId ?? act.toolName, { name: act.toolName, label })
      } else {
        if (act.toolCallId) {
          activity.activeTools.delete(act.toolCallId)
        } else {
          for (const [k, v] of activity.activeTools) {
            if (v.name === act.toolName) { activity.activeTools.delete(k); break }
          }
        }
        activity.toolUses++
      }
    },
    onTurnEnd: (turnCount: number) => {
      activity.turnCount = turnCount
    },
    onTextDelta: (_delta: string, fullText: string) => {
      activity.responseText = fullText.slice(-200)
    },
    onAssistantUsage: (usage: { input: number; output: number; cacheWrite: number }) => {
      activity.lifetimeUsage.input += usage.input
      activity.lifetimeUsage.output += usage.output
      activity.lifetimeUsage.cacheWrite += usage.cacheWrite
    },
    onSessionCreated: () => {
      activity.session = record.session as any
    },
  }
}
