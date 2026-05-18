import type { Model, Api } from "@earendil-works/pi-ai"
import type {
  AgentSession,
  AgentSessionEvent,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent"
import {
  getAgentConfig,
  getConfig,
  getMemoryToolNames,
  getReadOnlyMemoryToolNames,
  getToolNamesForType,
} from "./agent-types.js"
import { buildParentContext, extractText } from "./context.js"
import { DEFAULT_AGENTS } from "./default-agents.js"
import { detectEnv } from "./env.js"
import { buildMemoryBlock, buildReadOnlyMemoryBlock } from "./memory.js"
import { buildAgentPrompt, type PromptExtras } from "./prompts.js"
import { preloadSkills } from "./skill-loader.js"
import type { SubagentType, ThinkingLevel } from "./types.js"

const EXCLUDED_TOOL_NAMES = ["Agent", "get_subagent_result", "steer_subagent"]

let defaultMaxTurns: number | undefined

export function normalizeMaxTurns(n: number | undefined): number | undefined {
  if (n == null || n === 0) return undefined
  return Math.max(1, n)
}

export function getDefaultMaxTurns(): number | undefined {
  return defaultMaxTurns
}
export function setDefaultMaxTurns(n: number | undefined): void {
  defaultMaxTurns = normalizeMaxTurns(n)
}

let graceTurns = 5

export function getGraceTurns(): number {
  return graceTurns
}
export function setGraceTurns(n: number): void {
  graceTurns = Math.max(1, n)
}

export interface ToolActivity {
  type: "start" | "end"
  toolName: string
}

export interface RunOptions {
  pi: ExtensionAPI
  agentId?: string
  model?: Model<Api>
  maxTurns?: number
  signal?: AbortSignal
  isolated?: boolean
  inheritContext?: boolean
  thinkingLevel?: ThinkingLevel
  cwd?: string
  onToolActivity?: (activity: ToolActivity) => void
  onTextDelta?: (delta: string, fullText: string) => void
  onSessionCreated?: (session: AgentSession) => void
  onTurnEnd?: (turnCount: number) => void
  onAssistantUsage?: (usage: { input: number; output: number; cacheWrite: number }) => void
  onCompaction?: (info: { reason: "manual" | "threshold" | "overflow"; tokensBefore: number }) => void
}

export interface RunResult {
  responseText: string
  session: AgentSession
  aborted: boolean
  steered: boolean
}

function collectResponseText(session: AgentSession) {
  let text = ""
  const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "message_start") {
      text = ""
    }
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      text += event.assistantMessageEvent.delta
    }
  })
  return { getText: () => text, unsubscribe }
}

function getLastAssistantText(session: AgentSession): string {
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i]
    if (msg.role !== "assistant") continue
    const text = extractText(msg.content).trim()
    if (text) return text
  }
  return ""
}

function forwardAbortSignal(session: AgentSession, signal?: AbortSignal): () => void {
  if (!signal) return () => {}
  const onAbort = () => session.abort()
  signal.addEventListener("abort", onAbort, { once: true })
  return () => signal.removeEventListener("abort", onAbort)
}

