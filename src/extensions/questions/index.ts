import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { QUESTIONS_SYSTEM_APPENDIX } from "./instructions.js";
import registerQuestions from "./questions.js";

export default function initQuestions(pi: ExtensionAPI): void {
  pi.on("before_agent_start", async (event) => {
    // Pi only applies `systemPrompt` from the return value (mutating `event` is ignored).
    return {
      systemPrompt: event.systemPrompt + "\n\n" + QUESTIONS_SYSTEM_APPENDIX,
    };
  });
  registerQuestions(pi);
}
