import { Cron } from "croner"
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"
import type { AgentManager } from "./agent-manager.js"
import { ScheduleStore } from "./schedule-store.js"
import type { ScheduledSubagent } from "./types.js"
import { emitAgentCompleted, emitAgentFailed } from "./events.js"

interface ActiveTimer {
  type: "cron" | "timeout" | "interval"
  handle: InstanceType<typeof Cron> | ReturnType<typeof setTimeout>
  jobId: string
}

export class ScheduleEngine {
  private store: ScheduleStore
  private timers = new Map<string, ActiveTimer>()
  private manager: AgentManager | null = null
  private pi: ExtensionAPI | null = null
  private disposed = false

  constructor(cwd: string) {
    this.store = new ScheduleStore(cwd)
  }

  bind(manager: AgentManager, pi: ExtensionAPI): void {
    this.manager = manager
    this.pi = pi
  }

  load(): void {
    this.store.load()
  }

  start(): void {
    this.stopAll()
    for (const job of this.store.getEnabledJobs()) {
      this.scheduleJob(job)
    }
  }

  private scheduleJob(job: ScheduledSubagent): void {
    if (this.disposed) return

    switch (job.scheduleType) {
      case "cron":
        this.scheduleCron(job)
        break
      case "once":
        this.scheduleOnce(job)
        break
      case "interval":
        this.scheduleInterval(job)
        break
    }
  }

  private scheduleCron(job: ScheduledSubagent): void {
    try {
      const task = new Cron(job.schedule, () => {
        this.fireJob(job)
      })
      this.timers.set(job.id, { type: "cron", handle: task, jobId: job.id })

      const next = task.nextRun()
      if (next) {
        this.store.updateJob(job.id, { nextRun: next.toISOString() })
      }
    } catch (err) {
      this.store.updateJob(job.id, { enabled: false })
    }
  }

  private scheduleOnce(job: ScheduledSubagent): void {
    const target = new Date(job.schedule).getTime()
    const now = Date.now()
    const delay = target - now

    if (delay <= 0) {
      this.fireJob(job)
      return
    }

    const handle = setTimeout(() => {
      this.timers.delete(job.id)
      this.fireJob(job)
    }, delay)
    handle.unref()

    this.timers.set(job.id, { type: "timeout", handle, jobId: job.id })
    this.store.updateJob(job.id, { nextRun: job.schedule })
  }

  private scheduleInterval(job: ScheduledSubagent): void {
    const ms = job.intervalMs ?? 60_000
    const handle = setInterval(() => {
      this.fireJob(job)
    }, ms)
    handle.unref()

    this.timers.set(job.id, { type: "interval", handle, jobId: job.id })

    const nextRun = new Date(Date.now() + ms).toISOString()
    this.store.updateJob(job.id, { nextRun })
  }

  private async fireJob(job: ScheduledSubagent): Promise<void> {
    if (!this.manager || !this.pi || this.disposed) return
    if (!job.enabled) return

    this.store.recordRun(job.id, "running")

    const mockCtx = this.buildContext()

    try {
      const id = this.manager.spawn(this.pi, mockCtx as any, job.subagent_type, job.prompt, {
        description: job.description,
        maxTurns: job.max_turns,
        isolated: job.isolated,
        isolation: job.isolation,
        isBackground: true,
      })

      const record = this.manager.getRecord(id)
      if (record) {
        record.promise?.then(() => {
          const r = this.manager!.getRecord(id)
          if (r?.status === "error") {
            this.store.recordRun(job.id, "error")
          } else {
            this.store.recordRun(job.id, "success")
          }
        })
      }
    } catch {
      this.store.recordRun(job.id, "error")
    }

    if (job.scheduleType === "cron") {
      const active = this.timers.get(job.id)
      if (active && active.type === "cron") {
        const next = (active.handle as Cron).nextRun()
        if (next) {
          this.store.updateJob(job.id, { nextRun: next.toISOString() })
        }
      }
    }

    if (job.scheduleType === "once") {
      this.store.updateJob(job.id, { enabled: false })
    }
  }

  private buildContext(): Partial<ExtensionContext> {
    return {
      cwd: this.store["cwd"],
      model: undefined,
      modelRegistry: (this.pi as any).modelRegistry ?? { find: () => undefined, getAll: () => [] },
      sessionManager: (this.pi as any).sessionManager,
      hasUI: false,
      getSystemPrompt: () => "",
    }
  }

  reload(): void {
    this.store.load()
    this.start()
  }

  addJob(job: Omit<ScheduledSubagent, "id" | "createdAt" | "runCount">): ScheduledSubagent {
    const record = this.store.addJob(job)
    if (record.enabled) {
      this.scheduleJob(record)
    }
    return record
  }

  updateJob(id: string, patch: Partial<ScheduledSubagent>): ScheduledSubagent | undefined {
    const existing = this.store.getJob(id)
    if (!existing) return undefined

    this.cancelJob(id)
    const updated = this.store.updateJob(id, patch)
    if (updated && updated.enabled) {
      this.scheduleJob(updated)
    }
    return updated
  }

  removeJob(id: string): boolean {
    this.cancelJob(id)
    return this.store.removeJob(id)
  }

  getJobs(): ScheduledSubagent[] {
    return this.store.getJobs()
  }

  getJob(id: string): ScheduledSubagent | undefined {
    return this.store.getJob(id)
  }

  private cancelJob(id: string): void {
    const timer = this.timers.get(id)
    if (!timer) return
    if (timer.type === "cron") {
      (timer.handle as Cron).stop()
    } else if (timer.type === "timeout") {
      clearTimeout(timer.handle as ReturnType<typeof setTimeout>)
    } else if (timer.type === "interval") {
      clearInterval(timer.handle as ReturnType<typeof setInterval>)
    }
    this.timers.delete(id)
  }

  private stopAll(): void {
    for (const [id] of this.timers) {
      this.cancelJob(id)
    }
  }

  dispose(): void {
    this.disposed = true
    this.stopAll()
    this.store.dispose()
  }
}
