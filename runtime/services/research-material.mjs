import {inheritedStudyGroups} from './study-inheritance.mjs';
/** Source-aware Study material and additive Primer inheritance, in ar-create's own namespace.
 * Pure donor modules are copied locally; no i64OS runtime, DB, vault writer or API is loaded.
 */
import path from 'node:path';
import { StateError } from '../store.mjs';
import { atomicWrite, readJson, digest, ensurePrivateDirectory } from './files.mjs';
import { buildStudyMaterialCardInputs } from './donors/study/study-material-import.mjs';
import { verifyMaterialCandidates, renderClaimsMarkdown, parseClaimsMarkdown, renderAccountMarkdown, parseAccountMarkdown } from './donors/study/research-materials.mjs';
import { claimBandForCard } from './donors/study/study-material-bands.mjs';
import { conceptSentinel, positionSentinel, gapSentinel, titleKey } from './donors/study/research-inherit.mjs';

const now = () => new Date().toISOString();
const provenance = { adapter: 'ar-create.study-material.v1', donors: ['wordforge/study-material-import.ts', 'study/research-materials.ts', 'wordforge/research-inherit.ts', 'wordforge/study-material-bands.ts'], originalRuntimeConnected: false };
function required(value, name, max = 100000) { if (typeof value !== 'string' || !value.trim() || value.length > max || /\u0000/.test(value)) throw new StateError(`${name} must be nonempty text under ${max} characters.`); return value; }
function identity(value, name) { return required(value, name, 128); }
function array(value, name, max = 200) { if (!Array.isArray(value) || value.length > max) throw new StateError(`${name} must contain at most ${max} entries.`); return value; }
function unique(rows, key, name) { const ids = new Set(); for (const row of rows) { const id = identity(row?.[key], name); if (ids.has(id)) throw new StateError(`Duplicate ${name} in this batch.`); ids.add(id); } }
function safeUrl(value) { if (value == null || value === '') return null; try { const url = new URL(value); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {} throw new StateError('Source links must be HTTP or HTTPS without credentials.'); }
const sourceKind = source => source.kind === 'book' ? 'book' : ['video', 'audio', 'transcript'].includes(source.kind) ? 'video' : ['web', 'article'].includes(source.kind) ? 'article' : ['note', 'document', 'pdf'].includes(source.kind) ? 'document' : 'other';
const stableId = (type, value) => `${type}-${digest(JSON.stringify(value)).slice(0, 28)}`;
function empty(projectId) { return { schema: 'ar-create.research-material.v1', projectId, revision: 0, concepts: [], claims: [], accounts: [], positions: [], gaps: [], inherited: { passages: [], cards: [], notes: [] } }; }
function conceptInput(input, pileId) { return { id: identity(input.id, 'Concept ID'), name: required(input.name, 'Concept name', 512), short: required(input.short, 'Concept explanation'), ordinal: Number.isInteger(input.ordinal) && input.ordinal >= 0 ? input.ordinal : 0, pileId, origin_ref: conceptSentinel(input.id) }; }

export function createResearchMaterial({ dataDir, library }) {
  if (!library || !['tree', 'read', 'evidence'].every(key => typeof library[key] === 'function')) throw new Error('Research material needs the ar-create library adapter.');
  const directory = ensurePrivateDirectory(dataDir, 'research-material');
  let pending = Promise.resolve();
  const serial = fn => { const result = pending.then(fn); pending = result.catch(() => {}); return result; };
  const file = projectId => path.join(directory, digest(identity(projectId, 'Project ID')) + '.json');
  function load(projectId) { const room = readJson(file(projectId), empty(projectId)); if (room.schema !== 'ar-create.research-material.v1' || room.projectId !== projectId || !Number.isInteger(room.revision) || !['concepts', 'claims', 'accounts', 'positions', 'gaps'].every(key => Array.isArray(room[key])) || !room.inherited || !['passages', 'cards', 'notes'].every(key => Array.isArray(room.inherited[key]))) throw new Error('Research material is invalid; existing file preserved.'); return room; }
  function persist(room) { room.revision++; atomicWrite(file(room.projectId), JSON.stringify(room, null, 2)); }
  async function corpus() { const catalog = await library.tree(), evidence = await library.evidence(); return { catalog, sources: new Map(catalog.sources.map(source => [source.id, source])), evidence: new Map(evidence.cards.map(card => [card.id, card])), reads: new Map() }; }
  function source(corpus, id) { identity(id, 'Source ID'); const value = corpus.sources.get(id); if (!value || value.missing) throw new StateError('This material refers to a source that is no longer in the library.', 409); if (!value.cardEligibility?.eligible) throw new StateError('Use a readable source or transcript before recording research material.'); return value; }
  async function evidence(corpus, evidenceId, expectedSourceId = null, exactQuote = null) {
    const card = corpus.evidence.get(identity(evidenceId, 'Evidence ID'));
    if (!card || card.sourceMissing || card.stale) throw new StateError('Choose a current evidence card. The captured source is missing or changed.', 409);
    const original = source(corpus, card.sourceId);
    if (expectedSourceId !== null && card.sourceId !== expectedSourceId) throw new StateError('Evidence belongs to a different source.');
    if (exactQuote !== null && card.quote !== exactQuote) throw new StateError('The quote differs from the captured evidence.');
    let content = corpus.reads.get(card.sourceId); if (!content) { content = await library.read(card.sourceId); corpus.reads.set(card.sourceId, content); }
    if (content.hash !== card.sourceHash || content.text?.slice(card.locator.start, card.locator.end) !== card.quote) throw new StateError('Evidence no longer matches this source version.', 409);
    return { card, original, content };
  }
  function verifiedLocator(label, checked) { const anchored = `${checked.original.rel_path} · characters ${checked.card.locator.start}–${checked.card.locator.end}`; if (label === anchored || label === checked.card.locator.label || checked.content.text.includes(label)) return label; throw new StateError('Use the captured passage locator or a locator appearing in the original source.'); }
  function decorateBinding(c, binding) { const current = c.sources.get(binding.sourceId), card = binding.evidenceId ? c.evidence.get(binding.evidenceId) : null; return { ...binding, sourceMissing: !current, stale: !current || (card ? card.stale || card.sourceMissing : current.hash !== binding.sourceHash), currentSourceTitle: current?.title || current?.name || null, currentSourcePath: current?.rel_path || null }; }
  const boundSource = (original, card) => ({ evidenceId: card.id, sourceId: original.id, sourceHash: card.sourceHash, sourceTitle: original.title || original.name, sourcePath: original.rel_path, sourceUrl: safeUrl(original.source_url || original.url || null), locator: structuredClone(card.locator), excerpt: card.quote, humanReview: original.pipelineStates?.review?.state || 'unreviewed' });
  function conflict(existing, incoming) { if (existing && existing.payloadHash !== incoming.payloadHash) throw new StateError('This material identity already exists with different content. Give the revision a new ID; the saved material was preserved.', 409); }
  async function prepare(input, room, c) {
    identity(input.pileId, 'Research pile ID');
    if (input.positions !== undefined) throw new StateError('Import source research separately. Personal positions must be written through My perspective.');
    const claims = array(input.claims ?? [], 'Claims'), accounts = array(input.accounts ?? [], 'Accounts'), concepts = array(input.concepts ?? [], 'Concepts'), gaps = array(input.gaps ?? [], 'Gaps');
    if (!(claims.length + accounts.length + concepts.length + gaps.length)) throw new StateError('No research material to import.');
    unique(claims, 'id', 'Claim ID'); unique(accounts, 'account_id', 'Account ID'); unique(concepts, 'id', 'Concept ID');
    // Roundtrip the donor's signed receipt validators before its card builder. This adds
    // duplicate-source, lane, grounded-quote and count checks the card builder alone lacks.
    const donorClaims = parseClaimsMarkdown(renderClaimsMarkdown({ board_id: input.pileId, claims }));
    const donorAccounts = accounts.map(account => parseAccountMarkdown(renderAccountMarkdown(account)));
    const cards = buildStudyMaterialCardInputs(input.pileId, { claims: donorClaims, accounts: donorAccounts }, input.origin === 'manual' ? 'local-operator' : 'imported-research');
    const additions = { concepts: [], claims: [], accounts: [], gaps: [] }, report = { created: 0, already_present: 0, claim_count: claims.length, account_count: accounts.length, concept_count: concepts.length, gap_count: gaps.length };
    const conceptIds = new Set([...room.concepts.map(item => item.id), ...concepts.map(item => item.id)]);
    const add = (kind, value) => { const existing = room[kind].find(item => item.identity === value.identity); conflict(existing, value); if (existing) report.already_present++; else { additions[kind].push(value); report.created++; } };
    for (const concept of concepts) { const value = conceptInput(concept, input.pileId); add('concepts', { ...value, identity: `primer-concept:${concept.id}`, payloadHash: digest(JSON.stringify(value)), createdAt: now(), origin: input.origin === 'manual' ? 'operator' : 'imported' }); }
    for (const claim of donorClaims) {
      const original = claims.find(item => item.id === claim.id); const conceptId = original.concept_id ?? null;
      if (conceptId !== null && !conceptIds.has(conceptId)) throw new StateError('Claim concept is not present in this research.');
      if (claim.counts.unique_sources < 1 || claim.votes.length !== claim.counts.unique_sources) throw new StateError('Every counted source must have an explicit vote. Silence is never inferred as agreement.');
      const bindings = [];
      for (const vote of claim.votes) {
        const s = source(c, vote.source_id), raw = original.votes.find(item => item.source_id === vote.source_id);
        if (vote.stance === 'silent') { if (vote.exact_quote !== null || vote.locator !== null) throw new StateError('Silent sources must not carry quotation evidence.'); bindings.push({ sourceId: s.id, sourceTitle: s.title || s.name, sourcePath: s.rel_path, sourceHash: s.hash, sourceUrl: safeUrl(s.source_url || s.url || null), evidenceId: null, excerpt: null, locator: null, stance: 'silent', humanReview: s.pipelineStates?.review?.state || 'unreviewed' }); continue; }
        const checked = await evidence(c, raw.evidence_id, vote.source_id, vote.exact_quote);
        if (vote.locator_url != null && safeUrl(vote.locator_url) !== safeUrl(s.source_url || s.url || null)) throw new StateError('The source link differs from the captured library source.');
        bindings.push({ ...boundSource(checked.original, checked.card), stance: vote.stance, locatorLabel: verifiedLocator(vote.locator, checked) });
      }
      const card = cards.find(item => item.research_material_identity === `study:${input.pileId}:claim:${claim.id}`);
      const payload = { claim, evidence: bindings.map(item => ({ sourceId: item.sourceId, evidenceId: item.evidenceId, sourceHash: item.sourceHash })), conceptId };
      add('claims', { id: stableId('material', card.research_material_identity), identity: card.research_material_identity, pileId: input.pileId, conceptId, card, claim, sources: bindings, band: claimBandForCard(card), payloadHash: digest(JSON.stringify(payload)), createdAt: now(), origin: input.origin === 'manual' ? 'operator' : 'imported', reviewState: 'unreviewed' });
    }
    for (let index = 0; index < donorAccounts.length; index++) {
      const record = donorAccounts[index], raw = accounts[index], checked = await evidence(c, raw.evidence_id, record.research_source_id, record.account.verbatim_text);
      if (checked.content.text.indexOf(checked.card.quote) !== checked.content.text.lastIndexOf(checked.card.quote)) throw new StateError('This account quote appears more than once. Capture a longer unique passage so its surrounding context can be verified.');
      verifiedLocator(record.account.locator, checked);
      if (record.account.study_item_id !== record.research_source_id) throw new StateError('The account item and source identities must match the library.');
      const verified = verifyMaterialCandidates({ study_item_id: checked.original.id, text: checked.content.text, trusted_speaker: checked.original.author || null, locator: record.account.locator, locator_url: boundSource(checked.original, checked.card).sourceUrl, source_kind: sourceKind(checked.original), spine_order: null, lane: record.account.lane, wildcard_kind: record.account.wildcard_kind }, [{ kind: 'account', quote: record.account.verbatim_text, speaker: record.account.speaker }]);
      const account = verified.materials[0];
      if (!account) throw new StateError(`Account cannot be verified: ${verified.dropped[0]?.reason || 'source context missing'}.`);
      if (account.context_before !== record.account.context_before || account.context_after !== record.account.context_after) throw new StateError('Account context differs from the original surrounding paragraphs.');
      if (record.account.locator_url != null && safeUrl(record.account.locator_url) !== boundSource(checked.original, checked.card).sourceUrl) throw new StateError('Account source link differs from the library source.');
      const card = cards.find(item => item.research_material_identity === `study:${input.pileId}:account:${record.account_id}`), binding = boundSource(checked.original, checked.card);
      add('accounts', { id: stableId('material', card.research_material_identity), identity: card.research_material_identity, pileId: input.pileId, card, account: record.account, source: binding, payloadHash: digest(JSON.stringify({ account: record.account, evidenceId: binding.evidenceId, sourceHash: binding.sourceHash })), createdAt: now(), origin: input.origin === 'manual' ? 'operator' : 'imported', reviewState: 'unreviewed' });
    }
    for (const gap of gaps) { required(gap, 'Research gap'); const key = `${gapSentinel(input.pileId)}:${digest(gap)}`; add('gaps', { id: stableId('gap', key), identity: key, pileId: input.pileId, source_ref: gapSentinel(input.pileId), content: gap, payloadHash: digest(gap), createdAt: now() }); }
    return { additions, report };
  }
  async function importMaterial(input, { preview = false } = {}) { const room = load(input.projectId), c = await corpus(); let prepared; try { prepared = await prepare(input, room, c); } catch (error) { if (error instanceof StateError) throw error; throw new StateError(`Research batch was not imported: ${error.message}`); } if (!preview && prepared.report.created) { for (const kind of Object.keys(prepared.additions)) room[kind].push(...prepared.additions[kind]); persist(room); } return { ...prepared.report, projectId: room.projectId, pileId: input.pileId, revision: room.revision, preview, material: structuredClone(prepared.additions), provenance }; }
  async function presentation(projectId) {
    const room = load(projectId), c = await corpus();
    const decorate = binding => decorateBinding(c, binding);
    const result = structuredClone(room);
    result.claims = result.claims.map(item => ({ ...item, sources: item.sources.map(decorate) }));
    result.accounts = result.accounts.map(item => ({ ...item, source: decorate(item.source) }));
    result.inherited.cards = result.inherited.cards.map(card => ({ ...card, ...(card.sources ? {sources: card.sources.map(decorate)} : {}), ...(card.source ? {source: decorate(card.source)} : {}) }));
    return { ...result, provenance, capabilities: { manualClaims: true, manualAccounts: true, externalSnapshotImport: true, additiveInheritance: true, automaticResearch: false }, evidence: [...c.evidence.values()].filter(card => !card.sourceMissing && !card.stale && c.sources.get(card.sourceId)?.cardEligibility?.eligible) };
  }
  return {
    // Explicit request projection retains donor roles, votes and review; no prose acceptance.
    projectContext: (projectId, selection) => serial(async () => {
      const room = load(projectId), c = await corpus(), units = [];
      for (const [key, kind, rows] of [['positionIds', 'position', room.positions], ['claimIds', 'claim', room.claims], ['accountIds', 'account', room.accounts]]) {
        for (const id of selection[key] || []) {
          const item = rows.find(item => item.id === id);
          if (!item || kind === 'position' && (item.status !== 'held' || item.origin !== 'operator')) throw new StateError('A selected Study item is no longer available in this project.', 409);
          const bindings = kind === 'claim' ? item.sources : kind === 'account' ? [item.source] : [];
          for (const binding of bindings) {
            if (binding.evidenceId) { const checked = await evidence(c, binding.evidenceId, binding.sourceId, binding.excerpt); if (checked.content.hash !== binding.sourceHash || digest(JSON.stringify(checked.card.locator)) !== digest(JSON.stringify(binding.locator))) throw new StateError('Selected Study evidence changed. Reopen the material before sending.', 409); }
            else { const current = await library.read(source(c, binding.sourceId).id); if (current.hash !== binding.sourceHash) throw new StateError('A silent Study source changed. Reopen the comparison.', 409); }
          }
          const data = structuredClone(kind === 'position' ? {took:item.took,because:item.because,changesMyMind:item.changes_my_mind,status:item.status,origin:item.origin} : kind === 'claim' ? {claim:item.claim,band:item.band,origin:item.origin,reviewState:item.reviewState,sources:bindings} : {account:item.account,origin:item.origin,reviewState:item.reviewState,sources:bindings});
          const body = kind === 'position' ? `${item.took}\nReason: ${item.because}\nWhat could change my mind: ${item.changes_my_mind || '(Not stated)'}` : kind === 'claim' ? `${item.claim.text}\nBand: ${item.band}; counts: ${JSON.stringify(item.claim.counts)}` : `Speaker: ${item.account.speaker}\nBefore: ${item.account.context_before}\nExact account: ${item.account.verbatim_text}\nAfter: ${item.account.context_after}`;
          units.push({kind,id,role:kind === 'position' ? 'personal-position-not-evidence' : kind === 'claim' ? 'retained-claim-not-established-fact' : 'source-linked-exact-account',reviewState:kind === 'position' ? 'operator-held' : item.reviewState,body,data,sources:structuredClone(bindings),hash:digest(JSON.stringify(data))});
        }
      }
      return units;
    }),
    list: projectId => serial(() => presentation(projectId)),
    previewImport: input => serial(() => importMaterial(input, { preview: true })),
    import: input => serial(() => importMaterial(input)),
    saveConcept: input => serial(() => { const value = { id: input.id || stableId('concept', [input.name, input.short]), name: input.name, short: input.short, ordinal: input.ordinal }; return importMaterial({ projectId: input.projectId, pileId: input.pileId || input.projectId, concepts: [value], origin: 'manual' }); }),
    saveClaim: input => serial(async () => {
      required(input.text, 'Claim text'); const c = await corpus(), votes = [];
      for (const vote of array(input.votes, 'Claim votes', 100)) {
        if (vote.stance === 'silent') { const s = source(c, vote.sourceId); votes.push({ source_id: s.id, stance: 'silent', exact_quote: null, locator: null, locator_url: null, source_kind: sourceKind(s), spine_order: sourceKind(s) === 'book' ? 0 : null }); }
        else { if (!['support', 'contest'].includes(vote.stance)) throw new StateError('Choose supporting, contesting or silent for each source.'); const { card, original } = await evidence(c, vote.evidenceId); votes.push({ source_id: card.sourceId, stance: vote.stance, exact_quote: card.quote, locator: vote.locator || `${original.rel_path} · characters ${card.locator.start}–${card.locator.end}`, locator_url: safeUrl(original.source_url || original.url || null), source_kind: sourceKind(original), spine_order: sourceKind(original) === 'book' ? 0 : null, evidence_id: card.id }); }
      }
      const counts = { support: votes.filter(v => v.stance === 'support').length, contest: votes.filter(v => v.stance === 'contest').length, silent: votes.filter(v => v.stance === 'silent').length, unique_sources: votes.length };
      const claim = { id: input.id || stableId('claim', [input.text, votes]), text: input.text, band: input.band || (counts.contest ? 'contested' : counts.support <= 2 ? 'fringe' : 'settled'), lane: input.lane || 'main', wildcard_kind: input.wildcardKind ?? null, counts, votes, concept_id: input.conceptId ?? null };
      return importMaterial({ projectId: input.projectId, pileId: input.pileId || input.projectId, claims: [claim], origin: 'manual' });
    }),
    saveAccount: input => serial(async () => {
      const c = await corpus(), checked = await evidence(c, input.evidenceId);
      if (checked.content.text.indexOf(checked.card.quote) !== checked.content.text.lastIndexOf(checked.card.quote)) throw new StateError('This account quote appears more than once. Capture a longer unique passage so its surrounding context can be verified.');
      const result = verifyMaterialCandidates({ study_item_id: checked.original.id, text: checked.content.text, trusted_speaker: checked.original.author || null, locator: input.locator || `${checked.original.rel_path} · characters ${checked.card.locator.start}–${checked.card.locator.end}`, locator_url: safeUrl(checked.original.source_url || checked.original.url || null), source_kind: sourceKind(checked.original), spine_order: null, lane: input.lane || 'main', wildcard_kind: input.wildcardKind ?? null }, [{ kind: 'account', quote: checked.card.quote, speaker: input.speaker }]);
      if (!result.materials.length) throw new StateError(`Account needs an exact quote, grounded speaker and surrounding paragraphs: ${result.dropped[0]?.reason || 'not verified'}.`);
      const account = { account_id: input.id || stableId('account', [input.evidenceId, input.speaker]), run_id: 'manual', research_source_id: checked.original.id, evidence_id: checked.card.id, account: result.materials[0] };
      return importMaterial({ projectId: input.projectId, pileId: input.pileId || input.projectId, accounts: [account], origin: 'manual' });
    }),
    savePosition: input => serial(() => {
      const room = load(input.projectId); const concept = input.conceptId ? room.concepts.find(item => item.id === input.conceptId) : null;
      if (input.conceptId && !concept) throw new StateError('Personal position concept was not found.');
      const value = { id: input.id || stableId('position', [input.took, input.because, input.changesMyMind || '', input.conceptId || null]), took: required(input.took, 'My position'), because: required(input.because, 'My reason'), changes_my_mind: typeof input.changesMyMind === 'string' ? input.changesMyMind : '', concept_id: concept?.id || null, concept_name: concept?.name || '', status: 'held', origin: 'operator' };
      const position = { ...value, identity: positionSentinel(value.id), payloadHash: digest(JSON.stringify(value)), createdAt: now() }, existing = room.positions.find(item => item.identity === position.identity); conflict(existing, position);
      if (!existing) { room.positions.push(position); persist(room); }
      return { position: structuredClone(existing || position), revision: room.revision, created: !existing };
    }),
    inherit: input => serial(async () => {
      const room = load(input.projectId), destination = room.inherited, c = await corpus();
      const byOrigin = new Map(destination.passages.map(p => [p.origin_ref, p])), byTitle = new Map(destination.passages.map(p => [titleKey(p.title), p]));
      const result = { passages_created: 0, passages_reused: 0, claim_cards_created: 0, claim_cards_already_present: 0, account_cards_created: 0, account_cards_already_present: 0, position_cards_created: 0, position_cards_already_present: 0, gap_notes_created: 0 };
      for (const concept of [...room.concepts].sort((a, b) => a.ordinal - b.ordinal)) {
        const origin = conceptSentinel(concept.id), existing = byOrigin.get(origin) || byTitle.get(titleKey(concept.name));
        if (existing) { result.passages_reused++; byOrigin.set(origin, existing); }
        else { const passage = { id: stableId('passage', [room.projectId, origin]), title: concept.name, points: [{ id: stableId('point', origin), text: concept.short, source_ref: null }], origin_ref: origin }; destination.passages.push(passage); byOrigin.set(origin, passage); byTitle.set(titleKey(concept.name), passage); result.passages_created++; }
      }
      const identities = new Set(destination.cards.map(card => card.materialIdentity));
      for (const [kind, items] of [['claim', room.claims], ['account', room.accounts], ['position', room.positions]]) for (const item of items) {
        if (kind === 'position' && item.status !== 'held') continue;
        if (identities.has(item.identity)) { result[`${kind}_cards_already_present`]++; continue; }
        const conceptId = item.conceptId || item.concept_id, suggested = conceptId ? byOrigin.get(conceptSentinel(conceptId)) : null;
        const card = kind === 'position' ? { kind: 'point', text: item.took, excerpt: item.because, ref_label: 'My own position, not sourced evidence, never counted', origin: 'operator', source_ref: item.identity } : structuredClone(item.card);
        destination.cards.push({ ...card, id: stableId('inherited', [room.projectId, item.identity]), materialIdentity: item.identity, passage_id: null, suggested_passage_id: suggested?.id || null, suggestion_reason: suggested ? `from the “${suggested.title}” concept` : '', ...(kind === 'claim' ? { sources: structuredClone(item.sources) } : kind === 'account' ? { source: structuredClone(item.source) } : { changes_my_mind: item.changes_my_mind }) }); identities.add(item.identity); result[`${kind}_cards_created`]++;
      }
      const noteKeys = new Set(destination.notes.map(note => `${note.source_ref}:${note.content}`));
      for (const gap of room.gaps) { const key = `${gap.source_ref}:${gap.content}`; if (!noteKeys.has(key)) { destination.notes.push({ id: gap.id, source_ref: gap.source_ref, content: gap.content, passage_id: null }); noteKeys.add(key); result.gap_notes_created++; } }
      if (Object.entries(result).some(([key, count]) => key.endsWith('_created') && count)) persist(room);
      const output = structuredClone(destination); output.cards = output.cards.map(card => ({ ...card, ...(card.sources ? {sources: card.sources.map(binding => decorateBinding(c, binding))} : {}), ...(card.source ? {source: decorateBinding(c, card.source)} : {}) }));
      let handoff;
      if(input.passageId!==undefined){
        const group=inheritedStudyGroups(output).find(group=>group.id===input.passageId);if(!group)throw new StateError('Inherited writing group was not found in this project.',404);
        const cards=group.cards.filter(card=>card.origin!=='operator'),bindings=cards.flatMap(card=>card.sources||[card.source].filter(Boolean));
        for(const binding of bindings){if(binding.evidenceId){const checked=await evidence(c,binding.evidenceId,binding.sourceId,binding.excerpt);if(checked.content.hash!==binding.sourceHash||digest(JSON.stringify(checked.card.locator))!==digest(JSON.stringify(binding.locator)))throw new StateError('Inherited evidence changed. Review its current source before using the group.',409);}else{const content=await library.read(source(c,binding.sourceId).id);if(content.hash!==binding.sourceHash)throw new StateError('A compared source changed. Review the current comparison.',409);}}
        const body=[...(group.passage?[`## ${group.title}`,...group.passage.points.map(point=>point.text)]:[]),...cards.map(card=>card.research_material_kind==='account'?`Source account (${card.research_speaker||card.ref_label||'captured speaker'}): ${card.text}`:`Retained claim, not an established fact: ${card.text}`)].filter(Boolean).join('\n\n');
        const questions=[...group.notes,...(group.id!=='unassigned'?output.notes.filter(note=>!note.passage_id):[])].map(note=>({id:note.id,sourceRef:note.source_ref,question:note.content,role:'unresolved-research-question-not-prose'}));
        if(!body&&!questions.length)throw new StateError('This group contains only personal positions. Use your saved words separately.');
        const sourceIds=[...new Set(bindings.map(binding=>binding.sourceId))],cardIds=[...new Set(bindings.map(binding=>binding.evidenceId).filter(Boolean))];
        const data={groupId:group.id,title:group.title,originRef:group.passage?.origin_ref||null,role:'retained-study-not-established-fact',cards:cards.map(card=>({...structuredClone(card),role:card.research_material_kind==='account'?'source-linked-exact-account':'retained-claim-not-established-fact',reviewState:[...room.claims,...room.accounts].find(item=>item.identity===card.materialIdentity)?.reviewState||'unreviewed',sources:structuredClone(card.sources||[card.source].filter(Boolean))})),questions};
        handoff={schema:'ar-create.study-handoff.v1',projectId:room.projectId,id:stableId('study-handoff',[room.projectId,group.id,body,bindings.map(binding=>[binding.sourceId,binding.sourceHash]),questions]),body,sourceIds,cardIds,data};
      }
      if(handoff&&Buffer.byteLength(JSON.stringify(handoff))>1024*1024)throw new StateError('This writing group exceeds the 1 MB review limit. Its retained material is intact; use a smaller group.',413);
      return { projectId: room.projectId, revision: room.revision, ...output, result, provenance,...(handoff?{handoff}:{}) };
    }),
    review: input => serial(() => { const room = load(input.projectId), item = [...room.claims, ...room.accounts].find(item => item.id === input.id); if (!item) throw new StateError('Research material was not found.', 404); if (!['reviewed', 'unreviewed'].includes(input.state)) throw new StateError('Choose reviewed or unreviewed.'); item.reviewState = input.state; item.reviewedAt = input.state === 'reviewed' ? now() : null; persist(room); return { revision: room.revision, id: item.id, reviewState: item.reviewState }; }),
  };
}
