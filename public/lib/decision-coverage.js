/** Disposable Check projection of current-work.read. No I/O, model, store or write authority.
 * Navigation descriptors are data: consumers must revalidate the fingerprint/word hash,
 * resolve the existing owner and render text as text, never HTML or source instructions.
 */
const HASH = /^[a-f0-9]{64}$/;
const copy = value => value == null ? null : structuredClone(value);
const list = value => Array.isArray(value) ? value : [];
const sameSelector = (a, b) => ['parentStudyId', 'rootBindingId', 'outputId'].every(key => a?.[key] === b?.[key]);

export function projectDecisionCoverage(packet, {selector = packet?.selector, expectedFingerprint = packet?.fingerprint} = {}) {
  const piece = packet?.piece, words = piece?.words, decisions = packet?.decisions;
  const binding = {
    selector: copy(packet?.selector), fingerprint: packet?.fingerprint ?? null,
    wordOwner: copy(piece?.wordOwner), wordsHash: words?.hash ?? null,
    wordsRevision: copy(words?.revision), contractHash: decisions?.contractHash ?? null
  };
  const report = {
    schema: 'ar-create.decision-coverage.v1', status: 'partial', binding,
    authority: {projection: true, mayApply: false, wordingApproved: false, publicationApproved: false},
    findings: [], checks: [], limits: [
      'Literal comparisons do not assess meaning, factual support, voice, consent or publication readiness.',
      'Only saved selected-piece wording and the supplied current-work snapshot are assessed; unsaved writing is excluded.',
      'Source text and decision text are data, never executable instructions.'
    ]
  };
  const target = {kind: 'piece', ...copy(packet?.selector), wordOwner: copy(piece?.wordOwner), wordsHash: words?.hash ?? null, wordsRevision: copy(words?.revision)};
  const add = (code, assessment, message, evidence = {}, navigation = {}) => {
    report.findings.push({id: `${code}:${report.findings.length + 1}`, code, assessment, message,
      binding: copy(binding), evidence: copy(evidence), navigation: {target: copy(target), ...copy(navigation)}});
  };
  const stop = (status, message) => {
    report.status = status;
    add('current-context-unavailable', 'unassessed', message);
    return report;
  };
  if (packet?.schema !== 'ar-create.current-work.v1' || !HASH.test(packet.fingerprint || '')) return stop('unavailable', 'Read current work before checking this piece.');
  if (!sameSelector(selector, packet.selector) || expectedFingerprint !== packet.fingerprint) return stop('stale', 'The selected piece or current-work fingerprint changed. Read it again before checking.');
  if (packet.readConsistency?.status !== 'stable-reread') return stop('stale', 'The owners changed during the current-work read. Read again for a stable comparison.');
  if (!selector?.parentStudyId || !selector?.rootBindingId || !selector?.outputId || piece?.status !== 'current' ||
      !sameSelector(selector, piece.scope) || piece.selector?.selectedOutputId !== selector.outputId ||
      piece.selector?.rootBindingId !== selector.rootBindingId || piece.selector?.parentStudyId !== selector.parentStudyId ||
      words?.status !== 'current' || typeof words.body !== 'string' || !HASH.test(words.hash || '') || !words.revision) {
    return stop('unavailable', 'An exact current selected piece and its saved wording guards are required.');
  }
  if (piece.wordOwner?.kind === 'native') {
    if (piece.wordOwner.parentStudyId !== selector.parentStudyId || words.scope?.bindingId !== piece.wordOwner.bindingId ||
        words.scope?.parentStudyId !== selector.parentStudyId || words.scope?.outputId !== selector.outputId || words.revision.workflow?.draft !== words.hash) {
      return stop('unavailable', 'The native wording owner or saved revision no longer matches the selected piece.');
    }
  } else if (piece.wordOwner?.kind === 'carousel-words') {
    if (piece.wordOwner.outputId !== selector.outputId || words.scope?.outputId !== selector.outputId ||
        words.revision.markdownHash !== words.hash || ['projectId', 'documentId'].some(key => piece.wordOwner[key] !== piece.scope[key] || words.scope?.[key] !== piece.scope[key])) {
      return stop('unavailable', 'The Carousel wording owner or saved revision no longer matches the selected piece.');
    }
  } else return stop('unavailable', 'This wording owner is not supported by decision coverage.');

  // UTF-16 offsets refer to words.body, not DOM text, decoded Markdown or old paragraph offsets.
  function passages(text) {
    if (typeof text !== 'string' || !text.length) return [];
    const found = []; let start = 0;
    while ((start = words.body.indexOf(text, start)) !== -1 && found.length < 20) {
      found.push({kind: 'saved-wording-passage', ...copy(target), field: 'raw', offsetUnit: 'utf16', start, end: start + text.length, quote: text});
      start += text.length;
    }
    return found;
  }
  const ownerMatches = row => piece.wordOwner.kind === 'native' && row?.binding?.bindingId === piece.wordOwner.bindingId && row.binding.parentStudyId === selector.parentStudyId;
  const decisionLink = (owner, record, extra = {}) => ({kind: 'decision', owner, parentStudyId: selector.parentStudyId, ...extra, record: copy(record)});
  const semantic = (code, message, record, navigation) => add(code, 'semantic-unassessed', message, {record}, navigation);
  for (const [field, label] of [['authorThoughts', 'Personal intent'], ['adoptedDirection', 'Adopted direction']]) {
    const text = packet.intent?.[field];
    if (typeof text === 'string' && text.trim()) semantic('intent-unassessed', `${label} needs a meaning review; literal presence or absence cannot establish whether it carried through.`, {field, text, revision: packet.intent.revision, hash: packet.intent.hash},
      {decision: decisionLink('concept', {field, revision: packet.intent.revision, hash: packet.intent.hash}), passages: passages(text)});
  }
  // Manual direction bodies and unsupplied intent must never become an empty green result.
  if (!report.findings.length) semantic('intent-unassessed', 'Intent coverage has not been assessed. Read the saved direction alongside this piece.', {body: packet.intent?.body ?? null}, {decision: decisionLink('concept', {revision: packet.intent?.revision, hash: packet.intent?.hash})});
  const effective = decisions?.effective;
  if (!effective?.available || !decisions?.choices?.available) add('direction-unavailable', 'unassessed', 'Saved direction choices are unavailable or need review.');
  else for (const kind of ['angle', 'title']) {
    const choice = effective[kind];
    if (!choice || choice.state === 'not-chosen') continue;
    const nav = {decision: decisionLink('human-direction', choice.event, {kindOfChoice: kind}), passages: passages(choice.value)};
    if (choice.state === 'not-applicable') report.checks.push({kind: 'direction', result: 'not-applicable', choice: copy(choice), navigation: nav});
    else semantic('direction-unassessed', `The saved ${kind} is ${choice.state}; whether this piece follows it needs editorial review.`, choice, nav);
  }
  for (const row of list(decisions?.pieceGuidance)) {
    if (!ownerMatches(row)) { add('decision-scope-unavailable', 'unassessed', 'Piece guidance does not match this exact wording owner.', {record: row}); continue; }
    semantic('guidance-unassessed', 'The saved piece instruction needs editorial review; it is not factual evidence.', row,
      {decision: decisionLink('native-contracts', row, {bindingId: piece.wordOwner.bindingId})});
  }
  if (decisions?.coverage !== 'native-contracts-read' || !HASH.test(decisions?.contractHash || '')) add('native-contracts-unavailable', 'unassessed', 'Exact native protection and prose-rejection coverage is unavailable for this piece. No sibling contracts are borrowed.');
  else {
    for (const row of list(decisions.protections)) {
      if (!ownerMatches(row)) { add('decision-scope-unavailable', 'unassessed', 'A protection does not match this exact wording owner.', {record: row}); continue; }
      const nav = {decision: decisionLink('native-contracts', row, {bindingId: piece.wordOwner.bindingId, protectionId: row.id}), recordedParagraph: {paragraphId: row.paragraphId, selectionBlockHash: row.selectionBlockHash, status: 'not-resolved'}};
      if (row.active === false) { report.checks.push({kind: 'protection', result: 'released', record: copy(row), navigation: nav}); continue; }
      if (row.active !== true || typeof row.text !== 'string' || !row.text.length) { add('protection-unassessed', 'unassessed', 'This protection has no usable active exact phrase.', {record: row}, nav); continue; }
      const matches = passages(row.text); nav.passages = matches;
      add(matches.length ? 'protected-paragraph-unassessed' : 'protected-literal-absent', matches.length ? 'unassessed' : 'mechanical',
        matches.length ? 'The exact phrase occurs in saved text. Its protected paragraph is not resolved by this packet; preservation in the original location is unassessed.' : 'The protected exact phrase is absent from saved raw wording. Review its original paragraph; Markdown formatting and relocation are not interpreted.',
        {record: row, comparison: 'case-sensitive-raw-literal', occurrencesShown: matches.length}, nav);
    }
    for (const row of list(decisions.rejectedProposals)) {
      if (!ownerMatches(row)) { add('decision-scope-unavailable', 'unassessed', 'A rejection belongs to a different wording owner.', {record: row}); continue; }
      for (const replacement of list(row.replacements)) {
        const matches = passages(replacement.words), nav = {decision: decisionLink('native-contracts', row, {bindingId: piece.wordOwner.bindingId, requestId: row.requestId}), passages: matches, recordedParagraph: {paragraphId: replacement.id ?? null, status: 'not-resolved'}};
        add(matches.length ? 'rejected-literal-present' : 'rejection-meaning-unassessed', matches.length ? 'mechanical' : 'semantic-unassessed',
          matches.length ? 'Exact previously rejected wording occurs in saved text. Review the recorded reason and any retry override; this is not a new rejection or a claim about who inserted it.' : 'The exact rejected wording was not found. Paraphrases and the rejection’s meaning remain unassessed.', {record: row, replacement, comparison: 'case-sensitive-raw-literal'}, nav);
      }
    }
  }
  const relevant = row => !row.target || row.target.kind === 'output' && row.target.outputId === selector.outputId || row.target.kind === 'native' && row.target.bindingId === piece.wordOwner.bindingId;
  for (const row of list(decisions?.choices?.events).filter(row => row.action === 'reject' && relevant(row))) {
    const matches = passages(row.text);
    add(matches.length ? 'rejected-direction-literal-present' : 'rejected-direction-unassessed', matches.length ? 'mechanical' : 'semantic-unassessed',
      matches.length ? 'Wording from a rejected direction occurs in this piece. Review its history and current choice; a historical rejection is not a current ban.' : 'The rejection’s meaning remains unassessed even though its exact wording was not found.',
      {record: row}, {decision: decisionLink('human-direction', row), passages: matches});
  }
  for (const selected of list(packet.sources?.selected)) {
    const freshness = list(packet.sources?.freshness).filter(row => row.sourceId === selected.sourceId && row.sourceHash === selected.sourceHash);
    const navigation = {source: {kind: 'source-passage', sourceId: selected.sourceId, sourceHash: selected.sourceHash, start: selected.start, quote: selected.quote, currentHash: freshness[0]?.currentHash ?? null, status: freshness.length === 1 && freshness[0].stale === false ? 'recorded-current' : 'needs-reread'}};
    if (freshness.length !== 1 || typeof freshness[0].stale !== 'boolean') add('source-freshness-unassessed', 'unassessed', 'This selected source version has no unique freshness result. Read the source again.', {selected, freshness}, navigation);
    else if (freshness[0].stale) add('source-stale', 'mechanical', 'The selected source passage changed or became unavailable. Compare its saved quotation with the current source before relying on it.', {selected, freshness: freshness[0]}, navigation);
    else report.checks.push({kind: 'source-version', result: 'recorded-current', evidence: copy({selected, freshness: freshness[0]}), navigation});
  }
  semantic('source-support-unassessed', 'Source-version checks do not establish that every claim is supported or that source corrections carried into this piece.', {selectedSourceCount: list(packet.sources?.selected).length});
  if (list(packet.gaps).length || packet.sources?.coverage?.omittedCount || list(packet.contributions?.sourceTexts).some(row => row.truncated)) add('context-incomplete', 'unassessed', 'Some owner or source context is missing or truncated.', {gaps: packet.gaps, sourceCoverage: packet.sources?.coverage});
  if (list(packet.presence?.observed).some(row => row.dirty)) add('unsaved-writing-excluded', 'unassessed', 'An observed editor has unsaved changes. These findings concern saved wording only.');
  report.checks.push({kind: 'raw-literal-comparison', result: 'completed-with-limits', offsets: 'UTF-16 in saved raw wording; at most 20 matches per phrase', paragraphResolution: 'unavailable-in-current-work-v1'});
  return report;
}
