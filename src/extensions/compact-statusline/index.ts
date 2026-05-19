import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import {
  COMPACT_STATUSLINE_ENABLED,
  REPLACE_BUILTIN_FOOTER,
} from "./settings.js";
import {
  makeFallbackGitState,
  refreshGitState,
  renderStatusLine,
  type GitState,
} from "./statusline.js";

const WIDGET_ID = "dotpi-compact-statusline";
const INSTALL_GUARD = Symbol.for("dotpi.compact-statusline.installed");

/**
 * Compact statusline: repo / model / thinking level / context bar; optional
 * subagent badge via `SUBAGENT_STATUSLINE_BRIDGE_SYMBOL` or `PI_SUBAGENT_*` env.
 */
export default function initCompactStatusline(pi: ExtensionAPI): void {
  if (!COMPACT_STATUSLINE_ENABLED) return;

  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  let activeTui: TUI | undefined;
  let gitState: GitState | undefined;
  let refreshInFlight: Promise<GitState> | undefined;

  const requestRender = () => activeTui?.requestRender();

  const refreshGit = (ctx: ExtensionContext) => {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = refreshGitState(pi, ctx)
      .then((next) => {
        gitState = next;
        requestRender();
        return next;
      })
      .finally(() => {
        refreshInFlight = undefined;
      });
    return refreshInFlight;
  };

  const installUi = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;

    gitState = makeFallbackGitState(ctx.cwd);
    void refreshGit(ctx);

    queueMicrotask(() => {
      ctx.ui.setWidget(WIDGET_ID, (tui, theme) => {
        activeTui = tui;
        return {
          invalidate() {},
          render(width: number): string[] {
            return [
              renderStatusLine(
                width,
                ctx,
                gitState ?? makeFallbackGitState(ctx.cwd),
                pi,
                theme,
              ),
            ];
          },
        };
      });
    });

    if (REPLACE_BUILTIN_FOOTER) {
      ctx.ui.setFooter((tui, _theme, footerData) => {
        activeTui = tui;
        const unsub = footerData.onBranchChange(() => {
          void refreshGit(ctx);
          requestRender();
        });
        return {
          dispose: unsub,
          invalidate() {},
          render: () => [],
        };
      });
    }
  };

  const resetUi = (ctx: ExtensionContext) => {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(WIDGET_ID, undefined);
    if (REPLACE_BUILTIN_FOOTER) ctx.ui.setFooter(undefined);
    activeTui = undefined;
  };

  pi.on("session_start", (_event, ctx) => {
    installUi(ctx);
  });

  pi.on("session_shutdown", (_event, ctx) => {
    resetUi(ctx);
  });

  pi.on("model_select", (_event, ctx) => {
    if (!ctx.hasUI) return;
    void refreshGit(ctx);
    requestRender();
  });

  pi.on("thinking_level_select", (_event, ctx) => {
    if (ctx.hasUI) requestRender();
  });

  pi.on("agent_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    void refreshGit(ctx);
    requestRender();
  });

  pi.on("message_update", (_event, ctx) => {
    if (ctx.hasUI) requestRender();
  });

  pi.on("agent_end", (_event, ctx) => {
    if (!ctx.hasUI) return;
    void refreshGit(ctx);
    requestRender();
  });

  pi.on("session_compact", (_event, ctx) => {
    if (!ctx.hasUI) return;
    void refreshGit(ctx);
    requestRender();
  });

  pi.on("turn_end", (_event, ctx) => {
    if (ctx.hasUI) requestRender();
  });
}
