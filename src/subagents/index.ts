import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { registerAgents } from "./agent-types.js"
import { AgentManager } from "./agent-manager.js"
import { registerAgentTool } from "./tools/agent-tool.js"
import { registerGetResultTool } from "./tools/get-result-tool.js"
import { registerSteerTool } from "./tools/steer-tool.js"

export default function initSubagents(pi: ExtensionAPI): void {
  registerAgents(new Map())

  const manager = new AgentManager()

  pi.on("session_start", async () => {
    manager.clearCompleted()
  })

  pi.on("session_shutdown", async () => {
    manager.abortAll()
    manager.dispose()
  })

  registerAgentTool(pi, manager)
  registerGetResultTool(pi, manager)
  registerSteerTool(pi, manager)
}
