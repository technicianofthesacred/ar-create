import { mkdir, readFile, open, rename, unlink, lstat, readdir, link } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {constants} from 'node:fs';
import {existsSync} from 'node:fs';
import {createArticlePersistence,articleHash,articlePaths} from './article-persistence.mjs';
import {outputRecordsExpected,validateOutputIndex,outputPrivatePrefix,outputOperationInputHash} from './output-records.mjs';
import {articleCompositionIssue} from './src/workspaces/article-composition.mjs';

export const MAX_BODY_BYTES = 2 * 1024 * 1024;

export class StateError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

function shape(value, keys, label, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) {
    throw new StateError(`${label} must contain exactly: ${keys.join(', ')}.`);
  }
}
function text(value, label, max = MAX_BODY_BYTES) {
  if (typeof value !== 'string' || value.length > max) throw new StateError(`${label} must be a string of at most ${max} characters.`);
}
function id(value, label) {
  text(value, label, 128);
  if (!value.trim() || /[\u0000-\u001f\u007f]/.test(value)) throw new StateError(`${label} must be a nonempty ID without control characters.`);
}
function collection(value, label, max, check) {
  if (!Array.isArray(value) || value.length > max) throw new StateError(`${label} must be an array with at most ${max} entries.`);
  const ids = new Set();
  value.forEach((entry, index) => {
    check(entry, `${label}[${index}]`);
    if (ids.has(entry.id)) throw new StateError(`${label} contains duplicate ID ${entry.id}.`);
    ids.add(entry.id);
  });
  return ids;
}
function guidance(value, label) {
  shape(value, ['voice', 'perspective', 'recipe'], label);
  for (const key of ['voice', 'perspective', 'recipe']) text(value[key], `${label}.${key}`, 256 * 1024);
}

export const WRITING_TEMPLATE_MAX_BYTES = 128 * 1024;
const sha256 = value => createHash('sha256').update(value).digest('hex');
function isoDate(value, label) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new StateError(`${label} requires an ISO date-time.`); }
export function validateWritingTemplate(attachment, label = 'writingTemplate') {
  shape(attachment, ['sourceId','attachmentId','attachedAt','source'], label);
  id(attachment.sourceId, `${label}.sourceId`);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(attachment.attachmentId)) throw new StateError('Writing template requires a unique attachment UUID.');
  isoDate(attachment.attachedAt, `${label}.attachedAt`);
  shape(attachment.source, ['artifactId','fileName','provenance'], `${label}.source`);
  if (!/^mag_[a-f0-9]{64}$/.test(attachment.source.artifactId) || attachment.source.fileName !== 'TEMPLATE.md') throw new StateError('Only Magazine TEMPLATE.md can be attached as a writing template.');
  const origin=attachment.source.provenance;
  shape(origin,['rootId','rootLabel','rootPath','relativePath','sha256','readOnly'],`${label}.source.provenance`);
  for (const key of ['rootId','rootLabel','rootPath','relativePath']) {text(origin[key],`${label}.source.provenance.${key}`,key==='rootId'?128:key==='rootLabel'?256:4096);if(!origin[key].trim()||/[\u0000-\u001f\u007f]/.test(origin[key])) throw new StateError('Writing template provenance requires readable identifiers.');}
  if (!path.isAbsolute(origin.rootPath) || path.isAbsolute(origin.relativePath) || origin.relativePath.includes('\\') || origin.relativePath.split('/').some(part=>!part||part==='.'||part==='..') || path.posix.basename(origin.relativePath)!=='TEMPLATE.md' || !/^[a-f0-9]{64}$/.test(origin.sha256) || origin.readOnly!==true) throw new StateError('Writing template requires an original read-only Magazine receipt.');
  return attachment;
}
export function validateWritingTemplateSnapshot(snapshot, label = 'writingTemplateSnapshot') {
  if (snapshot === null) return snapshot;
  shape(snapshot,['schema','attachment','raw','hash','capturedAt'],label);
  if(snapshot.schema!=='ar-create.writing-template-snapshot.v1') throw new StateError('Writing template snapshot has an unsupported schema.');
  validateWritingTemplate(snapshot.attachment,`${label}.attachment`);text(snapshot.raw,`${label}.raw`,WRITING_TEMPLATE_MAX_BYTES);
  if(Buffer.byteLength(snapshot.raw)>WRITING_TEMPLATE_MAX_BYTES || snapshot.raw.includes('\0') || !/^[a-f0-9]{64}$/.test(snapshot.hash) || sha256(snapshot.raw)!==snapshot.hash) throw new StateError('Writing template snapshot requires exact bounded raw bytes and their SHA-256.');
  isoDate(snapshot.capturedAt,`${label}.capturedAt`);return snapshot;
}

