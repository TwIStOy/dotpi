import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import type { AgentManager } from "../agent-manager.js"
import {
  getAvailableTypes, getAgentConfig, getDefaultAgentNames,
  getUserAgentNames, isValidType, registerAgents,
} from "../agent-types.js"
import { DEFAULT_AGENTS } from "../default-agents.js"
import { formatDuration, formatTokens } from "../formatting.js"
import { getLifetimeTotal } from "../usage.js"
import type { AgentConfig, AgentRecord, ScheduledSubagent } from "../types.js"
import { getAgentFilePath, loadCustomAgents } from "../custom-agents.js"
import type { ScheduleEngine } from "../schedule.js"

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
  const allTypes = [...new Set([...types, ...getDefaultAgentNames(), ...getUserAgentNames()])]
  if (allTypes.length === 0) {
    ctx.ui.notify("No agent types available.", "info")
    return
  }

  const options: string[] = []
  for (const name of allTypes) {
    const config = getAgentConfig(name)
    if (!config) continue
    const src = config.source ?? (config.isDefault ? "default" : "custom")
    const sourceIcon = src === "project" ? "•" : src === "global" ? "◦" : src === "extension" ? "◆" : "·"
    const disabled = config.enabled === false ? " ✕" : ""
    const desc = config.trigger ?? config.description.slice(0, 60)
    options.push(`${sourceIcon} ${name.padEnd(20)}${disabled} ${desc}`)
  }

  const choice = await ctx.ui.select("Agent Types  • project  ◦ global  ◆ extension  · default", options)
  if (!choice) return

  const name = choice.split(/\s+/)[1]
  if (!name) return

  await showAgentTypeDetail(ctx, name)
}

async function showAgentTypeDetail(ctx: ExtensionCommandContext, name: string): Promise<void> {
  const config = getAgentConfig(name)
  if (!config) return

  const info = [
    `Name: ${name}`,
    `Display: ${config.displayName ?? name}`,
    `Description: ${config.description}`,
    `Source: ${config.source ?? "default"}`,
    `Mode: ${config.promptMode}`,
    `Tools: ${config.builtinToolNames?.join(", ") ?? "all"}`,
    `Enabled: ${config.enabled !== false}`,
    `Extensions: ${config.extensions === true ? "inherit" : config.extensions === false ? "none" : config.extensions.join(", ")}`,
    `Model: ${config.model ?? "inherit"}`,
    `Max turns: ${config.maxTurns ?? "unlimited"}`,
  ].join("\n")

  const isDefault = config.isDefault === true
  const hasFile = config.source === "project" || config.source === "global"
  const isDisabled = config.enabled === false

  const actions: string[] = []
  if (isDefault && !hasFile) {
    actions.push("Eject (create .md file for customization)")
  }
  if (hasFile) {
    actions.push("Edit")
    actions.push("Delete .md file")
  }
  if (isDisabled) {
    actions.push("Enable")
  } else {
    actions.push("Disable")
  }
  actions.push("Back")

  const choice = await ctx.ui.select(info, actions)
  if (!choice || choice === "Back") return

  if (choice === "Eject (create .md file for customization)") {
    await ejectAgent(ctx, name, config)
  } else if (choice === "Edit") {
    await editAgent(ctx, name, config)
  } else if (choice === "Delete .md file") {
    await deleteAgent(ctx, name, config)
  } else if (choice === "Enable" || choice === "Disable") {
    await toggleAgent(ctx, name, config, choice === "Disable")
  }
}

function agentConfigToFrontmatter(config: AgentConfig): string {
  const lines: string[] = ["---"]
  if (config.displayName && config.displayName !== config.name) lines.push(`display_name: ${config.displayName}`)
  lines.push(`description: ${config.description}`)
  if (config.builtinToolNames?.length) lines.push(`tools: ${config.builtinToolNames.join(", ")}`)
  if (config.disallowedTools?.length) lines.push(`disallowed_tools: ${config.disallowedTools.join(", ")}`)
  if (config.extensions !== true) lines.push(`extensions: ${config.extensions === false ? "none" : (config.extensions as string[]).join(", ")}`)
  if (config.skills !== true) lines.push(`skills: ${config.skills === false ? "none" : (config.skills as string[]).join(", ")}`)
  if (config.model) lines.push(`model: ${config.model}`)
  if (config.thinking) lines.push(`thinking: ${config.thinking}`)
  if (config.maxTurns != null) lines.push(`max_turns: ${config.maxTurns}`)
  lines.push(`prompt_mode: ${config.promptMode}`)
  if (config.inheritContext) lines.push(`inherit_context: true`)
  if (config.runInBackground) lines.push(`run_in_background: true`)
  if (config.isolated) lines.push(`isolated: true`)
  if (config.memory) lines.push(`memory: ${config.memory}`)
  if (config.isolation) lines.push(`isolation: ${config.isolation}`)
  lines.push("enabled: true")
  lines.push("---")
  lines.push("")
  lines.push(config.systemPrompt)
  return lines.join("\n")
}

