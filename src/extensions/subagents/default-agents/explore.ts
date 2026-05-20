/**
 * Explore subagent — system prompt structure informed by Oh My OpenCode.
 * @see https://github.com/code-yeongyu/oh-my-openagent/blob/dev/src/agents/explore.ts
 */
import type { AgentConfig } from "../types.js";
import { loadSubagentPrompt } from "../prompt-loader.js";
import { READ_ONLY_TOOLS } from "./shared.js";

const explore: AgentConfig = {
  name: "Explore",
  displayName: "Explore",
  description:
    'Contextual search for codebases. Answers "Where is X?", "Which file has Y?", "Find the code that does Z". Fire multiple searches in parallel for broad coverage. Specify thoroughness: "quick" for a single targeted lookup, "medium" for moderate exploration, or "very thorough" for comprehensive analysis. Do NOT use for full code review, design-doc auditing, or open-ended analysis beyond locating and summarizing matches — it works from excerpts and search hits, not whole-repo deep reads.',
  trigger:
    "Multiple search angles, unfamiliar module layout, cross-layer pattern discovery, locating symbols or files",
  builtinToolNames: READ_ONLY_TOOLS,
  extensions: true,
  skills: true,
  model: "glm-4.7-flash",
  systemPrompt: loadSubagentPrompt("explore"),
  promptMode: "replace",
  isDefault: true,
};

export default explore;
