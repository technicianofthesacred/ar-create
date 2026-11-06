// Transport seam for Write's independent Carousel requests. The native writer
// and output registry remain the only owners; no page/global article is read.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const clone = value => structuredClone(value);
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a, b) => stable(a) === stable(b);
const fail = message => { throw Object.assign(Error(message), {status: 409}); };

export function createNativeCarouselRequest({window: win, fetch: request = win.fetch.bind(win)}) {
  const attemptedRuns = new Set();
  const captured = new Map();
  let preparing = false;

  function context() {
    const binding = win.studyDraft?.currentBinding?.();
    const proof = win.studyDraft?.currentProof?.();
    const owner = win.studyDraft?.currentOwner?.();
    const selected = win.studyOutputConnection?.selection?.();
    if (owner && owner.kind !== 'native') fail('Choose a saved native Article before preparing a Carousel.');
    if (!UUID.test(binding?.id || '') || !binding.parentStudyId ||
        proof?.bindingId !== binding.id || proof.parentStudyId !== binding.parentStudyId || !proof.expected ||
        binding.textOutputKind && binding.textOutputKind !== 'article' || win.studyDraft?.viewMode?.() === 'preview') {
      fail('Open the exact current native Article before preparing a Carousel.');
    }
    if (proof.dirty !== false) fail('Save or resolve your browser edits before preparing a Carousel. Your words remain here.');
    if (owner && (owner.bindingId !== binding.id || owner.parentStudyId !== binding.parentStudyId)) fail('The selected Article owner changed.');
    if (selected && (selected.projectId !== binding.parentStudyId || !UUID.test(selected.rootBindingId || '') ||
        selected.output?.kind !== 'article' || !UUID.test(selected.output?.id || '') ||
        selected.owner?.kind !== 'native' || selected.owner.bindingId !== binding.id ||
        selected.owner.parentStudyId !== binding.parentStudyId ||
        binding.canonicalOutputId && binding.canonicalOutputId !== selected.output.id)) {
      fail('The selected output is not this native Article.');
    }
    if (!selected && (binding.kind === 'output-fork' || binding.sourceBindingId && binding.sourceBindingId !== binding.id)) {
      fail('Select this Article through its saved output before preparing a Carousel.');
    }
    return clone({binding, proof, owner: owner || null,
      selection: selected ? {projectId: selected.projectId, rootBindingId: selected.rootBindingId,
        output: {id: selected.output.id, kind: selected.output.kind}, owner: selected.owner} : null,
      scope: {rootBindingId: selected?.rootBindingId || binding.id, parentStudyId: binding.parentStudyId}});
  }
  function unchanged(before) {
    if (!same(context(), before)) fail('The selected Article or its saved revision changed. Open the current Article and prepare again.');
  }
  async function json(path, body) {
    const response = await request(path, body === undefined ? undefined : {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(Error(result?.error?.message || result?.error || result?.message || 'Carousel request failed.'), {status: response.status, result});
    return result;
  }
  const read = (path, fields) => json(path + '?' + new URLSearchParams(fields));
  function selector(record) {
    if (!UUID.test(record?.requestId || '') || !UUID.test(record?.scope?.rootBindingId || '') ||
        typeof record?.scope?.parentStudyId !== 'string' || !record.scope.parentStudyId ||
        !UUID.test(record?.sourceBindingId || '') || !UUID.test(record?.sourceOutputId || '')) fail('Choose an exact saved Carousel request.');
    return {...record.scope, requestId: record.requestId};
  }
  const key = record => stable(selector(record));
  function publicResult(result, expected) {
    selector(result);
    if (!same(selector(result), selector(expected)) || result.sourceBindingId !== expected.sourceBindingId ||
        result.sourceOutputId !== expected.sourceOutputId) fail('The saved Carousel request belongs to another Article.');
    return clone(result);
  }
  function checkNative(snapshot, before) {
    if (snapshot?.binding?.id !== before.binding.id || snapshot.binding.parentStudyId !== before.scope.parentStudyId ||
        snapshot.binding.parentStudyKey !== before.scope.parentStudyId || snapshot.binding.authority !== 'owned-working-copy' ||
        snapshot.binding.status !== 'ready' || snapshot.readiness?.ready !== true || !same(snapshot.expected, before.proof.expected)) {
      fail('The saved Article changed or is unavailable. Reopen its current saved words.');
    }
  }
  function checkListing(value, before) {
    if (!same(value?.scope, before.scope) || !value.expectedOutput || !Array.isArray(value.outputs) || !Array.isArray(value.outputBindings)) {
      fail('The saved output list belongs to another Article root.');
    }
  }
  function checkArticle(view, before, id) {
    checkListing(view, before);
    if (view.output?.id !== id || view.output.kind !== 'article' || view.wordOwner?.kind !== 'native' ||
        view.wordOwner.bindingId !== before.binding.id || view.wordOwner.parentStudyId !== before.scope.parentStudyId ||
        view.writingProof?.kind !== 'native' || view.writingProof.bindingId !== before.binding.id ||
        view.writingProof.parentStudyId !== before.scope.parentStudyId || !same(view.writingProof.expected, before.proof.expected) ||
        view.freshness?.stale) fail('Choose the current saved Article and update its saved output before preparing a Carousel.');
  }
  async function prepare() {
    if (preparing) fail('Carousel preparation is already in progress.');
    const before = context();
    preparing = true;
    try {
      const snapshot = await read('/api/study-draft/read', {bindingId: before.binding.id, parentStudyId: before.scope.parentStudyId});
      unchanged(before); checkNative(snapshot, before);
      const listing = await read('/api/study/outputs', before.scope);
      unchanged(before); checkListing(listing, before);
      const matches = listing.outputBindings.filter(row => row.wordOwner?.kind === 'native' &&
        row.wordOwner.bindingId === before.binding.id && row.wordOwner.parentStudyId === before.scope.parentStudyId);
      let id = before.selection?.output.id || snapshot.binding.canonicalOutputId || before.binding.canonicalOutputId;
      if (!id && matches.length === 1) id = matches[0].outputId;
      if (matches.length > 1 || id && !matches.some(row => row.outputId === id)) fail('The Article output registration is unavailable or ambiguous. Reopen the saved output.');
      if (!id) {
        if (before.scope.rootBindingId !== before.binding.id || matches.length) fail('Only the current unregistered primary Article can be registered here.');
        id = win.crypto.randomUUID();
        unchanged(before);
        const created = await json(listing.standInOutputCreation === true ? '/api/study/outputs/stand-in-create' : '/api/study/outputs/create', {
          ...before.scope, kind: 'article', sourceBindingId: before.binding.id,
          expectedNative: clone(snapshot.expected), expectedOutput: clone(listing.expectedOutput), operationId: id
        });
        unchanged(before); checkArticle(created.view, before, id);
      }
      const article = await read('/api/study/outputs', {...before.scope, selectedOutputId: id});
      unchanged(before); checkArticle(article, before, id);
      const operationId = win.crypto.randomUUID();
      const input = {...before.scope, sourceBindingId: before.binding.id, sourceOutputId: id,
        expectedNative: clone(snapshot.expected), expectedOutput: clone(article.expectedOutput), operationId};
      unchanged(before);
      const result = await json('/api/study/carousel-make/preview', input);
      const record = publicResult(result, {scope: before.scope, requestId: operationId, sourceBindingId: before.binding.id, sourceOutputId: id});
      captured.set(key(record), before);
      // Keep the durable scoped response available even if navigation changed
      // during the final POST. Later mutation checks refuse that changed context.
      return record;
    } finally { preparing = false; }
  }
  async function get(record) {
    const pinned = clone(record), fields = selector(pinned);
    return publicResult(await read('/api/study/carousel-make', fields), pinned);
  }
  function currentFor(record) {
    const before = context();
    selector(record);
    if (!same(before.scope, record.scope) || before.binding.id !== record.sourceBindingId ||
        before.selection && before.selection.output.id !== record.sourceOutputId ||
        !before.selection && before.binding.canonicalOutputId && before.binding.canonicalOutputId !== record.sourceOutputId) {
      fail('This Carousel request belongs to another Article. Return to that Article to continue.');
    }
    const original = captured.get(key(record));
    if (original && !same(original, before)) fail('The Article selection or revision changed after preparation. Read the saved request before preparing again.');
    return before;
  }
  async function mutate(action, record) {
    const pinned = clone(record), before = currentFor(pinned);
    const latest = await get(pinned);
    unchanged(before);
    if (action === 'run' && (latest.status !== 'preview' || attemptedRuns.has(key(pinned)))) fail('This request has already started or cannot run. Check its saved result; prepare a new request to try again.');
    if (action === 'register' && !['result-ready', 'registered'].includes(latest.status)) fail('Check for a finished Carousel draft before adding it.');
    if (action === 'run') attemptedRuns.add(key(pinned));
    return publicResult(await json('/api/study/carousel-make/' + action, selector(pinned)), pinned);
  }
  async function list() {
    const before = context(), result = await read('/api/study/carousel-make', before.scope);
    unchanged(before);
    if (!same(result.scope, before.scope) || !Array.isArray(result.items)) fail('The saved Carousel requests belong to another Article root.');
    return {...clone(result), items: result.items.map(item => {
      const record = {...clone(item), scope: clone(result.scope)};
      selector(record);
      return record;
    })};
  }
  return {prepare, get, list, run: record => mutate('run', record), register: record => mutate('register', record), cancel: record => mutate('cancel', record)};
}
