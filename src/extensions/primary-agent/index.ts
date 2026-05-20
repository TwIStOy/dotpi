import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  PRIMARY_AGENT_CHANGED_EVENT,
  PRIMARY_AGENT_STATUSLINE_BRIDGE_SYMBOL,
} from "../compact-statusline/constants.js";
import {
  listPrimaryAgentPresets,
  loadPrimaryAgentPreset,
  type LoadedPrimaryAgentPreset,
} from "./prompt-loader.js";
import {
  PRIMARY_AGENT_PRESET_SLUGS,
  type PrimaryAgentPresetSlug,
} from "./prompt-manifest.js";
import { buildRoutingDynamicAppendix } from "./routing/dynamic-appendix.js";
import { applyPrimaryAgentToolPolicy } from "./tool-policy.js";

const INSTALL_GUARD = Symbol.for("dotpi.primary-agent.installed");

/** Preset applied when a main session starts and the user has not opted into built-in default. */
const DEFAULT_PRIMARY_AGENT_SLUG: PrimaryAgentPresetSlug = "routing";

/** Session id → selected preset id, or unset / cleared for built-in default */
const selectionBySession = new Map<string, string>();

/** User asked for Pi built-in prompt/tools (`/primary-agent default`) — skip auto Routing for this session. */
const sessionsPreferBuiltinDefault = new Set<string>();

/** Snapshot of `pi.getActiveTools()` before the first tool-policy preset in this session */
const originalToolsBySession = new Map<string, string[]>();

function emitPrimaryAgentSelectionChanged(pi: ExtensionAPI): void {
  pi.events.emit(PRIMARY_AGENT_CHANGED_EVENT, {});
}

function getPresets(): LoadedPrimaryAgentPreset[] {
  return listPrimaryAgentPresets();
}

function getPreset(id: string): LoadedPrimaryAgentPreset | undefined {
  if (!(PRIMARY_AGENT_PRESET_SLUGS as readonly string[]).includes(id)) {
    return undefined;
  }
  try {
    return loadPrimaryAgentPreset(id);
  } catch {
    return undefined;
  }
}

function getSelectedId(ctx: ExtensionCommandContext): string | undefined {
  const sessionId = ctx.sessionManager.getSessionId();
  return selectionBySession.get(sessionId);
}

function setSelectedId(ctx: ExtensionCommandContext, id: string | undefined) {
  const sessionId = ctx.sessionManager.getSessionId();
  if (id === undefined) {
    selectionBySession.delete(sessionId);
  } else {
    selectionBySession.set(sessionId, id);
  }
}

function applyPresetSelectionAndTools(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  preset: LoadedPrimaryAgentPreset,
): void {
  const sessionId = ctx.sessionManager.getSessionId();
  sessionsPreferBuiltinDefault.delete(sessionId);
  selectionBySession.set(sessionId, preset.id);
  if (preset.toolPolicy) {
    maybeSnapshotToolsForSession(pi, sessionId);
    applyPrimaryAgentToolPolicy(pi, ctx, preset.toolPolicy);
  }
  emitPrimaryAgentSelectionChanged(pi);
}

function ensureDefaultPrimaryAgentOnSessionStart(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  const sessionId = ctx.sessionManager.getSessionId();
  if (sessionsPreferBuiltinDefault.has(sessionId)) return;
  if (selectionBySession.has(sessionId)) return;
  const preset = getPreset(DEFAULT_PRIMARY_AGENT_SLUG);
  if (!preset) return;
  applyPresetSelectionAndTools(pi, ctx, preset);
}

function maybeSnapshotToolsForSession(
  pi: ExtensionAPI,
  sessionId: string,
): void {
  if (!originalToolsBySession.has(sessionId)) {
    originalToolsBySession.set(sessionId, [...pi.getActiveTools()]);
  }
}

function clearPrimaryAgentSelection(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
): void {
  const sessionId = ctx.sessionManager.getSessionId();
  sessionsPreferBuiltinDefault.add(sessionId);
  setSelectedId(ctx, undefined);
  const snap = originalToolsBySession.get(sessionId);
  if (snap) {
    pi.setActiveTools(snap);
    originalToolsBySession.delete(sessionId);
  }
  emitPrimaryAgentSelectionChanged(pi);
}

function activatePrimaryAgentPreset(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  preset: LoadedPrimaryAgentPreset,
): void {
  applyPresetSelectionAndTools(pi, ctx, preset);
}

/**
 * Primary agent: choose a preset system prompt for this session (`/primary-agent`).
 */
