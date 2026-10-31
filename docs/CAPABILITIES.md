# ar-create — Capabilities

> **GENERATED — do not edit by hand.** Rerun
> `npm run build` then `npm run capabilities`. It indexes discoverable source declarations; enabled runtime interfaces may add commands.
> Generated 2026-10-31T05:52:27.190Z.

**At a glance:** 7 commands · 294 registry commands · 14 CLI command groups · 9 AR Create MCP tools.

## Commands (how to use it)

| script | runs |
|---|---|
| `npm run setup` | `npm ci --prefix runtime && npm ci --prefix mcp/study` |
| `npm run build` | `npm run build:document-study --prefix runtime` |
| `npm run start` | `node serve.mjs` |
| `npm run test` | `node --test tests/*.test.mjs` |
| `npm run verify:package` | `node scripts/check-package.mjs` |
| `npm run demo` | `node scripts/demo.mjs` |
| `npm run capabilities` | `node scripts/gen-capabilities.mjs` |

## Command registry (routes shared by the app, the CLI and the MCP server)

294 commands from `runtime/commands.mjs`; the running app serves its complete enabled list at `GET /api/capabilities`. Call one with `node agents/cli/ar-create.mjs call <name> --input -`. **who**: `any` actor, or `human` for a decision agents are refused (403). **kind**: `read` or `write`; a write names an `undo` command when it has one.

### agent-runtime (15)

| name | route | who | kind |
|---|---|---|---|
| `ai.execution.capabilities` | `GET /api/ai/execution/capabilities` | any | read |
| `passage.revisions.id` | `GET /api/passage/revisions/{id}` | any | read |
| `passage.revisions.id.run` | `POST /api/passage/revisions/{id}/run` | any | write |
| `passage.revisions.id.send` | `POST /api/passage/revisions/{id}/send` | any | write |
| `passage.revisions.preview` | `POST /api/passage/revisions/preview` | any | write |
| `passage.revisions.recent` | `GET /api/passage/revisions/recent` | any | read |
| `requests.preview` | `POST /api/requests/preview` | any | write |
| `requests.recent` | `GET /api/requests/recent` | any | read |
| `terminal.capabilities` | `GET /api/terminal/capabilities` | any | read |
| `terminal.sessions.get` | `GET /api/terminal/sessions` | any | read |
| `terminal.sessions.id` | `GET /api/terminal/sessions/{id}` | any | read |
| `terminal.sessions.id.input` | `POST /api/terminal/sessions/{id}/input` | any | write |
| `terminal.sessions.id.resize` | `POST /api/terminal/sessions/{id}/resize` | any | write |
| `terminal.sessions.id.stop` | `POST /api/terminal/sessions/{id}/stop` | any | write |
| `terminal.sessions.post` | `POST /api/terminal/sessions` | any | write |

### collection (21)

| name | route | who | kind |
|---|---|---|---|
| `inquiries.association.change` | `POST /api/inquiries/association/change` | human | write |
| `inquiries.association.propose` | `POST /api/inquiries/association/propose` | any | write |
| `inquiries.catalog` | `GET /api/inquiries/catalog` | any | read |
| `inquiries.create` | `POST /api/inquiries/create` | any | write |
| `inquiries.direction-references` | `GET /api/inquiries/direction-references` | any | read |
| `inquiries.direction-references.change` | `POST /api/inquiries/direction-references/change` | human | write |
| `inquiries.direction-references.propose` | `POST /api/inquiries/direction-references/propose` | any | write · undo `inquiries.direction-references.undo` |
| `inquiries.direction-references.undo` | `POST /api/inquiries/direction-references/undo` | any | write |
| `inquiries.learning.undo` | `POST /api/inquiries/learning/undo` | any | write |
| `inquiries.piece` | `GET /api/inquiries/piece` | any | read |
| `inquiries.project` | `GET /api/inquiries/project` | any | read |
| `inquiries.projects` | `GET /api/inquiries/projects` | any | read |
| `inquiries.read` | `GET /api/inquiries/read` | any | read |
| `inquiries.references` | `GET /api/inquiries/references` | any | read |
| `inquiries.references.change` | `POST /api/inquiries/references/change` | human | write |
| `inquiries.references.propose` | `POST /api/inquiries/references/propose` | any | write · undo `inquiries.references.undo` |
| `inquiries.references.undo` | `POST /api/inquiries/references/undo` | any | write |
| `inquiries.save` | `POST /api/inquiries/save` | any | write · undo `inquiries.learning.undo` |
| `inquiries.source` | `GET /api/inquiries/source` | any | read |
| `inquiries.understanding` | `GET /api/inquiries/understanding` | any | read |
| `inquiries.update` | `POST /api/inquiries/update` | any | write · undo `inquiries.learning.undo` |

