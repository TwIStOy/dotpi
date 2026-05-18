import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import type { AgentManager } from "../agent-manager.js"
import { getAvailableTypes, getAgentConfig } from "../agent-types.js"
import { formatDuration, formatTokens } from "../formatting.js"
import { getLifetimeTotal } from "../usage.js"
import type { AgentRecord, ScheduledSubagent } from "../types.js"
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
