// Pure projection/patching of the existing FEEDBACK owner. No files, receipts,
// sending or approval authority. Persist results only through Magazine's writer.
import {createHash} from 'node:crypto';
import {StateError} from '../../store.mjs';

const SCHEMA = 'ar-create.magazine-feedback-share.v1';
const KEY = 'ar-create-share';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const digest = value => createHash('sha256').update(value,'utf8').digest('hex');
const fail = message => { throw new StateError(message,409); };
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key=>Object.hasOwn(value,key));
const recipientNameValid = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\x00-\x1f\x7f-\x9f\u2028\u2029]/.test(value);
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
function source(markdown) {
  if (typeof markdown !== 'string' || Buffer.byteLength(markdown,'utf8') > 2*1024*1024 || markdown.includes('\0')) fail('Feedback must be bounded readable Markdown.');
  const lines = []; let start = 0;
  for (const raw of markdown.match(/[^\n]*\n|[^\n]+$/g) || []) {
    const text = raw.replace(/\r?\n$/,''); lines.push({start,end:start+raw.length,text,raw}); start += raw.length;
  }
  const hasFrontmatter = lines[0]?.text === '---';
  const closing = hasFrontmatter ? lines.findIndex((line,i)=>i>0&&line.text==='---') : -1;
  if (hasFrontmatter && closing < 0) fail('Feedback frontmatter is unclosed.');
  const metadataLines = hasFrontmatter ? lines.slice(1,closing).filter(line=>/^\s*ar-create-share\s*:/.test(line.text)) : [];
  if (metadataLines.length > 1) fail('Feedback has duplicate Share metadata.');
  // Nested, quoted-key or alternate-case keys are not silently ignored as legacy.
  if (hasFrontmatter && lines.slice(1,closing).some(line=>/^\s*['"]?ar-create-share['"]?\s*:/i.test(line.text) && !/^ar-create-share: /.test(line.text))) fail('Feedback Share metadata must use its exact single-line namespace.');
  const metadataLine = metadataLines[0] || null;
  let metadata = null;
  if (metadataLine) {
    if (metadataLine.raw.length > 64*1024) fail('Feedback Share metadata exceeds its bounded size.');
    const json = metadataLine.text.slice((KEY+': ').length);
    try { metadata = JSON.parse(json); }
    catch { fail('Feedback Share metadata is malformed.'); }
    // Canonical single-line JSON also refuses duplicate JSON keys rather than
    // silently accepting JSON.parse's last value. No prose is normalized.
    if (JSON.stringify(metadata) !== json) fail('Feedback Share metadata must use canonical single-line JSON.');
    const following = lines[lines.indexOf(metadataLine)+1];
    if (following && /^\s+\S/.test(following.text)) fail('Feedback Share metadata cannot have a multiline continuation.');
  }
  const sections = []; let fence = null, comment = false;
  for (const line of lines.slice(hasFrontmatter?closing+1:0)) {
    const fenced = line.text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fenced && fenced[1][0] === fence[0] && fenced[1].length >= fence.length && !fenced[2].trim()) fence = null;
      continue;
    }
    if (comment) { if (line.text.includes('-->')) comment = false; continue; }
    if (line.text.includes('<!--')) { comment = !line.text.slice(line.text.indexOf('<!--')+4).includes('-->'); continue; }
    if (fenced) { fence = fenced[1]; continue; }
    if (/^#{1,6} [^\r\n]+$/.test(line.text)) {
      if (sections.length) sections.at(-1).end = line.start;
      sections.push({heading:line.text,start:line.start,end:markdown.length});
    }
  }
  return {lines,hasFrontmatter,closing,metadataLine,metadata,sections,newline:lines[0]?.raw.endsWith('\r\n')?'\r\n':'\n'};
}
function validate(metadata, parsed, markdown) {
  if (!(exact(metadata,['schema','entries']) || exact(metadata,['schema','entries','invitations'])) || metadata.schema !== SCHEMA || !Array.isArray(metadata.entries) || metadata.entries.length > 200) fail('Feedback Share metadata has an unsupported shape.');
  validateInvitations(metadata);
  const seenEntries = new Set(), seenSections = new Set();
  return metadata.entries.map(entry=>{
    const named = Object.hasOwn(entry || {},'recipientName');
    if (!exact(entry,named?['recipientId','recipientName','target','sections']:['recipientId','target','sections']) || (named && !recipientNameValid(entry.recipientName)) || !UUID.test(entry.recipientId||'') || !exact(entry.target,['storyId','pieceId','edition','hash']) || !identity(entry.target.storyId) || !identity(entry.target.pieceId) || entry.target.edition !== 'working' || !HASH.test(entry.target.hash||'') || !Array.isArray(entry.sections) || !entry.sections.length || entry.sections.length > 12) fail('Feedback needs explicit recipient, working piece/hash and language section references.');
    const entryKey = JSON.stringify([entry.recipientId.toLowerCase(),entry.target.storyId,entry.target.pieceId,entry.target.hash]);
    if (seenEntries.has(entryKey)) fail('Feedback has duplicate recipient/edition mappings.');
    seenEntries.add(entryKey); const languages = new Set();
    const sections = entry.sections.map(anchor=>{
      if (!exact(anchor,['language','heading','hash']) || typeof anchor.language !== 'string' || !/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(anchor.language) || typeof anchor.heading !== 'string' || anchor.heading.length > 512 || !/^#{1,6} [^\r\n]+$/.test(anchor.heading) || !HASH.test(anchor.hash||'')) fail('Feedback language anchors must name exact heading lines and section hashes.');
      const language = anchor.language.toLowerCase();
      if (languages.has(language)) fail('Feedback has ambiguous language mappings for this recipient/edition.');
      languages.add(language);
      const matches = parsed.sections.filter(section=>section.heading===anchor.heading);
      if (matches.length !== 1) fail('Feedback section heading is missing or ambiguous.');
      const section = matches[0], raw = markdown.slice(section.start,section.end);
      if (digest(raw) !== anchor.hash) fail('Feedback section changed after its mapping was saved.');
      if (seenSections.has(anchor.heading)) fail('Feedback section is assigned to more than one recipient/edition or language.');
      seenSections.add(anchor.heading);
      return {...anchor,start:section.start,end:section.end,markdown:raw};
    });
    return {recipientId:entry.recipientId,...(named?{recipientName:entry.recipientName}:{}),target:structuredClone(entry.target),sections};
  });
}

/** Always retains the complete readable source; invalid mappings grant no structured action. */
export function parseFeedbackShare(markdown) {
  try {
    const parsed = source(markdown);
    if (!parsed.metadataLine) return {markdown,hash:digest(markdown),structured:false,metadata:null,projection:[],reason:'No explicit recipient/language mapping is saved.'};
    const projection = validate(parsed.metadata,parsed,markdown);
    return {markdown,hash:digest(markdown),structured:true,metadata:structuredClone(parsed.metadata),projection,reason:null};
  } catch (error) {
    return {markdown,hash:typeof markdown==='string'?digest(markdown):null,structured:false,metadata:null,projection:[],reason:error.message};
  }
}
function guard(markdown,expectedHash) {
  if (typeof markdown !== 'string' || !HASH.test(expectedHash||'') || digest(markdown) !== expectedHash) fail('Feedback changed. Keep local edits and read the exact current file before saving.');
  const parsed = source(markdown);
  if (parsed.metadataLine) validate(parsed.metadata,parsed,markdown);
  return parsed;
}
function patchMetadata(markdown,parsed,metadata) {
  const serialized = JSON.stringify(metadata);
  if (Buffer.byteLength(serialized,'utf8') > 64*1024) fail('Feedback Share metadata exceeds its bounded size.');
  const line = KEY+': '+serialized+parsed.newline;
  let start, before, after;
  if (parsed.metadataLine) { start=parsed.metadataLine.start;before=parsed.metadataLine.raw;after=line; }
  else if (parsed.hasFrontmatter) { start=parsed.lines[parsed.closing].start;before='';after=line; }
  else { start=0;before='';after='---'+parsed.newline+line+'---'+parsed.newline; }
  const updated = markdown.slice(0,start)+after+markdown.slice(start+before.length);
  const checked = parseFeedbackShare(updated);
  if (!checked.structured) fail(checked.reason);
  return {markdown:updated,beforeHash:digest(markdown),hash:digest(updated),metadataChange:{start,before,after}};
}

/** Metadata only. Canonical JSON in one frontmatter line; all other bytes stay exact.
 * Existing malformed/stale mappings need explicit full-file human repair. */
export function updateFeedbackShare(markdown,{expectedHash,metadata}={}) {
  const parsed = guard(markdown,expectedHash);
  validate(metadata,parsed,markdown);
  return patchMetadata(markdown,parsed,metadata);
}

/** Exact authoritative heading sections only; hashes cover the entire raw section. */
export function feedbackShareSectionChoices(markdown) {
  const sections = source(markdown).sections, counts = new Map();
  for (const section of sections) counts.set(section.heading,(counts.get(section.heading)||0)+1);
  return sections.filter(section=>counts.get(section.heading)===1).map(section=>({...section,hash:digest(markdown.slice(section.start,section.end))}));
}

/** Map explicit identities to existing sections, changing only Share metadata.
 * The maintained owner must establish the target's current working identity/hash. */
export function mapFeedbackShareRecipient(markdown,options={}) {
  const {expectedHash,recipientId,target,sections} = options;
  const parsed = guard(markdown,expectedHash);
  const metadata = parsed.metadata ? structuredClone(parsed.metadata) : {schema:SCHEMA,entries:[]};
  const index = metadata.entries.findIndex(entry=>typeof recipientId==='string' && entry.recipientId.toLowerCase()===recipientId.toLowerCase() && exact(target,['storyId','pieceId','edition','hash']) && ['storyId','pieceId','edition','hash'].every(key=>entry.target[key]===target[key]));
  const entry = {...(index<0?{}:metadata.entries[index]),recipientId,target,sections};
  if (Object.hasOwn(options,'recipientName')) entry.recipientName=options.recipientName;
  if (index<0) metadata.entries.push(entry);
  else metadata.entries[index]=entry;
  return updateFeedbackShare(markdown,{expectedHash,metadata});
}

/** Replace exactly one mapped canonical section and its reference in one candidate. */
export function updateFeedbackShareSection(markdown,{expectedHash,recipientId,target,language,expectedSectionHash,content}={}) {
  const parsed = guard(markdown,expectedHash);
  if (!parsed.metadataLine) fail('Map this recipient and language explicitly before editing a section.');
  const projection = validate(parsed.metadata,parsed,markdown);
  const selected = projection.filter(entry=>entry.recipientId===recipientId && exact(target,['storyId','pieceId','edition','hash']) && ['storyId','pieceId','edition','hash'].every(key=>entry.target[key]===target[key]));
  if (selected.length!==1) fail('Choose an exact mapped recipient and working edition.');
  const section = selected[0].sections.find(section=>section.language===language);
  if (!section || section.hash!==expectedSectionHash || typeof content!=='string' || !content.startsWith(section.heading+parsed.newline)) fail('The selected language section changed or its exact heading was not preserved.');
  const updated = markdown.slice(0,section.start)+content+markdown.slice(section.end);
  const next = source(updated), matches = next.sections.filter(row=>row.heading===section.heading);
  if (matches.length!==1 || updated.slice(matches[0].start,matches[0].end)!==content) fail('A section edit cannot introduce ambiguous headings or cross another section.');
  const metadata = structuredClone(parsed.metadata), nextHash = digest(content);
  for (const entry of metadata.entries) for (const anchor of entry.sections) if (anchor.heading===section.heading) anchor.hash=nextHash;
  validate(metadata,next,updated);
  const result = patchMetadata(updated,next,metadata);
  return {...result,beforeHash:digest(markdown),hash:digest(result.markdown)};
}


const sectionSnapshot = row => exact(row,['language','heading','hash']) && typeof row.language==='string' && /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(row.language) && typeof row.heading==='string' && row.heading.length<=512 && /^#{1,6} [^\r\n]+$/.test(row.heading) && HASH.test(row.hash||'');
const factText = value => typeof value==='string' && value.trim().length>0 && value.length<=8000 && value.isWellFormed() && !value.includes('\0');
const workingTarget = t => exact(t,['storyId','pieceId','edition','hash']) && identity(t.storyId) && identity(t.pieceId) && t.edition==='working' && HASH.test(t.hash||'');
function validateFact(f,recipientId){
 if(!f||!UUID.test(f.id||'')||f.recordedBy!=='human')fail('Correspondence facts require an explicit human record and UUID.');
 if(f.kind==='sent'){if(recipientId==='none'||!exact(f,['id','kind','recordedBy','sentAt','channel'])||!factText(f.sentAt)||f.sentAt.length>128||!factText(f.channel)||f.channel.length>256)fail('Record the actual sent date and channel.');}
 else if(f.kind==='reply'){if(recipientId==='none'||!exact(f,['id','kind','recordedBy','receivedAt','original','translation','correction'])||f.receivedAt!==null&&(!factText(f.receivedAt)||f.receivedAt.length>128)||!factText(f.original)||f.translation!==null&&!factText(f.translation))fail('Record the original reply and optional reviewed translation.');if(f.correction!==null&&(!exact(f.correction,['text','affected'])||!factText(f.correction.text)||!workingTarget(f.correction.affected)))fail('A proposed correction needs an exact affected piece and revision.');}
 else if(['closed','not-applicable'].includes(f.kind)){if(!exact(f,['id','kind','recordedBy','reason'])||!factText(f.reason))fail('Closing or not applicable needs a human reason.');}
 else fail('Unsupported correspondence fact.');
}
function validateInvitations(metadata){
 if(!Object.hasOwn(metadata,'invitations'))return;
 if(!Array.isArray(metadata.invitations)||metadata.invitations.length>100)fail('Invitations exceed their bounded contract.');
 const ids=new Set(),factIds=new Set();
 for(const row of metadata.invitations){
  if(!exact(row,['id','recipientId','recipientName','target','sections','facts'])||!UUID.test(row.id||'')||ids.has(row.id.toLowerCase())||!workingTarget(row.target)||!Array.isArray(row.sections)||row.sections.length>12||!Array.isArray(row.facts)||row.facts.length>100)fail('Use a unique invitation and its exact working target. Published editions are not connected.');
  ids.add(row.id.toLowerCase());
  if(row.recipientId==='none'){if(row.recipientName!==null||row.sections.length)fail('No recipient cannot contain recipient message sections.');}
  else if(!UUID.test(row.recipientId||'')||!recipientNameValid(row.recipientName)||!row.sections.length||row.sections.some(a=>!sectionSnapshot(a))||new Set(row.sections.map(a=>a.language.toLowerCase())).size!==row.sections.length||new Set(row.sections.map(a=>a.heading)).size!==row.sections.length)fail('An invitation needs an explicit named recipient and exact language snapshots.');
  for(const fact of row.facts){validateFact(fact,row.recipientId);if(factIds.has(fact.id.toLowerCase()))fail('Fact UUID is already recorded.');factIds.add(fact.id.toLowerCase());}
 }
}
/** Frozen invitation facts live only in the canonical FEEDBACK namespace. */
export function changeFeedbackInvitation(markdown,{expectedHash,change,target}={}){
 validateFeedbackInvitationChange(change);const parsed=guard(markdown,expectedHash);if(!parsed.metadataLine&&!(change.kind==='new'&&change.recipientId==='none'))fail('Map an explicit recipient and language section first.');
 const metadata=parsed.metadata?structuredClone(parsed.metadata):{schema:SCHEMA,entries:[]};metadata.invitations||=[];
 if(change?.kind==='new'){
  if(!exact(change,['kind','id','recipientId'])||!UUID.test(change.id||'')||!workingTarget(target))fail('Choose an exact working invitation target. Published editions are not connected.');
  const entry=metadata.entries.find(e=>e.recipientId===change.recipientId);
  if(change.recipientId!=='none'&&(!entry?.recipientName||entry.target.storyId!==target.storyId||entry.target.pieceId!==target.pieceId))fail('Choose this piece’s explicit named recipient.');
  metadata.invitations.push({id:change.id,recipientId:change.recipientId,recipientName:entry?.recipientName||null,target:structuredClone(target),sections:entry?structuredClone(entry.sections):[],facts:[]});
 }else if(change?.kind==='fact'){
  if(!exact(change,['kind','invitationId','fact']))fail('Choose one saved invitation and exact fact.');
  const invitation=metadata.invitations.find(i=>i.id===change.invitationId);if(!invitation)fail('The selected invitation is unavailable.');invitation.facts.push(structuredClone(change.fact));
 }else fail('Choose New invitation or one explicit correspondence fact.');
 return updateFeedbackShare(markdown,{expectedHash,metadata});
}
/** Applied under the existing owner lock for every FEEDBACK write path. Undo
 * alone may restore its own retained before-bytes through its receipt guard. */
export function guardFeedbackInvitations(before,after,{human=false,target=null}={}){
 const prior=parseFeedbackShare(before||''),next=parseFeedbackShare(after||''),old=prior.metadata?.invitations||[],rows=next.metadata?.invitations||[];
 const mentions=text=>/ar-create-share: .*"invitations"/.test(text||'');
 if(!human&&(mentions(before)||mentions(after))&&(!prior.structured||!next.structured)&&before!==after)throw new StateError('Only the human author can record invitation or correspondence facts.',403);
 if((old.length||mentions(before))&&!prior.structured)fail('Existing invitation metadata is unreadable; preserve its bytes.');
 if((old.length||mentions(after))&&!next.structured)fail('Invitation metadata cannot be removed or damaged.');
 if(JSON.stringify(old)===JSON.stringify(rows))return;
 if(!human)throw new StateError('Only the human author can record invitation or correspondence facts.',403);
 if(!workingTarget(target))fail('Invitation changes require the exact current contextual FEEDBACK owner.');
 if(rows.length<old.length)fail('Saved invitations cannot be removed; use exact saved Undo.');
 for(let i=0;i<old.length;i++){
  const a=old[i],b=rows[i];if(!b||JSON.stringify({...a,facts:[]})!==JSON.stringify({...b,facts:[]})||b.facts.length<a.facts.length||JSON.stringify(b.facts.slice(0,a.facts.length))!==JSON.stringify(a.facts))fail('Saved invitation targets, message snapshots and facts cannot be rewritten; use exact saved Undo.');
 }
 for(let i=0;i<old.length;i++)for(const fact of rows[i].facts.slice(old[i].facts.length)){if(old[i].target.storyId!==target.storyId||old[i].target.pieceId!==target.pieceId)fail('That invitation belongs to another working piece.');if(fact.kind==='reply'&&fact.correction&&JSON.stringify(fact.correction.affected)!==JSON.stringify(target))fail('A proposed correction must reference this exact current working piece and revision.');}
 for(const row of rows.slice(old.length)){
  if(JSON.stringify(row.target)!==JSON.stringify(target)||row.facts.length)fail('A new invitation must name the current exact working target and start without facts.');
  if(row.recipientId==='none')continue;
  const entry=next.metadata.entries.find(e=>e.recipientId===row.recipientId);
  if(!entry||entry.recipientName!==row.recipientName||JSON.stringify(entry.sections)!==JSON.stringify(row.sections)||entry.target.storyId!==target.storyId||entry.target.pieceId!==target.pieceId)fail('Invitation snapshot must match the explicit current message sections.');
 }
}

export function validateFeedbackInvitationChange(change){
 if(change?.kind==='new'&&exact(change,['kind','id','recipientId'])&&UUID.test(change.id||'')&&(UUID.test(change.recipientId||'')||change.recipientId==='none'))return;
 if(change?.kind==='fact'&&exact(change,['kind','invitationId','fact'])&&UUID.test(change.invitationId||'')){validateFact(change.fact,'selected-recipient');return;}
 fail('Choose one explicit invitation action with exact identifiers.');
}