export async function runAgent(
  ctx: ExtensionContext,
  type: SubagentType,
  prompt: string,
  options: RunOptions,
): Promise<RunResult> {
  const config = getConfig(type)
  const agentConfig = getAgentConfig(type)

  const effectiveCwd = options.cwd ?? ctx.cwd
  const env = await detectEnv(options.pi, effectiveCwd)
  const parentSystemPrompt = ctx.getSystemPrompt()

  const extras: PromptExtras = {}
  const extensions = options.isolated ? false : config.extensions
  const skills = options.isolated ? false : config.skills

  if (Array.isArray(skills)) {
    const loaded = preloadSkills(skills, effectiveCwd)
    if (loaded.length > 0) {
      extras.skillBlocks = loaded
    }
  }

  let toolNames = getToolNamesForType(type)

  if (agentConfig?.memory) {
    const existingNames = new Set(toolNames)
    const denied = agentConfig.disallowedTools ? new Set(agentConfig.disallowedTools) : undefined
    const effectivelyHas = (name: string) => existingNames.has(name) && !denied?.has(name)
    const hasWriteTools = effectivelyHas("write") || effectivelyHas("edit")

    if (hasWriteTools) {
      const extraNames = getMemoryToolNames(existingNames)
      if (extraNames.length > 0) toolNames = [...toolNames, ...extraNames]
      extras.memoryBlock = buildMemoryBlock(agentConfig.name, agentConfig.memory, effectiveCwd)
    } else {
      const extraNames = getReadOnlyMemoryToolNames(existingNames)
      if (extraNames.length > 0) toolNames = [...toolNames, ...extraNames]
      extras.memoryBlock = buildReadOnlyMemoryBlock(agentConfig.name, agentConfig.memory, effectiveCwd)
    }
  }

  let systemPrompt: string
  if (agentConfig) {
    systemPrompt = buildAgentPrompt(agentConfig, effectiveCwd, env, parentSystemPrompt, extras)
  } else {
    const fallback = DEFAULT_AGENTS.get("general-purpose")
    if (!fallback) throw new Error(`No fallback config available for unknown type "${type}"`)
    systemPrompt = buildAgentPrompt({ ...fallback, name: type }, effectiveCwd, env, parentSystemPrompt, extras)
  }

  const noSkills = skills === false || Array.isArray(skills)
  const agentDir = getAgentDir()

  const loader = new DefaultResourceLoader({
    cwd: effectiveCwd,
    agentDir,
    noExtensions: extensions === false,
    noSkills,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPromptOverride: () => systemPrompt,
    appendSystemPromptOverride: () => [],
  })
  await loader.reload()

  const model = options.model

  const sessionOpts: Parameters<typeof createAgentSession>[0] = {
    cwd: effectiveCwd,
    agentDir,
    sessionManager: SessionManager.inMemory(effectiveCwd),
    settingsManager: SettingsManager.create(effectiveCwd, agentDir),
    modelRegistry: ctx.modelRegistry,
    model,
    tools: toolNames,
    resourceLoader: loader,
  }
  if (options.thinkingLevel ?? agentConfig?.thinking) {
    sessionOpts.thinkingLevel = options.thinkingLevel ?? agentConfig?.thinking
  }

  const { session } = await createAgentSession(sessionOpts)

  const baseSessionName = agentConfig?.name ?? type
  session.setSessionName(
    options.agentId ? `${baseSessionName}#${options.agentId.slice(0, 8)}` : baseSessionName,
  )

  const disallowedSet = agentConfig?.disallowedTools
    ? new Set(agentConfig.disallowedTools)
    : undefined

  if (extensions !== false) {
    const builtinToolNameSet = new Set(toolNames)
    const activeTools = session.getActiveToolNames().filter(t => {
      if (EXCLUDED_TOOL_NAMES.includes(t)) return false
      if (disallowedSet?.has(t)) return false
      if (builtinToolNameSet.has(t)) return true
      if (Array.isArray(extensions)) {
        return extensions.some(ext => t.startsWith(ext) || t.includes(ext))
      }
      return true
    })
    session.setActiveToolsByName(activeTools)
  } else if (disallowedSet) {
    const activeTools = session.getActiveToolNames().filter(t => !disallowedSet.has(t))
    session.setActiveToolsByName(activeTools)
  }

  await session.bindExtensions({
    onError: err => {
      options.onToolActivity?.({
        type: "end",
        toolName: `extension-error:${err.extensionPath}`,
      })
    },
  })

  options.onSessionCreated?.(session)

  let turnCount = 0
  const maxTurns = normalizeMaxTurns(options.maxTurns ?? agentConfig?.maxTurns ?? defaultMaxTurns)
  let softLimitReached = false
  let aborted = false

  let currentMessageText = ""
  const unsubTurns = session.subscribe((event: AgentSessionEvent) => {
    if (event.type === "turn_end") {
      turnCount++
      options.onTurnEnd?.(turnCount)
      if (maxTurns != null) {
        if (!softLimitReached && turnCount >= maxTurns) {
          softLimitReached = true
          session.steer("You have reached your turn limit. Wrap up immediately — provide your final answer now.")
        } else if (softLimitReached && turnCount >= maxTurns + graceTurns) {
          aborted = true
          session.abort()
        }
      }
    }
    if (event.type === "message_start") {
      currentMessageText = ""
    }
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      currentMessageText += event.assistantMessageEvent.delta
      options.onTextDelta?.(event.assistantMessageEvent.delta, currentMessageText)
    }
    if (event.type === "tool_execution_start") {
      options.onToolActivity?.({ type: "start", toolName: event.toolName })
    }
    if (event.type === "tool_execution_end") {
      options.onToolActivity?.({ type: "end", toolName: event.toolName })
    }
    if (event.type === "message_end" && event.message.role === "assistant") {
      const u = (event.message as any).usage
      if (u) options.onAssistantUsage?.({ input: u.input ?? 0, output: u.output ?? 0, cacheWrite: u.cacheWrite ?? 0 })
    }
    if (event.type === "compaction_end" && !event.aborted && event.result) {
      options.onCompaction?.({ reason: event.reason, tokensBefore: event.result.tokensBefore })
    }
  })

  const collector = collectResponseText(session)
  const cleanupAbort = forwardAbortSignal(session, options.signal)

  let effectivePrompt = prompt
  if (options.inheritContext) {
    const parentContext = buildParentContext(ctx)
    if (parentContext) {
      effectivePrompt = parentContext + prompt
    }
  }

  try {
    await session.prompt(effectivePrompt)
  } finally {
    unsubTurns()
    collector.unsubscribe()
    cleanupAbort()
  }

  const responseText = collector.getText().trim() || getLastAssistantText(session)
  return { responseText, session, aborted, steered: softLimitReached }
}