### continuity (10)

| name | route | who | kind |
|---|---|---|---|
| `work-continuity.artifacts` | `POST /api/work-continuity/artifacts` | any | read |
| `work-continuity.assign` | `POST /api/work-continuity/assign` | any | write · undo `work-continuity.undo` |
| `work-continuity.complete` | `POST /api/work-continuity/complete` | any | write · undo `work-continuity.undo` |
| `work-continuity.context` | `POST /api/work-continuity/context` | any | read |
| `work-continuity.read` | `POST /api/work-continuity/read` | any | read |
| `work-continuity.recover` | `POST /api/work-continuity/recover` | any | write |
| `work-continuity.result` | `POST /api/work-continuity/result` | any | write · undo `work-continuity.undo` |
| `work-continuity.seen` | `POST /api/work-continuity/seen` | any | write |
| `work-continuity.understanding` | `POST /api/work-continuity/understanding` | any | read |
| `work-continuity.undo` | `POST /api/work-continuity/undo` | any | write |

### direction (11)

| name | route | who | kind |
|---|---|---|---|
| `concept` | `GET /api/concept` | any | read |
| `concept.capabilities` | `GET /api/concept/capabilities` | any | read |
| `concept.save` | `POST /api/concept/save` | any | write · undo `study.human-direction.undo` |
| `concept.source` | `GET /api/concept/source` | any | read |
| `concept.sources.search` | `POST /api/concept/sources/search` | any | read |
| `concepts.get` | `GET /api/concepts` | any | read |
| `concepts.post` | `POST /api/concepts` | any | write |
| `study.human-direction` | `GET /api/study/human-direction` | any | read |
| `study.human-direction.select` | `POST /api/study/human-direction/select` | any | write |
| `study.human-direction.undo` | `POST /api/study/human-direction/undo` | any | write |
| `study.human-direction.write` | `POST /api/study/human-direction/write` | any | write · undo `study.human-direction.undo` |

### draft (27)

| name | route | who | kind |
|---|---|---|---|
| `study-ai.accept` | `POST /api/study-ai/accept` | human | write |
| `study-ai.context` | `GET /api/study-ai/context` | any | read |
| `study-ai.contracts` | `GET /api/study-ai/contracts` | any | read |
| `study-ai.human-contract` | `POST /api/study-ai/human-contract` | human | write |
| `study-ai.prepare` | `POST /api/study-ai/prepare` | any | write |
| `study-ai.propose` | `POST /api/study-ai/propose` | any | write |
| `study-ai.read` | `GET /api/study-ai/read` | any | read |
| `study-ai.reject` | `POST /api/study-ai/reject` | human | write |
| `study-ai.requests` | `GET /api/study-ai/requests` | any | read |
| `study-ai.review` | `GET /api/study-ai/review` | any | read |
| `study-ai.run.get` | `GET /api/study-ai/run` | any | read |
| `study-ai.run.post` | `POST /api/study-ai/run` | any | write |
| `study-draft.catalog` | `GET /api/study-draft/catalog` | any | read |
| `study-draft.check.get` | `GET /api/study-draft/check` | any | read |
| `study-draft.check.post` | `POST /api/study-draft/check` | any | write |
| `study-draft.create-collection` | `POST /api/study-draft/create-collection` | any | write |
| `study-draft.history-preview` | `POST /api/study-draft/history-preview` | any | read |
| `study-draft.history-restore` | `POST /api/study-draft/history-restore` | any | write · undo `study-draft.undo` |
| `study-draft.inspect.get` | `GET /api/study-draft/inspect` | any | read |
| `study-draft.inspect.post` | `POST /api/study-draft/inspect` | any | read |
| `study-draft.open` | `POST /api/study-draft/open` | any | write |
| `study-draft.read` | `GET /api/study-draft/read` | any | read |
| `study-draft.recover` | `POST /api/study-draft/recover` | any | write |
| `study-draft.root-recovery.get` | `GET /api/study-draft/root-recovery` | any | read |
| `study-draft.root-recovery.post` | `POST /api/study-draft/root-recovery` | any | write |
| `study-draft.save` | `POST /api/study-draft/save` | any | write · undo `study-draft.undo` |
| `study-draft.undo` | `POST /api/study-draft/undo` | any | write |

