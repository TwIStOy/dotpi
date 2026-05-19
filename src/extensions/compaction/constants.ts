/**
 * Defaults for session / branch compaction (ported from pi-qol).
 */

export const DOTPI_COMPACTION_SYSTEM_PROMPT =
  "You summarize coding-agent sessions for continuation. Preserve exact technical facts, filenames, commands, constraints, decisions, blockers, and next actions. Do not invent details.";

export const DEFAULT_COMPACTION_MAX_TOKENS = 8192;

export const DEFAULT_IDLE_COMPACTION_THRESHOLD_TOKENS = 200_000;

export const DEFAULT_IDLE_COMPACTION_SECONDS = 300;
