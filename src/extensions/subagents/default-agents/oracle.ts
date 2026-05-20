import type { AgentConfig } from "../types.js";
import { loadSubagentPrompt } from "../prompt-loader.js";
import { READ_ONLY_TOOLS } from "./shared.js";

const oracle: AgentConfig = {
  name: "Oracle",
  displayName: "Oracle",
  description:
    "Read-only consultation agent. Strategic technical advisor for debugging hard problems and high-difficulty architecture design. Use when you need elevated reasoning on complex trade-offs, architecture decisions, or after multiple failed fix attempts.",
  trigger:
    "Complex architecture decisions, self-review after significant implementation, hard debugging after 2+ failed fix attempts, unfamiliar code patterns, security/performance concerns, multi-system trade-offs",
  builtinToolNames: READ_ONLY_TOOLS,
  extensions: true,
  skills: true,
  thinking: "high",
  routingHints: {
    cost: "EXPENSIVE",
    category: "advisor",
    triggers: [
      {
        domain: "Architecture decisions",
        trigger: "Multi-system tradeoffs, unfamiliar patterns",
      },
      {
        domain: "Self-review",
        trigger: "After completing significant implementation",
      },
      { domain: "Hard debugging", trigger: "After 2+ failed fix attempts" },
    ],
    useWhen: [
      "Complex architecture design",
      "After completing significant work",
      "2+ failed fix attempts",
      "Unfamiliar code patterns",
      "Security/performance concerns",
      "Multi-system tradeoffs",
    ],
    avoidWhen: [
      "Simple file operations (use direct tools)",
      "First attempt at any fix (try yourself first)",
      "Questions answerable from code you've read",
      "Trivial decisions (variable names, formatting)",
      "Things you can infer from existing code patterns",
    ],
  },
  systemPrompt: loadSubagentPrompt("oracle"),
  promptMode: "replace",
};

export default oracle;
