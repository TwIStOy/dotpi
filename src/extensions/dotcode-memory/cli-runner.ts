/**
 * CLI runner — spawns the dotcode Rust CLI binary with --json output.
 */
import { execFile as execFileCb } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  getSessionDotcodeNamespace,
  sanitizeDotcodeNamespace,
} from "./settings.js";

const execFile = promisify(execFileCb);

export type RunDotcodeOptions = {
  namespace?: string;
};

/** argv after binary: global flags, then subcommand args. */
export function buildDotcodeArgv(
  args: string[],
  options?: RunDotcodeOptions,
): string[] {
  const ns =
    options?.namespace !== undefined
      ? sanitizeDotcodeNamespace(options.namespace)
      : getSessionDotcodeNamespace();
  return ["--json", ...(ns ? ["--namespace", ns] : []), ...args];
}

let cachedBinaryPath: string | undefined;

function extensionDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function getDotcodeBinaryPath(): string {
  return findBinary();
}

function findBinary(): string {
  if (cachedBinaryPath) return cachedBinaryPath;

  if (process.env.DOTCODE_CLI) {
    cachedBinaryPath = process.env.DOTCODE_CLI;
    return cachedBinaryPath;
  }

  let dir = resolve(extensionDir());
  for (let i = 0; i < 10; i++) {
    for (const variant of ["release", "debug"]) {
      const candidate = join(dir, "tool", "target", variant, "dotcode");
      if (existsSync(candidate)) {
        cachedBinaryPath = candidate;
        return cachedBinaryPath;
      }
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  dir = resolve(extensionDir());
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "result", "bin", "dotcode");
    if (existsSync(candidate)) {
      cachedBinaryPath = candidate;
      return cachedBinaryPath;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }

  cachedBinaryPath = "dotcode";
  return cachedBinaryPath;
}

export async function runDotcode(
  args: string[],
  options?: RunDotcodeOptions,
): Promise<unknown> {
  const bin = findBinary();
  try {
    const { stdout } = await execFile(bin, buildDotcodeArgv(args, options), {
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout);
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    const message = err.stderr?.trim() || err.message || String(e);
    throw new Error(message, e instanceof Error ? { cause: e } : undefined);
  }
}