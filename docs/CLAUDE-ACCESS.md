# Access: what an agent can reach

Updated 1 November 2026. Start at [AGENTS.md](../AGENTS.md) and [START.md](START.md).

## One source

GitHub `technicianofthesacred/ar-create`, branch `main` (MAIN), is canonical for code and for intent. The local checkout at `~/Documents/Files/4 Coding/ar-create` is stale and not canonical: do not edit it, build from it or run its CLI. Work happens in a fresh worktree cut from `origin/main` (`git fetch && git worktree add /tmp/wt-<name> -b claude/<name> origin/main`, then `npm run setup`) and lands through a pull request. The CLI you run is the installed one (see below).

## What the repository supplies

Reviewed software, synthetic fixtures, the C3 and Tree look modules, the product intent, all twelve section briefs, the function flow and this documentation. A merge or push is not runtime activation, and no ZIP handoff is needed. A cloud agent with a granted GitHub connection can read these files and nothing else.

## What stays private on the Mac

The permanent local home is `~/Library/Application Support/i64os/ar-create`: `service/` runs the app and is a recorded release of one MAIN commit, `data/` holds saved private work, `config/` holds private settings, `state/`, `logs/`, `backups/` and `verification/` hold the rest. The app is at `http://127.0.0.1:8841/document-study/index.html`, reached from i64 OS at `http://127.0.0.1:8888/ar-create`. Linked originals stay in their existing folders. Do not edit the home, start anything on 8841, or read `data/` and `backups/` directly; use the CLI.

The repository holds no private manuscripts, transcripts, photographs, recordings, account configuration or backups. A repository connection is not access to localhost or those folders. Authorized local tools need real filesystem and service permission. No new provider, private upload, public deployment, Drive, VPS or device synchronization or original writeback is authorized by this documentation.

## App and agent work

The app window may be closed while the service keeps running. Agents on this Mac use the one CLI, run from the installed release (`$HOME/Library/Application Support/i64os/ar-create/service/agents/cli/ar-create.mjs --actor agent:<name>`), or the one MCP server (`agents/mcp/server.mjs` in the same place); both call the same command registry as the app and stamp the actor on every write. See [CONCEPT-AGENT](CONCEPT-AGENT.md) for the project concept brief and [AGENT-CONNECTIONS](AGENT-CONNECTIONS.md) for standalone Collection and continuity contracts. The older `tools/concept-cli.mjs` and `mcp/study` remain only as aliases. In a browser, open the page with `?reviewActor=agent:<name>`, or the page stamps your actions `human:adrian`.

On a conflict, preserve both versions, exact source identities and unknown or manual text. Saved is not adopted, reviewed, exported or published. A fresh browser reading the same local owner is not proof of remote-device synchronization.