export function validateDocument(document, label = 'document') {
  if (!document || typeof document !== 'object' || Array.isArray(document) || document.schema !== 'ar-create.document.v1') throw new StateError(`${label} requires ar-create.document.v1.`);
  id(document.id, `${label}.id`);
  text(document.title, `${label}.title`, 512);
  if (document.writingTemplate !== undefined && document.writingTemplate !== null) validateWritingTemplate(document.writingTemplate, `${label}.writingTemplate`);
  if (document.editorialFrame !== undefined) text(document.editorialFrame, `${label}.editorialFrame`, 16000);
  if (!Number.isSafeInteger(document.revision) || document.revision < 0) throw new StateError(`${label}.revision must be a nonnegative integer.`);
  collection(document.paragraphs, `${label}.paragraphs`, 2000, (paragraph, name) => {
    id(paragraph.id, `${name}.id`); text(paragraph.text, `${name}.text`);
    if (!paragraph.doc || typeof paragraph.doc !== 'object' || Array.isArray(paragraph.doc) || paragraph.doc.type !== 'doc') throw new StateError(`${name}.doc must contain a TipTap document.`);
    if (!Array.isArray(paragraph.attributions) || !Array.isArray(paragraph.kept)) throw new StateError(`${name} needs attributions and kept arrays.`);
    for (const attribution of paragraph.attributions) {
      id(attribution.id, `${name}.attribution.id`); id(attribution.sourceId, `${name}.attribution.sourceId`);
      if (!['quote', 'inline', 'reference', 'paraphrase'].includes(attribution.form)) throw new StateError(`${name}.attribution has an unknown form.`);
      text(attribution.excerpt, `${name}.attribution.excerpt`);
    }
    for (const kept of paragraph.kept) { id(kept.id, `${name}.kept.id`); text(kept.text, `${name}.kept.text`); if (!['verbatim', 'point'].includes(kept.mode)) throw new StateError(`${name}.kept has an unknown mode.`); }
  });
  if (!Array.isArray(document.outputs) || document.outputs.length > 100) throw new StateError(`${label}.outputs must be an array under 100 entries.`);
  for (const [outputIndex, output] of document.outputs.entries()) {
    if(output?.articleComposition!==undefined){if(output.kind!=='article')throw new StateError('Only an article can carry article composition.');const issue=articleCompositionIssue(output.articleComposition,output.manuscript||document.paragraphs,output.placements||[]);if(issue)throw new StateError(issue);}
    if(output?.articleCompositionNotice!==undefined)text(output.articleCompositionNotice,'articleCompositionNotice',1000);
    if(output?.articleVisualMake!==undefined){
      if(output.kind!=='article')throw new StateError('Only articles carry visual arrangement receipts.');
      shape(output.articleVisualMake,['requestId','artifactHash','wordsHash'],'articleVisualMake');
      id(output.articleVisualMake.requestId,'articleVisualMake.requestId');
      for(const key of ['artifactHash','wordsHash'])if(!/^[a-f0-9]{64}$/.test(output.articleVisualMake[key]))throw new StateError('Article visual receipts require SHA-256 hashes.');
    }
    if(output?.articleVisualHistory!==undefined){
      if(output.kind!=='article'||!Array.isArray(output.articleVisualHistory)||output.articleVisualHistory.length>10)throw new StateError('Keep at most ten earlier article arrangements.');
      for(const saved of output.articleVisualHistory){
        shape(saved,['createdAt','wordsHash','placements'],'articleVisualHistory',['composition']);
        if(typeof saved.createdAt!=='string'||!Number.isFinite(Date.parse(saved.createdAt))||!/^[a-f0-9]{64}$/.test(saved.wordsHash)||!Array.isArray(saved.placements)||saved.placements.length>200)throw new StateError('Earlier article arrangements require a date, wording hash and bounded photo placements.');
      }
    }
    if(output?.kind==='article'&&output.wordsReview!==undefined){
      shape(output.wordsReview,['hash','reviewedAt'],'article.wordsReview');
      if(!/^[a-f0-9]{64}$/.test(output.wordsReview.hash)||typeof output.wordsReview.reviewedAt!=='string'||!Number.isFinite(Date.parse(output.wordsReview.reviewedAt)))throw new StateError('Article wording review requires a SHA-256 receipt and review date.');
    }
    if (output?.kind !== 'carousel' || !Array.isArray(output.slides)) continue;
    if(output.stage!==undefined&&!['words','look'].includes(output.stage))throw new StateError('Carousel stage must be words or look.');
    if(output.wordsReview!==undefined){shape(output.wordsReview,['hash','reviewedAt'],'carousel.wordsReview');if(!/^[a-f0-9]{64}$/.test(output.wordsReview.hash)||typeof output.wordsReview.reviewedAt!=='string'||!Number.isFinite(Date.parse(output.wordsReview.reviewedAt)))throw new StateError('Carousel wording review requires a SHA-256 receipt and review date.');}
    for (const [slideIndex, slide] of output.slides.entries()) {
      if (slide?.pillar !== undefined && !['', '佳', '家', '嘉'].includes(slide.pillar)) throw new StateError(`${label}.outputs[${outputIndex}].slides[${slideIndex}].pillar must be 佳, 家, 嘉 or empty.`);
      if (slide?.label !== undefined) text(slide.label, `${label}.outputs[${outputIndex}].slides[${slideIndex}].label`, 240);
      if (slide?.typography !== undefined) {
        const name=`${label}.outputs[${outputIndex}].slides[${slideIndex}].typography`, value=slide.typography;
        shape(value,['font','scale','fit'],name);
        if(!['original','caudex','serif','sans'].includes(value.font)||!Number.isFinite(value.scale)||value.scale<0.5||value.scale>1.5||!['auto','manual'].includes(value.fit))throw new StateError(`${name} requires a supported font, scale 0.5–1.5 and auto or manual fit.`);
      }
    }
  }
  if(document.nativeOutputIndex!==undefined)validateOutputIndex(document.nativeOutputIndex,document.outputs,StateError);
  const magazine=document.importedDraft?.magazineProvenance;
  if(magazine!==undefined){
    shape(magazine,['rootId','rootLabel','rootPath','relativePath','sha256','readOnly'],`${label}.importedDraft.magazineProvenance`);
    for(const key of ['rootId','rootLabel','rootPath','relativePath']){text(magazine[key],`magazineProvenance.${key}`,key==='rootId'?128:key==='rootLabel'?256:4096);if(!magazine[key].trim()||/[\u0000-\u001f\u007f]/.test(magazine[key]))throw new StateError('Magazine provenance must contain readable source identifiers.');}
    if(!path.isAbsolute(magazine.rootPath)||path.isAbsolute(magazine.relativePath)||magazine.relativePath.includes('\\')||magazine.relativePath.split(/[\\/]/).some(part=>!part||part==='.'||part==='..')||!/^[a-f0-9]{64}$/.test(magazine.sha256)||magazine.readOnly!==true)throw new StateError('Magazine provenance requires an original path, SHA-256 and read-only receipt.');
  }
  if (Buffer.byteLength(JSON.stringify(document)) > MAX_BODY_BYTES) throw new StateError('Document exceeds the 2 MB limit.', 413);
  return document;
}

