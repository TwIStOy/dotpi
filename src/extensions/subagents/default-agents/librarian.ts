/**
 * Librarian subagent — adapted from Oh My OpenCode.
 * @see https://github.com/code-yeongyu/oh-my-openagent/blob/dev/src/agents/librarian.ts
 */
import type { AgentConfig } from "../types.js";
import { loadSubagentPrompt } from "../prompt-loader.js";
import { READ_ONLY_TOOLS } from "./shared.js";

const librarian: AgentConfig = {
  name: "Librarian",
  displayName: "Librarian",
  description:
    "Specialized agent for open-source and external-library research: official docs, remote source on GitHub, usage examples, and issue/PR history. Use when the user names an unfamiliar package, wants implementation evidence (with permalinks), or needs docs beyond the local repo. Read-only in the workspace; may clone or fetch under the system temp directory for evidence only.",
  trigger:
    "Unfamiliar libraries, external dependency behaviour, how upstream implements X, GitHub evidence, official docs, OSS examples",
  builtinToolNames: READ_ONLY_TOOLS,
  extensions: true,
  skills: true,
  model: "glm-4.7-flash",
  systemPrompt: loadSubagentPrompt("librarian", {
    CURRENT_YEAR: String(new Date().getFullYear()),
  }),
  promptMode: "replace",
};

export default librarian;
