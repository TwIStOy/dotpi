import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * If `filePath` resolves under `cwd`, return a relative path (forward slashes).
 * Otherwise return the trimmed input unchanged.
 */
export function displayPathUnderCwd(filePath: string, cwd: string): string {
  if (typeof filePath !== "string" || !filePath.trim()) return filePath;
  const trimmed = filePath.trim();
  if (typeof cwd !== "string" || !cwd.trim()) return trimmed;
  try {
    const absCwd = resolve(cwd);
    const absTarget = isAbsolute(trimmed)
      ? resolve(trimmed)
      : resolve(absCwd, trimmed);
    const rel = relative(absCwd, absTarget);
    const outside =
      rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel);
    if (outside) return trimmed;
    const normalized = rel.split(sep).join("/");
    return normalized === "" ? "." : normalized;
  } catch {
    return trimmed;
  }
}
