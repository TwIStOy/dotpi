import type { ThinkingLevel } from "@earendil-works/pi-agent-core"
import type { AgentSession } from "@earendil-works/pi-coding-agent"

export type { ThinkingLevel }

export type SubagentType = string

export const DEFAULT_AGENT_NAMES = ["general-purpose", "Explore", "Plan"] as const

export type MemoryScope = "user" | "project" | "local"

export type IsolationMode = "worktree"

export interface AgentConfig {
  name: string
  displayName?: string
  description: string
  trigger?: string
  builtinToolNames?: string[]
  disallowedTools?: string[]
  extensions: true | string[] | false
  skills: true | string[] | false
  model?: string
  thinking?: ThinkingLevel
  maxTurns?: number
  systemPrompt: string
  promptMode: "replace" | "append"
  inheritContext?: boolean
  runInBackground?: boolean
  isolated?: boolean
  memory?: MemoryScope
  isolation?: IsolationMode
  isDefault?: boolean
  enabled?: boolean
  source?: "default" | "project" | "global"
}

export type JoinMode = "async" | "group" | "smart"

export type LifetimeUsage = { input: number; output: number; cacheWrite: number }

export interface AgentRecord {
  id: string
  type: SubagentType
  description: string
  status: "queued" | "running" | "completed" | "steered" | "aborted" | "stopped" | "error"
  result?: string
  error?: string
  toolUses: number
  startedAt: number
  completedAt?: number
  session?: AgentSession
  abortController?: AbortController
  promise?: Promise<void>
  groupId?: string
  joinMode?: JoinMode
  resultConsumed?: boolean
  pendingSteers?: string[]
  worktree?: { path: string; branch: string }
  worktreeResult?: { hasChanges: boolean; branch?: string }
  toolCallId?: string
  outputFile?: string
  outputCleanup?: () => void
  lifetimeUsage: LifetimeUsage
  compactionCount: number
  invocation?: AgentInvocation
}

export interface AgentInvocation {
  modelName?: string
  thinking?: ThinkingLevel
  maxTurns?: number
  isolated?: boolean
  inheritContext?: boolean
  runInBackground?: boolean
  isolation?: IsolationMode
}

export interface EnvInfo {
  isGitRepo: boolean
  branch: string
  platform: string
}
