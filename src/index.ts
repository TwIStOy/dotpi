import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerZai from "./providers/zai/index.js";
import { registerPrompts } from "./prompts/index.js";
import { initExtensions } from "./extensions/index.js";

export default function (pi: ExtensionAPI) {
  registerZai(pi);
  registerPrompts(pi);
  initExtensions(pi);
}
