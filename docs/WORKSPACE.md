# AR Create developer workspace

AR Create is part of the i64 OS tool family. This standalone private repository is its canonical code/design container; i64 OS provides the host integration. Private content, the installed runtime and unfinished external candidates do not belong in this checkout. The authorized permanent local service/data home is separate from the source repository.

## Supporting documents for the next Claude Design pass

Read the handoff's brief first, then follow this index when a function or its reason needs more depth. The 20 October design-first instruction means unfinished connections do not block design; their actual states must remain visible. These documents are supplied together, not as a promise that every requirement is implemented.

| Question | Read | What it explains |
| --- | --- | --- |
| Why are we building this, and what must it preserve? | [Product purpose and pillars](PRODUCT.md) | Author-led creation, the seven human contributions, adopted decisions and their reasons, independent learning and independent outputs. Latest dated human direction takes precedence over older sequencing. |
| What belongs on each screen, and why? | [All twelve section briefs](sections/README.md) | Each section's purpose, core question, material, tools, decisions, result, constraints and dated refinements. The sections are accessible checkpoints, not mandatory steps. |
| Which functions work, and which still need connecting? | [Single function integration list](DESIGN-PASS-ADDITIONS.md) | Purpose/action/context/state map and working, prepared-unmounted, planned or external limits. A visible control is not evidence that its operation ran. |
| How do the functions join up? | [Seven connected flow diagrams](FUNCTION-FLOW.md) | Both agent/app entrances, collecting and learning, independent expressions, editing/media/export, safeguards, organizational relationships and returning to work. |
| How are the files and content related? | [File and identity contract](FILE-CONTRACT-MAP.md) | Library, Collections, Pieces and Projects mapped to existing owners; one source, exact references, scope/revision, supported moves and explicit interoperability limits. |
| How should the next pass combine these ideas? | [Connected next-pass plan](superpowers/specs/2026-10-18-connected-library-ideas-tea-design.md) | Invented tea scenario, personal contributions, Library alongside/on demand/full access, natural detours and current-understanding rules. Adopted requirements remain distinct from unresolved layout proposals. |
| How should the interface speak to the person? | [Human experience rules](HUMAN-EXPERIENCE.md) | Plain purpose/action language, useful entry and resume, readable work, honest states and progressive disclosure. |
| How do builders preserve and connect the real functions? | [Developer source map and setup](../CLAUDE-DEVELOPMENT.md), [source manifest](../source-manifest.json) | Exact packaged source, maintained components/services, synthetic setup, revision/Undo/conflict contracts, private exclusions and focused verification. Older baseline tables do not override the handoff's pinned current-status record. |

Use these as complementary authorities: product/section briefs state intent and rationale; the integration list states measured coverage; code defines the current contract. A dated implementation receipt may prove a bounded behavior, not every intended feature. Private operational receipts, real transcripts, manuscripts, media, credentials and decision histories are deliberately absent from this code-only package. Use its invented fixtures for design examples. Claude Design does not gain access to localhost, private folders or agent accounts from these documents.

| Area | Canonical code-only location | Use |
|---|---|---|
| Application source | `public/document-study/`, `runtime/`, `mcp/study/` | Existing Document Study UI, file/workflow services and fixed-identity assistant adapter |
| Product purpose and requirements | [What we are building](PRODUCT.md) | Pillars, shared acceptance, twelve-section map and direction-to-checklist update contract |
| Living intent/design | [Section brief index](sections/README.md) | Twelve authoritative developer briefs, updated from Product Direction; not completion claims |
| Developer setup/source map | [Claude guide](../CLAUDE-DEVELOPMENT.md) | Root-local commands, preserved behavior and focused checks |
| Synthetic examples | `fixtures/synthetic-study-data.js`, `scripts/demo.mjs`, `tests/` | Invented projects and temporary test storage; no actual interviews/media |
| Host-only configuration | `config.mjs`, `config.example.json`, `serve.mjs` | Explicit private roots/catalogs/tools, data outside checkout, loopback candidate ports |
| Source freeze | `source-manifest.json` | Reviewed included files, adaptations, completed delta pins and dependency overlay |
| Repository history | [Provenance](REPOSITORY-PROVENANCE.md) | AR Create-only history extracted from the preserved i64 package |
| i64 connection | [Host integration](I64-INTEGRATION.md) | Launcher/routing boundaries; authorized reversible local service move, completion subject to owner proof |
| Generated commands | [Capability index](CAPABILITIES.md) | Regenerate with `npm run build` then `npm run capabilities`; review manifest changes |

## Held references and candidates

Research exact-match references and other specialist candidates remain with their current owners outside this repository. Do not import stale candidate folders, captured private samples, bootstrap recovery files or quote/evidence/source-hash provenance outputs. Request a completed code-only delta with exact hashes; review its generic code and use synthetic tests before merging it here. This repository currently includes the completed source/direction checkpoint represented by the manifest, not unfinished live Research repairs.

Media/template experiments, source restoration, private playback/ASR tooling and complete export/publication acceptance retain their existing ownership. Candidate consolidation is a separate owner-receipt task; this index does not transfer or delete those artifacts.

## External management and proof

Product Direction owns human intent, section briefs and visual acceptance. Delivery Manager coordinates execution and owner receipts. The existing integrator alone owns live shared wiring and activation. Delivery also owns AI connection and code-only repository/release preparation, assigning bounded background helpers. Prior Internal chats are retained history, not routine owners.

External manager working drafts, installed-service handoffs, private-data preservation receipts and native proof/screenshots remain outside Git. The local repository-separation receipt names their current locations for the managers; it is deliberately not committed because private operational/proof directories are not application source. Use the manager's latest receipt rather than inventing an external path or copying an archive.

## Current boundaries

18 October: the author authorized the sole Build integrator to move the running service and saved work outside Codex to `~/Library/Application Support/i64os/ar-create`. The local move is installed with recorded restart/native preservation, unchanged originals/browser origin and subsequent one-click i64 entry/return proof. The owner migration/integration receipts and direct-entry verification remain outside Git with the private installation; this is bounded local proof, not remote/offline synchronization. Preserve exact installed code/data, the same localhost8841 browser origin, linked source originals and old-home rollback copies; use the final owner receipt for verified service/data subpaths and launcher details. The source checkout and i64 package remain separate from private runtime data. A normal checkout or visual-development task must not perform its own cutover. Existing synthetic previews are separate and are not live-content proof.

Runtime dependency repair is preserved. Its low Readability residual and the separate SDK client's high OAuth residual are documented in README; this workspace does not configure accounts or perform provider execution. Secure VPS/desktop replicas, offline synchronization and phone access remain planned work. No deployment or private upload is implied by a code push.