export async function resumeAgent(
  session: AgentSession,
  prompt: string,
  options: {
    onToolActivity?: (activity: ToolActivity) => void
    onAssistantUsage?: (usage: { input: number; output: number; cacheWrite: number }) => void
    onCompaction?: (info: { reason: "manual" | "threshold" | "overflow"; tokensBefore: number }) => void
    signal?: AbortSignal
  } = {},
): Promise<string> {
  const collector = collectResponseText(session)
  const cleanupAbort = forwardAbortSignal(session, options.signal)

  const unsubEvents =
    options.onToolActivity || options.onAssistantUsage || options.onCompaction
      ? session.subscribe((event: AgentSessionEvent) => {
          if (event.type === "tool_execution_start")
            options.onToolActivity?.({ type: "start", toolName: event.toolName })
          if (event.type === "tool_execution_end")
            options.onToolActivity?.({ type: "end", toolName: event.toolName })
          if (event.type === "message_end" && event.message.role === "assistant") {
            const u = (event.message as any).usage
            if (u)
              options.onAssistantUsage?.({
                input: u.input ?? 0,
                output: u.output ?? 0,
                cacheWrite: u.cacheWrite ?? 0,
              })
          }
          if (event.type === "compaction_end" && !event.aborted && event.result) {
            options.onCompaction?.({ reason: event.reason, tokensBefore: event.result.tokensBefore })
          }
        })
      : () => {}

  try {
    await session.prompt(prompt)
  } finally {
    collector.unsubscribe()
    unsubEvents()
    cleanupAbort()
  }

  return collector.getText().trim() || getLastAssistantText(session)
}

export async function steerAgent(session: AgentSession, message: string): Promise<void> {
  await session.steer(message)
}

export function getAgentConversation(session: AgentSession): string {
  const parts: string[] = []

  for (const msg of session.messages) {
    if (msg.role === "user") {
      const text = typeof msg.content === "string" ? msg.content : extractText(msg.content)
      if (text.trim()) parts.push(`[User]: ${text.trim()}`)
    } else if (msg.role === "assistant") {
      const textParts: string[] = []
      const toolCalls: string[] = []
      for (const c of msg.content) {
        if (c.type === "text" && c.text) textParts.push(c.text)
        else if (c.type === "toolCall")
          toolCalls.push(`  Tool: ${(c as any).name ?? (c as any).toolName ?? "unknown"}`)
      }
      if (textParts.length > 0) parts.push(`[Assistant]: ${textParts.join("\n")}`)
      if (toolCalls.length > 0) parts.push(`[Tool Calls]:\n${toolCalls.join("\n")}`)
    } else if (msg.role === "toolResult") {
      const text = extractText(msg.content)
      const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text
      parts.push(`[Tool Result (${msg.toolName})]: ${truncated}`)
    }
  }

  return parts.join("\n\n")
}
