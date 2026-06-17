import { z } from "zod";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
// Map common file extensions to MIME types so uploads carry a correct Content-Type
// (Taiga uses it for image detection / inline preview; falls back for unknown types).
const MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".json": "application/json",
    ".csv": "text/csv",
    ".html": "text/html",
    ".log": "text/plain",
    ".txt": "text/plain",
};
export function mimeTypeFor(filePath) {
    return MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
// Registers the attachment WRITE/READ-BYTES tools (upload + download) for an entity whose
// attachment REST collection is `/{plural}/attachments` (issues, tasks, userstories, epics).
// The metadata read tools (`*_attachments_list`, `*_attachment_get`) stay in each entity file.
// `plural` is the Taiga collection segment; `label` is the singular noun used in tool prose.
export function registerEntityAttachmentWriteTools(server, client, plural, label) {
    server.tool(`taiga_${plural}_attachment_create`, `Upload a local file as an attachment to a ${label} (e.g. logs, screenshots).`, {
        project: z.number().describe("Project ID"),
        object_id: z
            .number()
            .describe(`${label} internal ID (the 'id' field, not the #ref number)`),
        file_path: z.string().describe("Absolute path to the local file to upload"),
        description: z
            .string()
            .optional()
            .describe("Optional description for the attachment"),
    }, async ({ project, object_id, file_path, description }) => {
        const buffer = readFileSync(file_path);
        const form = new FormData();
        form.append("project", String(project));
        form.append("object_id", String(object_id));
        if (description)
            form.append("description", description);
        form.append("attached_file", new Blob([buffer], { type: mimeTypeFor(file_path) }), basename(file_path));
        const data = await client.postMultipart(`/${plural}/attachments`, form);
        return {
            content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
    });
    server.tool(`taiga_${plural}_attachment_download`, `Download a ${label} attachment's bytes to a local file. Authenticated via the MCP's own ` +
        `Taiga session (credentials never leave this process). Provide either the attachment ` +
        `\`id\` or a direct \`url\`.`, {
        id: z
            .number()
            .optional()
            .describe(`Attachment ID (resolved via GET /${plural}/attachments/{id})`),
        url: z
            .string()
            .optional()
            .describe("Direct attachment URL (absolute, signed); alternative to id"),
        dest_path: z
            .string()
            .describe("Absolute local path to write the downloaded file to"),
    }, async ({ id, url, dest_path }) => {
        if (id === undefined && !url) {
            throw new Error("Provide either `id` (attachment id) or `url`.");
        }
        let fileUrl = url;
        let name;
        if (id !== undefined) {
            const meta = (await client.get(`/${plural}/attachments/${id}`));
            // `url` is the absolute, signed, fetchable link; `attached_file` is an unsigned
            // relative path (not directly fetchable), so prefer `url`.
            fileUrl = meta.url ?? meta.attached_file;
            name = meta.name;
        }
        if (!fileUrl) {
            throw new Error("Could not resolve the attachment's file URL.");
        }
        const bytes = Buffer.from(await client.getBinary(fileUrl));
        writeFileSync(dest_path, bytes);
        if (!name)
            name = basename(fileUrl.split("?")[0]);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ id: id ?? null, name, size: bytes.length, dest_path }, null, 2),
                },
            ],
        };
    });
}
//# sourceMappingURL=attachments.js.map