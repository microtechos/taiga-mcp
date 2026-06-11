import { z } from "zod";
export function registerExportImportTools(server, client) {
    server.tool("taiga_project_export", "Export a project (returns export data or starts async export).", { id: z.number().describe("Project ID") }, async ({ id }) => {
        const data = await client.get(`/exporter/${id}`);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
    server.tool("taiga_project_import", "Import a project from a JSON dump.", {
        dump: z.string().describe("JSON string of the project export data"),
    }, async ({ dump }) => {
        const parsed = JSON.parse(dump);
        const data = await client.post("/importer/load_dump", parsed);
        return {
            content: [
                { type: "text", text: JSON.stringify(data, null, 2) },
            ],
        };
    });
}
//# sourceMappingURL=export-import.js.map