### library (26)

| name | route | who | kind |
|---|---|---|---|
| `collection-relationships` | `GET /api/collection-relationships` | any | read |
| `collection-relationships.detach` | `POST /api/collection-relationships/detach` | any | write |
| `collection-relationships.link` | `POST /api/collection-relationships/link` | any | write |
| `collections.get` | `GET /api/collections` | any | read |
| `collections.post` | `POST /api/collections` | any | write |
| `connections.delete` | `DELETE /api/connections` | any | write |
| `connections.get` | `GET /api/connections` | any | read |
| `connections.post` | `POST /api/connections` | any | write |
| `evidence.get` | `GET /api/evidence` | any | read |
| `evidence.post` | `POST /api/evidence` | any | write |
| `icloud-albums` | `GET /api/icloud-albums` | any | read |
| `library.folders.get` | `GET /api/library/folders` | any | read |
| `library.folders.post` | `POST /api/library/folders` | any | write · undo `library.folders.post` |
| `sources.blob` | `GET /api/sources/blob` | any | read |
| `sources.file.get` | `GET /api/sources/file` | any | read |
| `sources.file.post` | `POST /api/sources/file` | any | write |
| `sources.folders` | `POST /api/sources/folders` | any | write |
| `sources.import` | `POST /api/sources/import` | any | write |
| `sources.reconnect` | `POST /api/sources/reconnect` | any | write |
| `sources.reconnect.preview` | `POST /api/sources/reconnect/preview` | any | read |
| `sources.rename` | `POST /api/sources/rename` | any | write |
| `sources.tree` | `GET /api/sources/tree` | any | read |
| `study-originals` | `GET /api/study-originals` | any | read |
| `study-originals.audio` | `GET /api/study-originals/audio` | any | read |
| `study-originals.check-inputs` | `GET /api/study-originals/check-inputs` | any | read |
| `study.source-context` | `GET /api/study/source-context` | any | read |

### magazine (35)

