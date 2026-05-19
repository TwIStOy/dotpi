import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CONTEXT_USAGE_MESSAGE_TYPE } from "./constants.js";
import {
  buildContextUsageDetails,
  renderContextUsageMessage,
} from "./context-usage.js";

const INSTALL_GUARD = Symbol.for("dotpi.context-usage.installed");

/**
 * `/context` command and renderer: estimated token breakdown (ported from
 * pi-qol `context-usage.ts`).
 */
export default function initContextUsage(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  let latestSystemPromptOptions: unknown;

  pi.on("before_agent_start", (event: { systemPromptOptions?: unknown }) => {
    latestSystemPromptOptions = event?.systemPromptOptions;
  });

  pi.registerMessageRenderer(
    CONTEXT_USAGE_MESSAGE_TYPE,
    renderContextUsageMessage,
  );

  pi.registerCommand("context", {
    description:
      "Show estimated context-window usage and category breakdown (inline).",
    handler: async (_args, ctx) => {
      const details = buildContextUsageDetails(
        pi,
        ctx,
        latestSystemPromptOptions,
      );
      if (!details) {
        ctx.ui.notify(
          "Context usage is not available yet (no token estimate from the session).",
          "warning",
        );
        return;
      }
      pi.sendMessage(
        {
          customType: CONTEXT_USAGE_MESSAGE_TYPE,
          content: "Context usage snapshot",
          details,
          display: true,
        },
        { deliverAs: "followUp", triggerTurn: false },
      );
    },
  });
}
