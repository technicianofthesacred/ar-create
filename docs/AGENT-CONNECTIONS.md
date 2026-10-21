# Agent connections: independent learning and work receipts

Integration addendum to the existing [CONCEPT-AGENT](CONCEPT-AGENT.md) guide, checked against the maintained source on 20 October 2026 and updated for the one CLI on 21 October. The bounded connected routes are now installed; synthetic mutation proof and installed read-only preservation remain distinct. This is not human editorial acceptance, provider execution or publication. Host authentication, origin checks and configuration still apply. An unavailable owner or route is a hold, not permission to invent a replacement.

## Start with the actual inquiry

An inquiry is an existing Library Collection and its shared learning record. It can have no sources, Project or output. Discover it through `catalog`, use its returned Collection UUID, and read/save through the inquiry interface. Names and titles are display text, not identity joins.

Learning selectors use `{scope:"collection", collectionId}`. Project direction uses `{scope:"project", parentStudyId}`; part direction adds `scope:"part", bindingId`; output direction uses `{scope:"output", parentStudyId, bindingId, outputId}`. Resolve these exact identities from maintained owners. A legacy CLI command accepting only `parentStudyId` addresses Project direction; it does **not** read or save an independent Collection. The one CLI (`agents/cli/ar-create.mjs --actor agent:<name>`) now reaches these routes as `collection list|read|save|projects|create|update|undo`, with the selector in `--input`; the MCP server reaches them with `ar_create_call`. Every write needs an actor. `collection list` (the catalog) currently answers 400 through both, because an empty selector is dropped before sending: read the catalog with `GET /api/inquiries/catalog?input=%7B%7D` until that is fixed. This addendum adds no provider.

The route factory exposes these agent-safe methods only:

`catalog`, `read`, `save`, `projects`, `project`, `understanding`, `references`, `directionReferences`, `source`, `piece`.

`agentMethods.save` changes the shared learning record and therefore still needs the task's authorization. It captures the supplied request before asynchronous reads. The agent subset does not grant Collection creation/update, association/reference proposals, human acceptance, detachment or Undo. The broader UI HTTP map is not an agent permission list; some mutation handlers attribute decisions to `human`. Do not call them to impersonate a person or bypass the agent subset.

## Actual inquiry HTTP map

Prefix: `/api/inquiries`. Every GET takes exactly one query parameter, `input`, containing URL-encoded JSON. POST takes JSON. No caller paths, snapshots or extra fields are accepted.

| Method | Route suffix | Main request |
| --- | --- | --- |
| GET | `/catalog`, `/projects` | `{}` |
| GET | `/read` | `{collectionId}` |
| GET | `/project` | `{collectionId, projectSelector}` |
| GET | `/understanding` | `{collectionId, projectSelector?, piece?}` |
| GET | `/source` | `{collectionId, sourceId}` |
| GET | `/piece` | `{collectionId, projectSelector, outputId}` |
| GET | `/references` | `{collectionId, projectSelector?, piece?, sourceId?}` |
| GET | `/direction-references` | `{collectionId, projectSelector?, piece?}` |
| POST | `/create` | `{name, sourceIds, expectedRevision}` |
| POST | `/update` | `{id, name, sourceIds, expectedRevision}` |
| POST | `/save` | `{collectionId, operationId, expectedRevision, expectedHash, expectedMetadataHash, body}` |
| POST | `/association/propose`, `/association/change` | Exact Project connection, Library CAS, operation and decision fields |
| POST | `/references/propose`, `/references/change`, `/references/undo` | Exact source/reference target, Library CAS, operation and decision fields |
| POST | `/direction-references/propose`, `/direction-references/change`, `/direction-references/undo` | Exact target/origin reference, direction CAS, operation and decision fields |
| POST | `/learning/undo` | Exact Collection, current direction CAS, operation/Undo IDs and reason |

The decision-workflow rows after `/save` include human-attributed mutations; consult the route factory for their finite fields rather than treating these summaries as executable request templates. Collection creation/update uses the Library catalog revision. Learning save instead uses the learning record's revision, body hash **and metadata hash** (`null` when returned as null). Do not substitute a Library hash for a learning hash.

## Invented request flow

This example uses a host-supplied instance of `createInquiryInterfaceClient` against an authorized local candidate. IDs, revisions and hashes come from returned records; the text is invented. A trusted service caller can use the matching `agentMethods` directly.

```js
const catalog = await inquiry.catalog({});
// Pick the intended existing Collection using the actual task and catalog.
const collectionId = catalog.collections[selectedIndex].id;
const before = await inquiry.read({collectionId});
const request = {
  collectionId,
  operationId: crypto.randomUUID(),
  expectedRevision: before.record.revision,
  expectedHash: before.record.hash,
  expectedMetadataHash: before.record.metadataHash ?? null,
  body: before.record.body + '\n\n## Invented follow-up\nCompare two explanations.\n'
};
// Only after the task authorizes this exact learning amendment:
const saved = await inquiry.save(request);
const after = await inquiry.read({collectionId});
// Check exact Collection, operation, revision/hash and intended complete wording.
// A later concurrent amendment requires reconciliation, not overwriting it.
```

Equivalent reads are `GET /api/inquiries/read?input=` plus `encodeURIComponent(JSON.stringify({collectionId}))`; save is `POST /api/inquiries/save` with the exact JSON request. Keep the full manual body and its provenance distinctions. A successful response is not external evidence verification. On 409, retain submitted and current wording, reread and reconcile; do not force a save. After an uncertain/lost response, reread first and retry only the original identical operation/request when appropriate. Reusing an operation UUID with changed text is not a new edit.

