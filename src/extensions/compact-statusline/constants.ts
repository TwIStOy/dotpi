/**
 * Optional subagent badge: another extension (or dotpi itself) may register an
 * object with `getCurrentSubagent(cwd?)` on this well-known symbol.
 */
export const SUBAGENT_STATUSLINE_BRIDGE_SYMBOL = Symbol.for(
  "dotpi.compact-statusline.subagent-bridge",
);

/**
 * Primary-agent preset label for the compact statusline (`primary-agent` extension registers this).
 */
export const PRIMARY_AGENT_STATUSLINE_BRIDGE_SYMBOL = Symbol.for(
  "dotpi.compact-statusline.primary-agent-bridge",
);

/** Emitted when `/primary-agent` selection changes (compact statusline listens). */
export const PRIMARY_AGENT_CHANGED_EVENT = "dotpi:primary-agent-changed";