| name | route | who | kind |
|---|---|---|---|
| `magazine.artifact` | `GET /api/magazine/artifact` | any | read |
| `magazine.library-photos` | `GET /api/magazine/library-photos` | any | read |
| `magazine.library-photos.album` | `POST /api/magazine/library-photos/album` | any | write · undo `library.folders.post` |
| `magazine.library-photos.asset` | `GET /api/magazine/library-photos/asset` | any | read |
| `magazine.library-photos.preview` | `GET /api/magazine/library-photos/preview` | any | read |
| `magazine.mechanical-check.get` | `GET /api/magazine/mechanical-check` | any | read |
| `magazine.mechanical-check.post` | `POST /api/magazine/mechanical-check` | human | write |
| `magazine.portfolio` | `GET /api/magazine/portfolio` | any | read |
| `magazine.working-draft.ai.accept` | `POST /api/magazine/working-draft/ai/accept` | human | write · undo `magazine.working-draft.undo` |
| `magazine.working-draft.ai.context` | `GET /api/magazine/working-draft/ai/context` | any | read |
| `magazine.working-draft.ai.proposal` | `GET /api/magazine/working-draft/ai/proposal` | any | read |
| `magazine.working-draft.ai.proposals` | `GET /api/magazine/working-draft/ai/proposals` | any | read |
| `magazine.working-draft.ai.propose` | `POST /api/magazine/working-draft/ai/propose` | any | write |
| `magazine.working-draft.ai.reject` | `POST /api/magazine/working-draft/ai/reject` | human | write |
| `magazine.working-draft.ai.run` | `POST /api/magazine/working-draft/ai/run` | human | write |
| `magazine.working-draft.catalog` | `GET /api/magazine/working-draft/catalog` | any | read |
| `magazine.working-draft.edit` | `POST /api/magazine/working-draft/edit` | human | write · undo `magazine.working-draft.undo` |
| `magazine.working-draft.export` | `POST /api/magazine/working-draft/export` | any | write |
| `magazine.working-draft.export-file` | `GET /api/magazine/working-draft/export-file` | any | read |
| `magazine.working-draft.exports` | `GET /api/magazine/working-draft/exports` | any | read |
| `magazine.working-draft.operation` | `GET /api/magazine/working-draft/operation` | any | read |
| `magazine.working-draft.prepare` | `POST /api/magazine/working-draft/prepare` | human | write |
| `magazine.working-draft.read` | `GET /api/magazine/working-draft/read` | any | read |
| `magazine.working-draft.save` | `POST /api/magazine/working-draft/save` | any | write · undo `magazine.working-draft.undo` |
| `magazine.working-draft.share-context` | `GET /api/magazine/working-draft/share-context` | any | read |
| `magazine.working-draft.share-feedback` | `GET /api/magazine/working-draft/share-feedback` | any | read |
| `magazine.working-draft.share-feedback.edit-model` | `GET /api/magazine/working-draft/share-feedback/edit-model` | any | read |
| `magazine.working-draft.share-feedback.history` | `GET /api/magazine/working-draft/share-feedback/history` | any | read |
| `magazine.working-draft.share-feedback.prepare` | `POST /api/magazine/working-draft/share-feedback/prepare` | any | write |
| `magazine.working-draft.share-feedback.prepare-mapping` | `POST /api/magazine/working-draft/share-feedback/prepare-mapping` | human | write |
| `magazine.working-draft.share-feedback.prepare-paragraph` | `POST /api/magazine/working-draft/share-feedback/prepare-paragraph` | human | write |
| `magazine.working-draft.share-feedback.save` | `POST /api/magazine/working-draft/share-feedback/save` | any | write · undo `magazine.working-draft.share-feedback.undo` |
| `magazine.working-draft.share-feedback.undo` | `POST /api/magazine/working-draft/share-feedback/undo` | human | write |
| `magazine.working-draft.share-feedback.undo-eligibility` | `GET /api/magazine/working-draft/share-feedback/undo-eligibility` | any | read |
| `magazine.working-draft.undo` | `POST /api/magazine/working-draft/undo` | human | write |

### material (3)

| name | route | who | kind |
|---|---|---|---|
| `first-flow.material-triage` | `POST /api/first-flow/material-triage` | human | write |
| `material.album` | `POST /api/material/album` | any | write |
| `material.folder.open` | `POST /api/material/folder/open` | any | write |

### media (10)

| name | route | who | kind |
|---|---|---|---|
| `media` | `POST /api/media` | any | write |
| `study.media-usage` | `GET /api/study/media-usage` | any | read |
| `study.media-usage.resolve` | `GET /api/study/media-usage/resolve` | any | read |
| `study.photos` | `GET /api/study/photos` | any | read |
| `study.photos.add` | `POST /api/study/photos/add` | any | write |
| `study.photos.available` | `GET /api/study/photos/available` | any | read |
| `study.photos.inspect` | `GET /api/study/photos/inspect` | any | read |
| `study.photos.preview` | `GET /api/study/photos/preview` | any | read |
| `study.photos.select` | `POST /api/study/photos/select` | any | write |
| `study.photos.update` | `POST /api/study/photos/update` | any | write |

