/**
 * Optional subagent badge: another extension (or dotpi itself) may register an
 * object with `getCurrentSubagent(cwd?)` on this well-known symbol.
 */
export const SUBAGENT_STATUSLINE_BRIDGE_SYMBOL = Symbol.for(
  "dotpi.compact-statusline.subagent-bridge",
);
