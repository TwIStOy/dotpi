import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { AgentSession } from "@earendil-works/pi-coding-agent";

export type { ThinkingLevel };

export type SubagentType = string;

export const DEFAULT_AGENT_NAMES = [
  "general-purpose",
  "Explore",
  "Plan",
  "Oracle",
  "Librarian",
] as const;

export type MemoryScope = "user" | "project" | "local";

export type IsolationMode = "worktree";

/**
 * Optional hints for the primary-agent **Routing** preset’s dynamic appendix
 * (tables aligned with Oh My OpenAgent `AgentPromptMetadata`). When omitted,
 * Routing falls back to generic rows derived from `description` / `trigger`.
 */
export type SubagentRoutingHints = {
  cost: "FREE" | "CHEAP" | "EXPENSIVE";
  /** OMO-style category; `utility` rows are omitted from the cost-sorted agent table in Routing */
  category: "utility" | "exploration" | "advisor" | "other";
  keyTrigger?: string;
  triggers: { domain: string; trigger: string }[];
  useWhen?: string[];
  avoidWhen?: string[];
};

export interface AgentConfig {
  name: string;
  displayName?: string;
  description: string;
  trigger?: string;
  builtinToolNames?: string[];
  disallowedTools?: string[];
  extensions: true | string[] | false;
  skills: true | string[] | false;
  model?: string | string[];
  thinking?: ThinkingLevel;
  maxTurns?: number;
  systemPrompt: string;
  promptMode: "replace" | "append";
  inheritContext?: boolean;
  runInBackground?: boolean;
  isolated?: boolean;
  memory?: MemoryScope;
  isolation?: IsolationMode;
  isDefault?: boolean;
  enabled?: boolean;
  source?: "default" | "project" | "global" | "extension";
  /** Primary-agent Routing appendix: cost, triggers, use/avoid when, etc. */
  routingHints?: SubagentRoutingHints;
}

export type JoinMode = "async" | "group" | "smart";

export type LifetimeUsage = {
  input: number;
  output: number;
  cacheWrite: number;
};

export interface AgentRecord {
  id: string;
  type: SubagentType;
  description: string;
  status:
    | "queued"
    | "running"
    | "completed"
    | "steered"
    | "aborted"
    | "stopped"
    | "error";
  result?: string;
  error?: string;
  toolUses: number;
  startedAt: number;
  completedAt?: number;
  session?: AgentSession;
  abortController?: AbortController;
  promise?: Promise<void>;
  groupId?: string;
  joinMode?: JoinMode;
  resultConsumed?: boolean;
  pendingSteers?: string[];
  worktree?: { path: string; branch: string };
  worktreeResult?: { hasChanges: boolean; branch?: string };
  toolCallId?: string;
  outputFile?: string;
  outputCleanup?: () => void;
  lifetimeUsage: LifetimeUsage;
  compactionCount: number;
  invocation?: AgentInvocation;
}

export interface AgentInvocation {
  modelName?: string;
  thinking?: ThinkingLevel;
  maxTurns?: number;
  isolated?: boolean;
  inheritContext?: boolean;
  runInBackground?: boolean;
  isolation?: IsolationMode;
}

export interface ScheduledSubagent {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleType: "cron" | "once" | "interval";
  intervalMs?: number;
  subagent_type: SubagentType;
  prompt: string;
  model?: string;
  thinking?: ThinkingLevel;
  max_turns?: number;
  isolated?: boolean;
  isolation?: IsolationMode;
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  lastStatus?: "success" | "error" | "running";
  nextRun?: string;
  runCount: number;
}

export interface ScheduleStoreData {
  version: 1;
  jobs: ScheduledSubagent[];
}

export interface EnvInfo {
  isGitRepo: boolean;
  branch: string;
  platform: string;
}
