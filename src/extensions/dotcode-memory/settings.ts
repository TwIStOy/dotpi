import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Pi project / user settings key (under the object returned by
 * `settingsManager.getProjectSettings()`):
 *
 * ```json
 * {
 *   "dotcodeMemory": {
 *     "enabled": false
 *   }
 * }
 * ```
 *
 * Omit the key or set `"enabled": true` (default) to load memory tools and prompts.
 */
export const DOTCODE_MEMORY_SETTINGS_KEY = "dotcodeMemory";

export type DotcodeMemorySettings = {
  enabled?: boolean;
};

/** Process-wide override: set `DOTPI_DOTCODE_MEMORY=0` to disable before any session. */
export function isDisabledByEnv(): boolean {
  const v = process.env.DOTPI_DOTCODE_MEMORY?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off";
}

function readFromProjectSettings(
  raw: unknown,
): DotcodeMemorySettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const block = (raw as Record<string, unknown>)[DOTCODE_MEMORY_SETTINGS_KEY];
  if (!block || typeof block !== "object") return undefined;
  return block as DotcodeMemorySettings;
}

/**
 * Whether dotcode-memory should register tools and append memory/journal instructions.
 * Defaults to enabled when unset.
 */
export function isDotcodeMemoryEnabled(ctx?: ExtensionContext): boolean {
  if (isDisabledByEnv()) return false;
  const settings = (
    ctx as { settingsManager?: { getProjectSettings?: () => unknown } }
  )?.settingsManager;
  const project = settings?.getProjectSettings?.();
  const cfg = readFromProjectSettings(project);
  if (cfg?.enabled === false) return false;
  return true;
}