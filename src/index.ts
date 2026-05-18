import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import registerZai from "./providers/zai/index.js"
import { registerPrompts } from "./prompts/index.js"
import initSubagents from "./subagents/index.js"

export default function (pi: ExtensionAPI) {
  registerZai(pi)
  registerPrompts(pi)
  initSubagents(pi)
}
