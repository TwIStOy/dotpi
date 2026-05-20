import type { AgentConfig } from "../types.js";
import { loadSubagentPrompt } from "../prompt-loader.js";

const generalPurpose: AgentConfig = {
  name: "general-purpose",
  displayName: "Agent",
  description:
    "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
  trigger: "Complex multi-step tasks that need file editing or code generation",
  routingHints: {
    cost: "EXPENSIVE",
    category: "other",
    triggers: [
      {
        domain: "General-purpose",
        trigger:
          "Multi-step implementation when no narrower subagent fits; heavy execution",
      },
    ],
  },
  extensions: true,
  skills: true,
  systemPrompt: loadSubagentPrompt("general-purpose"),
  promptMode: "append",
  isDefault: true,
};

export default generalPurpose;