### outputs (58)

| name | route | who | kind |
|---|---|---|---|
| `article.make.id` | `GET /api/article/make/{id}` | any | read |
| `article.make.id.accept` | `POST /api/article/make/{id}/accept` | human | write |
| `article.make.id.context` | `GET /api/article/make/{id}/context` | any | read |
| `article.make.id.propose` | `POST /api/article/make/{id}/propose` | any | write |
| `article.make.id.run` | `POST /api/article/make/{id}/run` | any | write |
| `article.make.id.send` | `POST /api/article/make/{id}/send` | any | write |
| `article.make.preview` | `POST /api/article/make/preview` | any | write |
| `article.make.recent` | `GET /api/article/make/recent` | any | read |
| `article.visual.id` | `GET /api/article/visual/{id}` | any | read |
| `article.visual.id.run` | `POST /api/article/visual/{id}/run` | any | write |
| `article.visual.id.send` | `POST /api/article/visual/{id}/send` | any | write |
| `article.visual.preview` | `POST /api/article/visual/preview` | any | write |
| `article.visual.recent` | `GET /api/article/visual/recent` | any | read |
| `carousel.exports.get` | `GET /api/carousel/exports` | any | read |
| `carousel.exports.id.file.name` | `GET /api/carousel/exports/{id}/file/{name}` | any | read |
| `carousel.exports.id.render.index` | `GET /api/carousel/exports/{id}/render/{index}` | any | read |
| `carousel.exports.post` | `POST /api/carousel/exports` | any | write |
| `carousel.make.id` | `GET /api/carousel/make/{id}` | any | read |
| `carousel.make.id.run` | `POST /api/carousel/make/{id}/run` | any | write |
| `carousel.make.id.send` | `POST /api/carousel/make/{id}/send` | any | write |
| `carousel.make.preview` | `POST /api/carousel/make/preview` | any | write |
| `carousel.make.recent` | `GET /api/carousel/make/recent` | any | read |
| `exports.get` | `GET /api/exports` | any | read |
| `exports.id.file` | `GET /api/exports/{id}/file` | any | read |
| `exports.post` | `POST /api/exports` | any | write |
| `shared-articles.capabilities` | `GET /api/shared-articles/capabilities` | any | read |
| `shared-articles.current` | `GET /api/shared-articles/current` | any | read |
| `shared-articles.launches` | `POST /api/shared-articles/launches` | any | write |
| `shared-articles.launches.id` | `GET /api/shared-articles/launches/{id}` | any | read |
| `shared-articles.launches.id.send` | `POST /api/shared-articles/launches/{id}/send` | any | write |
| `shared-articles.prepare` | `POST /api/shared-articles/prepare` | any | write |
| `shared-articles.propose` | `POST /api/shared-articles/propose` | any | write |
| `shared-articles.recover-external` | `POST /api/shared-articles/recover-external` | any | write |
| `shared-articles.requests` | `GET /api/shared-articles/requests` | any | read |
| `shared-articles.requests.id` | `GET /api/shared-articles/requests/{id}` | any | read |
| `shared-articles.requests.id.accept` | `POST /api/shared-articles/requests/{id}/accept` | human | write |
| `shared-articles.requests.id.external` | `GET /api/shared-articles/requests/{id}/external` | any | read |
| `shared-articles.requests.id.reject` | `POST /api/shared-articles/requests/{id}/reject` | human | write |
| `shared-carousels.capabilities` | `GET /api/shared-carousels/capabilities` | any | read |
| `shared-carousels.current` | `GET /api/shared-carousels/current` | any | read |
| `shared-carousels.prepare` | `POST /api/shared-carousels/prepare` | any | write |
| `shared-carousels.propose` | `POST /api/shared-carousels/propose` | any | write |
| `shared-carousels.recover-external` | `POST /api/shared-carousels/recover-external` | any | write |
| `shared-carousels.requests` | `GET /api/shared-carousels/requests` | any | read |
| `shared-carousels.requests.id` | `GET /api/shared-carousels/requests/{id}` | any | read |
| `shared-carousels.requests.id.accept` | `POST /api/shared-carousels/requests/{id}/accept` | human | write |
| `shared-carousels.requests.id.external` | `GET /api/shared-carousels/requests/{id}/external` | any | read |
| `shared-carousels.requests.id.reject` | `POST /api/shared-carousels/requests/{id}/reject` | human | write |
| `shared-carousels.requests.id.review` | `POST /api/shared-carousels/requests/{id}/review` | any | read |
| `study.outputs` | `GET /api/study/outputs` | any | read |
| `study.outputs.create` | `POST /api/study/outputs/create` | any | write |
| `study.outputs.export` | `POST /api/study/outputs/export` | any | write |
| `study.outputs.export-check` | `POST /api/study/outputs/export-check` | any | read |
| `study.outputs.exports` | `GET /api/study/outputs/exports` | any | read |
| `study.outputs.refresh` | `POST /api/study/outputs/refresh` | any | write |
| `study.outputs.review-words` | `POST /api/study/outputs/review-words` | any | write |
| `study.outputs.save` | `POST /api/study/outputs/save` | any | write · undo `study.outputs.undo` |
| `study.outputs.undo` | `POST /api/study/outputs/undo` | any | write |

