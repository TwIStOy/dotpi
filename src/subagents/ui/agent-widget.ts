import type { Component, TUI } from "@earendil-works/pi-tui"
import { truncateToWidth } from "@earendil-works/pi-tui"
import type { AgentRecord } from "../types.js"
import { formatDuration, formatTokens, formatTurns } from "../formatting.js"
import { getLifetimeTotal, getSessionContextPercent } from "../usage.js"
import type { ToolActivity } from "../agent-runner.js"

export interface AgentActivity {
  activeTool: string | null
  activeToolCount: number
  turnCount: number
  maxTurns?: number
  responseText: string
  lastActivityAt: number
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

type ThemeLike = {
  fg(color: string, text: string): string
  bold(text: string): string
}

const TOOL_VERBS: Record<string, string> = {
  read: "reading",
  bash: "running command",
  edit: "editing",
  write: "writing",
  grep: "searching",
  find: "finding",
  ls: "listing",
}

function describeActivity(activity: AgentActivity | undefined): string {
  if (!activity) return "thinking…"
  if (activity.activeTool) {
    const verb = TOOL_VERBS[activity.activeTool] ?? activity.activeTool
    const count = activity.activeToolCount > 1 ? ` ${activity.activeToolCount} files` : ""
    return `${verb}${count}…`
  }
  const text = activity.responseText?.trim()
  if (text && text.length > 0) {
    const preview = text.length > 60 ? text.slice(0, 60) + "…" : text
    return preview
  }
  return "thinking…"
}

export class AgentWidget implements Component {
  private activities = new Map<string, AgentActivity>()
  private records = new Map<string, AgentRecord>()
  private frameIndex = 0
  private intervalId: ReturnType<typeof setInterval> | undefined
  private invalidated = false
  private ui: TUI | undefined
  private theme: ThemeLike | undefined
  private maxVisible: number

  constructor(maxVisible = 4) {
    this.maxVisible = maxVisible
  }

