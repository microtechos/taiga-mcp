# @microtechos/taiga-mcp

Microtech fork of [illodev/taiga-mcp](https://github.com/illodev/taiga-mcp)
(MIT) — a full-featured MCP server for [Taiga](https://taiga.io) project
management. This fork **adds an issue attachment-upload tool**
(`taiga_issues_attachment_create`) that the upstream lacks.

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

`src/tools/issues.ts` registers `taiga_issues_attachment_create` — reads a local
file and uploads it to an issue via Taiga's `POST /issues/attachments`
(multipart), using the existing `client.postMultipart`.

## License

MIT, inherited from illodev/taiga-mcp. Original copyright retained.