### piece (5)

| name | route | who | kind |
|---|---|---|---|
| `pieces.get` | `GET /api/pieces` | any | read |
| `pieces.post` | `POST /api/pieces` | any | write |
| `pieces.switch` | `POST /api/pieces/switch` | any | write |
| `state.get` | `GET /api/state` | any | read |
| `state.put` | `PUT /api/state` | any | write |

### research (31)

| name | route | who | kind |
|---|---|---|---|
| `first-flow` | `GET /api/first-flow` | any | read |
| `first-flow.attach` | `POST /api/first-flow/attach` | any | write |
| `first-flow.binding` | `GET /api/first-flow/binding` | any | read |
| `first-flow.check` | `POST /api/first-flow/check` | any | write |
| `first-flow.context` | `GET /api/first-flow/context` | any | read |
| `first-flow.decide-line` | `POST /api/first-flow/decide-line` | any | write |
| `first-flow.material-context` | `GET /api/first-flow/material-context` | any | read |
| `first-flow.pick` | `POST /api/first-flow/pick` | any | write |
| `first-flow.prepare` | `POST /api/first-flow/prepare` | any | write |
| `first-flow.reinspect` | `POST /api/first-flow/reinspect` | any | write |
| `first-flow.run` | `POST /api/first-flow/run` | any | write |
| `first-flow.select` | `POST /api/first-flow/select` | any | write |
| `first-flow.source-review` | `POST /api/first-flow/source-review` | any | write |
| `research-material` | `GET /api/research-material` | any | read |
| `research-material.account` | `POST /api/research-material/account` | any | write |
| `research-material.claim` | `POST /api/research-material/claim` | any | write |
| `research-material.concept` | `POST /api/research-material/concept` | any | write |
| `research-material.import` | `POST /api/research-material/import` | any | write |
| `research-material.inherit` | `POST /api/research-material/inherit` | any | write |
| `research-material.position` | `POST /api/research-material/position` | any | write |
| `research-material.preview` | `POST /api/research-material/preview` | any | write |
| `research-material.review` | `POST /api/research-material/review` | any | write |
| `research.answers.id` | `GET /api/research/answers/{id}` | any | read |
| `research.answers.id.keep` | `POST /api/research/answers/{id}/keep` | any | write |
| `research.answers.id.markdown` | `GET /api/research/answers/{id}/markdown` | any | read |
| `research.answers.id.run` | `POST /api/research/answers/{id}/run` | any | write |
| `research.answers.preview` | `POST /api/research/answers/preview` | any | write |
| `research.answers.recent` | `GET /api/research/answers/recent` | any | read |
| `study-research.choices.get` | `GET /api/study-research/choices` | any | read |
| `study-research.choices.post` | `POST /api/study-research/choices` | any | write |
| `study-research.findings` | `GET /api/study-research/findings` | any | read |

