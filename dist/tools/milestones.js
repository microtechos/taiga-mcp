import { z } from "zod";
export function registerMilestoneTools(server, client) {
    server.tool("taiga_milestones_list", "List milestones/sprints. Filter by project.", {
        project: z.number().optional().describe("Project ID"),
        closed: z.boolean().optional().describe("Filter by closed status"),
    }, async (params) => {
        const data = await client.get("/milestones", params);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_milestones_create", "Create a new milestone/sprint.", {
        project: z.number().describe("Project ID"),
        name: z.string().describe("Sprint name"),
        estimated_start: z.string().describe("Start date (YYYY-MM-DD)"),
        estimated_finish: z.string().describe("End date (YYYY-MM-DD)"),
        disponibility: z.number().optional().describe("Available story points"),
        slug: z.string().optional(),
        order: z.number().optional(),
        watchers: z.array(z.number()).optional(),
    }, async (params) => {
        const data = await client.post("/milestones", params);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_milestones_get", "Get a milestone/sprint by ID.", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        const data = await client.get(`/milestones/${id}`);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_milestones_update", "Update a milestone/sprint (partial).", {
        id: z.number().describe("Milestone ID"),
        name: z.string().optional(),
        estimated_start: z.string().optional(),
        estimated_finish: z.string().optional(),
        disponibility: z.number().optional(),
        closed: z.boolean().optional(),
    }, async ({ id, ...body }) => {
        const data = await client.patch(`/milestones/${id}`, body);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_milestones_delete", "Delete a milestone/sprint.", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        await client.delete(`/milestones/${id}`);
        return {
            content: [{ type: "text", text: "Milestone deleted." }],
        };
    });
    server.tool("taiga_milestones_stats", "Get milestone/sprint stats (burndown, etc.).", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        const data = await client.get(`/milestones/${id}/stats`);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_milestones_watch", "Watch a milestone.", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        await client.post(`/milestones/${id}/watch`);
        return {
            content: [{ type: "text", text: "Now watching milestone." }],
        };
    });
    server.tool("taiga_milestones_unwatch", "Stop watching a milestone.", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        await client.post(`/milestones/${id}/unwatch`);
        return {
            content: [
                { type: "text", text: "Stopped watching milestone." },
            ],
        };
    });
    server.tool("taiga_milestones_watchers", "List watchers of a milestone.", { id: z.number().describe("Milestone ID") }, async ({ id }) => {
        const data = await client.get(`/milestones/${id}/watchers`);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=milestones.js.map