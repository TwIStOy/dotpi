/**
 * Compact statusline — static toggles. Edit values here (no `process.env`).
 */

/**
 * When `true`, `initCompactStatusline` registers handlers and UI.
 * Allowed values: `true` | `false`
 */
export const COMPACT_STATUSLINE_ENABLED = true;

/**
 * When `true`, installs an empty custom footer so the default Pi footer line is
 * hidden while the compact status widget remains visible.
 * Allowed values: `true` | `false`
 */
export const REPLACE_BUILTIN_FOOTER = true;

/**
 * When `true`, appends `*` next to the branch segment when the worktree is dirty.
 * Allowed values: `true` | `false`
 */
export const SHOW_DIRTY_MARKER = true;

/**
 * Timeout (ms) for each `git` subprocess used to refresh branch / dirty state.
 * Allowed values: positive integers, e.g. `500`–`5000`; very low values may
 * yield empty results on slow disks or large repos.
 */
export const GIT_REFRESH_TIMEOUT_MS = 1500;
