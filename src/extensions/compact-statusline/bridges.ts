import { SUBAGENT_STATUSLINE_BRIDGE_SYMBOL } from "./constants.js";

export interface SubagentStatuslineBridge {
  getCurrentSubagent(
    cwd?: string,
  ): { name: string; color?: string } | undefined;
}

export function readSubagentStatuslineBridge():
  | SubagentStatuslineBridge
  | undefined {
  const host = globalThis as unknown as Record<PropertyKey, unknown>;
  const value = host[SUBAGENT_STATUSLINE_BRIDGE_SYMBOL];
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as SubagentStatuslineBridge).getCurrentSubagent !== "function"
  ) {
    return undefined;
  }
  return value as SubagentStatuslineBridge;
}
