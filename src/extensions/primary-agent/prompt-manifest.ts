/**
 * Slugs for `prompts/<slug>.md`. Keep in sync with
 * `scripts/check-primary-agent-prompts.mjs` (`REQUIRED`).
 */
export const PRIMARY_AGENT_PRESET_SLUGS = ["routing"] as const;

export type PrimaryAgentPresetSlug =
  (typeof PRIMARY_AGENT_PRESET_SLUGS)[number];
