import type { AgentConfig } from "./types.js";
import generalPurpose from "./default-agents/general-purpose.js";
import explore from "./default-agents/explore.js";
import plan from "./default-agents/plan.js";
import oracle from "./default-agents/oracle.js";
import librarian from "./default-agents/librarian.js";

export { READ_ONLY_TOOLS } from "./default-agents/shared.js";

export const DEFAULT_AGENTS: Map<string, AgentConfig> = new Map([
  [generalPurpose.name, generalPurpose],
  [explore.name, explore],
  [plan.name, plan],
  [oracle.name, oracle],
  [librarian.name, librarian],
]);
