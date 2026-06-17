# @microtechos/taiga-mcp

Microtech fork of [illodev/taiga-mcp](https://github.com/illodev/taiga-mcp)
(MIT) — a full-featured MCP server for [Taiga](https://taiga.io) project
management. This fork **adds attachment upload/download tools** (issues, tasks,
user stories, epics) that the upstream lacks.

It is the transport behind the `microtech-taiga` plugin in the
`microtech-hub` marketplace. End users don't run it directly — the plugin's
`.mcp.json` launches it via `npx -y github:microtechos/taiga-mcp`.

## Run

```
npx -y github:microtechos/taiga-mcp
```

Requires these environment variables:

| Variable | Value |
|---|---|
| `TAIGA_URL` | `https://taiga.microtechos.in` (the `/api/v1` suffix is added automatically) |
| `TAIGA_USERNAME` | Taiga username (or a dedicated automation account) |
| `TAIGA_PASSWORD` | Taiga password / token |

`dist/` is committed so `npx` runs without a build step. Auth uses a bearer
token obtained from `POST /auth`, refreshed automatically on 401.

## Maintaining this fork

```
npm install
# edit src/...
npm run build      # tsc -> dist/
git add -A && git commit && git push
```

Always rebuild and commit `dist/` after changing `src/` — that is what `npx`
actually runs.

## What this fork added

- **Attachment upload** — `taiga_<entity>_attachment_create` for `issues`, `tasks`,
  `userstories`, and `epics`: reads a local file and uploads it via
  `POST /<entity>/attachments` (multipart), with a Content-Type inferred from the
  file extension. Upstream wired upload for none of these.
- **Attachment download** — `taiga_<entity>_attachment_download` for the same four
  entities: resolves the attachment's signed URL (by id or direct `url`), fetches the
  bytes authenticated with the in-memory bearer token (credentials never leave the
  process), and writes them to a local `dest_path`. Upstream had no way to retrieve
  attachment bytes — `*_attachment_get` returns metadata only.
- **Reliable comments** — `taiga_<entity>_comment_create` fetches the entity's current
  `version` before PATCHing (instead of hardcoding `version: 1`), so comments don't fail
  optimistic-concurrency checks on already-edited entities. An optional `version` param
  overrides the fetched value.

The shared upload/download logic lives in `src/tools/attachments.ts`
(`registerEntityAttachmentWriteTools`); the read tools (`*_attachments_list`,
`*_attachment_get`) stay in each entity's tool file.

## Security notes

- **Attachment downloads** only ever fetch from the configured Taiga host, and the bearer
  token is only sent to that origin (never forwarded across a redirect to another host) — a
  hostile `url` argument cannot be used to exfiltrate the token.
- **Downloads never overwrite** an existing file. Set `TAIGA_DOWNLOAD_DIR` to confine all
  download writes to one directory, and `TAIGA_UPLOAD_DIR` to confine which local files may be
  uploaded. Unset, the tools use the absolute path given (their documented contract).

## License

MIT, inherited from illodev/taiga-mcp. Original copyright retained.
