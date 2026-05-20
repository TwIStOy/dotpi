import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { dotcodeInstallHint, isDotcodeBinaryAvailable } from "./cli-health.js";
import { buildSelfImprovePrompt } from "./commands/self-improve-template.js";
import { registerJournalTools } from "./journal-tools.js";
import { buildMemoryStatusReport } from "./memory-status.js";
import { registerMemoryTools } from "./memory-tools.js";
import {
  getDotcodeNamespace,
  isDisabledByEnv,
  isDotcodeMemoryEnabled,
  setSessionDotcodeNamespace,
} from "./settings.js";
import { generateSystemPrompt } from "./system-prompt.js";

const INSTALL_GUARD = Symbol.for("dotpi.dotcode-memory.installed");

let toolsRegistered = false;
let startupNotifyDone = false;

async function maybeNotifyMissingCli(ctx: ExtensionContext): Promise<void> {
  if (startupNotifyDone) return;
  startupNotifyDone = true;
  if (!(await isDotcodeBinaryAvailable())) {
    if (ctx.hasUI) {
      ctx.ui.notify(dotcodeInstallHint(), "warning");
    }
  }
}

function ensureToolsRegistered(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (toolsRegistered) return;
  toolsRegistered = true;
  registerMemoryTools(pi);
  registerJournalTools(pi, () => ctx.cwd);
}

export default function initDotcodeMemory(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  pi.registerCommand("memory-status", {
    description:
      "Show dotcode-memory enablement, CLI health, resolved binary, and domain list.",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      setSessionDotcodeNamespace(getDotcodeNamespace(ctx));
      const report = await buildMemoryStatusReport(ctx);
      if (ctx.hasUI) {
        ctx.ui.notify(report, "info");
      }
    },
  });

  pi.registerCommand("self-improve", {
    description:
      "Reflect on the current session, identify learnings, persist to memory/journal, and improve skills",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!ctx.isIdle()) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            "Agent is busy. Wait for the current turn to finish, then run /self-improve again.",
            "warning",
          );
        }
        return;
      }

      if (!isDotcodeMemoryEnabled(ctx)) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            "dotcode-memory tools are disabled (settings or DOTPI_DOTCODE_MEMORY). Reflection can continue, but memory-* and journal-* writes may fail until enabled.",
            "warning",
          );
        }
      }

      setSessionDotcodeNamespace(getDotcodeNamespace(ctx));
      pi.sendUserMessage(buildSelfImprovePrompt(args));
    },
  });

  if (isDisabledByEnv()) return;

  pi.on("session_start", async (_event, ctx) => {
    if (!isDotcodeMemoryEnabled(ctx)) return;
    setSessionDotcodeNamespace(getDotcodeNamespace(ctx));
    ensureToolsRegistered(pi, ctx);
    await maybeNotifyMissingCli(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!isDotcodeMemoryEnabled(ctx)) return;
    setSessionDotcodeNamespace(getDotcodeNamespace(ctx));
    if (!toolsRegistered) {
      ensureToolsRegistered(pi, ctx);
    }
    const appendix = await generateSystemPrompt();
    return {
      systemPrompt: event.systemPrompt + "\n\n" + appendix,
    };
  });
}