import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import initCompaction from "./compaction/index.js";
import initCompactStatusline from "./compact-statusline/index.js";
import initContextUsage from "./context-usage/index.js";
import initQuestions from "./questions/index.js";
import initSubagents from "./subagents/index.js";
import initToolRenderer from "./tool-renderer/index.js";

export function initExtensions(pi: ExtensionAPI) {
  initCompaction(pi);
  initCompactStatusline(pi);
  initContextUsage(pi);
  initSubagents(pi);
  initToolRenderer(pi);
  initQuestions(pi);
}
