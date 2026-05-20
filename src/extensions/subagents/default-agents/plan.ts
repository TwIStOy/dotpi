import type { AgentConfig } from "../types.js";
import { loadSubagentPrompt } from "../prompt-loader.js";
import { READ_ONLY_TOOLS } from "./shared.js";

const plan: AgentConfig = {
  name: "Plan",
  displayName: "Plan",
  description:
    "Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.",
  trigger:
    "Designing implementation plans, architectural analysis, step-by-step planning",
  builtinToolNames: READ_ONLY_TOOLS,
  extensions: true,
  skills: true,
  systemPrompt: loadSubagentPrompt("plan"),
  promptMode: "replace",
  isDefault: true,
};

export default plan;
