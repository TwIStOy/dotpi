/**
 * Permission gate — static toggles. Edit values here (no `process.env`).
 */

import { AGENIX_RUN_PREFIX } from "./constants.js";

/**
 * When `true`, register tool-call gates (blocked paths, future rules).
 * Allowed values: `true` | `false`
 */
export const PERMISSION_GATE_ENABLED = true;

/**
 * For `read` tool calls: resolved absolute paths that match or sit under any of
 * these prefixes are blocked (case-sensitive on POSIX). Add entries as new
 * gates need path denylists.
 */
export const READ_BLOCKED_PATH_PREFIXES: readonly string[] = [AGENIX_RUN_PREFIX];
