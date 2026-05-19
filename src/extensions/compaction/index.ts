import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  compactionTriggerReason,
  handleBranchSummary,
  handleSessionCompaction,
} from "./compaction.js";
import {
  BRANCH_SUMMARY_ENABLED,
  COMPACTION_NOTIFY,
  CUSTOM_COMPACTION_ENABLED,
  IDLE_COMPACTION_ENABLED,
  IDLE_COMPACTION_TIMEOUT_SECONDS,
} from "./settings.js";
import { isStaleCtxError, stringifyError } from "./util.js";

const INSTALL_GUARD = Symbol.for("dotpi.compaction.installed");

/**
 * Custom session compaction summaries, optional `/tree` branch summaries, and
 * optional idle-triggered compaction (ported from pi-qol `compaction.ts`).
 */
export default function initCompaction(pi: ExtensionAPI): void {
  const anyEnabled =
    CUSTOM_COMPACTION_ENABLED ||
    BRANCH_SUMMARY_ENABLED ||
    IDLE_COMPACTION_ENABLED;
  if (!anyEnabled) return;

  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  let idleCompactionTimer: ReturnType<typeof setTimeout> | undefined;

  const clearIdleCompactionTimer = () => {
    if (idleCompactionTimer) clearTimeout(idleCompactionTimer);
    idleCompactionTimer = undefined;
  };

  const scheduleIdleCompaction = (ctx: ExtensionContext) => {
    clearIdleCompactionTimer();
    if (!IDLE_COMPACTION_ENABLED) return;
    const reason = compactionTriggerReason(ctx);
    if (!reason) return;
    const delayMs =
      Math.max(1, Math.floor(IDLE_COMPACTION_TIMEOUT_SECONDS)) * 1000;
    idleCompactionTimer = setTimeout(() => {
      idleCompactionTimer = undefined;
      try {
        if (!ctx.isIdle?.()) return;
      } catch (error) {
        if (isStaleCtxError(error)) return;
        throw error;
      }
      const latestReason = compactionTriggerReason(ctx);
      if (!latestReason) return;
      const notifySafely = (message: string, level: "info" | "error") => {
        try {
          if (ctx.hasUI && COMPACTION_NOTIFY) ctx.ui.notify(message, level);
        } catch (error) {
          if (isStaleCtxError(error)) return;
          throw error;
        }
      };
      notifySafely(`Idle compaction starting: ${latestReason}`, "info");
      try {
        ctx.compact?.({
          customInstructions: `Idle compaction triggered after inactivity because ${latestReason}. Preserve current task state, decisions, files, blockers, and next steps.`,
          onComplete: () => notifySafely("Idle compaction completed.", "info"),
          onError: (error: Error) =>
            notifySafely(
              `Idle compaction failed: ${stringifyError(error)}`,
              "error",
            ),
        });
      } catch (error) {
        if (isStaleCtxError(error)) return;
        throw error;
      }
    }, delayMs);
    idleCompactionTimer.unref?.();
  };

  if (CUSTOM_COMPACTION_ENABLED) {
    pi.on("session_before_compact", (event, ctx) =>
      handleSessionCompaction(event, ctx),
    );
  }
  if (BRANCH_SUMMARY_ENABLED) {
    pi.on("session_before_tree", (event, ctx) =>
      handleBranchSummary(event, ctx),
    );
  }
  if (IDLE_COMPACTION_ENABLED) {
    pi.on("agent_start", () => {
      clearIdleCompactionTimer();
    });
    pi.on("agent_end", (_event, ctx) => {
      scheduleIdleCompaction(ctx);
    });
    pi.on("session_shutdown", () => {
      clearIdleCompactionTimer();
    });
  }
}
