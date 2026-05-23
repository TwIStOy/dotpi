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
  // ── Phase 1: Pre-tool hooks (must run before any tools are registered) ──
  initToolCallCasing(pi);     // Normalizes tool-call names in message history (before_agent_start)
  initDebugLlmDump(pi);       // Dumps LLM payloads to disk (before_provider_request)
  initPermissionGate(pi);     // Evaluates tool-call allow/deny gates (tool_call hook)

  // ── Phase 2: Session lifecycle ──
  initCompaction(pi);         // Custom compaction + branch summary (session_before_compact, session_before_tree)
  initCompactStatusline(pi);  // Status bar widget + footer replacement
  initContextUsage(pi);       // /context command

  // ── Phase 3: Core execution layer ──
  initSubagents(pi);          // Agent manager, tools (call_subagent, get_result, steer), /agents command
  // Tasks depends on subagents via RPC (subagents:rpc:spawn), so it must init after subagents
  // registers its event handlers.
  initTasks(pi);              // Task CRUD tools, /tasks command, background process tracking

  // ── Phase 4: Tool rendering (wraps built-in tools) ──
  initToolRenderer(pi);       // Enhanced rendering for read, bash, edit, write, grep, find, ls
  initBtw(pi);                // /btw side-question overlay

  // ── Phase 5: Prompt composition ──
  // Primary-agent must run before memory/questions so preset replacement is applied first;
  // memory then registers tools (needed before dynamic appendix reads tool list);
  // questions appends its tool appendix to the effective system prompt.
  initPrimaryAgent(pi);       // /primary-agent command, preset loading, routing dynamic appendix
  initMemory(pi);             // memory-*/journal-* tools, /memory-status, /self-improve
  initQuestions(pi);          // question tool + system prompt appendix
}