  bindTui(ui: TUI, theme: ThemeLike): void {
    this.ui = ui
    this.theme = theme
    this.intervalId = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER_FRAMES.length
      this.invalidated = true
      this.ui?.requestRender()
    }, 100)
  }

  updateAgent(record: AgentRecord): void {
    this.records.set(record.id, record)
    if (record.status !== "running" && record.status !== "queued") {
      this.activities.delete(record.id)
    }
    this.invalidated = true
    this.ui?.requestRender()
  }

  updateActivity(agentId: string, activity: Partial<AgentActivity>): void {
    const existing = this.activities.get(agentId) ?? {
      activeTool: null,
      activeToolCount: 0,
      turnCount: 0,
      responseText: "",
      lastActivityAt: Date.now(),
    }
    if (activity.activeTool && activity.activeTool === existing.activeTool) {
      activity.activeToolCount = existing.activeToolCount + 1
    } else if (activity.activeTool) {
      activity.activeToolCount = 1
    }
    Object.assign(existing, activity, { lastActivityAt: Date.now() })
    this.activities.set(agentId, existing)
    this.invalidated = true
    this.ui?.requestRender()
  }

  removeAgent(agentId: string): void {
    this.records.delete(agentId)
    this.activities.delete(agentId)
    this.invalidated = true
    this.ui?.requestRender()
  }

  invalidate(): void {
    this.invalidated = true
  }

  render(width: number): string[] {
    const allRecords = [...this.records.values()]
    const running = allRecords.filter(r => r.status === "running")
    const queued = allRecords.filter(r => r.status === "queued")
    const finished = allRecords.filter(
      r => r.status !== "running" && r.status !== "queued",
    ).slice(0, 3)

    if (running.length === 0 && queued.length === 0 && finished.length === 0) return []

    const t = this.theme
    const lines: string[] = []
    const frame = SPINNER_FRAMES[this.frameIndex]
    const hasActive = running.length > 0

    if (t) {
      const headingColor = hasActive ? "accent" : "dim"
      const headingIcon = hasActive ? "●" : "○"
      lines.push(truncateToWidth(t.fg(headingColor, headingIcon) + " " + t.fg(headingColor, "Agents"), width))
    } else {
      const headingIcon = hasActive ? "●" : "○"
      lines.push(truncateToWidth(`${headingIcon} Agents`, width))
    }

    const entries: Array<{ type: "running" | "queued" | "finished"; record: AgentRecord }> = [
      ...running.map(r => ({ type: "running" as const, record: r })),
      ...queued.map(r => ({ type: "queued" as const, record: r })),
      ...finished.map(r => ({ type: "finished" as const, record: r })),
    ]

    const visible = entries.slice(0, this.maxVisible)
    const hidden = entries.length - visible.length

    for (let i = 0; i < visible.length; i++) {
      const isLast = i === visible.length - 1 && hidden === 0
      const connector = isLast ? "└─" : "├─"
      const { type, record } = visible[i]

      if (type === "running") {
        lines.push(...this.renderRunningLine(record, frame, connector, width))
      } else if (type === "queued") {
        lines.push(this.renderQueuedLine(connector, width))
      } else {
        lines.push(this.renderFinishedLine(record, connector, width))
      }
    }

    if (hidden > 0) {
      const hiddenRunning = entries.slice(this.maxVisible).filter(e => e.type === "running").length
      const hiddenFinished = entries.slice(this.maxVisible).filter(e => e.type === "finished").length
      const parts: string[] = []
      if (hiddenRunning > 0) parts.push(`${hiddenRunning} running`)
      if (hiddenFinished > 0) parts.push(`${hiddenFinished} finished`)
      const overflowText = parts.join(", ")
      if (t) {
        lines.push(truncateToWidth(t.fg("dim", "└─") + " " + t.fg("dim", `+${hidden} more (${overflowText})`), width))
      } else {
        lines.push(truncateToWidth(`└─ +${hidden} more (${overflowText})`, width))
      }
    }

    return lines
  }

  private renderRunningLine(record: AgentRecord, frame: string, connector: string, width: number): string[] {
    const t = this.theme
    const activity = this.activities.get(record.id)
    const name = record.type
    const desc = record.description.slice(0, 30)

    const statsParts: string[] = []
    if (activity) {
      statsParts.push(formatTurns(activity.turnCount, record.invocation?.maxTurns))
    }
    statsParts.push(`${record.toolUses} tool ${record.toolUses === 1 ? "use" : "uses"}`)
    const tokens = getLifetimeTotal(record.lifetimeUsage)
    if (tokens > 0) {
      const contextPct = getSessionContextPercent(record.session)
      const tokenStr = formatTokens(tokens)
      const ctxStr = contextPct !== null ? ` (${Math.round(contextPct)}%)` : ""
      statsParts.push(`${tokenStr}${ctxStr}`)
    }
    statsParts.push(formatDuration(record.startedAt))
    const statsText = statsParts.join(" · ")

    const actText = describeActivity(activity)

    if (t) {
      const line1 = truncateToWidth(
        t.fg("dim", connector) + " " +
        t.fg("accent", frame) + " " +
        t.bold(name) + "  " +
        t.fg("muted", desc) + " " +
        t.fg("dim", "·") + " " +
        t.fg("dim", statsText),
        width,
      )
      const line2 = truncateToWidth(
        t.fg("dim", "│  ") + t.fg("dim", `  ⎿  ${actText}`),
        width,
      )
      return [line1, line2]
    }

    const line1 = truncateToWidth(`${connector} ${frame} ${name}  ${desc} · ${statsText}`, width)
    const line2 = truncateToWidth(`│    ⎿  ${actText}`, width)
    return [line1, line2]
  }

  private renderQueuedLine(connector: string, width: number): string {
    const t = this.theme
    if (t) {
      return truncateToWidth(t.fg("dim", connector) + " " + t.fg("muted", "◦") + " " + t.fg("dim", "queued"), width)
    }
    return truncateToWidth(`${connector} ◦ queued`, width)
  }

  private renderFinishedLine(record: AgentRecord, connector: string, width: number): string {
    const t = this.theme
    const name = record.type
    const desc = record.description.slice(0, 30)

    const icon = record.status === "completed" ? "✓" : record.status === "error" ? "✗" : "■"
    const statsParts: string[] = []
    const activity = this.activities.get(record.id)
    if (activity) {
      statsParts.push(formatTurns(activity.turnCount))
    }
    statsParts.push(`${record.toolUses} tool ${record.toolUses === 1 ? "use" : "uses"}`)
    const tokens = getLifetimeTotal(record.lifetimeUsage)
    if (tokens > 0) statsParts.push(formatTokens(tokens))
    statsParts.push(formatDuration(record.startedAt, record.completedAt))
    const statsText = statsParts.join(" · ")

    if (t) {
      const iconColored = record.status === "completed"
        ? t.fg("success", icon)
        : record.status === "error"
          ? t.fg("error", icon)
          : t.fg("dim", icon)
      const line = truncateToWidth(
        t.fg("dim", connector) + " " +
        iconColored + " " +
        t.fg("dim", name) + "  " +
        t.fg("dim", desc) + " " +
        t.fg("dim", "·") + " " +
        t.fg("dim", statsText),
        width,
      )
      return line
    }

    return truncateToWidth(`${connector} ${icon} ${name}  ${desc} · ${statsText}`, width)
  }

  dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }
  }
}

export function createWidgetUpdater(widget: AgentWidget, record: AgentRecord) {
  return {
    onToolActivity: (activity: ToolActivity) => {
      widget.updateActivity(record.id, {
        activeTool: activity.type === "start" ? activity.toolName : null,
        activeToolCount: activity.type === "start" ? 1 : 0,
      })
    },
    onTurnEnd: (turnCount: number) => {
      widget.updateActivity(record.id, { turnCount })
    },
    onTextDelta: (_delta: string, fullText: string) => {
      widget.updateActivity(record.id, { responseText: fullText.slice(-200) })
    },
  }
}
