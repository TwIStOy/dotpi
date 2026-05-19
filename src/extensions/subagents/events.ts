import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import type { AgentRecord } from "./types.js"
import { getLifetimeTotal } from "./usage.js"

export function emitAgentCreated(pi: ExtensionAPI, record: AgentRecord): void {
  pi.events.emit("subagents:created", {
    id: record.id,
    type: record.type,
    description: record.description,
  })
}

export function emitAgentStarted(pi: ExtensionAPI, record: AgentRecord): void {
  pi.events.emit("subagents:started", {
    id: record.id,
    type: record.type,
    description: record.description,
  })
}

export function emitAgentCompleted(pi: ExtensionAPI, record: AgentRecord): void {
  pi.events.emit("subagents:completed", {
    id: record.id,
    type: record.type,
    description: record.description,
    status: record.status,
    tokens: getLifetimeTotal(record.lifetimeUsage),
    toolUses: record.toolUses,
    duration: record.completedAt ? record.completedAt - record.startedAt : 0,
  })
}

export function emitAgentFailed(pi: ExtensionAPI, record: AgentRecord): void {
  pi.events.emit("subagents:failed", {
    id: record.id,
    type: record.type,
    description: record.description,
    error: record.error,
  })
}

export function emitAgentSteered(pi: ExtensionAPI, id: string, message: string): void {
  pi.events.emit("subagents:steered", { id, message })
}

export function emitAgentCompacted(pi: ExtensionAPI, record: AgentRecord, info: { reason: string; tokensBefore: number }): void {
  pi.events.emit("subagents:compacted", {
    id: record.id,
    type: record.type,
    reason: info.reason,
    tokensBefore: info.tokensBefore,
  })
}

export function emitReady(pi: ExtensionAPI): void {
  pi.events.emit("subagents:ready", {
    version: "0.1.0",
    maxConcurrent: 4,
  })
}
