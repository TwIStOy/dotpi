import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { dotcodeInstallHint, isDotcodeBinaryAvailable } from "./cli-health.js";
import { registerJournalTools } from "./journal-tools.js";
import { buildMemoryStatusReport } from "./memory-status.js";
import { registerMemoryTools } from "./memory-tools.js";
import { isDisabledByEnv, isDotcodeMemoryEnabled } from "./settings.js";
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
      const report = await buildMemoryStatusReport(ctx);
      if (ctx.hasUI) {
        ctx.ui.notify(report, "info");
      }
    },
  });

  if (isDisabledByEnv()) return;

  pi.on("session_start", async (_event, ctx) => {
    if (!isDotcodeMemoryEnabled(ctx)) return;
    ensureToolsRegistered(pi, ctx);
    await maybeNotifyMissingCli(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!isDotcodeMemoryEnabled(ctx)) return;
    if (!toolsRegistered) {
      ensureToolsRegistered(pi, ctx);
    }
    const appendix = await generateSystemPrompt();
    return {
      systemPrompt: event.systemPrompt + "\n\n" + appendix,
    };
  });
}