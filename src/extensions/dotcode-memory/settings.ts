import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Pi project / user settings key (under the object returned by
 * `settingsManager.getProjectSettings()`):
 *
 * ```json
 * {
 *   "dotcodeMemory": {
 *     "enabled": false,
 *     "namespace": "agent-a"
 *   }
 * }
 * ```
 *
 * Omit the key or set `"enabled": true` (default) to load memory tools and prompts.
 */
export const DOTCODE_MEMORY_SETTINGS_KEY = "dotcodeMemory";

export type DotcodeMemorySettings = {
  enabled?: boolean;
  /** Passed to dotcode global `--namespace` (default ""). */
  namespace?: string;
};

const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Only `[a-zA-Z0-9_-]+` or empty; invalid values become "".
 */
export function sanitizeDotcodeNamespace(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  return NAMESPACE_PATTERN.test(trimmed) ? trimmed : "";
}

let sessionDotcodeNamespace = "";

/** Updated on session_start / before_agent_start from project settings. */
export function setSessionDotcodeNamespace(namespace: string): void {
  sessionDotcodeNamespace = namespace;
}

export function getSessionDotcodeNamespace(): string {
  return sessionDotcodeNamespace;
}

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

/**
 * Namespace for dotcode CLI (`--namespace`), from `dotcodeMemory.namespace`.
 */
export function getDotcodeNamespace(ctx?: ExtensionContext): string {
  const settings = (
    ctx as { settingsManager?: { getProjectSettings?: () => unknown } }
  )?.settingsManager;
  const project = settings?.getProjectSettings?.();
  const cfg = readFromProjectSettings(project);
  return sanitizeDotcodeNamespace(cfg?.namespace ?? "");
}