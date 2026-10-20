const fail = message => { throw Object.assign(Error(message), {status: 409}); };

/** Enumerate saved native roots; source availability and matching titles confer no authority. */
export function createInquiryProjectSelectors({drafts, bindings, readAuthority} = {}) {
  if (!drafts?.catalog || !bindings?.lookup || typeof readAuthority !== 'function') {
    throw Error('Connect the maintained native catalog, study bindings and narrow Project authority.');
  }
  return async function listProjectSelectors() {
    const catalog = await drafts.catalog();
    if (!Array.isArray(catalog?.drafts) || !Array.isArray(catalog?.collections)) {
      throw Object.assign(Error('Maintained native Project catalog is unavailable.'), {status: 503});
    }
    const candidates = [...catalog.drafts, ...catalog.collections.filter(row => row.kind === 'collection-root')];
    const seen = new Set(), result = [];
    for (const row of candidates) {
      if (row.bindingStatus !== 'ready' || !row.bindingId || !row.parentStudyId || row.kind === 'output-fork') continue;
      const key = JSON.stringify([row.parentStudyId, row.bindingId]);
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const parent = await bindings.lookup({projectKey: row.parentStudyId});
        if (parent.projectKey !== row.parentStudyId) fail('Saved Project parent binding changed.');
        const selector = {workspaceId: parent.projectId, parentStudyId: row.parentStudyId, rootBindingId: row.bindingId};
        const endpoint = {kind: 'project', id: selector.workspaceId, parentStudyId: selector.parentStudyId, rootBindingId: selector.rootBindingId};
        const authority = await readAuthority(endpoint);
        if (authority?.endpoint?.kind !== endpoint.kind || authority.endpoint.id !== endpoint.id || authority.endpoint.parentStudyId !== endpoint.parentStudyId || authority.endpoint.rootBindingId !== endpoint.rootBindingId || authority.project?.id !== endpoint.id) {
          fail('Saved Project authority belongs to another parent or native root.');
        }
        result.push(selector);
      } catch (error) {
        // An optional original may never have been bound, or its saved target may be gone.
        if (error.status !== 404) throw error;
      }
    }
    return result;
  };
}
