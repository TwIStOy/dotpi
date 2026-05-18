import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import type { AgentManager } from "../agent-manager.js"
import { getAvailableTypes, getAgentConfig } from "../agent-types.js"
import { formatDuration, formatTokens } from "../formatting.js"
import { getLifetimeTotal } from "../usage.js"
import type { AgentRecord } from "../types.js"

function formatAgentStatus(record: AgentRecord): string {
  const duration = formatDuration(record.startedAt, record.completedAt)
  const tokens = getLifetimeTotal(record.lifetimeUsage)
  const tokenStr = tokens > 0 ? ` | ${formatTokens(tokens)}` : ""
  return `${record.status} | ${record.toolUses} tools | ${duration}${tokenStr}`
}

async function showRunningAgents(ctx: ExtensionCommandContext, manager: AgentManager): Promise<void> {
  const agents = manager.listAgents()
  const running = agents.filter(a => a.status === "running" || a.status === "queued")
  const recent = agents.filter(a => a.status !== "running" && a.status !== "queued").slice(0, 10)

  if (running.length === 0 && recent.length === 0) {
    ctx.ui.notify("No agents found.", "info")
    return
  }

  const options: string[] = []

  if (running.length > 0) {
    for (const record of running) {
      const desc = record.description.slice(0, 40)
      options.push(`● ${record.type} (${record.id.slice(0, 8)}) ${desc}`)
    }
  }

  if (recent.length > 0) {
    for (const record of recent) {
      const icon = record.status === "completed" ? "✓" : record.status === "error" ? "✗" : "○"
      const desc = record.description.slice(0, 40)
      options.push(`${icon} ${record.type} (${record.id.slice(0, 8)}) ${desc} [${record.status}]`)
    }
  }

  const choice = await ctx.ui.select("Agents — Running & Recent", options)
  if (!choice) return

  const idx = options.indexOf(choice)
  const allRecords = [...running, ...recent]
  const record = allRecords[idx]
  if (!record) return

  await showAgentDetail(ctx, manager, record)
}

async function showAgentDetail(ctx: ExtensionCommandContext, manager: AgentManager, record: AgentRecord): Promise<void> {
  const lines: string[] = [
    `Agent: ${record.id}`,
    `Type: ${record.type}`,
    `Description: ${record.description}`,
    `Status: ${formatAgentStatus(record)}`,
    `Started: ${new Date(record.startedAt).toISOString()}`,
  ]
  if (record.completedAt) {
    lines.push(`Completed: ${new Date(record.completedAt).toISOString()}`)
  }
  if (record.invocation?.modelName) {
    lines.push(`Model: ${record.invocation.modelName}`)
  }
  if (record.outputFile) {
    lines.push(`Output: ${record.outputFile}`)
  }

  const actions: string[] = []
  if (record.status === "running") {
    actions.push("Abort")
    actions.push("View conversation")
  }
  if (record.status === "completed" && record.result) {
    actions.push("View result")
  }
  if (record.status === "error") {
    actions.push("View error")
  }
  actions.push("Back")

  const info = lines.join("\n")
  const choice = await ctx.ui.select(info, actions)
  if (!choice || choice === "Back") return

  if (choice === "Abort") {
    manager.abort(record.id)
    ctx.ui.notify(`Agent ${record.id.slice(0, 8)} aborted.`, "info")
  } else if (choice === "View result") {
    ctx.ui.notify(record.result?.slice(0, 500) || "No output.", "info")
  } else if (choice === "View error") {
    ctx.ui.notify(record.error || "Unknown error.", "error")
  }
}

async function showAgentTypes(ctx: ExtensionCommandContext): Promise<void> {
  const types = getAvailableTypes()
  if (types.length === 0) {
    ctx.ui.notify("No agent types available.", "info")
    return
  }

  const options: string[] = []
  for (const name of types) {
    const config = getAgentConfig(name)
    if (!config) continue
    const source = config.source === "default" ? "[default]" : config.source === "project" ? "[project]" : config.source === "global" ? "[global]" : ""
    const desc = config.trigger ?? config.description.slice(0, 60)
    options.push(`${name.padEnd(20)} ${source.padEnd(12)} ${desc}`)
  }

  await ctx.ui.select("Agent Types", options)
}

async function showSettings(ctx: ExtensionCommandContext, manager: AgentManager): Promise<void> {
  const options = [
    `Max concurrent: ${manager.getMaxConcurrent()}`,
    "Back",
  ]

  const choice = await ctx.ui.select("Subagent Settings", options)
  if (!choice || choice === "Back") return

  if (choice.startsWith("Max concurrent")) {
    const input = await ctx.ui.input("Max concurrent agents (1-16):", String(manager.getMaxConcurrent()))
    if (input) {
      const n = parseInt(input, 10)
      if (n >= 1 && n <= 16) {
        manager.setMaxConcurrent(n)
        ctx.ui.notify(`Max concurrent set to ${n}.`, "info")
      } else {
        ctx.ui.notify("Invalid value. Must be 1-16.", "error")
      }
    }
  }
}

export function registerAgentsCommand(
  pi: ExtensionAPI,
  manager: AgentManager,
): void {
  pi.registerCommand("agents", {
    description: "Manage subagents — view running agents, types, and settings",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) return

      const sections = [
        "Running & Recent Agents",
        "Agent Types",
        "Settings",
        "Cancel",
      ]

      const choice = await ctx.ui.select("Subagents", sections)
      if (!choice) return

      if (choice === "Running & Recent Agents") {
        await showRunningAgents(ctx, manager)
      } else if (choice === "Agent Types") {
        await showAgentTypes(ctx)
      } else if (choice === "Settings") {
        await showSettings(ctx, manager)
      }
    },
  })
}
