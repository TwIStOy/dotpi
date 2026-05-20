/**
 * Keep `REQUIRED` in sync with `src/extensions/subagents/prompt-manifest.ts`
 * (`SUBAGENT_PROMPT_SLUGS`).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REQUIRED = ["explore", "librarian", "oracle", "plan", "general-purpose"];

const root = process.cwd();
const dir = join(root, "src/extensions/subagents/prompts");

let failed = false;
for (const slug of REQUIRED) {
  const file = join(dir, `${slug}.md`);
  if (!existsSync(file)) {
    console.error(`missing subagent prompt: ${file}`);
    failed = true;
  }
}

if (!existsSync(dir)) {
  console.error(`prompts directory missing: ${dir}`);
  process.exit(1);
}

const extras = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .map((f) => f.slice(0, -".md".length))
  .filter((slug) => !REQUIRED.includes(slug));

if (extras.length > 0) {
  console.warn(
    "warning: prompts/*.md not listed in SUBAGENT_PROMPT_SLUGS:",
    extras.join(", "),
  );
}

if (failed) {
  process.exit(1);
}

console.log(
  `check-subagent-prompts: ok (${REQUIRED.length} files under ${dir})`,
);
