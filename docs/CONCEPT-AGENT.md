# Work on a shared concept from an external agent

Read this before saving. This program lets an authorized local Claude/Codex conversation read and develop the same concept that AR Create displays. It uses the existing project and human-direction authority. It does not run a model, grant filesystem/account access, approve manuscripts or publish output. Every write names its author: pass `--actor agent:<name>` (or set `AR_CREATE_ACTOR`); the server refuses a write without one (400) and stamps the actor on the record and the journal. Only already configured local project material is available for source lookup; this is not internet search or a new global Library store.

Keep the person's exact contributions in `authorThoughts`. Only Adrian writes that section and `adoptedDirection` (3 Nov 2026: agents propose prose, never save it): an agent's save must copy both unchanged from the latest read, or it answers 403 (exit 5). Words Adrian says to an agent go in his own save in the app, or as an `ask`. Put AI interpretations in `aiInterpretation` and provisional alternatives in `suggestions`. A conversation with an agent does not automatically adopt its interpretation, approve wording or create an editorial decision. Preserve the person's choices and rejected alternatives from the latest read. Source words, personal beliefs and AI proposals have different meanings: never invent quotations, source identities, evidence or human approval. Saved concept prose does not silently rewrite independent outputs.

## Connect explicitly

Use the one CLI, `agents/cli/ar-create.mjs`, with Node 22 or newer. For real work run the installed copy, `$HOME/Library/Application Support/i64os/ar-create/service/agents/cli/ar-create.mjs`; it is the same release as the app. For a synthetic run, use a worktree of `origin/main`, never the stale local checkout `~/Documents/Files/4 Coding/ar-create`. Point it at the app you mean: a synthetic candidate from `npm run demo` (port 8854, or the port you gave it), or the installed app at `http://127.0.0.1:8841` when the task is real work. Only HTTP on `127.0.0.1`, `localhost` or `::1` with an explicit port is accepted; redirects and credentialed URLs are refused.

```sh
export AR_CREATE_URL=http://127.0.0.1:8854 AR_CREATE_ACTOR=agent:claude-code
node agents/cli/ar-create.mjs status
node agents/cli/ar-create.mjs project list
```

(The relative path assumes a worktree of `origin/main`; against the installed app use the installed CLI path above.)

Actor values: `agent:claude-code`, `agent:codex`, `agent:claude-design`, `agent:hermes`, `agent:grok`, `agent:chatgpt`. The older `tools/concept-cli.mjs` and `mcp/study` remain only as aliases for older callers (same input fields; they also need `--actor` or `AR_CREATE_ACTOR` to write); do not start from them. In a browser, open the page with `?reviewActor=agent:<name>` or its actions are stamped `human:adrian`. Keep input files outside Git.

## Read, connect sources, then save

Every command returns JSON on stdout. Pass content in a JSON file with `--input /absolute/path/to/input.json` or through stdin with `--input -`. Do not put personal prose in command arguments. No shell aliases, agent registration or provider configuration is necessary.

| Command | Input JSON fields |
| --- | --- |
| `project list` | none |
| `status` | none; shows commands, presence, whether Adrian has unsaved words, recent events. `project capabilities` reports the concept limits |
| `project create` | `parentStudyId`, `title`, fresh `operationId` UUID |
| `project read` | `parentStudyId` |
| `library search` | `query`, optional `parentStudyId` and integer `limit` (1–20) |
| `library read` | `sourceId`, optional `parentStudyId` |
| `project save` | `parentStudyId`, `operationId`, `expectedRevision`, `expectedHash`, exact `body`; or the structured convenience fields below |

Unknown fields are refused. `project list` shows only projects that already have a concept; `project read` of any other id answers 404. Use `project create` with an explicit `parentStudyId`, title and operation UUID to create a new maintained collection/project identity; a prior project is not required. Repeating the exact same create intent is idempotent. Use `project list` and `project read` to resume existing work. For example, an entirely synthetic read:

```sh
node agents/cli/ar-create.mjs project read --input - <<'JSON'
{"parentStudyId":"synthetic-project-id"}
JSON
```

Read the concept before each edit. The receipt includes its current `revision`, SHA-256 `hash`, shared `path`, human thoughts, AI fields, selected sources and recorded history. Retain exact human wording and existing source selections unless the person requests their change. Search returns matching passages with identity, hash, offset, context and relevance. Use `library read` to inspect the source and confirm the exact selection before linking it. Search/read can also begin without `parentStudyId`; link the result to a concept later.

