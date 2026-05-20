import {
  PRIMARY_AGENT_STATUSLINE_BRIDGE_SYMBOL,
  SUBAGENT_STATUSLINE_BRIDGE_SYMBOL,
} from "./constants.js";

export interface SubagentStatuslineBridge {
  getCurrentSubagent(
    cwd?: string,
  ): { name: string; color?: string } | undefined;
}

export interface PrimaryAgentStatuslineBridge {
  getCurrentPrimaryAgentDisplayName(
    sessionId: string,
  ): string | undefined;
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

export function readPrimaryAgentStatuslineBridge():
  | PrimaryAgentStatuslineBridge
  | undefined {
  const host = globalThis as unknown as Record<PropertyKey, unknown>;
  const value = host[PRIMARY_AGENT_STATUSLINE_BRIDGE_SYMBOL];
  if (
    !value ||
    typeof value !== "object" ||
    typeof (value as PrimaryAgentStatuslineBridge)
      .getCurrentPrimaryAgentDisplayName !== "function"
  ) {
    return undefined;
  }
  return value as PrimaryAgentStatuslineBridge;
}