async function ejectAgent(ctx: ExtensionCommandContext, name: string, config: AgentConfig): Promise<void> {
  const scope = await ctx.ui.select("Eject to:", ["Project (.pi/agents/)", "Global (~/.pi/agent/agents/)", "Cancel"])
  if (!scope || scope === "Cancel") return

  const isProject = scope.startsWith("Project")
  const scopeTag = isProject ? "project" : "global"
  const filePath = getAgentFilePath(ctx.cwd, name, scopeTag)

  if (existsSync(filePath)) {
    ctx.ui.notify(`File already exists: ${filePath}`, "warning")
    return
  }

  const dir = join(filePath, "..")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const content = agentConfigToFrontmatter(config)
  writeFileSync(filePath, content, "utf-8")

  const reloaded = loadCustomAgents(ctx.cwd)
  registerAgents(reloaded)

  ctx.ui.notify(`Ejected ${name} to ${filePath}`, "info")
}

async function editAgent(ctx: ExtensionCommandContext, name: string, config: AgentConfig): Promise<void> {
  const scope = config.source as "project" | "global"
  const filePath = getAgentFilePath(ctx.cwd, name, scope)
  ctx.ui.notify(`Edit: ${filePath}`, "info")
}

async function deleteAgent(ctx: ExtensionCommandContext, name: string, config: AgentConfig): Promise<void> {
  const scope = config.source as "project" | "global"
  const filePath = getAgentFilePath(ctx.cwd, name, scope)

  const confirm = await ctx.ui.confirm("Delete agent?", `Delete ${filePath}?`)
  if (!confirm) return

  try {
    unlinkSync(filePath)
  } catch {
    ctx.ui.notify(`Failed to delete ${filePath}`, "error")
    return
  }

  const reloaded = loadCustomAgents(ctx.cwd)
  registerAgents(reloaded)
  ctx.ui.notify(`Deleted agent ${name}`, "info")
}

