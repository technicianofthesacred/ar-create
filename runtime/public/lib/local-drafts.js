const PREFIX = "ar-create-recovery";
function localDraftKey(articleId) {
  return `${PREFIX}:${articleId}`;
}
function storage() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}
function readLocalDrafts(articleId) {
  const store = storage();
  if (!store || !articleId) return {};
  try {
    const raw = store.getItem(localDraftKey(articleId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [paragraphId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const entry = value;
      if (typeof entry.text !== "string") continue;
      out[paragraphId] = {
        text: entry.text,
        savedAt: typeof entry.savedAt === "string" ? entry.savedAt : ""
      };
    }
    return out;
  } catch {
    return {};
  }
}
function writeMap(articleId, map) {
  const store = storage();
  if (!store || !articleId) return;
  try {
    if (Object.keys(map).length === 0) {
      store.removeItem(localDraftKey(articleId));
      return;
    }
    store.setItem(localDraftKey(articleId), JSON.stringify(map));
  } catch {
  }
}
function writeLocalDraft(articleId, paragraphId, text, savedAt) {
  if (!articleId || !paragraphId) return;
  const map = readLocalDrafts(articleId);
  map[paragraphId] = { text, savedAt };
  writeMap(articleId, map);
}
function clearLocalDraft(articleId, paragraphId) {
  if (!articleId || !paragraphId) return;
  const map = readLocalDrafts(articleId);
  if (!(paragraphId in map)) return;
  delete map[paragraphId];
  writeMap(articleId, map);
}
function clearLocalDrafts(articleId) {
  const store = storage();
  if (!store || !articleId) return;
  try {
    store.removeItem(localDraftKey(articleId));
  } catch {
  }
}
function pendingLocalDrafts(articleId, serverTexts) {
  const map = readLocalDrafts(articleId);
  const pending = [];
  const keep = {};
  for (const [paragraphId, entry] of Object.entries(map)) {
    const serverText = serverTexts[paragraphId];
    if (serverText === void 0) continue;
    if (entry.text === serverText) continue;
    keep[paragraphId] = entry;
    pending.push({ paragraphId, text: entry.text, savedAt: entry.savedAt, serverText });
  }
  writeMap(articleId, keep);
  return pending;
}
const APPROVED_PREFIX = "ar-create-approved-material";
function approvedKey(articleId) {
  return `${APPROVED_PREFIX}:${articleId}`;
}
function readApprovedMaterial(articleId) {
  const store = storage();
  if (!store || !articleId) return [];
  try {
    const raw = store.getItem(approvedKey(articleId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
function approveMaterialLocally(articleId, materialId) {
  const next = [.../* @__PURE__ */ new Set([...readApprovedMaterial(articleId), materialId])];
  const store = storage();
  if (store && articleId) {
    try {
      store.setItem(approvedKey(articleId), JSON.stringify(next));
    } catch {
    }
  }
  return next;
}
export {
  approveMaterialLocally,
  clearLocalDraft,
  clearLocalDrafts,
  localDraftKey,
  pendingLocalDrafts,
  readApprovedMaterial,
  readLocalDrafts,
  writeLocalDraft
};
