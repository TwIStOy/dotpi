import { randomUUID } from "node:crypto";
import type { Model, Api } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { resumeAgent, runAgent, type ToolActivity } from "./agent-runner.js";
import type {
  AgentInvocation,
  AgentRecord,
  IsolationMode,
  SubagentType,
  ThinkingLevel,
} from "./types.js";
import { addUsage } from "./usage.js";
import { cleanupWorktree, createWorktree, pruneWorktrees } from "./worktree.js";

export type OnAgentComplete = (record: AgentRecord) => void;
export type OnAgentStart = (record: AgentRecord) => void;
export type OnAgentCompact = (
  record: AgentRecord,
  info: CompactionInfo,
) => void;
export type OnAgentActivity = (
  record: AgentRecord,
  activity: ToolActivity,
) => void;
export type OnAgentTurnEnd = (record: AgentRecord, turnCount: number) => void;
export type OnAgentTextDelta = (
  record: AgentRecord,
  delta: string,
  fullText: string,
) => void;
export type CompactionInfo = {
  reason: "manual" | "threshold" | "overflow";
  tokensBefore: number;
};

const DEFAULT_MAX_CONCURRENT = 4;

interface SpawnArgs {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  type: SubagentType;
  prompt: string;
  options: SpawnOptions;
}

interface SpawnOptions {
  description: string;
  model?: Model<Api>;
  maxTurns?: number;
  isolated?: boolean;
  inheritContext?: boolean;
  thinkingLevel?: ThinkingLevel;
  isBackground?: boolean;
  bypassQueue?: boolean;
  isolation?: IsolationMode;
  invocation?: AgentInvocation;
  signal?: AbortSignal;
  onToolActivity?: (activity: ToolActivity) => void;
  onTextDelta?: (delta: string, fullText: string) => void;
  onSessionCreated?: (session: AgentSession) => void;
  onTurnEnd?: (turnCount: number) => void;
  onAssistantUsage?: (usage: {
    input: number;
    output: number;
    cacheWrite: number;
  }) => void;
  onCompaction?: (info: CompactionInfo) => void;
}

export class AgentManager {
  private agents = new Map<string, AgentRecord>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private onComplete?: OnAgentComplete;
  private onStart?: OnAgentStart;
  private onCompact?: OnAgentCompact;
  private onToolActivity?: OnAgentActivity;
  private onTurnEndHook?: OnAgentTurnEnd;
  private onTextDeltaHook?: OnAgentTextDelta;
  private maxConcurrent: number;
  private queue: { id: string; args: SpawnArgs }[] = [];
  private runningBackground = 0;

  constructor(
    onComplete?: OnAgentComplete,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    onStart?: OnAgentStart,
    onCompact?: OnAgentCompact,
  ) {
    this.onComplete = onComplete;
    this.onStart = onStart;
    this.onCompact = onCompact;
    this.maxConcurrent = maxConcurrent;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  setMaxConcurrent(n: number) {
    this.maxConcurrent = Math.max(1, n);
    this.drainQueue();
  }

  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }

  setActivityHooks(hooks: {
    onToolActivity?: OnAgentActivity;
    onTurnEnd?: OnAgentTurnEnd;
    onTextDelta?: OnAgentTextDelta;
  }): void {
    this.onToolActivity = hooks.onToolActivity;
    this.onTurnEndHook = hooks.onTurnEnd;
    this.onTextDeltaHook = hooks.onTextDelta;
  }

  spawn(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    type: SubagentType,
    prompt: string,
    options: SpawnOptions,
  ): string {
    const id = randomUUID().slice(0, 17);
    const abortController = new AbortController();
    const record: AgentRecord = {
      id,
      type,
      description: options.description,
      status: options.isBackground ? "queued" : "running",
      toolUses: 0,
      startedAt: Date.now(),
      abortController,
      lifetimeUsage: { input: 0, output: 0, cacheWrite: 0 },
      compactionCount: 0,
      invocation: options.invocation,
    };
    this.agents.set(id, record);

    const args: SpawnArgs = { pi, ctx, type, prompt, options };

    if (
      options.isBackground &&
      !options.bypassQueue &&
      this.runningBackground >= this.maxConcurrent
    ) {
      this.queue.push({ id, args });
      return id;
    }

    try {
      this.startAgent(id, record, args);
    } catch (err) {
      this.agents.delete(id);
      throw err;
    }
    return id;
  }

