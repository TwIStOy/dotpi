import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerZaiProvider from "./providers/zai.js";

export default function (pi: ExtensionAPI) {
  registerZaiProvider(pi);
}
