# Generic kept-source and Material host contract

This is a provisional source contract for accepted transcript/Material/Source/Research slices. Final output integration and Delivery's latest flow/list/doc freeze are separate.

## Explicit host configuration only

Normal `config.mjs` / `serve.mjs` keeps synthetic/demo startup, external private data and candidate8841 refusal. `config.example.json` leaves both new hooks null. An authorized host may provide these exact records in its private external configuration; no actual values, registries, source content or handover proofs are supplied by this repository:

| Optional field | Exact properties | Authority |
| --- | --- | --- |
| `transcriptLibrary` | `registryFile`, `indexFile`, `libraryRoot`, all explicit absolute paths | Read-only kept-session projection into the existing Library; original source UUIDs and exact working-text hash retained |
| `importedTranscriptOwner` | `dataDir`, `notesFile`, `handoverFile`, explicit `connections` array | Single existing external transcript owner; mutation requires verified prior-owner handover, locks, exact source/revision/operation guards |

Relative/extra config fields and private owner data inside this checkout are refused. Configuration does not create/repair a missing owner or handover. The Source owner validates exact disabled prior entrypoint hashes, a stopped prior writer, directory/lock identity and guarded registry versions. A missing/unverified handover holds Source; do not replace paths, steal locks, disable guards or replay old operations to make it open. Arbitrary external file editors are not universally locked; owner/source hashes and registry checks refuse detected conflicts.

The installed-host template `scripts/permanent-home/serve.mjs` passes the same optional trusted constructor hooks while retaining its permanent-home guards. It is a source template, not an installer or permission to activate a second writer. Keep the actual installed entry/config/private roots with the sole integrator. No host-only frozen launcher was copied over the canonical synthetic entry.

## Supported bounded behavior

Kept sessions are read from the configured owner/catalog; no duplicate speech database. Library literal recall reports working-language source provenance; original-language reader, transcription, translation, verified audio alignment, semantic/all-format recall and live model research remain separate. Source reads kept sessions with context/notes and offers guarded human correction plus only eligible exact saved Undo. Notes do not regenerate after corrections: exact source-hash changes mark them stale.

Material's saved-binding lookup creates no new identity. Opening the Material folder targets only the current owned project/derived folder under host checks. Album actions keep exact project/document guards, a persisted link note, truthful imported/error/partial/link-only states and no repeat import of an already saved URL. Providers/account access are not configured by this source package; test provider actions are stubbed.

Research displays/edits the existing freeform shared Markdown and current/stale/unavailable source links. Dirty buffers and newer saved revisions remain visible for deliberate conflict resolution, and saved Undo retains exact prior text. Moving to Direction preserves the same notes and performs no automatic save/adoption/output mutation. This is not a new structured per-point research store, inference engine or source-verification claim.

Generic affected tests use invented temporary owners/sources and injected host/provider actions. Source build/test proof is distinct from accepted installed owner/root journeys and human visual acceptance. No real Source correction, album call, private import, runtime restart or source push is part of preparing the candidate.