  private startAgent(
    id: string,
    record: AgentRecord,
    { pi, ctx, type, prompt, options }: SpawnArgs,
  ) {
    let worktreeCwd: string | undefined;
    if (options.isolation === "worktree") {
      const wt = createWorktree(ctx.cwd, id);
      if (!wt) {
        throw new Error(
          'Cannot run with isolation: "worktree" — not a git repo, no commits yet, or `git worktree add` failed. ' +
            "Initialize git and commit at least once, or omit `isolation`.",
        );
      }
      record.worktree = wt;
      worktreeCwd = wt.path;
    }

    record.status = "running";
    record.startedAt = Date.now();
    if (options.isBackground) this.runningBackground++;
    this.onStart?.(record);

    let detachParentSignal: (() => void) | undefined;
    if (options.signal) {
      const onParentAbort = () => this.abort(id);
      options.signal.addEventListener("abort", onParentAbort, { once: true });
      detachParentSignal = () =>
        options.signal!.removeEventListener("abort", onParentAbort);
    }
    const detach = () => {
      detachParentSignal?.();
      detachParentSignal = undefined;
    };

    const promise = runAgent(ctx, type, prompt, {
      pi,
      agentId: id,
      model: options.model,
      maxTurns: options.maxTurns,
      isolated: options.isolated,
      inheritContext: options.inheritContext,
      thinkingLevel: options.thinkingLevel,
      cwd: worktreeCwd,
      signal: record.abortController!.signal,
      onToolActivity: (activity) => {
        if (activity.type === "end") record.toolUses++;
        options.onToolActivity?.(activity);
        this.onToolActivity?.(record, activity);
      },
      onTurnEnd: (turnCount) => {
        options.onTurnEnd?.(turnCount);
        this.onTurnEndHook?.(record, turnCount);
      },
      onTextDelta: (delta, fullText) => {
        options.onTextDelta?.(delta, fullText);
        this.onTextDeltaHook?.(record, delta, fullText);
      },
      onAssistantUsage: (usage) => {
        addUsage(record.lifetimeUsage, usage);
        options.onAssistantUsage?.(usage);
      },
      onCompaction: (info) => {
        record.compactionCount++;
        this.onCompact?.(record, info);
        options.onCompaction?.(info);
      },
      onSessionCreated: (session) => {
        record.session = session;
        if (record.pendingSteers?.length) {
          for (const msg of record.pendingSteers) {
            session.steer(msg).catch(() => {});
          }
          record.pendingSteers = undefined;
        }
        options.onSessionCreated?.(session);
      },
    })
      .then(({ responseText, session, aborted, steered }) => {
        if (record.status !== "stopped") {
          record.status = aborted
            ? "aborted"
            : steered
              ? "steered"
              : "completed";
        }
        record.result = responseText;
        record.session = session;
        record.completedAt ??= Date.now();

        detach();

        if (record.outputCleanup) {
          try {
            record.outputCleanup();
          } catch {
            /* cleanup best-effort */
          }
          record.outputCleanup = undefined;
        }

        if (record.worktree) {
          const wtResult = cleanupWorktree(
            ctx.cwd,
            record.worktree,
            options.description,
          );
          record.worktreeResult = wtResult;
          if (wtResult.hasChanges && wtResult.branch) {
            record.result =
              (record.result ?? "") +
              `\n\n---\nChanges saved to branch \`${wtResult.branch}\`. Merge with: \`git merge ${wtResult.branch}\``;
          }
        }

        if (options.isBackground) {
          this.runningBackground--;
          try {
            this.onComplete?.(record);
          } catch {
            /* subscriber error */
          }
          this.drainQueue();
        }
        return responseText;
      })
      .catch((err) => {
        if (record.status !== "stopped") {
          record.status = "error";
        }
        record.error = err instanceof Error ? err.message : String(err);
        record.completedAt ??= Date.now();

        detach();

        if (record.outputCleanup) {
          try {
            record.outputCleanup();
          } catch {
            /* cleanup best-effort */
          }
          record.outputCleanup = undefined;
        }

        if (record.worktree) {
          try {
            const wtResult = cleanupWorktree(
              ctx.cwd,
              record.worktree,
              options.description,
            );
            record.worktreeResult = wtResult;
          } catch {
            /* cleanup best-effort */
          }
        }

        if (options.isBackground) {
          this.runningBackground--;
          this.onComplete?.(record);
          this.drainQueue();
        }
        return "";
      });

    record.promise = promise.then(() => {});
  }