### share (5)

| name | route | who | kind |
|---|---|---|---|
| `study.share` | `GET /api/study/share` | any | read |
| `study.share.fact` | `POST /api/study/share/fact` | human | write |
| `study.share.recipients` | `GET /api/study/share/recipients` | any | read |
| `study.share.save` | `POST /api/study/share/save` | human | write · undo `study.share.undo` |
| `study.share.undo` | `POST /api/study/share/undo` | human | write |

### system (19)

| name | route | who | kind |
|---|---|---|---|
| `.transcription.id.action` | `POST /transcription/{id}/{action}` | any | write |
| `.transcription.id.view` | `GET /transcription/{id}/view` | any | read |
| `capabilities` | `GET /api/capabilities` | any | read |
| `events` | `GET /api/events` | any | read |
| `events.since` | `GET /api/events/since` | any | read |
| `i64os.health` | `GET /api/i64os/health` | any | read |
| `journal` | `GET /api/journal` | any | read |
| `journal.ask` | `POST /api/journal/ask` | any | write |
| `journal.handoff` | `POST /api/journal/handoff` | any | write |
| `leases` | `GET /api/leases` | any | read |
| `leases.acquire` | `POST /api/leases/acquire` | any | write |
| `leases.release` | `POST /api/leases/release` | any | write |
| `presence.get` | `GET /api/presence` | any | read |
| `presence.post` | `POST /api/presence` | any | write |
| `study.structure-tests.get` | `GET /api/study/structure-tests` | any | read |
| `study.structure-tests.post` | `POST /api/study/structure-tests` | agent | write |
| `study.structure-tests.proposal-contract` | `POST /api/study/structure-tests/proposal-contract` | agent | write |
| `study.structure-tests.proposal-review` | `POST /api/study/structure-tests/proposal-review` | agent | write |
| `study.structure-tests.review-mark` | `POST /api/study/structure-tests/review-mark` | agent | write |

### transcript (11)

| name | route | who | kind |
|---|---|---|---|
| `ingestion` | `GET /api/ingestion` | any | read |
| `ingestion.raw` | `GET /api/ingestion/raw` | any | read |
| `ingestion.retry` | `POST /api/ingestion/retry` | any | write |
| `recordings` | `GET /api/recordings` | any | read |
| `source-sessions` | `GET /api/source-sessions` | any | read |
| `source-sessions.edit` | `POST /api/source-sessions/edit` | any | write · undo `source-sessions.undo` |
| `source-sessions.translation-accept` | `POST /api/source-sessions/translation-accept` | human | write · undo `source-sessions.undo` |
| `source-sessions.translation-proposals` | `POST /api/source-sessions/translation-proposals` | any | write |
| `source-sessions.translation-review` | `GET /api/source-sessions/translation-review` | any | read |
| `source-sessions.undo` | `POST /api/source-sessions/undo` | any | write |
| `transcript-tools.connect` | `POST /api/transcript-tools/connect` | any | write |

### writing (7)

| name | route | who | kind |
|---|---|---|---|
| `guidance.get` | `GET /api/guidance` | any | read |
| `guidance.post` | `POST /api/guidance` | any | write |
| `writing-template` | `GET /api/writing-template` | any | read |
| `writing-template.attach` | `POST /api/writing-template/attach` | any | write |
| `writing-template.detach` | `POST /api/writing-template/detach` | any | write |
| `writing-template.restore-copy` | `POST /api/writing-template/restore-copy` | any | write |
| `writing-template.snapshot` | `POST /api/writing-template/snapshot` | any | write |

## CLI (agents/cli/ar-create.mjs)

`node agents/cli/ar-create.mjs --url http://127.0.0.1:PORT --actor ACTOR COMMAND [--input FILE|-]`. JSON in, one JSON line out. `AR_CREATE_URL` and `AR_CREATE_ACTOR` are the defaults for `--url` and `--actor`.