async function toggleAgent(ctx: ExtensionCommandContext, name: string, config: AgentConfig, disable: boolean): Promise<void> {
  const hasFile = config.source === "project" || config.source === "global"

  if (hasFile) {
    const scope = config.source as "project" | "global"
    const filePath = getAgentFilePath(ctx.cwd, name, scope)
    try {
      let content = readFileSync(filePath, "utf-8")
      if (disable) {
        content = content.replace(/enabled:\s*true/, "enabled: false")
        if (!content.includes("enabled:")) {
          content = content.replace(/^---/, `---\nenabled: false`)
        }
      } else {
        content = content.replace(/enabled:\s*false/, "enabled: true")
      }
      writeFileSync(filePath, content, "utf-8")
    } catch {
      ctx.ui.notify(`Failed to update ${filePath}`, "error")
      return
    }
  } else if (disable && config.isDefault) {
    const scope = await ctx.ui.select("Create disabled override in:", ["Project (.pi/agents/)", "Global (~/.pi/agent/agents/)", "Cancel"])
    if (!scope || scope === "Cancel") return

    const scopeTag = scope.startsWith("Project") ? "project" : "global"
    const filePath = getAgentFilePath(ctx.cwd, name, scopeTag)
    const dir = join(filePath, "..")
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const content = agentConfigToFrontmatter(config).replace("enabled: true", "enabled: false")
    writeFileSync(filePath, content, "utf-8")
  }

  const reloaded = loadCustomAgents(ctx.cwd)
  registerAgents(reloaded)
  ctx.ui.notify(`${name} ${disable ? "disabled" : "enabled"}`, "info")
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

function formatSchedule(job: ScheduledSubagent): string {
  const enabled = job.enabled ? "●" : "○"
  const typeLabel = job.scheduleType === "cron" ? `cron(${job.schedule})`
    : job.scheduleType === "once" ? `once(${job.schedule.slice(0, 19)})`
    : `interval(${job.intervalMs ?? 0}ms)`
  const lastRun = job.lastRun ? ` | last: ${job.lastRun.slice(0, 19)}` : ""
  const runs = ` | runs: ${job.runCount}`
  return `${enabled} ${job.name.padEnd(25)} ${typeLabel.padEnd(25)} ${job.subagent_type}${lastRun}${runs}`
}

async function showScheduledJobs(ctx: ExtensionCommandContext, scheduler: ScheduleEngine): Promise<void> {
  const jobs = scheduler.getJobs()

  const options: string[] = []

  if (jobs.length > 0) {
    for (const job of jobs) {
      options.push(formatSchedule(job))
    }
  }
  options.push("─ Create new job ─")
  options.push("Back")

  const choice = await ctx.ui.select("Scheduled Jobs", options)
  if (!choice || choice === "Back") return

  if (choice === "─ Create new job ─") {
    await createScheduledJob(ctx, scheduler)
    return
  }

  const idx = jobs.findIndex(j => formatSchedule(j) === choice)
  if (idx === -1) return
  const job = jobs[idx]
  await showJobDetail(ctx, scheduler, job)
}

async function showJobDetail(ctx: ExtensionCommandContext, scheduler: ScheduleEngine, job: ScheduledSubagent): Promise<void> {
  const lines: string[] = [
    `Job: ${job.name}`,
    `ID: ${job.id}`,
    `Description: ${job.description}`,
    `Type: ${job.scheduleType}`,
    `Schedule: ${job.schedule}`,
    `Agent: ${job.subagent_type}`,
    `Enabled: ${job.enabled}`,
    `Created: ${job.createdAt}`,
    `Runs: ${job.runCount}`,
  ]
  if (job.lastRun) lines.push(`Last run: ${job.lastRun}`)
  if (job.lastStatus) lines.push(`Last status: ${job.lastStatus}`)
  if (job.nextRun) lines.push(`Next run: ${job.nextRun}`)

  const actions: string[] = []
  actions.push(job.enabled ? "Disable" : "Enable")
  actions.push("Delete")
  actions.push("Run now")
  actions.push("Back")

  const info = lines.join("\n")
  const choice = await ctx.ui.select(info, actions)
  if (!choice || choice === "Back") return

  if (choice === "Enable") {
    scheduler.updateJob(job.id, { enabled: true })
    ctx.ui.notify(`Job "${job.name}" enabled.`, "info")
  } else if (choice === "Disable") {
    scheduler.updateJob(job.id, { enabled: false })
    ctx.ui.notify(`Job "${job.name}" disabled.`, "info")
  } else if (choice === "Delete") {
    scheduler.removeJob(job.id)
    ctx.ui.notify(`Job "${job.name}" deleted.`, "info")
  } else if (choice === "Run now") {
    const updatedJob = scheduler.getJob(job.id)
    if (updatedJob) {
      scheduler.updateJob(job.id, { enabled: true })
      ctx.ui.notify(`Job "${job.name}" triggered.`, "info")
    }
  }
}

async function createScheduledJob(ctx: ExtensionCommandContext, scheduler: ScheduleEngine): Promise<void> {
  const name = await ctx.ui.input("Job name:", "")
  if (!name) return

  const types = getAvailableTypes()
  const typeChoice = await ctx.ui.select("Agent type", types)
  if (!typeChoice) return

  const scheduleTypes = ["once (one-shot at ISO datetime)", "interval (every N minutes)", "cron (cron expression)"]
  const scheduleTypeChoice = await ctx.ui.select("Schedule type", scheduleTypes)
  if (!scheduleTypeChoice) return

  let scheduleType: "once" | "interval" | "cron"
  let schedule: string
  let intervalMs: number | undefined

  if (scheduleTypeChoice.startsWith("once")) {
    scheduleType = "once"
    const defaultTime = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 19)
    schedule = (await ctx.ui.input("Run at (ISO datetime):", defaultTime)) ?? ""
    if (!schedule) return
    try {
      const d = new Date(schedule)
      if (isNaN(d.getTime())) {
        ctx.ui.notify("Invalid datetime.", "error")
        return
      }
      schedule = d.toISOString()
    } catch {
      ctx.ui.notify("Invalid datetime.", "error")
      return
    }
  } else if (scheduleTypeChoice.startsWith("interval")) {
    scheduleType = "interval"
    const mins = await ctx.ui.input("Interval (minutes):", "5")
    if (!mins) return
    const n = parseInt(mins, 10)
    if (isNaN(n) || n <= 0) {
      ctx.ui.notify("Invalid interval.", "error")
      return
    }
    intervalMs = n * 60_000
    schedule = `every ${n}m`
  } else {
    scheduleType = "cron"
    schedule = (await ctx.ui.input("Cron expression:", "*/5 * * * *")) ?? ""
    if (!schedule) return
  }

  const prompt = await ctx.ui.input("Prompt for the agent:", "")
  if (!prompt) return

  const job = scheduler.addJob({
    name,
    description: name,
    schedule,
    scheduleType,
    intervalMs,
    subagent_type: typeChoice,
    prompt,
    enabled: true,
  })

  ctx.ui.notify(`Scheduled job "${job.name}" created (${job.scheduleType}: ${job.schedule}).`, "info")
}

export function registerAgentsCommand(
  pi: ExtensionAPI,
  manager: AgentManager,
  scheduler?: ScheduleEngine,
): void {
  pi.registerCommand("agents", {
    description: "Manage subagents — view running agents, types, schedules, and settings",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.hasUI) return

      const sections = [
        "Running & Recent Agents",
        "Agent Types",
      ]
      if (scheduler) {
        sections.push("Scheduled Jobs")
      }
      sections.push("Settings")
      sections.push("Cancel")

      const choice = await ctx.ui.select("Subagents", sections)
      if (!choice) return

      if (choice === "Running & Recent Agents") {
        await showRunningAgents(ctx, manager)
      } else if (choice === "Agent Types") {
        await showAgentTypes(ctx)
      } else if (choice === "Scheduled Jobs" && scheduler) {
        await showScheduledJobs(ctx, scheduler)
      } else if (choice === "Settings") {
        await showSettings(ctx, manager)
      }
    },
  })
}