export function validateState(state) {
  shape(state, ['revision', 'project'], 'state');
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || state.revision >= Number.MAX_SAFE_INTEGER) {
    throw new StateError('revision must be a nonnegative safe integer below the maximum.');
  }
  const project = state.project;
  shape(project, ['id', 'title', 'sources', 'reflections', 'draft', 'guidance', 'versions'], 'project', ['document', 'materialSelection']);
  if (project.document !== undefined) validateDocument(project.document, 'project.document');
  if (project.materialSelection !== undefined) {
    const selection=project.materialSelection;
    shape(selection,['sourceIds'],'project.materialSelection',['cardIds','collectionId']);
    for(const [key,max] of [['sourceIds',100],['cardIds',200]]) {
      if(selection[key]===undefined)continue;
      if(!Array.isArray(selection[key])||selection[key].length>max||new Set(selection[key]).size!==selection[key].length)throw new StateError(`materialSelection.${key} must contain unique IDs, at most ${max}.`);
      selection[key].forEach(value=>id(value,`materialSelection.${key}`));
    }
    if(selection.collectionId!==undefined)id(selection.collectionId,'materialSelection.collectionId');
  }

  id(project.id, 'project.id');
  text(project.title, 'project.title', 256);
  text(project.draft, 'project.draft');
  guidance(project.guidance, 'project.guidance');
  const sourceIds = collection(project.sources, 'sources', 200, (source, label) => {
    shape(source, ['id', 'title', 'url', 'body'], label);
    id(source.id, `${label}.id`);
    text(source.title, `${label}.title`, 512);
    text(source.url, `${label}.url`, 2048);
    text(source.body, `${label}.body`);
  });
  collection(project.reflections, 'reflections', 1000, (reflection, label) => {
    shape(reflection, ['id', 'body', 'sourceId'], label, ['origin']);
    id(reflection.id, `${label}.id`);
    text(reflection.body, `${label}.body`);
    if(reflection.origin!==undefined){
      const origin=reflection.origin;shape(origin,['kind','rootId','relativePath','sourceHash','questionKey','questionTitle','prompt'],`${label}.origin`);
      if(origin.kind!=='magazine-question')throw new StateError(`${label}.origin requires magazine-question.`);
      if(reflection.sourceId!==null)throw new StateError('A Magazine question contribution must have sourceId null.');
      id(origin.rootId,`${label}.origin.rootId`);text(origin.relativePath,`${label}.origin.relativePath`,4096);
      if(!origin.relativePath.trim()||/[\u0000-\u001f\u007f]/.test(origin.relativePath)||path.isAbsolute(origin.relativePath)||origin.relativePath.includes('\\')||origin.relativePath.split('/').some(part=>!part||part==='.'||part==='..'))throw new StateError('Magazine question origin requires a safe relative artifact path.');
      for(const key of ['sourceHash','questionKey'])if(typeof origin[key]!=='string'||!/^[a-f0-9]{64}$/.test(origin[key]))throw new StateError(`${label}.origin.${key} requires a lowercase SHA-256 hash.`);
      text(origin.questionTitle,`${label}.origin.questionTitle`,512);text(origin.prompt,`${label}.origin.prompt`,20000);
    }
    if (reflection.sourceId !== null) {
      id(reflection.sourceId, `${label}.sourceId`);
      if (!sourceIds.has(reflection.sourceId)) throw new StateError(`${label}.sourceId refers to an unknown source.`);
    }
  });
  collection(project.versions, 'versions', 50, (version, label) => {
    shape(version, ['id', 'createdAt', 'label', 'draft', 'guidance'], label, ['document','writingTemplateSnapshot']);
    if (version.writingTemplateSnapshot !== undefined) {validateWritingTemplateSnapshot(version.writingTemplateSnapshot, `${label}.writingTemplateSnapshot`);if(version.writingTemplateSnapshot && (!version.document || JSON.stringify(version.document.writingTemplate)!==JSON.stringify(version.writingTemplateSnapshot.attachment)))throw new StateError('Version writing template snapshot must match its saved document attachment.');}
    if (version.document !== undefined) validateDocument(version.document, `${label}.document`);
    id(version.id, `${label}.id`);
    text(version.createdAt, `${label}.createdAt`, 64);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(version.createdAt) || !Number.isFinite(Date.parse(version.createdAt))) {
      throw new StateError(`${label}.createdAt must be an ISO date-time.`);
    }
    text(version.label, `${label}.label`, 256);
    text(version.draft, `${label}.draft`);
    guidance(version.guidance, `${label}.guidance`);
  });
  if (Buffer.byteLength(JSON.stringify(state)) > MAX_BODY_BYTES) throw new StateError('State exceeds the 2 MB limit.', 413);
  return state;
}

export function createInitialState() {
  return { revision: 0, project: { id: randomUUID(), title: 'Untitled exploration', sources: [], reflections: [], draft: '',
    guidance: { voice: '', perspective: '', recipe: '' }, versions: [] } };
}

