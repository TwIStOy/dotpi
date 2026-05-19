/**
 * Decrypted secrets from agenix live under this tree; reads and shell access
 * must be blocked (aligned with agenix / OpenCode guard hooks).
 */

/** Normalized absolute path prefix (no trailing slash); used for path checks. */
export const AGENIX_RUN_PREFIX = "/run/agenix";

/** Human-readable path for messages (matches on-disk layout). */
export const AGENIX_MESSAGE_PATH = "/run/agenix/";

/** Detect shell commands that reference agenix decrypted paths. */
export const BASH_AGENIX_PATTERN = /\/run\/agenix\//;

export function rejectedReadAgenixMessage(quotedPath: string): string {
  return (
    `REJECTED: "${quotedPath}" is a decrypted secret managed by agenix. ` +
    `Reading files under ${AGENIX_MESSAGE_PATH} is not allowed.`
  );
}

export function rejectedBashAgenixMessage(): string {
  return (
    `REJECTED: The command references ${AGENIX_MESSAGE_PATH} which contains ` +
    `decrypted secrets managed by agenix. ` +
    `Accessing files under ${AGENIX_MESSAGE_PATH} is not allowed.`
  );
}
