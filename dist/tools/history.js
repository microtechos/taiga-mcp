import { z } from "zod";
export function registerHistoryTools(server, client) {
    // History for each entity type
    const entityTypes = ["userstory", "task", "issue", "wiki"];
    for (const entityType of entityTypes) {
        server.tool(`taiga_${entityType}_history`, `Get change history for a ${entityType}.`, { id: z.number().describe(`${entityType} ID`) }, async ({ id }) => {
            const data = await client.get(`/history/${entityType}/${id}`);
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        });
        // Comments (create via history endpoint)
        server.tool(`taiga_${entityType}_comment_create`, `Add a comment to a ${entityType}. Comment is posted via the history endpoint.`, {
            id: z.number().describe(`${entityType} ID`),
            comment: z.string().describe("Comment text"),
        }, async ({ id, comment }) => {
            // In Taiga, comments are added by posting a comment field in a PATCH to the entity
            // The proper way is to PATCH the entity with a "comment" field
            const entityEndpoints = {
                userstory: "userstories",
                task: "tasks",
                issue: "issues",
                wiki: "wiki",
            };
            const endpoint = entityEndpoints[entityType];
            const data = await client.patch(`/${endpoint}/${id}`, {
                comment,
                version: 1,
            });
            return {
                content: [
                    { type: "text", text: JSON.stringify(data, null, 2) },
                ],
            };
        });
        server.tool(`taiga_${entityType}_comment_delete`, `Delete a comment from a ${entityType}.`, {
            id: z.number().describe(`${entityType} ID`),
            comment_id: z.string().describe("Comment ID (from history)"),
        }, async ({ id, comment_id }) => {
            await client.post(`/history/${entityType}/${id}/delete_comment`, {
                id: comment_id,
            });
            return {
                content: [{ type: "text", text: "Comment deleted." }],
            };
        });
    }
}
//# sourceMappingURL=history.js.map