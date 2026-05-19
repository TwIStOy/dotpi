export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}m${remaining}s`
}

export function formatDuration(start: number, end?: number): string {
  return formatMs((end ?? Date.now()) - start)
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

export function formatTurns(current: number, max?: number): string {
  if (max != null) return `⟳${current}≤${max}`
  return `⟳${current}`
}

export function getPromptModeLabel(_type: string): string {
  return ""
}
