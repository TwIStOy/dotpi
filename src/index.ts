import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import registerZai from "./providers/zai/index.js"

export default function (pi: ExtensionAPI) {
  registerZai(pi)
}
