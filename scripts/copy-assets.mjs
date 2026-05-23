// copy-assets.mjs — Mirror src/**/prompts/*.md to dist/ preserving directory structure.
//
// Replaces the hardcoded shell one-liner in build:copy-prompts.
// Run from project root: node scripts/copy-assets.mjs

import {
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

if (!existsSync(SRC)) {
  console.error(`src/ directory not found: ${SRC}`);
  process.exit(1);
}

function findPromptDirs(dir, results = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name === "prompts") {
      const hasMd = readdirSync(full).some((f) => f.endsWith(".md"));
      if (hasMd) results.push(full);
    }
    findPromptDirs(full, results);
  }
  return results;
}

const promptDirs = findPromptDirs(SRC);
let copied = 0;

for (const dir of promptDirs) {
  const relDir = relative(SRC, dir);
  const targetDir = join(DIST, relDir);

  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  if (files.length === 0) continue;

  mkdirSync(targetDir, { recursive: true });

  for (const file of files) {
    const src = join(dir, file);
    const dest = join(targetDir, file);
    copyFileSync(src, dest);
    console.log(`  ${relative(ROOT, src)} → ${relative(ROOT, dest)}`);
    copied++;
  }
}

if (copied === 0) {
  console.warn("copy-assets: no .md files found under src/**/prompts/");
  process.exit(0);
}

console.log(`copy-assets: ${copied} file(s) copied`);