Actors: `human:adrian`, `agent:claude-code`, `agent:codex`, `agent:claude-design`, `agent:hermes`, `agent:grok`, `agent:chatgpt`, `cron:<name>`, `import:<source>`, `release:<sha>`.

Exit codes: 0 = ok; 1 = failed; 2 = usage; 3 = conflict (re-read; never force); 4 = locked by another actor; 5 = forbidden (human-only).

| subcommand | does |
|---|---|
| `library tree` | registry command `sources.tree` |
| `library file` | registry command `sources.file.get` |
| `library search` | registry command `concept.sources.search` |
| `library read` | registry command `concept.source` |
| `library collections` | registry command `collections.get` |
| `collection list` | registry command `inquiries.catalog` |
| `collection read` | registry command `inquiries.read` |
| `collection create` | registry command `inquiries.create` |
| `collection update` | registry command `inquiries.update` |
| `collection save` | registry command `inquiries.save` |
| `collection projects` | registry command `inquiries.projects` |
| `collection undo` | registry command `inquiries.learning.undo` |
| `project list` | registry command `concepts.get` |
| `project create` | registry command `concepts.post` |
| `project read` | registry command `concept` |
| `project save` | registry command `concept.save` |
| `project direction` | registry command `study.human-direction` |
| `project capabilities` | registry command `concept.capabilities` |
| `piece list` | registry command `pieces.get` |
| `piece create` | registry command `pieces.post` |
| `piece switch` | registry command `pieces.switch` |
| `magazine board` | registry command `magazine.board` |
| `magazine story` | registry command `magazine.story` |
| `magazine propose` | registry command `magazine.write` |
| `magazine status` | registry command `magazine.status.table` |
| `draft catalog` | registry command `study-draft.catalog` |
| `draft read` | registry command `study-draft.read` |
| `draft open` | registry command `study-draft.open` |
| `draft create` | registry command `study-draft.create-collection` |
| `draft save` | registry command `study-draft.save` |
| `draft undo` | registry command `study-draft.undo` |
| `draft check` | registry command `study-draft.check.get` |
| `draft inspect` | registry command `study-draft.inspect.get` |
| `draft proposals` | registry command `study-ai.requests` |
| `status` | coordination and discovery |
| `events` | coordination and discovery |
| `history` | coordination and discovery |
| `lease acquire\|renew\|release\|list` | coordination and discovery |
| `handoff` | coordination and discovery |
| `ask` | coordination and discovery |
| `list-commands [--section S]` | coordination and discovery |
| `call NAME` | coordination and discovery |

## MCP tools (agents/mcp/server.mjs and mcp/study/server.mjs)

- **`ar_create_list_commands`** — List every AR Create command (name, section, method, route, input summary, readOnly, actors, undo). _(agents/mcp/server.mjs)_
- **`ar_create_call`** — Call one command by name with a JSON input. _(agents/mcp/server.mjs)_
- **`ar_create_events`** — Events since a cursor: {kind, scope, revision, actor, client, at, operationId}. _(agents/mcp/server.mjs)_
- **`study_draft_read`** — Read the latest saved manuscript part and its retained source catalog. _(agents/mcp/server.mjs)_
- **`study_draft_prepare`** — Capture selected corrected source/context, current manuscript and human direction. _(agents/mcp/server.mjs)_
- **`study_draft_context`** — Read the hash-verified captured material and human editorial decisions for a known request. _(agents/mcp/server.mjs)_
- **`study_draft_propose`** — Stage plain existing-paragraph replacements, prepared openingOptions or prepared article continuationParagraphs. _(agents/mcp/server.mjs)_
- **`study_draft_review`** — Inspect a candidate, its decision and freshness. _(agents/mcp/server.mjs)_
- **`study_draft_status`** — Current saved identity and request decisions, with an optional known review. _(agents/mcp/server.mjs)_

---

_Generated by `scripts/gen-capabilities-portable.ts` (auto-detects scripts, pages, API routes, MCP tools, migrations; and, where present, the AR Create command registry, CLI and MCP tools). Copy that one file into any repo and run it — no config._
