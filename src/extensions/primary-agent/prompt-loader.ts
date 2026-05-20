import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIMARY_AGENT_PRESET_SLUGS } from "./prompt-manifest.js";
import {
  parseToolPolicyFromFrontmatter,
  type PrimaryAgentToolPolicy,
} from "./tool-policy.js";

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), "prompts");
const extensionRoot = dirname(fileURLToPath(import.meta.url));

function promptFilePathForSlug(slug: string): string {
  if (slug === "routing") {
    return join(extensionRoot, "routing", "prompts", `${slug}.md`);
  }
  return join(promptsDir, `${slug}.md`);
}

function applyVars(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
}

function isRegisteredSlug(slug: string): boolean {
  return (PRIMARY_AGENT_PRESET_SLUGS as readonly string[]).includes(slug);
}

/** Appends runtime-built sections at `before_agent_start` (see `routing/dynamic-appendix.ts`). */
export type PrimaryAgentDynamicAppendixKind = "routing";

export type LoadedPrimaryAgentPreset = {
  id: string;
  label: string;
  prompt: string;
  /** When set, `/primary-agent` applies this via `pi.setActiveTools` */
  toolPolicy: PrimaryAgentToolPolicy | undefined;
  /** Optional runtime appendix; `routing` preset defaults to this when not disabled in frontmatter */
  dynamicAppendix?: PrimaryAgentDynamicAppendixKind;
};

/**
 * Load a primary-agent preset from `prompts/<slug>.md`.
 * Optional YAML frontmatter (same `parseFrontmatter` as subagents).
 * Optional `label` or `title` in frontmatter for `/primary-agent` menu; defaults to slug.
 * Optional `tools` (CSV or YAML list) and `disallowed_tools` — same semantics as subagent `.pi/agents` prompts.
 * Optional `dynamic_appendix: routing` — append Oh-My-OpenAgent–aligned runtime sections (set `dynamic_appendix: none` on the `routing` slug to disable). Legacy `dynamic_appendix: sisyphus` is treated as `routing`.
 * `{{VAR}}` in the body is replaced when `vars` is passed.
 */
function parseDynamicAppendix(
  fm: Record<string, unknown>,
  slug: string,
): PrimaryAgentDynamicAppendixKind | undefined {
  const v = fm.dynamic_appendix;
  if (v === false || v === "none" || v === "off") {
    return undefined;
  }
  if (v === "routing" || v === "sisyphus") {
    return "routing";
  }
  if (slug === "routing") {
    return "routing";
  }
  return undefined;
}

export function loadPrimaryAgentPreset(
  slug: string,
  vars: Record<string, string> = {},
): LoadedPrimaryAgentPreset {
  if (!isRegisteredSlug(slug)) {
    throw new Error(
      `Unknown primary-agent preset slug "${slug}". Add it to PRIMARY_AGENT_PRESET_SLUGS in prompt-manifest.ts.`,
    );
  }
  const path = promptFilePathForSlug(slug);
  if (!existsSync(path)) {
    throw new Error(
      `Primary-agent prompt file missing: ${path} (slug "${slug}"). Expected slugs: ${PRIMARY_AGENT_PRESET_SLUGS.join(", ")}`,
    );
  }
  const raw = readFileSync(path, "utf-8");
  const { frontmatter: fm, body } = parseFrontmatter<Record<string, unknown>>(raw);
  const labelFromFm =
    (typeof fm.label === "string" && fm.label.trim()) ||
    (typeof fm.title === "string" && fm.title.trim()) ||
    "";
  const label = labelFromFm || slug;
  const prompt = applyVars(body.trimEnd(), vars).trim();
  const toolPolicy = parseToolPolicyFromFrontmatter(fm);
  const dynamicAppendix = parseDynamicAppendix(fm, slug);
  return { id: slug, label, prompt, toolPolicy, dynamicAppendix };
}

/** All registered presets (reads each markdown file). */
export function listPrimaryAgentPresets(): LoadedPrimaryAgentPreset[] {
  return (PRIMARY_AGENT_PRESET_SLUGS as readonly string[]).map((slug) =>
    loadPrimaryAgentPreset(slug),
  );
}
