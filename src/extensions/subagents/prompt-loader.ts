import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SUBAGENT_PROMPT_SLUGS,
  type SubagentPromptSlug,
} from "./prompt-manifest.js";

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), "prompts");

function applyVars(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

/**
 * Load a default subagent system prompt from `prompts/<slug>.md`.
 * Optional YAML frontmatter uses the same `parseFrontmatter` helper as
 * `.pi/agents` custom agents (`custom-agents.ts`).
 * `{{VAR}}` placeholders in the body are replaced when `vars` is passed.
 */
export function loadSubagentPrompt(
  slug: SubagentPromptSlug | string,
  vars: Record<string, string> = {},
): string {
  const path = join(promptsDir, `${slug}.md`);
  if (!existsSync(path)) {
    throw new Error(
      `Subagent prompt file missing: ${path} (slug "${slug}"). Expected one of: ${SUBAGENT_PROMPT_SLUGS.join(", ")}`,
    );
  }
  const raw = readFileSync(path, "utf-8");
  const { body } = parseFrontmatter<Record<string, unknown>>(raw);
  return applyVars(body.trimEnd(), vars).trim();
}
