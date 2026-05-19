import type {
  ExtensionAPI,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import { evaluateToolCallGates } from "./gates.js";
import { PERMISSION_GATE_ENABLED } from "./settings.js";

const INSTALL_GUARD = Symbol.for("dotpi.permission-gate.installed");

/**
 * Central place for tool-call allow/deny rules. Agenix: blocks `read` and
 * `bash` that touch decrypted secrets under `/run/agenix/`.
 */
export default function initPermissionGate(pi: ExtensionAPI): void {
  if (!PERMISSION_GATE_ENABLED) return;

  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  pi.on("tool_call", (event, ctx): ToolCallEventResult | undefined => {
    return evaluateToolCallGates(ctx, event);
  });
}