async function assertRegularOrMissing(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing non-regular data file: ${file}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function atomicWrite(file, contents, {exclusive=false}={}) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close(); handle = undefined;
    if(exclusive)await link(temporary,file);else await rename(temporary, file);
    const directory = await open(path.dirname(file), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  } finally {
    if (handle) await handle.close();
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function createStore({ dataDir, sharedArticles=false, publicationFault } = {}) {
  dataDir=path.resolve(dataDir);
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const directory = await lstat(dataDir);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Data directory must be a real directory.');
  const file = path.join(dataDir, 'state.json');
  const backup = path.join(dataDir, 'state.backup.json');
  await assertRegularOrMissing(file);
  await assertRegularOrMissing(backup);
  const articles=sharedArticles?await createArticlePersistence({dataDir,atomicWrite,StateError,fault:publicationFault}):null;
  let state;
  try {
    const contents = await readFile(file);
    if (contents.length > MAX_BODY_BYTES) throw new Error('Stored state exceeds the 2 MB limit.');
    state = validateState(JSON.parse(contents.toString('utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') {if(articles)await articles.close();throw new Error(`Cannot load state; existing files were preserved: ${error.message}`, { cause: error });}
    state = createInitialState();
    await atomicWrite(file, JSON.stringify(state));
  }
  let knownStateBytes=await readFile(file),needsRecovery=false,closed=false,recoveryFiles=[];
  let pending = Promise.resolve();
  const savedListeners = new Set();
  const piecesDir=path.join(dataDir,'pieces'),migrationBackup=path.join(dataDir,'state.pieces-migration.backup.json');
  let piecesReady=false,activeMetadata=null;
  const knownPieceBytes=new Map();
  const pieceFile=projectId=>path.join(piecesDir,createHash('sha256').update(projectId).digest('hex')+'.json');
  const timestamp=()=>new Date().toISOString();
  async function refreshPublication(){
    if(closed)throw new StateError('Store owner is closed.',409);
    if(!articles)return;
    const recovered=await articles.recover(),disk=await readFile(file);
    if(recovered||needsRecovery){if(!recovered)await articles.checkPublished(recoveryFiles);state=validateState(JSON.parse(disk.toString('utf8')));knownStateBytes=disk;activeMetadata=null;capturePublishedPieceBytes(recovered?.files||recoveryFiles);needsRecovery=false;recoveryFiles=[];}
    else if(!disk.equals(knownStateBytes))throw new StateError('State changed outside its cooperating store owner; existing files were preserved.',409);
  }
  function serialized(action){const operation=pending.then(async()=>{await refreshPublication();return action();});pending=operation.catch(()=>{});return operation;}
  function notifySaved(){for(const listener of savedListeners){try{listener(structuredClone(state));}catch(error){console.error('Saved workspace view could not refresh:',error.message);}}}
  async function checkDataDirectory(){const stat=await lstat(dataDir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Data storage must remain a real directory.',403);}
  async function checkPiecesDirectory(create=false){
    await checkDataDirectory();
    try{const stat=await lstat(piecesDir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Pieces storage must be a real private directory.',403);}
    catch(error){if(error.code!=='ENOENT')throw error;if(!create)throw new StateError('Saved piece was not found.',404);await mkdir(piecesDir,{mode:0o700});}
  }
  function envelope(project,metadata){
    const result={schema:'ar-create.piece.v1',createdAt:metadata.createdAt,updatedAt:metadata.updatedAt,project:structuredClone(project)};
    const bytes=JSON.stringify(result);if(Buffer.byteLength(bytes)>MAX_BODY_BYTES)throw new StateError('Piece exceeds the 2 MB limit.',413);return {result,bytes};
  }
  async function capturePieceBytes(){
    knownPieceBytes.clear();if(!existsSync(piecesDir))return;
    for(const filename of await readdir(piecesDir))if(/^[a-f0-9]{64}\.json$/.test(filename)){const location=path.join(piecesDir,filename);await assertRegularOrMissing(location);knownPieceBytes.set(location,articleHash(await readFile(location)));}
  }
  function capturePublishedPieceBytes(files){
    // Remember the bytes we wrote, never a rereading that could silently adopt
    // a concurrent external change. Unrelated snapshots keep their old baseline.
    for(const [location,value] of files)if(path.dirname(location)===piecesDir&&/^[a-f0-9]{64}\.json$/.test(path.basename(location))){if(value===null)knownPieceBytes.delete(location);else knownPieceBytes.set(location,articleHash(value));}
  }
  async function readPiece(projectId,filename=pieceFile(projectId)){
    await checkPiecesDirectory();let handle;
    try{
      handle=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=await handle.stat();
      if(!stat.isFile()||stat.nlink!==1)throw new StateError('Piece snapshot must be an ordinary private file.',403);
      if(stat.size>MAX_BODY_BYTES)throw new StateError('Stored piece exceeds the 2 MB limit.',413);
      const bytes=await handle.readFile();if(bytes.length>MAX_BODY_BYTES)throw new StateError('Stored piece exceeds the 2 MB limit.',413);
      const record=JSON.parse(bytes.toString('utf8'));shape(record,['schema','createdAt','updatedAt','project'],'piece');
      if(record.schema!=='ar-create.piece.v1')throw new StateError('Piece snapshot has an unsupported schema.');
      for(const key of ['createdAt','updatedAt'])if(typeof record[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(record[key])||!Number.isFinite(Date.parse(record[key])))throw new StateError('Piece timestamps are invalid.');
      validateState({revision:0,project:record.project});
      if((projectId!==undefined&&record.project.id!==projectId)||pieceFile(record.project.id)!==filename)throw new StateError('Piece snapshot identity does not match its saved file.',409);
      return record;
    }catch(error){if(error.code==='ENOENT')throw new StateError('Saved piece was not found.',404);if(error.code==='ELOOP')throw new StateError('Symlink piece snapshots are not available.',403);if(error instanceof StateError)throw error;throw new StateError('Cannot read saved piece; existing files were preserved: '+error.message);}
    finally{await handle?.close();}
  }
  async function activeMeta(){
    if(activeMetadata?.id===state.project.id)return activeMetadata;
    const stat=await lstat(file),updatedAt=stat.mtime.toISOString();let prior=null;
    try{prior=await readPiece(state.project.id);}catch(error){if(error.status!==404)throw error;}
    return activeMetadata={id:state.project.id,createdAt:prior?.createdAt||updatedAt,updatedAt:prior&&JSON.stringify(prior.project)===JSON.stringify(state.project)?prior.updatedAt:updatedAt};
  }
  async function writePiece(project,metadata,{exclusive=false}={}){
    const prepared=envelope(project,metadata);await checkPiecesDirectory();await assertRegularOrMissing(pieceFile(project.id));await atomicWrite(pieceFile(project.id),prepared.bytes,{exclusive});return prepared.result;
  }
  async function initializePieces(){
    if(piecesReady){await checkPiecesDirectory();return;}
    await checkPiecesDirectory(true);await assertRegularOrMissing(file);await assertRegularOrMissing(migrationBackup);
    if(articles){
      const projects=[state.project],files=[],expectedFiles=new Map();
      for(const filename of await readdir(piecesDir)){if(!/^[a-f0-9]{64}\.json$/.test(filename)||filename===path.basename(pieceFile(state.project.id)))continue;projects.push((await readPiece(undefined,path.join(piecesDir,filename))).project);}
      const metadata=await activeMeta();
      const activeFile=pieceFile(state.project.id);
      if(!existsSync(activeFile))files.push([activeFile,envelope(state.project,metadata).bytes]);
      else {const activeBytes=await readFile(activeFile),prior=await readPiece(state.project.id);if(JSON.stringify(prior.project)!==JSON.stringify(state.project)){files.push([activeFile,envelope(state.project,metadata).bytes]);expectedFiles.set(activeFile,articleHash(activeBytes));}}
      if(!existsSync(migrationBackup))files.push([migrationBackup,await readFile(file)]);
      try{await articles.bootstrap(projects,files,{expectedFiles});}catch(error){needsRecovery=existsSync(articles.journal);throw error;}
      await capturePieceBytes();piecesReady=true;return;
    }
    // Exclusive publication preserves the exact pre-pieces state forever.
    try{await lstat(migrationBackup);}catch(error){if(error.code!=='ENOENT')throw error;await atomicWrite(migrationBackup,await readFile(file),{exclusive:true});}
    const metadata=await activeMeta();
    try{await lstat(pieceFile(state.project.id));}catch(error){if(error.code!=='ENOENT')throw error;await writePiece(state.project,metadata,{exclusive:true});}
    piecesReady=true;
  }
  function expected(input){
    id(input.expectedProjectId,'expectedProjectId');
    if(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw new StateError('expectedRevision must be a nonnegative safe integer.');
    if(input.expectedProjectId!==state.project.id||input.expectedRevision!==state.revision)throw new StateError('Active piece changed since this page loaded. Reload the latest state before continuing.',409);
  }
  async function commit(next,metadata=null,{pieceProjects=[],expectedArticle,expectedCarousel,decisionFile,receipt,finalCheck,extraFiles=[],extraExpectedFiles=new Map(),preserveActive=false}={}){
    validateState(next);await checkDataDirectory();await assertRegularOrMissing(file);await assertRegularOrMissing(backup);
    if(articles){
      await initializePieces();const checked=preserveActive?null:await articles.checkArticle(state.project,expectedArticle);
      const carouselChecks=preserveActive?[]:await articles.checkCarouselWords(state.project,expectedCarousel);
      // A selected reviewed decision reconciles one file. Other outside files
      // are CAS-bound old==next journal entries, never regenerated or written.
      const retainedCarouselFiles=new Map(carouselChecks.filter(carousel=>carousel.externalEdit&&carousel.output.id!==expectedCarousel?.outputId).map(carousel=>[carousel.paths.markdown,carousel.bytes]));
      const expectedFiles=new Map([[file,articleHash(knownStateBytes)],...extraExpectedFiles]);
      if(checked){expectedFiles.set(checked.paths.markdown,checked.expected.markdownHash);expectedFiles.set(checked.paths.companion,checked.expected.companionHash);}
      for(const carousel of carouselChecks)expectedFiles.set(carousel.paths.markdown,carousel.expected.markdownHash);
      const disk=await readFile(file);if(!disk.equals(knownStateBytes))throw new StateError('State changed during article publication; existing files were preserved.',409);
      const active=await activeMeta(),nextMeta=metadata||(preserveActive?active:{createdAt:active.createdAt,updatedAt:timestamp()});
      const projects=new Map(pieceProjects.map(entry=>[entry.project.id,entry]));if(!preserveActive)projects.set(next.project.id,{project:next.project,metadata:nextMeta});
      const files=[...retainedCarouselFiles,...(preserveActive?[]:[[backup,disk]]),...extraFiles];
      for(const entry of projects.values()){
        if(entry.project.id!==state.project.id){const oldPiece=await readPiece(entry.project.id).catch(error=>{if(error.status===404)return null;throw error;});if(oldPiece){const target=await articles.checkArticle(oldPiece.project);expectedFiles.set(target.paths.markdown,target.expected.markdownHash);expectedFiles.set(target.paths.companion,target.expected.companionHash);for(const carousel of await articles.checkCarouselWords(oldPiece.project))expectedFiles.set(carousel.paths.markdown,carousel.expected.markdownHash);}else{const paths=articlePaths(dataDir,entry.project);expectedFiles.set(paths.markdown,null);expectedFiles.set(paths.companion,null);}}
        for(const [destination] of articles.bundleFiles(entry.project))if(!expectedFiles.has(destination))expectedFiles.set(destination,await articles.retainedCarouselWordsHash(entry.project,destination));
        expectedFiles.set(pieceFile(entry.project.id),knownPieceBytes.get(pieceFile(entry.project.id))??null);
        files.push([pieceFile(entry.project.id),envelope(entry.project,entry.metadata).bytes],...articles.bundleFiles(entry.project).filter(([destination])=>!retainedCarouselFiles.has(destination)));}
      files.push([file,preserveActive?disk:JSON.stringify(next)]);
      if(decisionFile){expectedFiles.set(decisionFile,null);files.push([decisionFile,JSON.stringify(receipt)]);}
      await finalCheck?.();
      try{await articles.publish(files,{expectedFiles});}catch(error){needsRecovery=existsSync(articles.journal)||!!(decisionFile&&existsSync(decisionFile))||!(await readFile(file)).equals(knownStateBytes);if(needsRecovery)recoveryFiles=files;throw error;}
      state=next;knownStateBytes=preserveActive?disk:Buffer.from(JSON.stringify(next));activeMetadata={id:state.project.id,...nextMeta};capturePublishedPieceBytes(files);notifySaved();return structuredClone(state);
    }
    await atomicWrite(backup,JSON.stringify(state));await atomicWrite(file,JSON.stringify(next));state=next;
    if(metadata)activeMetadata={id:state.project.id,...metadata};else if(activeMetadata)activeMetadata={...activeMetadata,updatedAt:timestamp()};
    notifySaved();return structuredClone(state);
  }
  async function outputOwnedDirectory(directory){
    await checkDataDirectory();const relative=path.relative(dataDir,directory);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep)[0]!=='native-outputs')throw new StateError('Output path is outside owned native-output storage.',403);
    let current=dataDir;
    for(const part of relative.split(path.sep)){current=path.join(current,part);try{await mkdir(current,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}const stat=await lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Output directories must be real private directories.',403);}
  }
  async function outputPrivateFile(destination){
    await outputOwnedDirectory(path.dirname(destination));
    try{const stat=await lstat(destination);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new StateError('Output captures require ordinary private files.',403);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  function summary(project,metadata,active){
    const paragraphs=project.document?.paragraphs||[],body=project.document?paragraphs.map(paragraph=>paragraph.text).join(' '):project.draft;
    const original=project.document?.importedDraft?.magazineProvenance;
    // Association describes the untouched original receipt, never current prose
    // or permission to access a path. Identity and source bytes stay separate.
    const magazineSource=original?{rootId:original.rootId,relativePath:original.relativePath,rootPathHash:createHash('sha256').update(original.rootPath).digest('hex'),sha256:original.sha256,readOnly:true}:null;
    return {id:project.id,title:project.title,documentId:project.document?.id||null,wordCount:(body.match(/\S+/gu)||[]).length,passages:paragraphs.length,outputs:project.document?.outputs?.length||0,sourceCount:new Set([...project.sources.map(source=>source.id),...(project.materialSelection?.sourceIds||[])]).size,createdAt:metadata.createdAt,updatedAt:metadata.updatedAt,active,...(magazineSource?{magazineSource}:{})};
  }
  if(articles){try{await initializePieces();}catch(error){await articles.close();throw error;}}
  return {
    async close(){if(closed)return;await pending;closed=true;if(articles)await articles.close();},
    read(options={}){return serialized(async()=>{if(articles)await articles.readArticle(state.project,options);return structuredClone(state);});},
    readArticle(options={}){return serialized(async()=>{if(!articles)throw new StateError('Shared article persistence is not enabled.',409);const project=(!options.projectId||options.projectId===state.project.id)?state.project:(await readPiece(options.projectId)).project;return articles.readArticle(project,options);});},
    readCarouselWords(options={}){const captured=structuredClone(options);return serialized(async()=>{if(!articles)throw new StateError('Shared article persistence is not enabled.',409);const project=(!captured.projectId||captured.projectId===state.project.id)?state.project:(await readPiece(captured.projectId)).project;return articles.readCarouselWords(project,captured);});},
    // Trusted in-process service boundary. No HTTP route accepts prepare or paths.
    saveOutputRecords(input,prepare){const incoming=structuredClone(input);return serialized(async()=>{
      let receiptFile,publicationAttempted=false;
      try{
        if(!articles)throw new StateError('Shared article persistence is required for output saves.',409);
        shape(incoming,['projectId','documentId','expectedOutput','operationId','commandHash'],'output save');
        id(incoming.projectId,'projectId');id(incoming.documentId,'documentId');
        shape(incoming.expectedOutput,['revision','hash'],'expectedOutput');
        if(!Number.isSafeInteger(incoming.expectedOutput.revision)||incoming.expectedOutput.revision<0||!/^[a-f0-9]{64}$/.test(incoming.expectedOutput.hash)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(incoming.operationId))throw new StateError('Output saves require exact revision/hash and operation UUID.');
        if(typeof incoming.commandHash!=='string'||!/^[a-f0-9]{64}$/.test(incoming.commandHash))throw new StateError('Output save requires an exact trusted command SHA-256.');
        if(typeof prepare!=='function')throw new StateError('Output save requires a trusted preparation callback.');
        const inputHash=outputOperationInputHash(incoming);
        receiptFile=path.join(dataDir,'native-outputs','operations',incoming.operationId,'receipt.json');
        await outputOwnedDirectory(path.dirname(receiptFile));await outputPrivateFile(receiptFile);
        let prior;try{prior=JSON.parse(await readFile(receiptFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
        if(prior){
          if(prior.schema!=='ar-create.output-save-receipt.v1'||prior.operationId!==incoming.operationId||prior.inputHash!==inputHash||prior.commandHash!==incoming.commandHash||prior.projectId!==incoming.projectId||prior.documentId!==incoming.documentId)throw new StateError('Output operation already belongs to different input.',409);
          return {receipt:prior,alreadySaved:true};
        }
        const active=incoming.projectId===state.project.id;
        const record=active?null:await readPiece(incoming.projectId),project=structuredClone(active?state.project:record.project);
        if(project.document?.id!==incoming.documentId)throw new StateError('Output save belongs to another document.',409);
        const expected=outputRecordsExpected(project.document);
        if(expected.revision!==incoming.expectedOutput.revision||expected.hash!==incoming.expectedOutput.hash)throw new StateError('Output records changed since inspection.',409);
        const outputReadProject=structuredClone(project);
        const prepared=await prepare({project:structuredClone(project),expectedOutput:structuredClone(expected),readArticle:options=>articles.readArticle(project,options),readCarouselWords:options=>articles.readCarouselWords(outputReadProject,options)});
        shape(prepared,['outputs','nativeOutputIndex','finalCheck'],'prepared outputs',['extraFiles']);
        if(typeof prepared.finalCheck!=='function')throw new StateError('Output save requires the native/source proof check.');
        const outputs=structuredClone(prepared.outputs),index=structuredClone(prepared.nativeOutputIndex);
        if(!Array.isArray(outputs)||outputs.length>100||outputs.some(output=>!output||!['article','carousel','post','product-listing'].includes(output.kind)||typeof output.id!=='string'||!output.id.trim())||new Set(outputs.map(output=>output.id)).size!==outputs.length)throw new StateError('Output saves require unique article or carousel records.');
        validateOutputIndex(index,outputs,StateError);
        for(const entry of index.records)if(entry.wordOwner.kind==='carousel-words'&&(entry.wordOwner.projectId!==project.id||entry.wordOwner.documentId!==project.document.id))throw new StateError('Carousel word owner belongs to another document.',409);
        if(index.revision!==expected.revision+1)throw new StateError('Native output index must advance exactly once.');
        project.document.outputs=outputs;project.document.nativeOutputIndex=index;
        validateState({revision:0,project});
        const extraFiles=[],extraExpectedFiles=new Map(),prefix=outputPrivatePrefix(project.id,project.document.id);
        if(prepared.extraFiles!==undefined&&!Array.isArray(prepared.extraFiles))throw new StateError('Private capture files must be an array.');
        if((prepared.extraFiles?.length??0)>200)throw new StateError('Too many private capture files.');
        for(const extra of prepared.extraFiles||[]){
          shape(extra,['relativePath','contents','expectedHash'],'private capture');
          if(typeof extra.relativePath!=='string'||!extra.relativePath.startsWith(prefix)||!new RegExp('^(captures|history)/[A-Za-z0-9_-]{1,128}\\.json$').test(extra.relativePath.slice(prefix.length)))throw new StateError('Private capture paths must remain in this document native-output namespace.',403);
          text(extra.contents,'private capture contents');
          if(Buffer.byteLength(extra.contents)>MAX_BODY_BYTES||extra.expectedHash!==null&&!/^[a-f0-9]{64}$/.test(extra.expectedHash))throw new StateError('Private captures require bounded bytes and an expected file hash.');
          const destination=path.join(dataDir,extra.relativePath);
          if(extraExpectedFiles.has(destination))throw new StateError('Private capture destinations must be unique.');
          await outputOwnedDirectory(path.dirname(destination));await outputPrivateFile(destination);
          extraFiles.push([destination,extra.contents]);extraExpectedFiles.set(destination,extra.expectedHash);
        }
        const next=active?{revision:state.revision+1,project}:structuredClone(state);
        const receipt={schema:'ar-create.output-save-receipt.v1',operationId:incoming.operationId,inputHash,commandHash:incoming.commandHash,projectId:project.id,documentId:project.document.id,expectedOutput:incoming.expectedOutput,savedOutput:outputRecordsExpected(project.document),savedAt:timestamp(),committedRevision:next.revision};
        publicationAttempted=true;
        await commit(next,null,{preserveActive:!active,pieceProjects:active?[]:[{project,metadata:{createdAt:record.createdAt,updatedAt:timestamp()}}],extraFiles,extraExpectedFiles,decisionFile:receiptFile,receipt,finalCheck:async()=>{for(const [destination] of extraFiles)await outputPrivateFile(destination);await outputOwnedDirectory(path.dirname(receiptFile));await prepared.finalCheck();}});
        return {receipt:structuredClone(receipt),alreadySaved:false};
      }catch(error){error.outcome=publicationAttempted&&(existsSync(articles?.journal||'')||(receiptFile&&existsSync(receiptFile)))?'unknown':'not-applied';throw error;}
    });},
    initializeFirstDraft(input){const incoming=structuredClone(input);return serialized(async()=>{
      expected(incoming);
      if(!articles)throw new StateError('Shared article persistence is required for a first draft.',409);
      if(String(state.project.draft||'').trim())throw new StateError('Existing legacy writing must be preserved. Open it before preparing a first draft.',409);
      const document=state.project.document;
      if(document){
        if(document.paragraphs.length||document.pendingResearchCandidate||document.importedDraft||document.legacyImport)throw new StateError('A first draft requires an empty document with no pending writing.',409);
        await articles.readArticle(state.project);return structuredClone(state);
      }
      const next=structuredClone(state);next.revision++;
      // Same identity as the existing untouched initial visual surface.
      next.project.document={schema:'ar-create.document.v1',id:state.project.id,revision:0,title:state.project.title,paragraphs:[],outputs:[]};
      return commit(next);
    });},
    decideFirstDraft(input,prepare){const incoming=structuredClone(input);return serialized(async()=>{
      let decisionFile,publicationAttempted=false;
      try{
        if(!articles)throw new StateError('Shared article persistence is required for a first draft.',409);
        const {requestId,binding}=incoming;
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId))throw new StateError('Invalid first-draft request.');
        shape(binding,['artifactHash','completionHash','reviewHash'],'first-draft binding');
        if(Object.values(binding).some(hash=>!/^[a-f0-9]{64}$/.test(hash)))throw new StateError('First-draft acceptance requires exact inspected artifact hashes.');
        const directory=path.join(dataDir,'article-make',requestId);
        for(const dir of [path.dirname(directory),directory]){const stat=await lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('First-draft request must be an owned directory.',403);}
        decisionFile=path.join(directory,'decision.json');await assertRegularOrMissing(decisionFile);
        let prior;try{prior=JSON.parse(await readFile(decisionFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
        if(prior){
          if(prior.schema!=='ar-create.first-draft-decision.v1'||prior.requestId!==requestId||Object.keys(binding).some(key=>prior.binding?.[key]!==binding[key]))throw new StateError('This first draft already has a different acceptance receipt.',409);
          return {state:structuredClone(state),receipt:prior,alreadyDecided:true};
        }
        expected(incoming);
        const prepared=await prepare({state:structuredClone(state),readArticle:()=>articles.readArticle(state.project)});
        if(prepared.next.project.id!==state.project.id||prepared.next.project.document?.id!==state.project.document?.id)throw new StateError('First-draft acceptance cannot change article identity.',409);
        const receipt={schema:'ar-create.first-draft-decision.v1',requestId,projectId:state.project.id,documentId:state.project.document.id,decision:'accepted',binding,decidedAt:timestamp(),committedRevision:prepared.next.revision};
        publicationAttempted=true;
        await commit(prepared.next,null,{expectedArticle:prepared.expectedArticle,decisionFile,receipt,finalCheck:prepared.finalCheck});
        return {state:structuredClone(state),receipt,alreadyDecided:false};
      }catch(error){error.outcome=publicationAttempted&&(existsSync(articles.journal)||(decisionFile&&existsSync(decisionFile)))?'unknown':'not-applied';throw error;}
    });},
    // The callback holds the SAME serialized boundary as ordinary saves. It must
    // use get() and the supplied readArticle, never await a nested store command.
    decideSharedArticle(input,prepare){return serialized(async()=>{
      let decisionFile,publicationAttempted=false;
      try {
      if(!articles)throw new StateError('Shared article persistence is not enabled.',409);
      const {requestId,decision,binding}=input;
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)||!['accepted','rejected'].includes(decision))throw new StateError('Invalid shared article decision.');
      shape(binding,['requestId','proposalHash','contextHash','writingIdentity'],'decision binding');
      if(binding.requestId!==requestId||['proposalHash','contextHash','writingIdentity'].some(key=>!/^[a-f0-9]{64}$/.test(binding[key])))throw new StateError('Decision requires the exact reviewed proposal and context hashes.');
      const directory=path.join(dataDir,'shared-article-requests',requestId);
      for(const dir of [path.dirname(directory),directory]){const stat=await lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Shared request must be an owned real directory.',403);}
      decisionFile=path.join(directory,'decision.json');await assertRegularOrMissing(decisionFile);
      let prior;try{prior=JSON.parse(await readFile(decisionFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      // Receipt FIRST: later writing, restored Versions or guidance changes may
      // never replay an already committed choice or make it look undecided.
      if(prior){
        if(prior.schema!=='ar-create.shared-article-decision.v1'||prior.requestId!==requestId||prior.decision!==decision||Object.keys(binding).some(key=>prior.binding?.[key]!==binding[key]))throw new StateError('This request already has a different terminal decision or review identity.',409);
        return {state:structuredClone(state),receipt:prior,alreadyDecided:true};
      }
      const prepared=await prepare({state:structuredClone(state),readArticle:options=>articles.readArticle(state.project,options)});
      const next=prepared.next||state;
      const receipt={schema:'ar-create.shared-article-decision.v1',requestId,projectId:prepared.projectId,documentId:prepared.documentId,decision,binding:structuredClone(binding),proposalHash:binding.proposalHash,contextHash:binding.contextHash,writingIdentity:binding.writingIdentity,decidedAt:timestamp(),committedRevision:next.revision,safetyVersionId:prepared.safetyVersionId||null,...(prepared.externalHash?{externalHash:prepared.externalHash}:{})};
      publicationAttempted=true;
      if(prepared.next)await commit(prepared.next,null,{expectedArticle:prepared.expectedArticle,decisionFile,receipt,finalCheck:prepared.finalCheck});
      else {
        const files=[[decisionFile,JSON.stringify(receipt)]];await prepared.finalCheck?.();
        try{await articles.publish(files,{expectedFiles:new Map([[decisionFile,null]])});}catch(error){needsRecovery=existsSync(articles.journal);if(needsRecovery)recoveryFiles=files;throw error;}
      }
      return {state:structuredClone(state),receipt,alreadyDecided:false};
      }catch(error){error.outcome=publicationAttempted&&(existsSync(articles.journal)||(decisionFile&&existsSync(decisionFile)))?'unknown':'not-applied';throw error;}
    });},
    decideSharedCarousel(input,prepare){return serialized(async()=>{
      let decisionFile,publicationAttempted=false;
      try {
      if(!articles)throw new StateError('Shared article persistence is not enabled.',409);
      const {requestId,decision,binding}=input;
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId)||!['accepted','rejected'].includes(decision))throw new StateError('Invalid shared carousel decision.');
      shape(binding,['requestId','proposalHash','reviewHash','contextHash','wordsIdentity'],'decision binding');
      if(binding.requestId!==requestId||['proposalHash','reviewHash','contextHash','wordsIdentity'].some(key=>!/^[a-f0-9]{64}$/.test(binding[key])))throw new StateError('Decision requires the exact reviewed proposal and context hashes.');
      const directory=path.join(dataDir,'shared-carousel-requests',requestId);
      for(const dir of [path.dirname(directory),directory]){const stat=await lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new StateError('Shared request must be an owned real directory.',403);}
      decisionFile=path.join(directory,'decision.json');await assertRegularOrMissing(decisionFile);
      let prior;try{prior=JSON.parse(await readFile(decisionFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
      // Receipt FIRST: later writing, restored Versions or guidance changes may
      // never replay an already committed choice or make it look undecided.
      if(prior){
        if(prior.schema!=='ar-create.shared-carousel-decision.v1'||prior.requestId!==requestId||prior.decision!==decision||Object.keys(binding).some(key=>prior.binding?.[key]!==binding[key]))throw new StateError('This request already has a different terminal decision or review identity.',409);
        return {state:structuredClone(state),receipt:prior,alreadyDecided:true};
      }
      const prepared=await prepare({state:structuredClone(state),readArticle:options=>articles.readArticle(state.project,options),readCarouselWords:options=>articles.readCarouselWords(state.project,options)});
      const next=prepared.next||state;
      if(prepared.projectId!==state.project.id||prepared.documentId!==state.project.document?.id)throw new StateError('Carousel decision belongs to another active document.',409);
      if(prepared.next&&(next.project.id!==state.project.id||next.project.document?.id!==state.project.document?.id))throw new StateError('Carousel decision cannot change piece identity.',409);
      const receipt={schema:'ar-create.shared-carousel-decision.v1',requestId,projectId:prepared.projectId,documentId:prepared.documentId,outputId:prepared.outputId,decision,binding:structuredClone(binding),proposalHash:binding.proposalHash,contextHash:binding.contextHash,wordsIdentity:binding.wordsIdentity,reviewHash:binding.reviewHash,decidedAt:timestamp(),committedRevision:next.revision,safetyVersionId:prepared.safetyVersionId||null,...(prepared.externalMissing!==undefined?{externalHash:prepared.externalHash??null,externalMissing:prepared.externalMissing}:{})};
      publicationAttempted=true;
      if(prepared.next)await commit(prepared.next,null,{expectedArticle:prepared.expectedArticle,expectedCarousel:prepared.expectedCarousel,decisionFile,receipt,finalCheck:prepared.finalCheck});
      else {
        const files=[[decisionFile,JSON.stringify(receipt)]];await prepared.finalCheck?.();
        try{await articles.publish(files,{expectedFiles:new Map([[decisionFile,null]])});}catch(error){needsRecovery=existsSync(articles.journal);if(needsRecovery)recoveryFiles=files;throw error;}
      }
      return {state:structuredClone(state),receipt,alreadyDecided:false};
      }catch(error){error.outcome=publicationAttempted&&(existsSync(articles.journal)||(decisionFile&&existsSync(decisionFile)))?'unknown':'not-applied';throw error;}
    });},
    subscribeSaved(listener) { savedListeners.add(listener); return () => savedListeners.delete(listener); },
    get() { if(closed||needsRecovery||(articles&&existsSync(articles.journal)))throw new StateError('Article publication requires an awaited read to recover before reading.',409);return structuredClone(state); },
    put(candidate,options={}) {
      // Capture the caller's value immediately; serializing saves prevents two
      // simultaneous writes from passing the same revision check.
      const incoming = structuredClone(candidate),expectedArticle=structuredClone(options.expectedArticle);
      return serialized(async () => {
        validateState(incoming);
        if (incoming.revision !== state.revision) throw new StateError('State changed since this page loaded. Reload the latest state before saving.', 409);
        if (incoming.project.id !== state.project.id) throw new StateError('project.id cannot change.');
        const next = { ...incoming, revision: state.revision + 1 };
        validateState(next);
        return commit(next,null,{expectedArticle});
      });
    },
    listPieces(options={}){
      if(!options||Array.isArray(options)||Object.keys(options).some(k=>k!=='readOnly')||options.readOnly!==undefined&&typeof options.readOnly!=='boolean')throw new StateError('Choose a supported piece catalog read.');
      const queue=options.readOnly?fn=>{const operation=pending.then(async()=>{if(closed||needsRecovery||articles&&existsSync(articles.journal))throw new StateError('Piece publication requires explicit owner recovery before a read-only catalog.',409);if(articles?!(await readFile(file)).equals(knownStateBytes):JSON.stringify(JSON.parse(await readFile(file,'utf8')))!==JSON.stringify(state))throw new StateError('State changed outside its cooperating store owner.',409);return fn();});pending=operation.catch(()=>{});return operation;}:serialized;
      return queue(async()=>{
      if(options.readOnly)await checkPiecesDirectory();else await initializePieces();const pieces=[],activeFilename=path.basename(pieceFile(state.project.id));
      for(const filename of await readdir(piecesDir)){if(!/^[a-f0-9]{64}\.json$/.test(filename)||filename===activeFilename)continue;const record=await readPiece(undefined,path.join(piecesDir,filename));pieces.push(summary(record.project,record,false));}
      pieces.push(summary(state.project,await activeMeta(),true));pieces.sort((left,right)=>Number(right.active)-Number(left.active)||right.updatedAt.localeCompare(left.updatedAt)||left.title.localeCompare(right.title));return {pieces};
    });},
    createPiece(candidate,options={}){const incoming=structuredClone(candidate),assignedId=options.projectId;return serialized(async()=>{
      if(assignedId!==undefined){if(typeof assignedId!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(assignedId))throw new StateError('Invalid owned piece identity.');if(assignedId===state.project.id)throw new StateError('Piece identity already exists.',409);await initializePieces();if(await lstat(pieceFile(assignedId)).catch(e=>{if(e.code==='ENOENT')return null;throw e;}))throw new StateError('Piece identity already exists.',409);}
      shape(incoming,['expectedProjectId','expectedRevision'],'createPiece',['project','title']);expected(incoming);
      if(incoming.title!==undefined)text(incoming.title,'title',256);
      let project;if(incoming.project!==undefined){validateState({revision:0,project:incoming.project});project=structuredClone(incoming.project);if(project.document?.writingTemplate)throw new StateError('A new piece needs its own writing template copy. Detach the inherited template before creating it.');}else project=createInitialState().project;
      project.id=assignedId||randomUUID();if(incoming.title!==undefined)project.title=incoming.title;
      project.versions=[];project.document ||= {schema:'ar-create.document.v1',id:randomUUID(),revision:0,title:project.title,paragraphs:[],outputs:[]};
      project.document.id=randomUUID();project.document.outputs=[];if(incoming.title!==undefined)project.document.title=incoming.title;
      const next={revision:state.revision+1,project},metadata={createdAt:timestamp(),updatedAt:timestamp()};validateState(next);envelope(project,metadata);
      await initializePieces();await assertRegularOrMissing(file);await assertRegularOrMissing(backup);
      if(articles)return commit(next,metadata,{pieceProjects:[{project:state.project,metadata:await activeMeta()}]});
      await writePiece(state.project,await activeMeta());await writePiece(project,metadata,{exclusive:true});return commit(next,metadata);
    });},
    switchPiece(candidate){const incoming=structuredClone(candidate);return serialized(async()=>{
      shape(incoming,['expectedProjectId','expectedRevision','projectId'],'switchPiece');expected(incoming);id(incoming.projectId,'projectId');
      if(incoming.projectId===state.project.id)return structuredClone(state);
      await checkPiecesDirectory();const target=await readPiece(incoming.projectId),next={revision:state.revision+1,project:structuredClone(target.project)};validateState(next);
      await initializePieces();await assertRegularOrMissing(file);await assertRegularOrMissing(backup);if(articles){await articles.checkArticle(target.project);return commit(next,{createdAt:target.createdAt,updatedAt:target.updatedAt},{pieceProjects:[{project:state.project,metadata:await activeMeta()}]});}await writePiece(state.project,await activeMeta());return commit(next,{createdAt:target.createdAt,updatedAt:target.updatedAt});
    });},
  };
}