export default function initPrimaryAgent(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  const host = globalThis as unknown as Record<PropertyKey, unknown>;
  host[PRIMARY_AGENT_STATUSLINE_BRIDGE_SYMBOL] = {
    getCurrentPrimaryAgentDisplayName(sessionId: string): string | undefined {
      const id = selectionBySession.get(sessionId);
      if (!id) return undefined;
      const preset = getPreset(id);
      return preset?.label ?? id;
    },
  };

  pi.on("session_start", async (_event, ctx) => {
    ensureDefaultPrimaryAgentOnSessionStart(pi, ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const sessionId = ctx.sessionManager.getSessionId();
    const promptId = selectionBySession.get(sessionId);
    if (!promptId) return;

    let preset: LoadedPrimaryAgentPreset;
    try {
      preset = loadPrimaryAgentPreset(promptId);
    } catch {
      selectionBySession.delete(sessionId);
      emitPrimaryAgentSelectionChanged(pi);
      return;
    }
    let systemPrompt = preset.prompt;
    if (preset.dynamicAppendix === "routing") {
      systemPrompt = `${preset.prompt}\n\n---\n\n${buildRoutingDynamicAppendix(pi, ctx as ExtensionContext)}`;
    }
    if (preset.toolPolicy) {
      applyPrimaryAgentToolPolicy(pi, ctx as ExtensionContext, preset.toolPolicy);
    }
    // Pi only applies `systemPrompt` from the handler return value (mutating `event` is ignored).
    return { systemPrompt };
  });

  pi.registerCommand("primary-agent", {
    description:
      "Switch system prompt and tool permissions (markdown under primary-agent/prompts/ or primary-agent/routing/prompts/)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const presets = getPresets();
      const trimmed = args.trim();

      if (trimmed === "" || trimmed === "select" || trimmed === "menu") {
        if (presets.length === 0) {
          if (ctx.hasUI) {
            ctx.ui.notify(
              "No system prompt presets yet. Add a slug to PRIMARY_AGENT_PRESET_SLUGS in prompt-manifest.ts and add prompts/<slug>.md.",
              "info",
            );
          }
          return;
        }

        if (!ctx.hasUI) {
          return;
        }

        const options = [
          "default — use built-in system prompt",
          ...presets.map((p) => `${p.id} — ${p.label}`),
        ];
        const choice = await ctx.ui.select("System prompt preset", options);
        if (!choice) return;

        if (choice.startsWith("default —")) {
          clearPrimaryAgentSelection(pi, ctx);
          ctx.ui.notify("Primary agent: built-in default (prompt + tools)", "info");
          return;
        }
        const id = choice.split(" — ")[0] ?? "";
        const preset = getPreset(id);
        if (preset) {
          activatePrimaryAgentPreset(pi, ctx, preset);
          ctx.ui.notify(`Primary agent preset: ${preset.label} (${preset.id})`, "info");
        }
        return;
      }

      const lower = trimmed.toLowerCase();
      if (lower === "reset" || lower === "default" || lower === "clear") {
        clearPrimaryAgentSelection(pi, ctx);
        if (ctx.hasUI) {
          ctx.ui.notify("Primary agent: built-in default (prompt + tools)", "info");
        }
        return;
      }

      if (lower === "status" || lower === "current") {
        const current = getSelectedId(ctx);
        if (!current) {
          if (ctx.hasUI) {
            ctx.ui.notify("Primary agent: built-in default", "info");
          }
          return;
        }
        const preset = getPreset(current);
        if (preset && ctx.hasUI) {
          const toolHint = preset.toolPolicy
            ? `tools: ${preset.toolPolicy.allowlist?.length ? preset.toolPolicy.allowlist.join(", ") : "all"}${preset.toolPolicy.disallow.length ? `; disallowed: ${preset.toolPolicy.disallow.join(", ")}` : ""}`
            : "tools: unchanged";
          const dyn =
            preset.dynamicAppendix === "routing"
              ? " | runtime appendix: routing"
              : "";
          ctx.ui.notify(
            `Primary agent: ${preset.label} (${preset.id}) — ${toolHint}${dyn}`,
            "info",
          );
        } else if (ctx.hasUI) {
          ctx.ui.notify(
            `Selection "${current}" is missing or invalid; cleared.`,
            "warning",
          );
          clearPrimaryAgentSelection(pi, ctx);
        }
        return;
      }

      const preset = getPreset(trimmed);
      if (!preset) {
        if (presets.length === 0 && ctx.hasUI) {
          ctx.ui.notify(
            `No preset "${trimmed}". Add slugs to prompt-manifest.ts and markdown under prompts/.`,
            "warning",
          );
        } else if (ctx.hasUI) {
          const ids = presets.map((p) => p.id).join(", ");
          ctx.ui.notify(
            `Unknown preset "${trimmed}". Try: ${ids || "(none defined)"}`,
            "warning",
          );
        }
        return;
      }

      activatePrimaryAgentPreset(pi, ctx, preset);
      if (ctx.hasUI) {
        ctx.ui.notify(`Primary agent preset: ${preset.label} (${preset.id})`, "info");
      }
    },
  });
}
