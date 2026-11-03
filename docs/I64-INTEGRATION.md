# i64 OS host integration

AR Create is a separate development repository and remains an i64 OS capability. i64 hosts the entry, routing and availability/lifecycle boundary; AR Create owns Document Study and its existing file/workflow services. Do not merge the databases or introduce a second manuscript authority.

## Where the entrance lives

The entrance is the i64os code that opens AR Create from the shell and returns to it: `apps/core/lib/develop/ar-create.ts`, `apps/core/routes/develop.ts`, `apps/web/lib/ar-create-navigation.ts` and `apps/web/components/concourse/ArCreateSurface.tsx`, plus the rail entry and the full-page route with the i64os header. It lands on i64os `main` in i64os pull request #208. Until that merges, the files exist only on that branch, and a path to them from `main` is dangling. The old `claude/ar-create-finish` i64os branch also carries a stale copy of the app under `apps/ar-create`; this repository is the only source, so that copy is retired and not to be merged.

## Preserved current integration

The existing i64 rail and Writing entrance opens `/ar-create`, checks the local companion's identity and offers its guarded owned launcher when available. The companion retains `/document-study/index.html`, loopback binding and its existing Host/Origin/CSP checks. The metadata-only health endpoint is `/api/i64os/health`; it identifies the service, not completion of every workflow.

The validated `i64osReturn` parameter returns only to allowed loopback i64 Writing/AR Create paths at the established ports. Preserve the editor's project/part state, browser-unsaved recovery and before-leave protections. Do not embed it by stripping origin checks or weakening the frame policy.

The 18 October bounded relocation is verified: installed runtime/dependencies/data now live at `~/Library/Application Support/i64os/ar-create`; i64 uses that guarded companion home. Controlled restart, native/browser preservation and actual open/validated return passed. This standalone repository still runs isolated synthetic candidates on a spare port and refuses8841. Source publication does not activate/reconfigure the companion. See [permanent home](PERMANENT-HOME.md).

## Voice: one copy in i64os (3 November 2026)

Adrian's voice lives in the i64os directions, `substrate/directions/voice-profile.md` and `body-of-work.md`. AR Create reads them straight from an i64os checkout on this Mac, read-only, with no credentials: nothing needs setting up: with no config it looks for the checkout's `substrate/directions` folder at `~/Documents/Files/4 Coding/i64os/` and then `~/Documents/Files/2 Areas/Coding/i64os/`, and uses the first one that holds both files. To point somewhere else, set `directionsDir` in `data/i64os-directions.json` (or the `i64osDirections` server option); the config wins over the default. `"directionsDir": null` keeps the local copies. Then every agent draft request captures that voice, the Voice and Perspective sheets show it read-only, and AR Create's own copies in `data/guidance/` are no longer read. If a folder is found or configured but a voice file cannot be read, writing guidance answers 503 rather than falling back to a stale copy. With no config and no checkout at either location, the local copies are used as before.

Corrections travel the other way through a queue Adrian approves. When he finishes a read-through, each machine paragraph he rewrote becomes a voice correction in `data/voice-corrections/`. He approves (choosing How I sound or What I argue) or drops each one in the Write margin; `voice-corrections.decide` is human-only. `voice-corrections.export` lists the approved ones in the exact input shape of the i64os `voice_correct` tool, which only queues them in the voice file. An agent carries each one with `voice_correct` and then records `voice-corrections.sent`. Routing a correction into the voice itself stays Adrian's `voice_route` in i64os. AR Create has no direct route to the i64os voice queue: the copied Magazine i64 export needs i64os credentials and its worker was never copied in.

## Preservation for any later transition

1. Freeze and verify the integrator's exact current code/data identities, private configuration, capture paths, browser-local state, direction/decision records and native Undo journals. Preserve recoverable snapshots outside Git.
2. Verify this repository's locked install/build and relevant synthetic screen/file journeys without private copies, services or providers being activated implicitly.
3. Prepare an explicit reversible code-home/config transition. Moving data is a separate decision; absolute captured ownership must remain valid or be migrated by its existing owner with proof.
4. Let the integrator perform sole live activation. Verify the i64 entry, service identity, same existing story/part, durable save/return and exact Undo before retiring anything.
5. i64os is reduced to the entrance described above. Keep a recoverable old package/data snapshot until the integrator confirms the retirement.

Secure VPS/desktop replicas, offline writes, conflicts, phone access, media availability and versioned backup remain the separately agreed private-content plan. They are not installed or authorized by this code repository handoff. No public deployment or private upload is implied.
