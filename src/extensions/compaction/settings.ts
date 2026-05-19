/**
 * Compaction extension — static toggles. Edit values here (no `process.env`).
 */

import {
  DEFAULT_COMPACTION_MAX_TOKENS,
  DEFAULT_IDLE_COMPACTION_SECONDS,
  DEFAULT_IDLE_COMPACTION_THRESHOLD_TOKENS,
} from "./constants.js";

/**
 * When `true`, `session_before_compact` uses this extension to produce a custom
 * summary instead of Pi’s built-in compaction path.
 * Allowed values: `true` | `false`
 */
export const CUSTOM_COMPACTION_ENABLED = true;

/**
 * When `true`, show toast notifications for compaction lifecycle (start, success,
 * errors). Idle compaction uses the same flag.
 * Allowed values: `true` | `false`
 */
export const COMPACTION_NOTIFY = true;

/**
 * When `true`, if summarization fails, Pi falls back to default compaction. When
 * `false`, compaction may be cancelled on error.
 * Allowed values: `true` | `false`
 */
export const FALLBACK_TO_DEFAULT_ON_ERROR = true;

/**
 * When `true`, include the previous compaction summary in the summarizer prompt.
 * Allowed values: `true` | `false`
 */
export const INCLUDE_PREVIOUS_SUMMARY = true;

/**
 * Summary style passed to the model.
 * Allowed values: `"concise"` | `"balanced"` | `"exhaustive"`
 */
export const COMPACTION_PROFILE: "concise" | "balanced" | "exhaustive" =
  "balanced";

/**
 * Max completion tokens for the summarizer call (minimum 256 enforced in code).
 * Allowed values: positive integers, typically `4096`–`32768`.
 */
export const COMPACTION_MAX_TOKENS = DEFAULT_COMPACTION_MAX_TOKENS;

/**
 * When `true`, `session_before_tree` may produce a branch-leave summary.
 * Allowed values: `true` | `false`
 */
export const BRANCH_SUMMARY_ENABLED = false;

/**
 * When `true`, after `agent_end` schedule an automatic `ctx.compact` once the
 * session is idle for `IDLE_COMPACTION_TIMEOUT_SECONDS` and a trigger reason
 * exists (token thresholds / idle token threshold).
 * Allowed values: `true` | `false`
 */
export const IDLE_COMPACTION_ENABLED = false;

/**
 * Delay (seconds) before idle compaction runs after `agent_end`.
 * Allowed values: positive integers, e.g. `60`–`3600`.
 */
export const IDLE_COMPACTION_TIMEOUT_SECONDS =
  DEFAULT_IDLE_COMPACTION_SECONDS;

/**
 * Minimum context tokens before idle compaction may trigger (when no other
 * threshold applies). Used with `compactionTriggerReason`.
 * Allowed values: positive integers.
 */
export const IDLE_COMPACTION_THRESHOLD_TOKENS =
  DEFAULT_IDLE_COMPACTION_THRESHOLD_TOKENS;

/**
 * Absolute token count at or above which idle compaction may trigger. `-1`
 * disables this trigger.
 * Allowed values: `-1` (off) or a positive integer.
 */
export const THRESHOLD_TOKENS = -1;

/**
 * Percent of context window at or above which idle compaction may trigger.
 * `-1` disables. Requires a known `contextWindow` from usage.
 * Allowed values: `-1` (off) or `1`–`100`.
 */
export const THRESHOLD_PERCENT = -1;
