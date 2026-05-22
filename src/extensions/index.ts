import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import initCompaction from "./compaction/index.js";
import initCompactStatusline from "./compact-statusline/index.js";
import initContextUsage from "./context-usage/index.js";
import initDebugLlmDump from "./debug-llm-dump/index.js";
import initPermissionGate from "./permission-gate/index.js";
import initToolCallCasing from "./tool-call-casing/index.js";
import initMemory from "./memory/index.js";
import initPrimaryAgent from "./primary-agent/index.js";
import initQuestions from "./questions/index.js";
import initSubagents from "./subagents/index.js";
import initBtw from "./btw/index.js";
import initToolRenderer from "./tool-renderer/index.js";
import initTasks from "./tasks/index.js";

export function initExtensions(pi: ExtensionAPI) {
  initToolCallCasing(pi);
  initDebugLlmDump(pi);
  initPermissionGate(pi);
  initCompaction(pi);
  initCompactStatusline(pi);
  initContextUsage(pi);
  initSubagents(pi);
  initTasks(pi);
  initToolRenderer(pi);
  initBtw(pi);
  // Primary-agent must run before questions so preset replacement is applied first;
  // questions then appends its tool appendix to the effective system prompt.
  initPrimaryAgent(pi);
  initMemory(pi);
  initQuestions(pi);
}
