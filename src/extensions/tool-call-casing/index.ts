import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  buildCaseInsensitiveToolNameMap,
  normalizeToolCallNamesInMessage,
} from "./normalize.js";

const INSTALL_GUARD = Symbol.for("dotpi.tool-call-casing.installed");

/**
 * Some models call tools with wrong casing (`Read`, `Bash`, `Memory-Read`, …).
 * Pi resolves tools by exact name before `tool_call` hooks run, so those calls
 * would fail as "tool not found". Normalize on the finalized assistant message
 * (same object reference used for execution) so lookup succeeds.
 */
export default function initToolCallCasing(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  pi.on("message_end", (event): void => {
    const canonicalByLowercase = buildCaseInsensitiveToolNameMap(
      pi.getActiveTools(),
    );
    normalizeToolCallNamesInMessage(event.message, canonicalByLowercase);
  });
}