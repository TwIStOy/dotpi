/**
 * Keep `REQUIRED` in sync with `src/extensions/primary-agent/prompt-manifest.ts`
 * (`PRIMARY_AGENT_PRESET_SLUGS`).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** @type {string[]} */
const REQUIRED = ["routing"];

const root = process.cwd();
const dirs = [
  join(root, "src/extensions/primary-agent/prompts"),
  join(root, "src/extensions/primary-agent/routing/prompts"),
];

for (const dir of dirs) {
  if (!existsSync(dir)) {
    console.error(`prompts directory missing: ${dir}`);
    process.exit(1);
  }
}

function promptPathForSlug(slug) {
  if (slug === "routing") {
    return join(root, "src/extensions/primary-agent/routing/prompts", `${slug}.md`);
  }
  return join(root, "src/extensions/primary-agent/prompts", `${slug}.md`);
}

let failed = false;
for (const slug of REQUIRED) {
  const file = promptPathForSlug(slug);
  if (!existsSync(file)) {
    console.error(`missing primary-agent prompt: ${file}`);
    failed = true;
  }
}

const requiredSet = new Set(REQUIRED);
const extras = [];
for (const dir of dirs) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".md")) continue;
    const slug = f.slice(0, -".md".length);
    if (!requiredSet.has(slug)) extras.push(`${dir}/${f}`);
  }
}

if (extras.length > 0) {
  console.warn(
    "warning: primary-agent *.md not listed in PRIMARY_AGENT_PRESET_SLUGS:",
    extras.join(", "),
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `check-primary-agent-prompts: ok (${REQUIRED.length} required files under primary-agent/prompts + routing/prompts)`,
);
