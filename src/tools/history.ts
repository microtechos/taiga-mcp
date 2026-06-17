import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TaigaClient } from "../client.js";

export function registerHistoryTools(server: McpServer, client: TaigaClient) {
  // History for each entity type
  const entityTypes = ["userstory", "task", "issue", "wiki"] as const;

  for (const entityType of entityTypes) {
    server.tool(
      `taiga_${entityType}_history`,
      `Get change history for a ${entityType}.`,
      { id: z.number().describe(`${entityType} ID`) },
      async ({ id }) => {
        const data = await client.get(`/history/${entityType}/${id}`);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      },
    );

    // Comments (create via history endpoint)
    server.tool(
      `taiga_${entityType}_comment_create`,
      `Add a comment to a ${entityType}. Comment is posted via the history endpoint.`,
      {
        id: z.number().describe(`${entityType} ID`),
        comment: z.string().describe("Comment text"),
        version: z
          .number()
          .optional()
          .describe(
            "Entity version for optimistic-concurrency. Defaults to the entity's current version (fetched automatically). Never hardcode it.",
          ),
      },
      async ({ id, comment, version }) => {
        // Comments are added by PATCHing the entity with a "comment" field. Taiga's optimistic
        // concurrency expects the entity's CURRENT version — hardcoding it can be rejected (412)
        // on any already-edited entity. Fetch the current version unless the caller supplied one.
        const entityEndpoints: Record<string, string> = {
          userstory: "userstories",
          task: "tasks",
          issue: "issues",
          wiki: "wiki",
        };
        const endpoint = entityEndpoints[entityType];
        let resolvedVersion = version;
        if (resolvedVersion === undefined) {
          const current = (await client.get(`/${endpoint}/${id}`)) as {
            version?: number;
          };
          resolvedVersion = current.version ?? 1;
        }
        const data = await client.patch(`/${endpoint}/${id}`, {
          comment,
          version: resolvedVersion,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      },
    );

    server.tool(
      `taiga_${entityType}_comment_delete`,
      `Delete a comment from a ${entityType}.`,
      {
        id: z.number().describe(`${entityType} ID`),
        comment_id: z.string().describe("Comment ID (from history)"),
      },
      async ({ id, comment_id }) => {
        await client.post(`/history/${entityType}/${id}/delete_comment`, {
          id: comment_id,
        });
        return {
          content: [{ type: "text" as const, text: "Comment deleted." }],
        };
      },
    );
  }
}
