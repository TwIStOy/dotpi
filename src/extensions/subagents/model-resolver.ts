import type { Model, Api } from "@earendil-works/pi-ai"

export interface ModelRegistryLike {
  find(provider: string, modelId: string): Model<Api> | undefined
  getAll(): Model<Api>[]
  getAvailable?(): Model<Api>[]
}

export function resolveModel(
  input: string,
  registry: ModelRegistryLike,
): Model<Api> | string {
  const all = (registry.getAvailable?.() ?? registry.getAll())
  const availableSet = new Set(all.map(m => `${m.provider}/${m.id}`.toLowerCase()))

  const slashIdx = input.indexOf("/")
  if (slashIdx !== -1) {
    const provider = input.slice(0, slashIdx)
    const modelId = input.slice(slashIdx + 1)
    if (availableSet.has(input.toLowerCase())) {
      const found = registry.find(provider, modelId)
      if (found) return found
    }
  }

  const query = input.toLowerCase()

  let bestMatch: Model<Api> | undefined
  let bestScore = 0

  for (const m of all) {
    const id = m.id.toLowerCase()
    const name = m.name.toLowerCase()
    const full = `${m.provider}/${m.id}`.toLowerCase()

    let score = 0
    if (id === query || full === query) {
      score = 100
    } else if (id.includes(query) || full.includes(query)) {
      score = 60 + (query.length / id.length) * 30
    } else if (name.includes(query)) {
      score = 40 + (query.length / name.length) * 20
    } else if (
      query
        .split(/[\s\-/]+/)
        .every(
          part =>
            id.includes(part) ||
            name.includes(part) ||
            m.provider.toLowerCase().includes(part),
        )
    ) {
      score = 20
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = m
    }
  }

  if (bestMatch && bestScore >= 20) {
    const found = registry.find(bestMatch.provider, bestMatch.id)
    if (found) return found
  }

  const modelList = all
    .map(m => `  ${m.provider}/${m.id}`)
    .sort()
    .join("\n")
  return `Model not found: "${input}".\n\nAvailable models:\n${modelList}`
}

export function resolveBestModel(
  candidates: string[],
  registry: ModelRegistryLike,
): Model<Api> | undefined {
  const all = (registry.getAvailable?.() ?? registry.getAll())
  if (all.length === 0) return undefined

  let bestModel: Model<Api> | undefined
  let bestScore = -1

  for (const candidate of candidates) {
    const resolved = resolveModel(candidate, registry)
    if (typeof resolved === "string") continue

    let score: number
    const query = candidate.toLowerCase()
    const id = resolved.id.toLowerCase()
    const full = `${resolved.provider}/${resolved.id}`.toLowerCase()

    if (id === query || full === query) score = 100
    else if (id.includes(query) || full.includes(query)) score = 60
    else score = 20

    if (score > bestScore) {
      bestScore = score
      bestModel = resolved
    }
  }

  return bestModel
}
