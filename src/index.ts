import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerZai from "./extensions/zai-provider/index.js";
// import registerHawtianPrivate from "./extensions/hawtian-private/index.js";
import { registerPrompts } from "./prompts/index.js";
import { initExtensions } from "./extensions/index.js";

/** Repo root (parent of src/ or dist/). Bundled resources when only the extension entry path is listed in settings. */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundledSkillsDir = join(packageRoot, "skills");
const bundledThemesDir = join(packageRoot, "themes");

export default function (pi: ExtensionAPI) {
  // pi.skills / pi.themes in package.json apply when this repo is a *package* source in settings.
  // Most setups list only ./src/index.ts (or dist) under extensions — that path does not read package.json for resources.
  pi.on("resources_discover", () => {
    const out: { skillPaths?: string[]; themePaths?: string[] } = {};
    if (existsSync(bundledSkillsDir)) {
      out.skillPaths = [bundledSkillsDir];
    }
    if (existsSync(bundledThemesDir)) {
      out.themePaths = [bundledThemesDir];
    }
    return out;
  });

  registerZai(pi);
  // registerHawtianPrivate(pi);
  registerPrompts(pi);
  initExtensions(pi);
}
