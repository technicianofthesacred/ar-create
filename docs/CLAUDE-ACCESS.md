# Access: what an agent can reach

Updated 21 October 2026. Start at [AGENTS.md](../AGENTS.md) and [START.md](START.md).

## One source

GitHub `technicianofthesacred/ar-create`, branch `main` (MAIN), is canonical for code and for intent. The local checkout at `~/Documents/Files/4 Coding/ar-create` is a clone: it fast-forwards to MAIN and holds no work that MAIN lacks. If it shows uncommitted or untracked files, compare them with MAIN by hash before trusting them; the ones that were measured on 21 October were identical to MAIN or older than it. Work happens on a branch of MAIN and lands through a pull request.

## What the repository supplies

Reviewed software, synthetic fixtures, the C3 and Tree look modules, the product intent, all twelve section briefs, the function flow and this documentation. A merge or push is not runtime activation, and no ZIP handoff is needed. A cloud agent with a granted GitHub connection can read these files and nothing else.

## What stays private on the Mac

The permanent local home is `~/Library/Application Support/i64os/ar-create`: `service/` runs the app and is a recorded release of one MAIN commit, `data/` holds saved private work, `config/` holds private settings, `state/`, `logs/`, `backups/` and `verification/` hold the rest. The app is at `http://127.0.0.1:8841/document-study/index.html`, reached from i64 OS at `http://127.0.0.1:8888/ar-create`. Linked originals stay in their existing folders. Do not edit the home, start anything on 8841, or read `data/` and `backups/` directly; use the CLI.

The repository holds no private manuscripts, transcripts, photographs, recordings, account configuration or backups. A repository connection is not access to localhost or those folders. Authorized local tools need real filesystem and service permission. No new provider, private upload, public deployment, Drive, VPS or device synchronization or original writeback is authorized by this documentation.

## App and agent work

The app window may be closed while the service keeps running. Agents on this Mac use the one CLI (`agents/cli/ar-create.mjs --actor agent:<name>`) or the one MCP server (`agents/mcp/server.mjs`); both call the same command registry as the app and stamp the actor on every write. See [CONCEPT-AGENT](CONCEPT-AGENT.md) for the project concept brief and [AGENT-CONNECTIONS](AGENT-CONNECTIONS.md) for standalone Collection and continuity contracts. The older `tools/concept-cli.mjs` is kept as an alias for one release; it also needs an actor to write.

On a conflict, preserve both versions, exact source identities and unknown or manual text. Saved is not adopted, reviewed, exported or published. A fresh browser reading the same local owner is not proof of remote-device synchronization.
