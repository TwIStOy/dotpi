/**
 * Slugs for `prompts/<slug>.md`. Keep in sync with `scripts/check-subagent-prompts.mjs`.
 */
export const SUBAGENT_PROMPT_SLUGS = [
  "explore",
  "librarian",
  "oracle",
  "plan",
  "general-purpose",
] as const;

export type SubagentPromptSlug = (typeof SUBAGENT_PROMPT_SLUGS)[number];