  private drainQueue() {
    while (
      this.queue.length > 0 &&
      this.runningBackground < this.maxConcurrent
    ) {
      const next = this.queue.shift()!;
      const record = this.agents.get(next.id);
      if (!record || record.status !== "queued") continue;
      try {
        this.startAgent(next.id, record, next.args);
      } catch (err) {
        record.status = "error";
        record.error = err instanceof Error ? err.message : String(err);
        record.completedAt = Date.now();
        this.onComplete?.(record);
      }
    }
  }

  async spawnAndWait(
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    type: SubagentType,
    prompt: string,
    options: Omit<SpawnOptions, "isBackground">,
  ): Promise<AgentRecord> {
    const id = this.spawn(pi, ctx, type, prompt, {
      ...options,
      isBackground: false,
    });
    const record = this.agents.get(id)!;
    await record.promise;
    return record;
  }

  async resume(
    id: string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<AgentRecord | undefined> {
    const record = this.agents.get(id);
    if (!record?.session) return undefined;

    record.status = "running";
    record.startedAt = Date.now();
    record.completedAt = undefined;
    record.result = undefined;
    record.error = undefined;

    try {
      const responseText = await resumeAgent(record.session, prompt, {
        onToolActivity: (activity) => {
          if (activity.type === "end") record.toolUses++;
        },
        onAssistantUsage: (usage) => {
          addUsage(record.lifetimeUsage, usage);
        },
        onCompaction: (info) => {
          record.compactionCount++;
          this.onCompact?.(record, info);
        },
        signal,
      });
      record.status = "completed";
      record.result = responseText;
      record.completedAt = Date.now();
    } catch (err) {
      record.status = "error";
      record.error = err instanceof Error ? err.message : String(err);
      record.completedAt = Date.now();
    }

    return record;
  }

  getRecord(id: string): AgentRecord | undefined {
    return this.agents.get(id);
  }

  listAgents(): AgentRecord[] {
    return [...this.agents.values()].sort((a, b) => b.startedAt - a.startedAt);
  }

  abort(id: string): boolean {
    const record = this.agents.get(id);
    if (!record) return false;

    if (record.status === "queued") {
      this.queue = this.queue.filter((q) => q.id !== id);
      record.status = "stopped";
      record.completedAt = Date.now();
      return true;
    }

    if (record.status !== "running") return false;
    record.abortController?.abort();
    record.status = "stopped";
    record.completedAt = Date.now();
    return true;
  }

  private removeRecord(id: string, record: AgentRecord): void {
    record.session?.dispose?.();
    record.session = undefined;
    this.agents.delete(id);
  }

  private cleanup() {
    const cutoff = Date.now() - 10 * 60_000;
    for (const [id, record] of this.agents) {
      if (record.status === "running" || record.status === "queued") continue;
      if ((record.completedAt ?? 0) >= cutoff) continue;
      this.removeRecord(id, record);
    }
  }

  clearCompleted(): void {
    for (const [id, record] of this.agents) {
      if (record.status === "running" || record.status === "queued") continue;
      this.removeRecord(id, record);
    }
  }

  hasRunning(): boolean {
    return [...this.agents.values()].some(
      (r) => r.status === "running" || r.status === "queued",
    );
  }

  abortAll(): number {
    let count = 0;
    for (const queued of this.queue) {
      const record = this.agents.get(queued.id);
      if (record) {
        record.status = "stopped";
        record.completedAt = Date.now();
        count++;
      }
    }
    this.queue = [];
    for (const record of this.agents.values()) {
      if (record.status === "running") {
        record.abortController?.abort();
        record.status = "stopped";
        record.completedAt = Date.now();
        count++;
      }
    }
    return count;
  }

  async waitForAll(): Promise<void> {
    while (true) {
      this.drainQueue();
      const pending = [...this.agents.values()]
        .filter((r) => r.status === "running" || r.status === "queued")
        .map((r) => r.promise)
        .filter(Boolean);
      if (pending.length === 0) break;
      await Promise.allSettled(pending);
    }
  }

  dispose() {
    clearInterval(this.cleanupInterval);
    this.queue = [];
    for (const record of this.agents.values()) {
      record.session?.dispose();
    }
    this.agents.clear();
    try {
      pruneWorktrees(process.cwd());
    } catch {
      /* best-effort */
    }
  }
}
