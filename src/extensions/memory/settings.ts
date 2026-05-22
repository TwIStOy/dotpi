import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/**
 * Pi project / user settings key (under the object returned by
 * `settingsManager.getProjectSettings()`):
 *
 * ```json
 * {
 *   "memory": {
 *     "enabled": false,
 *     "namespace": "agent-a"
 *   }
 * }
 * ```
 *
 * Omit the key or set `"enabled": true` (default) to load memory tools and prompts.
 */
export const MEMORY_SETTINGS_KEY = "memory";

export type MemorySettings = {
  enabled?: boolean;
  /** Passed to hat global `--namespace` (default ""). */
  namespace?: string;
};

const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Only `[a-zA-Z0-9_-]+` or empty; invalid values become "".
 */
export function sanitizeNamespace(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  return NAMESPACE_PATTERN.test(trimmed) ? trimmed : "";
}

let sessionNamespace = "";

/** Updated on session_start / before_agent_start from project settings. */
export function setSessionNamespace(namespace: string): void {
  sessionNamespace = namespace;
}

export function getSessionNamespace(): string {
  return sessionNamespace;
}

/** Process-wide override: set `DOTPI_MEMORY=0` to disable before any session. */
export function isDisabledByEnv(): boolean {
  const v = process.env.DOTPI_MEMORY?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "off";
}

function readFromProjectSettings(
  raw: unknown,
): MemorySettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const block = (raw as Record<string, unknown>)[MEMORY_SETTINGS_KEY];
  if (!block || typeof block !== "object") return undefined;
  return block as MemorySettings;
}

/**
 * Whether the memory extension should register tools and append memory/journal instructions.
 * Defaults to enabled when unset.
 */
export function isMemoryEnabled(ctx?: ExtensionContext): boolean {
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
 * Namespace for hat CLI (`--namespace`), from `memory.namespace`.
 */
export function getNamespace(ctx?: ExtensionContext): string {
  const settings = (
    ctx as { settingsManager?: { getProjectSettings?: () => unknown } }
  )?.settingsManager;
  const project = settings?.getProjectSettings?.();
  const cfg = readFromProjectSettings(project);
  return sanitizeNamespace(cfg?.namespace ?? "");
}
