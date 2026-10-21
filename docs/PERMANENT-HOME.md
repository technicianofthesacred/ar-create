# Permanent local home and reproducible migration source

The sole integrator completed the bounded 18 October move to `~/Library/Application Support/i64os/ar-create`, outside Codex. This repository preserves generic implementation and handoff context. It contains no real migration configuration, owner mappings, installed data/public tree or preservation receipts, and performs no live installation.

| Installed layout | Role |
| --- | --- |
| `service/runtime` | Maintained runtime and real installed dependencies |
| `service/public/document-study` | Actual installed interface; may contain private reference material |
| `data` | Private saved work/captures/journals |
| `config/local.json` | Explicit private home/port/data/public/source configuration |
| `config/local-owned-relocation.json` | Private exact owner/root/capture capability; never share |
| `start.py`, `stop.py`, `restart.py` | Guarded installed lifecycle |
| `state`, `logs`, `backups`, `verification` | Private process/proof/preservation records |

## Source contract

`runtime/services/study-owned-relocation.mjs` accepts an explicit constructor-only startup capability, not an HTTP request. Minimal injection points are `runtime/services/ar-project-folders.mjs`, `runtime/services/study-draft-copies.mjs` and `runtime/server.mjs`. The server retains the canonical packageView GET-only bootstrap behind the Host guard. Ordinary candidate `config.mjs`/`serve.mjs` remain unchanged and refuse8841.

The capability pins existing native metadata bytes, old and new exact root identities and captured file hashes. Mapped reads recheck canonical destination directories/inodes and capture bytes; source identity, raw metadata, CAS and saved Undo remain intact. Replaced roots, symlinks, changed metadata/captures and wrong identity refuse access. New owners use ordinary ownership. This is not a prefix rewrite, automatic rebind, recovery replay or permission to expand a catalog. Do not hand-author a real capability from guesses.

Generic lifecycle templates are in `scripts/permanent-home/`. They preserve the installed layout and startup checks but replace the original machine-specific Node path with an explicit absolute `AR_CREATE_NODE` or the local `node` executable. Start records that executable identity; stop refuses an unrecognized recorded process. These templates do not change the already installed launchers and do not self-install. The guarded entry on i64 is maintained separately in its companion adapter; this source handoff does not modify i64.

Only the sole integrator may prepare an installed home under explicit authority, using reviewed exact code, real dependencies, private configuration and owner-produced relocation proof. The service entry template belongs at `<home>/service/serve.mjs`; Python templates belong at `<home>/`. The installed service's source files must not be replaced by an older checkout. Use the existing installed launcher for a current idle service; do not run templates from the source checkout or connect an isolated candidate to real data.

## Verified facts and continuing limits

Owner and independent root checks confirmed identical saved native state and originals through the move, controlled restart, direct Research access/project return, unchanged browser draft cache, and i64 open/validated return. Synthetic tests separately prove new saves, exact saved Undo, same-UUID retry, interrupted-operation recovery and refusal after relocation with the old root unavailable. Historical provenance paths remain historical identities; runtime/data dependencies no longer point into Codex.

Keep one writer, the same127.0.0.1:8841 origin and prior copies for rollback. Browser-only drafts are not automatically covered by file backups. Never restore an old tree over newer saved work; stop the exact owned writer, preserve a new private snapshot and have the integrator reconcile newer data and any reverse relocation. Installed private migration/rollback records remain in the permanent home, outside Git.

Bounded relocation is complete. Full workflow/human visual acceptance, the existing sticky-header follow-up, live AI, complete media/platform publication and private synchronization remain separate work.
