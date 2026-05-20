import { existsSync } from "node:fs";
import { getDotcodeBinaryPath, runDotcode } from "./cli-runner.js";

/**
 * Returns true if the dotcode CLI appears usable (local build path exists, or
 * `memory domains` succeeds on PATH).
 */
export async function isDotcodeBinaryAvailable(): Promise<boolean> {
  const bin = getDotcodeBinaryPath();
  if (bin !== "dotcode" && existsSync(bin)) {
    return true;
  }
  try {
    await runDotcode(["memory", "domains"]);
    return true;
  } catch {
    return false;
  }
}

export function dotcodeInstallHint(): string {
  return (
    "dotcode CLI not found or not working. Install or build dotcode, add it to PATH, " +
    "or set DOTCODE_CLI to the binary path (see docs/dotcode-memory.md)."
  );
}