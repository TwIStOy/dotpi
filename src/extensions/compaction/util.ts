export function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || String(error);
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Pi may invalidate extension context between schedule and idle timer fire. */
export function isStaleCtxError(error: unknown): boolean {
  return error instanceof Error && /extension ctx is stale/i.test(error.message);
}
