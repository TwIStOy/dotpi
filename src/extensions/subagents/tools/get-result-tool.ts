import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { getAgentConversation } from "../agent-runner.js";
import type { AgentManager } from "../agent-manager.js";
import { buildResultSummary, textResult } from "./utils.js";

export function registerGetResultTool(pi: ExtensionAPI, manager: AgentManager) {
  pi.registerTool(
    defineTool({
      name: "get_subagent_result",
      label: "Get Agent Result",
      description:
        "Check status and retrieve results from a background agent. Use the agent ID returned by Agent with run_in_background.",
      parameters: Type.Object({
        agent_id: Type.String({ description: "The agent ID to check." }),
        wait: Type.Optional(
          Type.Boolean({
            description:
              "If true, wait for the agent to complete before returning. Default: false.",
          }),
        ),
        verbose: Type.Optional(
          Type.Boolean({
            description:
              "If true, include the agent's full conversation (messages + tool calls). Default: false.",
          }),
        ),
      }),

      execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
        const record = manager.getRecord(params.agent_id);
        if (!record) {
          return textResult(
            `Agent not found: "${params.agent_id}". It may have been cleaned up.`,
          );
        }

        if (params.wait && record.status === "running" && record.promise) {
          record.resultConsumed = true;
          await record.promise;
        }

        const stats = buildResultSummary(record);

        let output =
          `Agent: ${record.id}\n` +
          `Type: ${record.type} | Status: ${record.status} | ${stats}\n` +
          `Description: ${record.description}\n\n`;

        if (record.status === "running") {
          output +=
            "Agent is still running. Use wait: true or check back later.";
        } else if (record.status === "error") {
          output += `Error: ${record.error}`;
        } else {
          output += record.result?.trim() || "No output.";
        }

        if (record.status !== "running" && record.status !== "queued") {
          record.resultConsumed = true;
        }

        if (params.verbose && record.session) {
          const conversation = getAgentConversation(record.session);
          if (conversation) {
            output += `\n\n--- Agent Conversation ---\n${conversation}`;
          }
        }

        return textResult(output);
      },
    }),
  );
}
