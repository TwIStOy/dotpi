import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerJournalTools } from "./journal-tools.js";
import { registerMemoryTools } from "./memory-tools.js";
import { generateSystemPrompt } from "./system-prompt.js";

export default function initDotcodeMemory(pi: ExtensionAPI): void {
  registerMemoryTools(pi);
  registerJournalTools(pi, () => process.cwd());

  pi.on("before_agent_start", async (event) => {
    const appendix = await generateSystemPrompt();
    return {
      systemPrompt: event.systemPrompt + "\n\n" + appendix,
    };
  });
}