import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import initQuestions from "./questions/index.js";
import initSubagents from "./subagents/index.js";
import initToolRenderer from "./tool-renderer/index.js";

export function initExtensions(pi: ExtensionAPI) {
  initSubagents(pi);
  initToolRenderer(pi);
  initQuestions(pi);
}
