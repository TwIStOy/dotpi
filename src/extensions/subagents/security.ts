import { existsSync, lstatSync, readFileSync } from "node:fs"

export function isUnsafeName(name: string): boolean {
  if (!name || name.length > 128) return true
  return !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)
}

export function isSymlink(filePath: string): boolean {
  try {
    return lstatSync(filePath).isSymbolicLink()
  } catch {
    return false
  }
}

export function safeReadFile(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined
  if (isSymlink(filePath)) return undefined
  try {
    return readFileSync(filePath, "utf-8")
  } catch {
    return undefined
  }
}