If `structured` is false, the file has manual or unrecognized direction. Save it as exact `body` text with the same guarded metadata; do not convert it silently. A raw-body save excludes the structured fields and preserves its text exactly. Explicitly authorized conversion can instead send all structured fields with `replaceExistingDirection: true`; without that flag the server refuses to replace manual direction.

Save the authoritative `body` first: preserve every manual section, exact human passage and source reference from the current read, and edit only the requested material. Copy the actual revision and hash into the request. Values below are illustrative only:

```json
{
  "parentStudyId": "synthetic-project-id",
  "operationId": "592a3d55-9abe-4d0c-a47e-1beb7c2735fd",
  "expectedRevision": 0,
  "expectedHash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "body": "# Concept\n\nAn invented personal question.\n"
}
```

For a new/recognized structured concept, the convenience alternative replaces `body` with all four fields: `authorThoughts` (string), `aiInterpretation` (string), `suggestions` (string), and `sourceSelections` (array). Empty strings and an empty array are valid. An optional `adoptedDirection` string records only a direction the person explicitly chose; never infer adoption from personal reflections, AI interpretations, suggestions or the conversation alone. It remains separate from exact personal thoughts. Omitting it preserves any existing saved adopted direction; on a new concept it stays empty. Supply an explicit empty string only when the person intentionally clears that direction. Raw-body saves cannot include `adoptedDirection`. These fields do not authorize restructuring an existing manual document; prefer its exact body and preserve unknown sections.

Each selected source has exactly `sourceId`, lowercase SHA-256 `sourceHash`, exact `quote`, and zero-based nonnegative `start`. Preserve returned identities and offsets; do not calculate an invented match. Missing/unavailable source access is a limitation to report, not a reason to replace it with invented evidence. Inspect the save receipt's path and revision, then read again when checking app-to-agent changes. Refresh the matching project in AR Create to see the same saved work.

## Conflicts and uncertain completion

Exit 0 means the server accepted the request; it does not imply human approval. Exit 3 means HTTP 409: stdout preserves the conflict details. Exit 4 means 423: another actor holds a lease on the project, so wait or ask; take one yourself with `lease acquire --input '{"scope":{"kind":"project","id":"<parentStudyId>"}}'` before a long edit and `handoff` when you stop. Exit 5 means a human-only decision. Exit 2 means usage, for example a missing actor. Read the latest state, retain both contributions, and resolve the difference deliberately before a new save with current guards and a new operation UUID. Never remove guards or overwrite a newer revision to make the command succeed.

Exit 1 reports validation, HTTP or connection failure as JSON. Each invocation sends at most one request and never retries automatically. A connection can fail after the server saved: read the concept/history before deciding whether another mutation is needed. Keep the operation UUID to identify the uncertain attempt; do not assume a failed response means nothing changed. A stale/dirty app surface must resolve its own conflict rather than discard unsaved human work.

Requirements covered: C01/C03/C04/C06 and S04. The CLI's finish criterion is an external JSON-input command that reads shared revisions, searches/reads permitted sources, saves guarded concept work and exposes conflicts. Actual app round-trip and native recovery proof belong to the integrated candidate verification; this document is not installed or human-acceptance proof.

Downstream manuscript/MCP preparation honors the mixed concept role: exact personal contributions stay separate from provisional AI interpretation, unadopted suggestions and Library references. It preserves the whole Markdown snapshot hash/revision for conflict checks; the context body contains only explicitly adopted human direction; exact personal thoughts remain a separately labeled creative contribution and are not inferred to be instructions. If manual edits prevent safe separation, the context retains the complete mixed text with an empty direction body. Ordinary saved human editorial direction keeps its existing behavior.


## Standalone inquiries and local work receipts — 20 October integration candidate

The `parentStudyId` command flow above remains the Project concept interface. It does not create or address a standalone Library Collection. Read [Agent connections](AGENT-CONNECTIONS.md) for the actual separate Collection/inquiry routes, exact ownership and save guards, local continuity receipts, transient browser recovery, and verified agent→app→agent handoff. These additions are connected in the synthetic candidate; live installation and combined acceptance remain separate. No new MCP/provider, publication authority or replacement content store is implied.