## Optional Project and Piece context

`projects` returns verified `projectSelector` values: `{workspaceId, parentStudyId, rootBindingId}`. Copy the returned selector; never derive roots from titles. `piece` in a contextual request is `{rootBindingId, parentStudyId, selectedOutputId}`. Piece access requires an accepted Collection–Project association and exact maintained membership. Source opens require actual Collection membership. Neither is necessary for standalone learning.

`piece` returns a navigation descriptor with `wordOwner`. The actual browser bridge dispatches `wordOwner.kind === "carousel-words"` to the maintained output connection's `onAction({projectId:parentStudyId, outputId, kind:"words"})`; native wording dispatches `kind:"native"`, after the owner read. These are opens, not word writes. Preserve independent Article/Carousel owners and their own save/revision guards. Do not route a Carousel to the native manuscript editor.

`understanding` rereads maintained records and returns a dependency fingerprint. The direct resolver accepts `{scopes:[selector, ...], selectedScope, piece?}`; `selectedScope` must be explicitly requested. Linked learning is background, not implicitly inherited direction. Overlaps have no invented precedence. `assistance.mayApply` and reference `permissionGranted` remain false: a projection is context, not application authority.

## Continuity records and context checks

All `/api/work-continuity/*` routes use local **POST JSON**, including reads. Their `scope` uses `kind`, unlike direction selectors:

- Collection: `{kind:"collection", collectionId}`.
- Project: `{kind:"project", parentStudyId}`.
- Piece: `{kind:"piece", parentStudyId, rootBindingId, outputId}`.

Actual suffixes: `/read`, `/seen`, `/assign`, `/result`, `/complete`, `/undo`, `/recover`, `/context`, `/understanding`, `/artifacts`. Read takes `{scope, viewerId?}`; recover/artifacts take `{scope}`; understanding takes `{request}`. Context takes `{scope, assignmentId, preparedText, humanText}` and preserves both text variants while checking the saved preparation fingerprint against current owners.

Receipt mutations require `scope`, `operationId`, receipt CAS `expected:{revision,hash}`, maintained `expectedWork:{revision,hash,wordsHash,editionHash}`, and `actor:{clientId,reportedRole}`, plus their operation-specific fields. Read current receipt/work guards; never supply a caller snapshot as authority. Actor roles (`viewer`, `agent`, `local-client`) are **unverified client labels**, not authenticated execution permissions. An agent cannot record a viewer visit or attribute manual completion to itself as human approval.

An assignment receipt records desired result, exact requested scope, bounded allowed changes, protected words and stopping conditions; it reports `permissionGranted:false` and `executionLaunched:false`. A result's changes are reported-only, with causation unverified and approval false. A completed export artifact or completion receipt still reports `publicationVerified:false`. Creating these metadata records launches no agent, writes no manuscript, publishes nothing and grants no new execution authority.

Before applying prepared work, revalidate the assignment context and actual target owner guards. A context-unchanged response still requires those guards and supplies no permission. Changed/unavailable context retains prepared and human text for review. Browser return holds preserve an exact existing editor buffer; they are not a second manuscript authority.

## Recovery stays subordinate to saved owners

The recovery adapter is mounted in the isolated synthetic candidate through `mountContinuityBrowserRecovery`, retaining the existing host capture/restore contract and stable opaque `authorityKey` and local `viewerId`. Native browser proof covers failed-before-send → reload → exact-command retry with newer typing preserved. The bounded adapter is installed in the working app. Synthetic dirty-manuscript detours and scope departure have their own native checkpoint; installed review verifies read-only return and actual controls, not private prose mutation. Its controller keeps exact pending commands and exposes explicit retry/hold/restore actions; verify combined host wiring separately. Browser recovery omits manuscript text, host buffer objects and return tokens, so it does not prove dirty native manuscript recovery after reload.

Learning browser recovery stores bounded per-Collection draft text, its base CAS and an exact pending request. Continuity browser recovery stores bounded local form variants and exact pending metadata commands, keyed by local authority/viewer/scope. These are transient browser copies, not canonical saves, AI memory or an agent interchange store. Do not scrape/import browser recovery as authoritative learning or silently replace canonical records with it.

Keep old and newer variants separate, reconcile lost acknowledgments through maintained reads, and retry only an identical pending command when its recovery flow permits. A stale/rejected command needs review and a separately authorized new operation; never silently rewrite its CAS. Saved journals and explicit owner recovery remain the authority for receipts/learning. Missing recovery access does not authorize installing providers, transmitting private material or changing the runtime home.

Existing documentation checked: the frozen `CONCEPT-AGENT.md` guide and continuity recovery `HANDOFF.md`. The guide’s parent-based “collection/project” create wording must not be confused with the independent Library Collection API above. Source contracts checked: `runtime/services/inquiry-interface-routes.mjs`, `continuity-interface-routes.mjs`, `current-understanding.mjs`, `work-continuity.mjs`; `public/document-study/inquiry-workspace.mjs`, `connected-workspace.mjs`, `continuity-browser-recovery.mjs`; and the candidate server mounts. The existing CONCEPT-AGENT guide and frozen source remain unchanged.


## Visible standalone entrance — source verification, pending activation

The current source bridge exposes the same independent Learning library through C3 Open/create and Home as well as the legacy rail. It uses maintained owner flush and return guards; a visible actual native part is held/read through its native owner, without inventing a Project/output relation. The exact-source native journey saves/rereads a source-free inquiry, returns to exact editor words/binding/proof, reloads and reopens the same saved record. The bridge entrance delta is not yet live until separately activated by the sole integrator. Existing scoped output guards are not loosened.
