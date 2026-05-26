import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerModels from "./models.js";

export default function registerHawtianPrivate(pi: ExtensionAPI) {
  registerModels(pi);
}
