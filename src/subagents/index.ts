import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { registerAgents } from "./agent-types.js"
import { loadCustomAgents } from "./custom-agents.js"

export const reloadCustomAgents = (cwd: string) => {
  const userAgents = loadCustomAgents(cwd)
  registerAgents(userAgents)
}

export default function initSubagents(pi: ExtensionAPI): void {
  reloadCustomAgents(process.cwd())
}
