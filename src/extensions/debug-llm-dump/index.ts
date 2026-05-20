import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import { describeLlmDumpToggle, isLlmDumpEnabled, setLlmDumpEnabled } from "./enabled.js";
import { scheduleProviderPayloadDump } from "./dump.js";

const INSTALL_GUARD = Symbol.for("dotpi.debug-llm-dump.installed");

/**
 * Dumps each provider (LLM) request payload as JSON under ~/.dotpi/debug-dump.
 *
 * Toggle:
 * - `/dotpi-debug-dump on|off|status`
 * - Or create/remove ~/.dotpi/debug-dump/.enabled
 * - Or `DOTPI_DEBUG_DUMP_LLM=1` / `0` in the environment (overrides the file).
 */
export default function initDebugLlmDump(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  pi.registerCommand("dotpi-debug-dump", {
    description:
      "Toggle or show status of LLM request JSON dumps (~/.dotpi/debug-dump). Args: on | off | status.",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const sub = args.trim().toLowerCase();
      if (!sub || sub === "status") {
        ctx.ui.notify(describeLlmDumpToggle(), "info");
        return;
      }
      if (sub === "on" || sub === "1" || sub === "true") {
        await setLlmDumpEnabled(true);
        ctx.ui.notify(
          "LLM payload dumps enabled. Files go to ~/.dotpi/debug-dump/\n(DOTPI_DEBUG_DUMP_LLM=0 in env still forces off.)",
          "info",
        );
        return;
      }
      if (sub === "off" || sub === "0" || sub === "false") {
        await setLlmDumpEnabled(false);
        ctx.ui.notify(
          "LLM payload dumps disabled (removed ~/.dotpi/debug-dump/.enabled).",
          "info",
        );
        return;
      }
      ctx.ui.notify(
        `Unknown argument "${args.trim()}". Use: on | off | status`,
        "warning",
      );
    },
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (!isLlmDumpEnabled()) return;
    scheduleProviderPayloadDump(event.payload, ctx);
  });
}
