import type { ExtensionAPI, MessageRenderer } from "@earendil-works/pi-coding-agent"
import { Text } from "@earendil-works/pi-tui"
import type { AgentRecord } from "../types.js"
import { formatDuration, formatTokens } from "../formatting.js"
import { getLifetimeTotal, getSessionContextPercent } from "../usage.js"

export interface NotificationData {
  id: string
  type: string
  description: string
  status: string
  toolUses: number
  tokens: number
  duration: number
  result?: string
  error?: string
  outputFile?: string
  toolCallId?: string
  compactionCount: number
}

export function recordToNotification(record: AgentRecord): NotificationData {
  return {
    id: record.id,
    type: record.type,
    description: record.description,
    status: record.status,
    toolUses: record.toolUses,
    tokens: getLifetimeTotal(record.lifetimeUsage),
    duration: record.completedAt ? record.completedAt - record.startedAt : 0,
    result: record.result,
    error: record.error,
    outputFile: record.outputFile,
    toolCallId: record.toolCallId,
    compactionCount: record.compactionCount,
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function getStatusLabel(status: string, error?: string): string {
  switch (status) {
    case "completed": return "Done"
    case "error": return `Error: ${error ?? "Unknown"}`
    case "aborted": return "Aborted (max turns exceeded)"
    case "steered": return "Wrapped up (turn limit)"
    case "stopped": return "Stopped"
    default: return status
  }
}

export function formatTaskNotification(record: AgentRecord, resultMaxLen = 500): string {
  const status = getStatusLabel(record.status, record.error)
  const totalTokens = getLifetimeTotal(record.lifetimeUsage)
  const durationMs = record.completedAt ? record.completedAt - record.startedAt : 0
  const result = record.result?.trim() ?? "No output."
  const resultPreview = result.length > resultMaxLen ? result.slice(0, resultMaxLen) + "…" : result
  const contextPct = getSessionContextPercent(record.session)

  const parts: string[] = [
    `<task-notification>`,
    `<task-id>${record.id}</task-id>`,
  ]
  if (record.toolCallId) {
    parts.push(`<tool-use-id>${escapeXml(record.toolCallId)}</tool-use-id>`)
  }
  if (record.outputFile) {
    parts.push(`<output-file>${escapeXml(record.outputFile)}</output-file>`)
  }
  parts.push(
    `<status>${escapeXml(status)}</status>`,
    `<summary>Agent "${escapeXml(record.description)}" ${record.status}</summary>`,
    `<result>${escapeXml(resultPreview)}</result>`,
    `<usage><total_tokens>${totalTokens}</total_tokens><tool_uses>${record.toolUses}</tool_uses>`,
  )
  if (contextPct !== null) {
    parts.push(`<context_percent>${Math.round(contextPct)}</context_percent>`)
  }
  parts.push(`<duration_ms>${durationMs}</duration_ms></usage>`)
  parts.push(`</task-notification>`)

  return parts.join("\n")
}

export function registerNotificationRenderer(pi: ExtensionAPI): void {
  const renderer: MessageRenderer<NotificationData> = (
    message: any,
    options,
    theme: any,
  ) => {
    const data = message.details as NotificationData | undefined
    if (!data) return undefined

    const icon = data.status === "completed"
      ? theme.fg("success", "✓")
      : data.status === "error"
        ? theme.fg("error", "✗")
        : theme.fg("dim", "○")

    const duration = formatDuration(0, data.duration)
    const tokenStr = data.tokens > 0 ? ` · ${formatTokens(data.tokens)}` : ""
    const header = `${icon} ${theme.fg("dim", data.type)} ${theme.fg("muted", data.description)} ${theme.fg("dim", "·")} ${theme.fg("dim", `${data.toolUses} tools · ${duration}${tokenStr}`)}`

    const result = data.result?.trim() ?? ""
    if (!result && data.status !== "error") {
      return new Text(header, 0, 0)
    }

    const preview = data.status === "error"
      ? data.error ?? "Unknown error"
      : result.length > 200 ? result.slice(0, 200) + "…" : result

    const output = data.outputFile
      ? `\n${theme.fg("dim", `Transcript: ${data.outputFile}`)}`
      : ""

    return new Text(`${header}\n  ${theme.fg("dim", `⎿  ${preview}`)}${output}`, 0, 0)
  }

  pi.registerMessageRenderer("subagent-notification", renderer)
}
