// Shared browser/server validation. A layout contains references, never a
// second copy of prose or a file URL. Every accepted passage is used once.
export const ARTICLE_COMPOSITION_SCHEMA = 'ar-create.article-composition.v1';
export function articleCompositionIssue(value, paragraphs, placements = []) {
 const fail = message => { throw new Error(message); };
 const object = (v, keys) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) fail('Invalid article layout fields.');
 };
 const text = (v, max = 256) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
 const list = v => { if (!Array.isArray(v) || v.length > 5000) fail('Invalid article layout list.'); };
 const optionalBool = (v, key) => { if (v[key] !== undefined && typeof v[key] !== 'boolean') fail('Invalid article layout option.'); };
 const aspect = v => { if (v !== undefined && (!text(v, 32) || !/^[1-9]\d*(?:\.\d+)?\/[1-9]\d*(?:\.\d+)?$/.test(v))) fail('Invalid article photo aspect.'); };
 try {
  object(value, ['schema','form','hookId','introId','closingId','portraitSlot','opening','parts','ending']);
  if (value.schema !== ARTICLE_COMPOSITION_SCHEMA || value.form !== undefined && !['story','conversation'].includes(value.form)) fail('Unknown article layout format.');
  const ids = new Set(paragraphs.map(p => p.id)), slots = new Set(placements.map(p => p.slot));
  if (ids.size !== paragraphs.length || slots.size !== placements.length) fail('Article identities must be unique.');
  const usedIds = new Set(), usedSlots = new Set();
  const passage = id => {
   if (!text(id) || !ids.has(id)) fail('Article layout references a missing accepted passage.');
   if (usedIds.has(id)) fail('Article layout repeats an accepted passage.');
   usedIds.add(id);
  };
  const photo = slot => {
   if (!text(slot) || !slots.has(slot)) fail('Article layout references a photo slot it does not own.');
   if (usedSlots.has(slot)) fail('Article layout repeats a photo slot.');
   usedSlots.add(slot);
  };
  const walk = (blocks, depth = 0, wordsOnly = false) => {
   list(blocks); if (depth > 8) fail('Article layout is nested too deeply.');
   for (const b of blocks) {
    if (!b || typeof b !== 'object') fail('Invalid article block.');
    if (wordsOnly && !['q','a','n','line'].includes(b.kind)) fail('Side and glyph frames contain words only.');
    switch (b.kind) {
     case 'q': case 'a': case 'n': object(b, ['kind','paragraphId']); passage(b.paragraphId); break;
     case 'line':
      object(b, ['kind','paragraphId','size','followId']); passage(b.paragraphId);
      if (!['xl','l','m'].includes(b.size)) fail('Invalid article line size.');
      if (b.followId !== undefined) passage(b.followId); break;
     case 'side':
      object(b, ['kind','slot','flip','bleed','blocks']); photo(b.slot);
      optionalBool(b, 'flip'); optionalBool(b, 'bleed'); walk(b.blocks, depth + 1, true); break;
     case 'glyph':
      object(b, ['kind','glyph','blocks']); if (!text(b.glyph, 32)) fail('Invalid article glyph.');
      walk(b.blocks, depth + 1, true); break;
     case 'photos':
      object(b, ['kind','slots','aspect','stagger','narrow']); list(b.slots);
      if (b.slots.length < 1 || b.slots.length > 2) fail('An article photo pair has one or two photos.');
      b.slots.forEach(photo); aspect(b.aspect); optionalBool(b,'stagger'); optionalBool(b,'narrow'); break;
     case 'wide':
      object(b, ['kind','slot','aspect','narrow','offset']); photo(b.slot); aspect(b.aspect); optionalBool(b,'narrow');
      if (b.offset !== undefined && !['left','right'].includes(b.offset)) fail('Invalid article photo offset.'); break;
     case 'bleed': object(b, ['kind','slot']); photo(b.slot); break;
     case 'on-photo':
      object(b, ['kind','paragraphId','slot','aspect','ink','accent']); passage(b.paragraphId); photo(b.slot); aspect(b.aspect);
      if (!b.aspect || !/^#[a-f\d]{6}$/i.test(b.ink || '') || !/^#[a-f\d]{6}$/i.test(b.accent || '')) fail('An on-photo passage needs its measured colors and aspect.'); break;
     default: fail('Unknown article block.');
    }
   }
  };
  for (const key of ['hookId','introId','closingId']) if (value[key] !== undefined) passage(value[key]);
  if (value.portraitSlot !== undefined) photo(value.portraitSlot);
  walk(value.opening); list(value.parts);
  for (const part of value.parts) {
   object(part, ['titleId','openerSlot','blocks']); passage(part.titleId);
   const title = paragraphs.find(p => p.id === part.titleId);
   if (title.doc?.content?.length !== 1 || title.doc.content[0].type !== 'heading') fail('An article chapter title must reference an accepted heading.');
   if (part.openerSlot !== undefined) photo(part.openerSlot); walk(part.blocks);
  }
  object(value.ending, ['blocks','sayingId','photoSlot','aspect']); walk(value.ending.blocks);
  if (value.ending.sayingId !== undefined) passage(value.ending.sayingId);
  if (value.ending.photoSlot !== undefined) photo(value.ending.photoSlot); aspect(value.ending.aspect);
  if (usedIds.size !== ids.size) fail('Article layout omits an accepted passage.');
  return undefined;
 } catch (error) { return error.message; }
}
export function validateArticleComposition(value, paragraphs, placements = []) {
 const issue = articleCompositionIssue(value, paragraphs, placements);
 if (issue) throw new Error(issue);
 return value;
}
