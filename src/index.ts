import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerZai from "./providers/zai/index.js";
import { registerPrompts } from "./prompts/index.js";
import { initExtensions } from "./extensions/index.js";

/** Repo root (parent of src/). Used so bundled skills load when the extension is only referenced as a file path. */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundledSkillsDir = join(packageRoot, "skills");

export default function (pi: ExtensionAPI) {
  // pi.skills in package.json is applied when this repo is a *package* source in settings.
  // Most setups list only ./src/index.ts under extensions — that path never reads package.json for skills.
  pi.on("resources_discover", () => {
    if (!existsSync(bundledSkillsDir)) {
      return {};
    }
    return { skillPaths: [bundledSkillsDir] };
  });

  registerZai(pi);
  registerPrompts(pi);
  initExtensions(pi);
}
