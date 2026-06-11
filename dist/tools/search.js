import { z } from "zod";
export function registerSearchTools(server, client) {
    server.tool("taiga_search", "Global search across a project (user stories, tasks, issues, wiki pages).", {
        project: z.number().describe("Project ID"),
        text: z.string().describe("Search text"),
    }, async (params) => {
        const data = await client.get("/search", params);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=search.js.map