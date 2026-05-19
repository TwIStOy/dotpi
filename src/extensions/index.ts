import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import initCompactStatusline from "./compact-statusline/index.js";
import initQuestions from "./questions/index.js";
import initSubagents from "./subagents/index.js";
import initToolRenderer from "./tool-renderer/index.js";

export function initExtensions(pi: ExtensionAPI) {
  initCompactStatusline(pi);
  initSubagents(pi);
  initToolRenderer(pi);
  initQuestions(pi);
}
