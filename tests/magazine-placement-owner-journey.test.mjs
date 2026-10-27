// Invented files only: the maintained parser plans, and the existing Magazine
// HTTP owner alone prepares, saves and exactly undoes the same registered DEV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import {readMagazinePhotoOriginHeader} from '../runtime/services/magazine-library-photos.mjs';
import {projectMagazineMediaUsage} from '../runtime/services/magazine-media-usage.mjs';
import {createMagazinePortfolio} from '../runtime/services/magazine-portfolio.mjs';
import {createExistingWorkReader} from '../runtime/services/review-existing-work.mjs';
import {apply as register} from '../tools/magazine/register.mjs';
import {treeHashes} from './helpers/magazine-fixture.mjs';

const repo = path.resolve(import.meta.dirname, '..');
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const selection = {storyId:'mag-clay-teacher', pieceId:'mag-clay-teacher:article', edition:'working'};
const sha = value => createHash('sha256').update(value).digest('hex');
const require = createRequire(new URL('../runtime/package.json', import.meta.url));
const parserCode = fs.readFileSync(new URL('../runtime/src/donors/mag/mag-send.ts', import.meta.url), 'utf8');
const specCode = fs.readFileSync(new URL('../runtime/src/donors/mag/spec.ts', import.meta.url), 'utf8');
const compiled = await require('esbuild').transform(parserCode, {loader:'ts', format:'esm'});
const parser = await import('data:text/javascript;base64,' + Buffer.from(compiled.code).toString('base64'));
const original = [
  '---', 'type: DEV', 'story: Clay Teacher', 'title: Invented placement journey',
  'published: https://www.teajia.com/read/synthetic', '---', '',
  'Invented retained reader metadata.', '', '---', '',
  '%%photo: same.png · Invented cover · cover%%', '',
  'Invented opening 瓷 😀.', '',
  '%%photo: same.png · Invented wide · wide x=0.2 y=0.8%%', '',
  'Invented words between photographs.', '',
  '%%photo: replacement.png · Invented replacement description · bleed x=0.1 y=0.9%%', '',
  '%%photos: same.png · First group member | same.png · Second group member · aspect=4/5%%', '',
  'Invented words after the group.', '', '%%ending%%', '', '%%saying%%', '> "An invented closing saying."', '', 'Invented closing words.', '', '---', '', 'Invented retained author notes.', ''
].join('\r\n');

// Keeping the helper in its own process lets this test terminate the actual
// owner, then open a fresh owner over the same fixture and persisted receipts.
const ownerCode = `
import {magazineServer} from './tests/helpers/magazine-server.mjs';
import {createServer} from './runtime/server.mjs';
import path from 'node:path';
const prior = JSON.parse(process.env.AR_SYNTHETIC_OWNER || 'null');
let server, fixture, url;
if (!prior) {
  const s = await magazineServer({after(){}}, {fixture:JSON.parse(process.env.AR_SYNTHETIC_OPTIONS)});
  fixture = Object.fromEntries(['dir','vault','files','data','drops'].map(k=>[k,s.f[k]]));
  url = s.url;
} else {
  fixture = prior;
  server = await createServer({dataDir:fixture.data,publicDir:path.resolve('public'),connections:[],magazineRoots:[],researchEnabled:false,magazineVault:{vaultRoot:fixture.vault,filesRoot:fixture.files,drops:fixture.drops,writable:true,machine:'synthetic-placement-owner',exportStaging:path.join(fixture.dir,'staging'),magSendRepo:path.join(fixture.dir,'publication')}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  url = 'http://127.0.0.1:'+server.address().port;
}
process.send({fixture,url,pid:process.pid});
`;

async function startOwner(fixture,{initialDraft=null,endingPhotos=false,coverOpenerPhotos=false,sidePhotos=false,nestedPhotos=false,composedPhotos=false}={}) {
  const options = {extra:{
    [DEV]:initialDraft?initialDraft:composedPhotos?original.replace('Invented opening 瓷 😀.', 'Invented opening 瓷 😀.\r\n\r\n%%glyph: 缘%%\r\n\r\n%%side: same.png · Invented nested side · flip%%\r\n\r\nExact nested side words.\r\n\r\n%%/side%%\r\n\r\n%%on-photo: same.png · Invented on-photo · aspect=4/5 ink=#fff accent=#000%% \t\r\n> “Exact _protected quote_ **marks** 瓷.” \t\r\n\r\n%%/glyph%%').replace('%%saying%%\r\n> "An invented closing saying."','%%saying: replacement.png · Invented saying caption · aspect=4/5%%\t \r\n> "An invented closing saying." \t'):nestedPhotos?original.replace('Invented opening 瓷 😀.', 'Invented opening 瓷 😀.\r\n\r\n%%side: same.png · Invented outer side%%\r\n\r\nInvented container words.\r\n\r\n%%glyph: 瓷%%\r\n\r\n%%photo: same.png · Invented nested wide · wide%%\r\n\r\n%%photos: same.png · Invented nested first | replacement.png · Invented nested second · aspect=4/5%%\r\n\r\n%%/glyph%%\r\n\r\n%%/side%%'):sidePhotos?original.replace('Invented opening 瓷 😀.', 'Invented opening 瓷 😀.\r\n\r\n%%side: same.png · Invented side · flip bleed%%\r\n\r\nInvented adjacent side words.\r\n\r\n%%/side%%'):coverOpenerPhotos?original.replace('Invented opening 瓷 😀.', 'Invented opening 瓷 😀.\r\n\r\n## Invented opener part\r\n\r\n%%photo: same.png · Invented opener · opener%%\r\n\r\nInvented opener words.'):endingPhotos?original.replace('%%saying%%',[ '%%photo: same.png · Closing wide · wide x=0.3%%', '', '%%photo: replacement.png · Closing bleed · bleed%%', '', '%%photos: same.png · Closing group first | replacement.png · Closing group second · aspect=4/5%%', '', '%%saying%%' ].join('\r\n')):original,
    '_archive/DEV - Clay Teacher (earlier).md':'---\ntype: DEV\nstory: Clay Teacher\n---\n\nInvented earlier published words.\n',
    'Workflow/3-Develop/DEV - River Potter (story).md':'---\ntype: DEV\nstory: River Potter\n---\n\nInvented independent sibling words.\n'
  }};
  const child = spawn(process.execPath, ['--input-type=module','--eval',ownerCode], {
    cwd:repo, env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
      AR_SYNTHETIC_OWNER:JSON.stringify(fixture || null), AR_SYNTHETIC_OPTIONS:JSON.stringify(options)},
    stdio:['ignore','ignore','pipe','ipc']
  });
  let log = '';
  child.stderr.on('data', chunk => { log = (log + chunk).slice(-6000); });
  const ready = await new Promise((resolve,reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Synthetic owner startup timed out: ' + log)); },15000);
    child.once('message', value => { clearTimeout(timeout); resolve(value); });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(Error('Synthetic owner exited ' + code + ': ' + log)); });
  });
  return {...ready, child};
}
async function stopOwner(owner) {
  if (owner.child.exitCode !== null || owner.child.signalCode !== null) return;
  const stopped = once(owner.child, 'exit');
  owner.child.kill('SIGTERM');
  await stopped;
}
async function fixture(t,options) {
  let owner = await startOwner(undefined,options);
  const f = owner.fixture;
  t.after(async () => { await stopOwner(owner); fs.rmSync(f.dir,{recursive:true,force:true}); });
  const registration = await register({mag:f.vault,files:f.files,data:f.data,verification:path.join(f.dir,'verification')});
  assert.equal(registration.applied,true); assert.equal(registration.identical,true);
  const publication = path.join(f.dir,'publication');
  const conversation = path.join(publication,'src/pages/read/conversation');
  fs.mkdirSync(path.join(conversation,'pieces'),{recursive:true});
  fs.writeFileSync(path.join(conversation,'magSend.ts'),parserCode);
  fs.writeFileSync(path.join(conversation,'spec.ts'),specCode);
  fs.writeFileSync(path.join(conversation,'pieces/index.ts'),"export const CONVERSATIONS=[{path:'/read/synthetic',slug:'synthetic',images:'/read/synthetic/',title:['Invented placement journey'],credit:[],opening:[],parts:[],ending:{blocks:[]}}];");
  fs.mkdirSync(path.join(publication,'public/read/synthetic'),{recursive:true});
  fs.writeFileSync(path.join(publication,'public/read/synthetic/same.png'),Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));
  fs.writeFileSync(path.join(publication,'public/read/synthetic/replacement.png'),Buffer.from([137,80,78,71,13,10,26,10,4,5,6]));
  fs.writeFileSync(path.join(publication,'published.html'),'<article>Invented immutable published edition.</article>\n');
  const get = async (route, input={}, headers={}) => {
    const url=new URL(route,owner.url);for(const [key,value] of Object.entries(input))url.searchParams.set(key,value);
    const response = await fetch(url,{headers});
    const body = await response.json();
    if (!response.ok) throw Object.assign(Error(body.error),{status:response.status});
    return body;
  };
  const post = async (action, input) => {
    const response = await fetch(owner.url + '/api/magazine/working-draft/' + action, {
      method:'POST', headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian','X-AR-Client':'mag-page'}, body:JSON.stringify(input)
    });
    return {status:response.status,body:await response.json()};
  };
  const roots = [{id:'invented-placement-magazine',path:f.vault}];
  const portfolio = createMagazinePortfolio({roots});
  const story = (await portfolio.list()).stories.find(s=>s.artifacts.some(a=>a.relativePath===DEV && !a.archived));
  assert.ok(story);
  const reader = createExistingWorkReader({roots,portfolio,projectLinks:{[story.id]:{nativeProjectId:'invented-native-project'}},readAuthority:get});
  let resolveCount = 0;
  const resolveWorking = async ({storyId,pieceId,expectedHash}) => {
    resolveCount++;
    const catalog = await reader.catalog();
    const claims = catalog.stories.flatMap(s=>s.artifacts.filter(a=>a.magazineWorkingTarget?.storyId===storyId && a.magazineWorkingTarget?.pieceId===pieceId).map(a=>({artifact:a,target:a.magazineWorkingTarget})));
    if (claims.length!==1 || claims[0].artifact.hash!==expectedHash || claims[0].target.hash!==expectedHash) throw Object.assign(Error('Exact registered working target changed.'),{status:409});
    const [registered, value] = await Promise.all([get('/api/magazine/working-draft/catalog'),get('/api/magazine/working-draft/read',{storyId,pieceId,edition:'working'})]);
    const {artifact,target} = claims[0];
    assert.deepEqual(registered.rootIdentity,catalog.magazineWorkingLinks.rootIdentity);
    assert.equal(registered.rootIdentity.fingerprint,sha(fs.realpathSync(f.vault)));
    assert.equal(registered.stories.flatMap(s=>s.pieces).filter(p=>p.relativePath===artifact.relativePath && p.pieceId===pieceId && p.hash===expectedHash).length,1);
    if (value.document.hash!==expectedHash || value.document.path!==artifact.relativePath || value.authority.storyId!==storyId || value.authority.pieceId!==pieceId) throw Object.assign(Error('Exact owner read changed.'),{status:409});
    return {document:value.document,authority:value.authority,projection:value.projection,supportedNativeOperations:value.supportedNativeOperations,target,rootIdentity:registered.rootIdentity};
  };
  const libraryPhotoRead=async(route,input)=>{const response=await fetch(new URL(route+'?'+new URLSearchParams(input),owner.url));if(!response.ok)throw Object.assign(Error((await response.json()).error),{status:response.status});const body=Buffer.from(await response.arrayBuffer()),hash=response.headers.get('x-content-sha256'),origin=readMagazinePhotoOriginHeader(response.headers.get('x-ar-photo-origin'),hash);return {body,hash,contentType:response.headers.get('content-type'),rootId:response.headers.get('x-ar-photo-root-id'),sourceId:response.headers.get('x-ar-photo-source-id'),...(origin?{originRef:(origin.kind==='publication'?{kind:'publication',rootId:origin.rootId,relativePath:origin.relativePath}:{kind:origin.kind||'library',rootId:origin.rootId,sourceId:origin.sourceId})}:{})};};
  const media = createMagazineMediaInspection({repoRoot:publication,resolveWorking,libraryPhotos:{preview:input=>libraryPhotoRead('/api/magazine/library-photos/preview',input),resolve:input=>libraryPhotoRead('/api/magazine/library-photos/asset',input)},originTrace:{parserHash:sha(parserCode),specHash:sha(specCode),loadParser:async()=>parser}});
  const read = () => get('/api/magazine/working-draft/read',selection);
  const inspect = async () => { const current=await read();return media.inspect({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash}); };
  const moveRequest = inspection => {
    const all=inspection.sources.flatMap(s=>s.placements),photo=alt=>all.find(p=>p.alt===alt);
    assert.equal(inspection.originTrace.status,'ready');
    return {storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:inspection.ownerRef.hash,revision:inspection.revision,placementId:photo('First group member').placementId,beforeId:photo('Invented wide').nativeOrigin.blockId};
  };
  return {f,publication,media,get,post,read,inspect,moveRequest,async verifyPhoto(asset){const response=await fetch(owner.url+'/api/magazine/library-photos/preview?'+new URLSearchParams({rootId:asset.rootId,sourceId:asset.sourceId,revision:asset.revision,verify:'1'}));assert.equal(response.status,200);return {hash:response.headers.get('x-content-sha256'),revision:response.headers.get('x-ar-photo-revision'),body:Buffer.from(await response.arrayBuffer())};},async libraryUsage(){const catalog=await get('/api/magazine/library-photos'),inspection=await inspect();return {catalog,media:inspection,usage:projectMagazineMediaUsage({catalog,inspection,expectedOwnerRef:inspection.ownerRef,expectedCatalogRevision:catalog.revision})};},async readExport(url){const response=await fetch(new URL(url,owner.url));assert.equal(response.status,200);return response.text();},async importPhoto(bytes,name='unused-indexed.png'){const response=await fetch(owner.url+'/api/sources/import',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian','X-AR-Client':'mag-page'},body:JSON.stringify({rootId:'library',files:[{name,base64:bytes.toString('base64')}]})});assert.equal(response.status,200);return response.json();},get resolveCount(){return resolveCount;},
    async restart(){const previous=owner.pid;await stopOwner(owner);owner=await startOwner(f);assert.notEqual(owner.pid,previous);return {previous,current:owner.pid};}};
}

function onlyDraftChanged(before,after) {
  const differences = [...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>before[key]!==after[key]);
  assert.deepEqual(differences,[DEV]);
}

test('S08/S09: a real owner prepares the exact planned photo move, saves the same DEV, restarts and exactly undoes it',async t=>{
  const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication);
  const first=await h.read(),inspection=await h.inspect(),request=h.moveRequest(inspection),count=h.resolveCount;
  const plan=await h.media.planMove(request);
  assert.ok(h.resolveCount>count,'planning resolves the current registered owner afresh');
  assert.equal(plan.schema,'ar-create.magazine-placement-plan.v1');
  assert.deepEqual(plan.ownerRef,inspection.ownerRef); assert.equal(plan.expectedHash,first.document.hash);
  assert.equal(plan.placementIds.length,2,'both repeated-photo group members share one native move');
  assert.equal(plan.operations.length,1); assert.equal(plan.operations[0].kind,'move');
  assert.ok(!JSON.stringify(plan).includes('%%photos:')); assert.ok(!JSON.stringify(plan).includes(h.f.dir));
  assert.equal(Object.hasOwn(plan,'content'),false); assert.equal(Object.hasOwn(plan,'raw'),false);
  assert.deepEqual(treeHashes(h.f.vault),beforeVault,'inspection and planning never write');
  const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});
  assert.equal(prepared.status,200,JSON.stringify(prepared.body));
  assert.equal(sha(prepared.body.content),plan.expectedContentHash,'maintained native preparation matches the reviewed candidate hash');
  assert.equal(prepared.body.expectedHash,plan.expectedHash);
  assert.ok(prepared.body.content.indexOf('%%photos:')<prepared.body.content.indexOf('%%photo: same.png · Invented wide'));
  assert.match(prepared.body.content,/Invented opening 瓷 😀/);
  assert.ok(prepared.body.content.startsWith(original.slice(0,original.indexOf('%%photo:'))));
  assert.ok(prepared.body.content.endsWith('---\r\n\r\nInvented retained author notes.\r\n'));
  assert.deepEqual(treeHashes(h.f.vault),beforeVault,'prepare is read-only');
  const operationId=randomUUID(),saved=await h.post('save',{...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId});
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  const disk=fs.readFileSync(path.join(h.f.vault,DEV),'utf8');
  assert.equal(disk,prepared.body.content); assert.equal(sha(disk),plan.expectedContentHash);
  onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
  const sameDEV=await h.read();assert.deepEqual(sameDEV.authority,first.authority);assert.equal(sameDEV.document.path,DEV);assert.equal(sameDEV.document.text,disk);
  assert.equal(sameDEV.history.find(r=>r.operationId===operationId)?.actor,'human:adrian');
  const afterInspection=await h.inspect();assert.notEqual(afterInspection.revision,inspection.revision);
  assert.notEqual(afterInspection.sources[0].placements.find(p=>p.alt==='First group member').nativeOrigin.blockId,plan.operations[0].id,'fresh reads expose the new revision-scoped native block IDs');
  const restart=await h.restart(),reopened=await h.read();
  assert.equal(reopened.document.text,disk);assert.equal(reopened.document.hash,plan.expectedContentHash);
  assert.equal(reopened.history.find(r=>r.operationId===operationId)?.canUndo,true,'saved exact Undo eligibility survives owner process restart');
  const undo=await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()});
  assert.equal(undo.status,200,JSON.stringify(undo.body));
  assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(original),'exact Undo restores frontmatter, notes, words and CRLF bytes');
  assert.equal((await h.read()).document.text,original);
  assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
  assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
  t.diagnostic(JSON.stringify({inventedOnly:true,sameDEV:true,expectedCandidateHash:true,ownerRestart:restart,exactEligibleUndo:true,sourcePhotosPublishedAndSiblingPreserved:true}));
});

test('S08/S09: changed owner bytes refuse old plans and stale prepare/save without changing any current file',async t=>{
  const h=await fixture(t),inspection=await h.inspect(),request=h.moveRequest(inspection),plan=await h.media.planMove(request);
  const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200);
  const publicationBefore=treeHashes(h.publication),photosBefore=treeHashes(h.f.files);
  fs.appendFileSync(path.join(h.f.vault,DEV),'\r\nInvented external words must remain.\r\n');
  const current=treeHashes(h.f.vault),dataBefore=treeHashes(h.f.data);
  await assert.rejects(h.media.planMove(request),e=>e.status===409);
  const fresh=await h.read();await assert.rejects(h.media.planMove({...request,expectedHash:fresh.document.hash}),e=>e.status===409,'old placement revision cannot be relabelled with the new file hash');
  assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);
  assert.equal((await h.post('save',{...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId:randomUUID()})).status,409);
  assert.deepEqual(treeHashes(h.f.vault),current);assert.deepEqual(treeHashes(h.f.files),photosBefore);assert.deepEqual(treeHashes(h.publication),publicationBefore);
  // A refused writer may journal its failure, but it cannot create a native copy
  // or alter registration; the maintained owner still exposes the external bytes.
  for(const [relative,hash] of Object.entries(dataBefore).filter(([relative])=>relative.startsWith('magazine/')))assert.equal(treeHashes(h.f.data)[relative],hash);
  assert.equal((await h.read()).document.hash,fresh.document.hash);
  assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
});

test('S08/S09: focal change uses the same real DEV owner, persists through restart, retries one operation and exactly undoes',async t=>{
 const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide');
 assert.ok(first.supportedNativeOperations.includes('photoFocus'));
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:photo.placementId,x:.7,y:.3},plan=await h.media.planFocus(request);
 assert.equal(plan.operations[0].kind,'photoFocus');assert.deepEqual(plan.placementIds,[photo.placementId]);assert.equal(Object.hasOwn(plan,'content'),false);assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);
 const expected=original.replace('Invented wide · wide x=0.2 y=0.8','Invented wide · wide x=0.7 y=0.3');assert.equal(prepared.body.content,expected);assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId},saved=await h.post('save',payload);assert.equal(saved.status,200,JSON.stringify(saved.body));onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const committed=await h.read();assert.equal(committed.history.find(r=>r.operationId===operationId)?.canUndo,true,'the owner exposes its persisted eligible receipt before restart');
 const restart=await h.restart(),replayed=await h.post('save',payload);assert.equal(replayed.status,200,JSON.stringify(replayed.body));const reopened=await h.read();assert.equal(reopened.document.text,expected);assert.equal(reopened.history.filter(r=>r.operationId===operationId).length,1);assert.equal(reopened.history.find(r=>r.operationId===operationId).canUndo,true);
 const fresh=await h.inspect(),afterPhoto=fresh.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide');assert.equal(afterPhoto.crop.x,.7);assert.equal(afterPhoto.crop.y,.3);assert.notEqual(fresh.revision,inspection.revision);
 for(const p of inspection.sources.flatMap(s=>s.placements).filter(p=>p.placementId!==photo.placementId)){const after=fresh.sources.flatMap(s=>s.placements).find(n=>n.alt===p.alt);assert.equal(after.alt,p.alt);assert.deepEqual(after.crop,p.crop);}
 await assert.rejects(h.media.planFocus(request),e=>e.status===409);
 const undone=await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()});assert.equal(undone.status,200,JSON.stringify(undone.body));assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(original));assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
 t.diagnostic(JSON.stringify({inventedOnly:true,sameDEV:true,focalChangedOnlyOneOccurrence:true,ownerRestart:restart,sameOperationIdReplay:true,exactUndo:true,sourceAndPublishedBytesPreserved:true}));
});

test('S09/C01/C04: photo aspect saves through the real owner, survives process restart and operation replay, and restores exact Undo',async t=>{
 const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect();
 const placements=inspection.sources.flatMap(s=>s.placements),photo=placements.find(p=>p.alt==='Invented wide');
 assert.ok(first.supportedNativeOperations.includes('photoAspect'));
 assert.equal(photo.crop?.aspect??'4/3','4/3');assert.equal(photo.crop.x,.2);assert.equal(photo.crop.y,.8);
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:photo.placementId,aspect:'1/1'},count=h.resolveCount,plan=await h.media.planAspect(request);
 assert.ok(h.resolveCount>count,'shape planning resolves the current registered owner');
 assert.equal(plan.schema,'ar-create.magazine-placement-plan.v1');assert.deepEqual(plan.ownerRef,inspection.ownerRef);assert.equal(plan.expectedHash,first.document.hash);
 assert.deepEqual(plan.operations,[{kind:'photoAspect',id:photo.nativeOrigin.blockId,seenBlockHash:photo.nativeOrigin.blockHash,aspect:'1/1'}]);assert.deepEqual(plan.placementIds,[photo.placementId]);assert.equal(Object.hasOwn(plan,'content'),false);
 assert.deepEqual(treeHashes(h.f.vault),beforeVault,'shape inspection and planning are read-only');
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);
 const expected=original.replace('Invented wide · wide x=0.2 y=0.8%%','Invented wide · wide x=0.2 y=0.8 aspect=1/1%%');assert.equal(prepared.body.content,expected);assert.deepEqual(treeHashes(h.f.vault),beforeVault,'shape preparation does not save');
 const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId},saved=await h.post('save',payload);assert.equal(saved.status,200,JSON.stringify(saved.body));
 // Restart immediately after the save response; recovery must use persisted
 // owner receipts without a confirming read from the process that saved it.
 const restart=await h.restart(),replayed=await h.post('save',payload);assert.equal(replayed.status,200,JSON.stringify(replayed.body));
 const reopened=await h.read();assert.deepEqual(reopened.authority,first.authority);assert.equal(reopened.document.path,DEV);assert.equal(reopened.document.text,expected);assert.equal(reopened.document.hash,plan.expectedContentHash);
 assert.equal(reopened.history.filter(r=>r.operationId===operationId).length,1);assert.equal(reopened.history.find(r=>r.operationId===operationId)?.canUndo,true);assert.equal(reopened.history.find(r=>r.operationId===operationId)?.actor,'human:adrian');
 assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(expected));onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const fresh=await h.inspect(),afterPlacements=fresh.sources.flatMap(s=>s.placements),afterPhoto=afterPlacements.find(p=>p.alt==='Invented wide');assert.notEqual(fresh.revision,inspection.revision);assert.deepEqual(afterPhoto.crop,{...photo.crop,aspect:'1/1'});
 assert.deepEqual(afterPlacements.map(p=>[p.structuralPath,p.alt,p.slot,p.sourceRef]),placements.map(p=>[p.structuralPath,p.alt,p.slot,p.sourceRef]),'all existing photo occurrences keep their order, caption, identity and source');
 for(const p of placements.filter(p=>p.placementId!==photo.placementId))assert.deepEqual(afterPlacements.find(n=>n.structuralPath===p.structuralPath).crop,p.crop,'other photograph crops stay exact');
 const expectedStory=parser.parseDraft(parser.draftBody(original).body);expectedStory.opening.find(b=>b.shot?.alt==='Invented wide').aspect='1/1';assert.deepEqual(parser.parseDraft(parser.draftBody(reopened.document.text).body),expectedStory,'only the selected aspect changes in the maintained parser');
 const currentVault=treeHashes(h.f.vault);await assert.rejects(h.media.planAspect(request),e=>e.status===409);await assert.rejects(h.media.planAspect({...request,expectedHash:reopened.document.hash}),e=>e.status===409,'an old occurrence revision cannot borrow the current hash');
 assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);assert.deepEqual(treeHashes(h.f.vault),currentVault,'refused stale plans preserve current bytes');
 assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
 const undone=await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()});assert.equal(undone.status,200,JSON.stringify(undone.body));assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(original),'Undo restores exact original words, metadata, notes and CRLF bytes');
 assert.equal((await h.read()).document.text,original);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
 t.diagnostic(JSON.stringify({inventedOnly:true,sameDEV:true,aspectChangedOnlyOneOccurrence:true,focalCoordinatesPreserved:true,ownerRestart:restart,sameOperationIdReplay:true,stalePlanRefused:true,exactUndo:true,sourcePhotosPublishedAndSiblingPreserved:true}));
});

test('committed owner receipts expose exact Undo after save response and immediate child restart without journal discovery',async t=>{
 const h=await fixture(t),first=await h.read(),row=first.projection.find(p=>p.raw==='Invented opening 瓷 😀.'),prepared=await h.post('prepare',{...selection,expectedHash:first.document.hash,operations:[{kind:'text',id:row.id,from:0,to:8,insert:'Changed',seenBlockHash:row.blockHash}]});
 assert.equal(prepared.status,200);const operationId=randomUUID(),saved=await h.post('save',{...selection,expectedHash:first.document.hash,content:prepared.body.content,operationId});assert.equal(saved.status,200);
 // No read-confirm, timer or receipt read before stopping the actual writer.
 const restart=await h.restart(),receiptPath=path.join(h.f.data,'magazine/operations',operationId+'.json'),receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
 assert.equal(receipt.state,'committed');assert.equal(sha(fs.readFileSync(path.join(h.f.vault,DEV))),sha(prepared.body.content));
 // Explicitly remove the invented secondary index to make the missing-journal
 // regression deterministic even if the old process won its shutdown race.
 fs.rmSync(path.join(h.f.data,'journal'),{recursive:true,force:true});
 const excluded=[];
 for(const override of [{scope:{kind:'story',id:'mag-river-potter'}},{result:{...receipt.result,path:'Workflow/3-Develop/DEV - River Potter (story).md'}},{state:'pending'}]){const id=randomUUID();excluded.push(id);fs.writeFileSync(path.join(h.f.data,'magazine/operations',id+'.json'),JSON.stringify({...receipt,...override,operationId:id}));}
 const reopened=await h.read(),history=reopened.history.find(r=>r.operationId===operationId);
 assert.ok(history,'a committed exact owner receipt is discoverable without an optional journal line');assert.equal(history.canUndo,true);assert.equal(history.actor,'human:adrian');assert.equal(history.beforeHash,first.document.hash);assert.equal(history.afterHash,sha(prepared.body.content));assert.ok(excluded.every(id=>!reopened.history.some(r=>r.operationId===id)),'other scope/path and pending receipts stay out of this history');
 const agent=await h.get('/api/magazine/working-draft/read',selection,{'X-AR-Actor':'agent:codex','X-AR-Client':'cli'});assert.equal(agent.history.find(r=>r.operationId===operationId).canUndo,false,'discovery does not grant an agent wording Undo');
 const newerId=randomUUID(),newerContent=prepared.body.content.replace('Changed opening','Newer opening'),newer=await h.post('save',{...selection,expectedHash:reopened.document.hash,content:newerContent,operationId:newerId});assert.equal(newer.status,200);
 const stale=await h.read();assert.equal(stale.history.find(r=>r.operationId===operationId).canUndo,false);assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,409);assert.equal(fs.readFileSync(path.join(h.f.vault,DEV),'utf8'),newerContent);
 assert.equal((await h.post('undo',{...selection,undoOperationId:newerId,operationId:randomUUID()})).status,200);assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.equal(fs.readFileSync(path.join(h.f.vault,DEV),'utf8'),original);
 const undone=await h.read();assert.equal(undone.history.find(r=>r.operationId===operationId).canUndo,false);assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,409);
 t.diagnostic(JSON.stringify({inventedOnly:true,saveResponseThenImmediateRestart:restart,durableReceiptWithoutJournal:true,scopedHistory:true,staleAndUndoneRefused:true,exactUndo:true}));
});


test('S09: replacing one photo uses exact current source file and description, persists through owner restart and exact Undo',async t=>{
 const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect();
 const all=inspection.sources.flatMap(s=>s.placements),target=all.find(p=>p.alt==='Invented wide'),source=all.find(p=>p.alt==='Invented replacement description'),asset=inspection.sources.find(s=>s.id===source.sourceRef.sourceId);
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:target.placementId,replacementPlacementId:source.placementId,sourceId:asset.id,sourceHash:asset.sourceRef.hash};
 assert.ok(first.supportedNativeOperations.includes('photoReplace'));
 const plan=await h.media.planReplace(request);assert.equal(plan.sourceId,asset.id);assert.equal(plan.sourceHash,asset.sourceRef.hash);assert.equal(plan.replacementPlacementId,source.placementId);
 assert.deepEqual(plan.operations,[{kind:'photoReplace',id:target.nativeOrigin.blockId,seenBlockHash:target.nativeOrigin.blockHash,replacementId:source.nativeOrigin.blockId,seenReplacementHash:source.nativeOrigin.blockHash}]);
 for(const mutate of [op=>op.file='/tmp/unrelated.png',op=>op.alt='forged description',op=>op.path='../replacement.png',op=>op.replacementId='magazine:foreign:1',op=>op.seenReplacementHash='0'.repeat(64)]){const op={...plan.operations[0]};mutate(op);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:[op]})).status,409);}
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);
 const expected=original.replace('same.png · Invented wide · wide x=0.2 y=0.8','replacement.png · Invented replacement description · wide x=0.2 y=0.8');assert.equal(prepared.body.content,expected);assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId};assert.equal((await h.post('save',payload)).status,200);const restart=await h.restart();assert.equal((await h.post('save',payload)).status,200);
 const reopened=await h.read();assert.equal(reopened.document.text,expected);assert.equal(reopened.history.find(r=>r.operationId===operationId)?.canUndo,true);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const fresh=await h.inspect(),changed=fresh.sources.flatMap(s=>s.placements).find(p=>p.structuralPath===target.structuralPath);assert.equal(changed.sourceRef.hash,source.sourceRef.hash);assert.equal(changed.alt,source.alt);assert.deepEqual(changed.crop,target.crop);
 await assert.rejects(h.media.planReplace(request),e=>e.status===409);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);
 assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(original));assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
 t.diagnostic(JSON.stringify({inventedOnly:true,photoAndDescriptionFromExactOwnedOccurrence:true,targetCropAndLayoutPreserved:true,ownerRestart:restart,exactUndo:true,originalAssetsAndPublicationPreserved:true}));
});


test('S08/S09 full library: an unused cross-story original saves into the same DEV, survives owner restart, renders/exports exact retained bytes and exactly undoes',async t=>{
 const h=await fixture(t);let count=0;const baseline=original.replaceAll('same.png',()=>`local-photo-${count++}.png`);fs.writeFileSync(path.join(h.f.vault,DEV),baseline);for(let i=0;i<count;i++)fs.copyFileSync(path.join(h.publication,'public/read/synthetic/same.png'),path.join(h.publication,`public/read/synthetic/local-photo-${i}.png`));
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=','base64'),foreign=path.join(h.f.files,'Another Story/Photos/unused-original.png');fs.mkdirSync(path.dirname(foreign),{recursive:true});fs.writeFileSync(foreign,bytes);await h.restart();
 const beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),target=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide');
 const catalog=await h.get('/api/magazine/library-photos'),asset=catalog.items.find(item=>item.relativePath==='Another Story/Photos/unused-original.png');assert.ok(asset,'the full server-owned union includes a different story’s unused original');assert.ok(!baseline.includes(asset.name));assert.equal(asset.sourceHash,null);const verified=await h.verifyPhoto(asset);assert.deepEqual(verified.body,bytes);Object.assign(asset,{sourceHash:verified.hash,revision:verified.revision});
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:target.placementId,assetRootId:asset.rootId,assetSourceId:asset.sourceId,assetRevision:asset.revision,assetHash:asset.sourceHash,description:''},plan=await h.media.planLibraryReplace(request);
 assert.equal(plan.operations[0].kind,'photoReplaceAsset');assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const libraryBytes=()=>fs.existsSync(path.join(h.f.data,'library-index.json'))?fs.readFileSync(path.join(h.f.data,'library-index.json'),'utf8'):null,libraryBefore=libraryBytes();
 for(const mutate of [op=>op.file='arbitrary.png',op=>op.path=foreign,op=>op.id='magazine:foreign:1',op=>op.seenBlockHash='0'.repeat(64),op=>op.rootId='0'.repeat(64)]){const op={...plan.operations[0]};mutate(op);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:[op]})).status,409);assert.equal(libraryBytes(),libraryBefore,'forged preparations never retain a photo');}
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);const token='library-photo-'+sha(bytes)+'.png',expected=baseline.replace(/local-photo-\d+\.png · Invented wide ·/,token+' ·  ·');assert.equal(prepared.body.content,expected);
 const afterRetain=fs.readFileSync(path.join(h.f.data,'library-index.json'),'utf8'),again=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(again.status,200);assert.equal(fs.readFileSync(path.join(h.f.data,'library-index.json'),'utf8'),afterRetain,'repeat prepare reuses the same owned original');
 const operationId=randomUUID(),payload={...selection,content:prepared.body.content,expectedHash:plan.expectedHash,operationId};assert.equal((await h.post('save',payload)).status,200);const restart=await h.restart();const reopened=await h.read();assert.equal(reopened.document.text,expected);assert.equal(reopened.history.find(r=>r.operationId===operationId)?.canUndo,true);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:reopened.document.hash}),retained=edition.media.sources.find(s=>s.name===token);assert.ok(retained);const preview=await h.media.preview({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:reopened.document.hash,sourceId:retained.id,sourceHash:retained.sourceRef.hash,revision:edition.revision});assert.deepEqual(preview.body,bytes);assert.equal(retained.placements[0].crop.x,.2);assert.equal(retained.placements[0].crop.y,.8);
 const built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
 const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8859',readAsset:async input=>{const url=new URL(input,'http://127.0.0.1:8859');if(url.pathname.endsWith('.css'))return new Response('.ar-output-reader{color:black}');const image=await h.media.preview(Object.fromEntries(url.searchParams));return new Response(image.body,{headers:{'Content-Type':image.contentType}});}});assert.ok(html.includes('data:image/png;base64,'+bytes.toString('base64')));assert.doesNotMatch(html,/src="\/api\//);
 await assert.rejects(h.media.planLibraryReplace(request));assert.equal((await h.post('save',{...payload,operationId:randomUUID()})).status,409);
 assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(baseline));assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
 t.diagnostic(JSON.stringify({inventedOnly:true,fullCatalogCrossStoryUnusedOriginal:true,noGETcopy:true,forgedPrepareNoCopy:true,privateLibraryImmutableRetention:true,repeatPrepareReuses:true,ownerRestart:restart,renderAndHtmlExactBytes:true,targetCropPreserved:true,exactUndo:true,originalAndPublicationBytesPreserved:true}));
});

test('S08/S09: description change uses the same real DEV owner, persists through restart, retries one operation and exactly undoes',async t=>{
 const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide');
 assert.ok(first.supportedNativeOperations.includes('photoDescription'));
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:photo.placementId,description:'Exact description 瓷 😀'},plan=await h.media.planDescription(request);
 assert.equal(plan.operations[0].kind,'photoDescription');assert.deepEqual(plan.placementIds,[photo.placementId]);assert.equal(Object.hasOwn(plan,'content'),false);assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);
 const expected=original.replace('Invented wide · wide x=0.2 y=0.8','Exact description 瓷 😀 · wide x=0.2 y=0.8');assert.equal(prepared.body.content,expected);assert.deepEqual(treeHashes(h.f.vault),beforeVault);
 const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId},saved=await h.post('save',payload);assert.equal(saved.status,200,JSON.stringify(saved.body));onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const committed=await h.read();assert.equal(committed.history.find(r=>r.operationId===operationId)?.canUndo,true,'the owner exposes its persisted eligible receipt before restart');
 const restart=await h.restart(),replayed=await h.post('save',payload);assert.equal(replayed.status,200,JSON.stringify(replayed.body));const reopened=await h.read();assert.equal(reopened.document.text,expected);assert.equal(reopened.history.filter(r=>r.operationId===operationId).length,1);assert.equal(reopened.history.find(r=>r.operationId===operationId).canUndo,true);
 const fresh=await h.inspect(),afterPhoto=fresh.sources.flatMap(s=>s.placements).find(p=>p.alt==='Exact description 瓷 😀');assert.equal(afterPhoto.crop.x,.2);assert.equal(afterPhoto.crop.y,.8);assert.notEqual(fresh.revision,inspection.revision);
 for(const p of inspection.sources.flatMap(s=>s.placements).filter(p=>p.placementId!==photo.placementId)){const after=fresh.sources.flatMap(s=>s.placements).find(n=>n.alt===p.alt);assert.equal(after.alt,p.alt);assert.deepEqual(after.crop,p.crop);}
 const edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:reopened.document.hash});assert.equal(edition.media.sources.flatMap(s=>s.placements).find(p=>p.structuralPath===photo.structuralPath).alt,'Exact description 瓷 😀');
 const built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
 const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8859',readAsset:async url=>String(url).endsWith('.css')?new Response('.ar-output-reader{color:#000}'):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}})});assert.match(html,/alt="Exact description 瓷 😀"/);assert.doesNotMatch(html,/<figcaption[^>]*>Exact description/);
 await assert.rejects(h.media.planDescription(request),e=>e.status===409);
 const undone=await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()});assert.equal(undone.status,200,JSON.stringify(undone.body));assert.deepEqual(fs.readFileSync(path.join(h.f.vault,DEV)),Buffer.from(original));assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
 t.diagnostic(JSON.stringify({inventedOnly:true,sameDEV:true,descriptionChangedOnlyOneOccurrence:true,ownerRestart:restart,sameOperationIdReplay:true,exactUndo:true,sourceAndPublishedBytesPreserved:true}));
});

test('S08/S09 unused indexed Library photo replaces an explicit current target through the real owner and exactly undoes after restart',async t=>{
 const h=await fixture(t),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=','base64'),imported=await h.importPhoto(bytes);assert.equal(imported.receipts[0].ok,true);const sourceId=imported.receipts[0].source.id,beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),target=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide'),catalog=await h.get('/api/magazine/library-photos'),asset=catalog.items.find(row=>row.sourceId===sourceId);assert.ok(asset);assert.equal(asset.originRef.kind,'library');assert.equal(inspection.sources.some(row=>row.sourceRef.sourceId===sourceId),false);
 const request={storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:target.placementId,assetRootId:asset.rootId,assetSourceId:asset.sourceId,assetRevision:asset.revision,assetHash:asset.sourceHash,description:'Chosen Library photo'},plan=await h.media.planLibraryReplace(request);assert.deepEqual(treeHashes(h.f.vault),beforeVault,'selection and planning never write');const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200);const operationId=randomUUID();assert.equal((await h.post('save',{...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId})).status,200);await h.restart();const reopened=await h.read();assert.equal(reopened.document.text,prepared.body.content);const fresh=await h.inspect(),changed=fresh.sources.flatMap(s=>s.placements).find(p=>p.alt==='Chosen Library photo');assert.deepEqual(changed.crop,target.crop);assert.equal(changed.sourceRef.hash,sha(bytes));await assert.rejects(h.media.planLibraryReplace(request),e=>e.status===409);assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
});

test('canonical caption and credits use existing HTTP prepare/save/receipts, actual owner restart, stale refusal and exact Undo',async t=>{
 const h=await fixture(t),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide');
 const plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation:{caption:'Invented vessel 瓷 😀 100%',credit:'Photo: Invented Maker'}});
 const prepare=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepare.status,200,JSON.stringify(prepare.body));assert.equal(sha(prepare.body.content),plan.expectedContentHash);
 const photoOperationId=randomUUID(),saved=await h.post('save',{...selection,content:prepare.body.content,expectedHash:plan.expectedHash,operationId:photoOperationId,reason:'Human invented caption and credit'});assert.equal(saved.status,200);assert.equal(saved.body.written,true);
 onlyDraftChanged(beforeVault,treeHashes(h.f.vault));await h.restart();
 const reopened=await h.read(),refreshed=await h.inspect();assert.equal(refreshed.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented wide').annotation.caption,'Invented vessel 瓷 😀 100%');assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);
 const creditPlan=await h.media.planCredits({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:reopened.document.hash,revision:refreshed.revision,credits:['Words: Invented author','Photographs: Invented Maker']});
 const preparedCredits=await h.post('prepare',{...selection,expectedHash:creditPlan.expectedHash,operations:creditPlan.operations});assert.equal(preparedCredits.status,200);assert.equal(sha(preparedCredits.body.content),creditPlan.expectedContentHash);
 const creditOperationId=randomUUID(),saveCredits={...selection,content:preparedCredits.body.content,expectedHash:creditPlan.expectedHash,operationId:creditOperationId,reason:'Human invented article credits'};assert.equal((await h.post('save',saveCredits)).status,200);
 await h.restart();assert.equal((await h.post('save',saveCredits)).body.replay,true);const final=await h.inspect();assert.deepEqual(final.annotations.credits,['Words: Invented author','Photographs: Invented Maker']);
 for(const undoOperationId of [creditOperationId,photoOperationId]){const undone=await h.post('undo',{...selection,undoOperationId,operationId:randomUUID()});assert.equal(undone.status,200,JSON.stringify(undone.body));}
 assert.equal((await h.read()).document.text,first.document.text);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
});


test('closing standalone and group caption saves restart through the existing owner and exact Undo preserves ending/publication/source files',async t=>{
 const h=await fixture(t,{endingPhotos:true}),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),operations=[];
 const upstreamBefore=parser.parseDraft(parser.draftBody(first.document.text).body);
 for(const alt of ['Closing wide','Closing bleed','Closing group first']){
  const read=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt);
  const plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:read.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation:{caption:'Closing words '+alt+' 瓷 😀',credit:'Photo: Invented Maker'}});
  const prepare=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepare.status,200,JSON.stringify(prepare.body));assert.equal(sha(prepare.body.content),plan.expectedContentHash);
  const operationId=randomUUID(),save={...selection,content:prepare.body.content,expectedHash:plan.expectedHash,operationId,reason:'Invented closing-caption proof'};operations.push(operationId);assert.equal((await h.post('save',save)).status,200);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
  await h.restart();assert.equal((await h.post('save',save)).body.replay,true);
  const current=await h.inspect(),saved=current.sources.flatMap(s=>s.placements).find(p=>p.alt===alt);assert.ok(saved.structuralPath.startsWith('ending/blocks/'));assert.equal(saved.annotation.caption,'Closing words '+alt+' 瓷 😀');assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);
  const next=await h.read();assert.deepEqual(parser.parseDraft(parser.draftBody(next.document.text).body),upstreamBefore);
 }
 for(const undoOperationId of operations.reverse()){const undo=await h.post('undo',{...selection,undoOperationId,operationId:randomUUID()});assert.equal(undo.status,200,JSON.stringify(undo.body));}
 assert.equal((await h.read()).document.text,first.document.text);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal(fs.existsSync(path.join(h.f.data,'study-draft-copies')),false);
});

test('cover and opener captions use the existing owner across real restart, exact retry, stale refusal and reverse Undo',async t=>{
 const h=await fixture(t,{coverOpenerPhotos:true}),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),operations=[],upstream=parser.parseDraft(parser.draftBody(first.document.text).body);
 for(const alt of ['Invented cover','Invented opener']){
  const read=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt),annotation={caption:'Exact '+alt+' 瓷 😀 100%',credit:'Photograph: Invented Maker'},plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:read.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation});
  const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);const operationId=randomUUID(),save={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId,reason:'Invented exact cover/opener caption proof'};operations.push(operationId);assert.equal((await h.post('save',save)).status,200);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
  await h.restart();assert.equal((await h.post('save',save)).body.replay,true);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);const current=await h.read(),edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash}),shot=alt==='Invented cover'?edition.spec.portrait:edition.spec.parts[0].opener;assert.equal(shot.caption.text,annotation.caption);assert.equal(shot.photoCredit,annotation.credit);assert.deepEqual(parser.parseDraft(parser.draftBody(current.document.text).body),upstream);
 }
 for(const undoOperationId of operations.reverse())assert.equal((await h.post('undo',{...selection,undoOperationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
});

test('side photo caption save restarts through existing owner and exact Undo preserves its adjacent words and every original',async t=>{
 const h=await fixture(t,{sidePhotos:true}),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Invented side'),upstream=parser.parseDraft(parser.draftBody(first.document.text).body),annotation={caption:'Exact side caption 瓷 😀 100%',credit:'Photograph: Invented Maker'},plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:first.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation});
 const prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId,reason:'Invented side caption proof'};assert.equal((await h.post('save',payload)).status,200);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));await h.restart();assert.equal((await h.post('save',payload)).body.replay,true);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);const current=await h.read();assert.deepEqual(parser.parseDraft(parser.draftBody(current.document.text).body),upstream);const edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash}),side=edition.spec.opening.find(b=>b.kind==='side');assert.equal(side.shot.caption.text,annotation.caption);assert.equal(side.shot.photoCredit,annotation.credit);assert.equal(side.blocks[0].text,'Invented adjacent side words.');assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
});

test('nested standalone and group captions save through existing owner, restart, refuse stale and exactly Undo without losing containers',async t=>{
 const h=await fixture(t,{nestedPhotos:true}),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),operations=[],upstream=parser.parseDraft(parser.draftBody(first.document.text).body);
 for(const alt of ['Invented nested wide','Invented nested first']){const read=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt);assert.equal(photo.nativeOrigin.depth,2);const plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:read.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation:{caption:'Nested exact '+alt+' 瓷 😀',credit:'Invented maker'}}),prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId,reason:'Invented nested caption proof'};operations.push(operationId);assert.equal((await h.post('save',payload)).status,200);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));await h.restart();assert.equal((await h.post('save',payload)).body.replay,true);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);const current=await h.read();assert.deepEqual(parser.parseDraft(parser.draftBody(current.document.text).body),upstream);const edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash}),side=edition.spec.opening.find(b=>b.kind==='side');assert.equal(side.blocks[0].text,'Invented container words.');assert.equal(side.blocks[1].kind,'glyph');const block=side.blocks[1].blocks.find(b=>b.shot?.alt===alt||b.shots?.[0]?.alt===alt);assert.equal(block.caption.text,'Nested exact '+alt+' 瓷 😀');}
 for(const undoOperationId of operations.reverse())assert.equal((await h.post('undo',{...selection,undoOperationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
});

test('remaining composed captions save, restart, retain actual HTML and exactly Undo with protected quote bytes unchanged',async t=>{
 const h=await fixture(t,{composedPhotos:true}),beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),operations=[],upstream=parser.parseDraft(parser.draftBody(first.document.text).body);const {splitPhotoAnnotation}=await import('../runtime/services/magazine-annotations.mjs');
 for(const alt of ['Invented nested side','Invented on-photo','Invented saying caption']){const read=await h.read(),inspection=await h.inspect(),photo=inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt),originalBlock=read.projection.find(b=>b.id===photo.nativeOrigin.blockId).raw,plan=await h.media.planAnnotation({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:read.document.hash,revision:inspection.revision,placementId:photo.placementId,annotation:{caption:'Exact '+alt+' 瓷 100%',credit:'Invented maker'}}),prepared=await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations});assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(sha(prepared.body.content),plan.expectedContentHash);const operationId=randomUUID(),payload={...selection,expectedHash:plan.expectedHash,content:prepared.body.content,operationId,reason:'Invented composed caption proof'};operations.push(operationId);assert.equal((await h.post('save',payload)).status,200);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));await h.restart();assert.equal((await h.post('save',payload)).body.replay,true);assert.equal((await h.post('prepare',{...selection,expectedHash:plan.expectedHash,operations:plan.operations})).status,409);const current=await h.read(),fresh=await h.inspect(),saved=fresh.sources.flatMap(s=>s.placements).find(p=>p.alt===alt),savedBlock=current.projection.find(b=>b.id===saved.nativeOrigin.blockId).raw;assert.equal(splitPhotoAnnotation(savedBlock).base,originalBlock);assert.deepEqual(parser.parseDraft(parser.draftBody(current.document.text).body),upstream);}
 const current=await h.read(),edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash}),built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8854',readAsset:async url=>String(url).endsWith('.css')?new Response('.tj-conv-caption{color:#333}'):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}})}),retained=await h.post('export',{storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:current.document.hash,renderRevision:edition.revision,name:'composed-captions.html',body:html});assert.equal(retained.status,200,JSON.stringify(retained.body));assert.equal(retained.body.artifact.hash,sha(html));await h.restart();assert.equal(await h.readExport(retained.body.artifact.url),html);assert.match(html,/Exact Invented nested side/);assert.match(html,/Exact Invented on-photo/);assert.match(html,/Exact Invented saying caption/);assert.ok(!html.includes('ar-create-photo:'));
 for(const undoOperationId of operations.reverse())assert.equal((await h.post('undo',{...selection,undoOperationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);assert.equal(await h.readExport(retained.body.artifact.url),html);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);
});


test('unused indexed Library photo inserts at exact ordinary boundary, survives owner restart/render/export and exact Undo',async t=>{
 const h=await fixture(t),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=','base64'),imported=await h.importPhoto(bytes),sourceId=imported.receipts[0].source.id,importedB=await h.importPhoto(bytes,'equal-byte-second-origin.png'),sourceB=importedB.receipts[0].source.id;assert.notEqual(sourceB,sourceId);
 const beforeVault=treeHashes(h.f.vault),beforePhotos=treeHashes(h.f.files),beforePublication=treeHashes(h.publication),first=await h.read(),catalog=await h.get('/api/magazine/library-photos'),asset=catalog.items.find(r=>r.sourceId===sourceId),anchor=first.projection.find(r=>r.words==='Invented words between photographs.');
 assert.ok(first.photoInsertionAnchors.some(a=>a.id===anchor.id&&a.blockHash===anchor.blockHash));assert.ok(first.supportedNativeOperations.includes('photoInsertAsset'));
 const op={kind:'photoInsertAsset',id:anchor.id,seenBlockHash:anchor.blockHash,rootId:asset.rootId,sourceId:asset.sourceId,revision:asset.revision,sourceHash:asset.sourceHash,description:'Unused chosen photograph'},prepare=operations=>h.post('prepare',{...selection,expectedHash:first.document.hash,operations});
 for(const change of [o=>o.id='foreign',o=>o.seenBlockHash='0'.repeat(64),o=>o.rootId='0'.repeat(64),o=>o.revision='0'.repeat(64),o=>o.sourceHash='0'.repeat(64),o=>o.file='arbitrary.png',o=>o.id=first.projection.find(r=>r.raw.includes('%%photo:')).id]){const bad={...op};change(bad);assert.equal((await prepare([bad])).status,409);assert.deepEqual(treeHashes(h.f.vault),beforeVault);}
 assert.equal((await prepare([{kind:'insert',id:'forged',beforeId:anchor.id,raw:'%%photo: arbitrary.png · bad · wide%%'}])).status,409);
 const prepared=await prepare([op]);assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal((await h.read()).document.text,first.document.text,'prepare retains bytes without changing working words');
 const token=/library-photo-[a-f0-9]{64}-[a-f0-9]{64}\.png/.exec(prepared.body.content)[0];assert.equal(prepared.body.content,first.document.text.replace(anchor.raw,anchor.raw+'\r\n\r\n%%photo: '+token+' · Unused chosen photograph · wide%%'));
 const again=await prepare([op]);assert.equal(again.body.content,prepared.body.content);
 const operationId=randomUUID(),saved=await h.post('save',{...selection,expectedHash:first.document.hash,content:prepared.body.content,operationId});assert.equal(saved.status,200);assert.equal((await prepare([op])).status,409);
 await h.restart();const fresh=await h.read();assert.equal(fresh.document.text,prepared.body.content);assert.ok(fresh.history.find(r=>r.operationId===operationId)?.canUndo);onlyDraftChanged(beforeVault,treeHashes(h.f.vault));
 const useA=await h.libraryUsage();assert.equal(useA.usage.items.find(r=>r.sourceId===sourceId).usage.status,'used');assert.equal(useA.usage.items.find(r=>r.sourceId===sourceB).usage.status,'not-used-in-article');
 const assetB=(await h.get('/api/magazine/library-photos')).items.find(r=>r.sourceId===sourceB),anchorB=fresh.projection.find(r=>r.words==='Invented words between photographs.'),opB={...op,id:anchorB.id,seenBlockHash:anchorB.blockHash,rootId:assetB.rootId,sourceId:assetB.sourceId,revision:assetB.revision,sourceHash:assetB.sourceHash,description:'Distinct equal-byte photograph'},preparedB=await h.post('prepare',{...selection,expectedHash:fresh.document.hash,operations:[opB]});assert.equal(preparedB.status,200,JSON.stringify(preparedB.body));const tokenB=[...preparedB.body.content.matchAll(/library-photo-[a-f0-9]{64}-[a-f0-9]{64}\.png/g)].map(m=>m[0]).find(v=>v!==token);assert.ok(tokenB);const operationB=randomUUID();assert.equal((await h.post('save',{...selection,expectedHash:fresh.document.hash,content:preparedB.body.content,operationId:operationB})).status,200);await h.restart();const withBoth=await h.read(),usageBoth=await h.libraryUsage();for(const id of [sourceId,sourceB]){const row=usageBoth.usage.items.find(r=>r.sourceId===id);assert.equal(row.usage.status,'used');assert.equal(row.usage.count,1);assert.equal(row.sourceHash,sha(bytes));}
 const edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:withBoth.document.hash}),photo=edition.media.sources.find(r=>r.name===token);assert.ok(photo);assert.equal(photo.placements.length,1);assert.equal(edition.media.sources.find(r=>r.name===tokenB).placements.length,1);assert.notEqual(photo.sourceRef.sourceId,edition.media.sources.find(r=>r.name===tokenB).sourceRef.sourceId);assert.equal(photo.placements[0].alt,'Unused chosen photograph');const image=await h.media.preview({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:withBoth.document.hash,sourceId:photo.id,sourceHash:photo.sourceRef.hash,revision:edition.revision});assert.deepEqual(image.body,bytes);
 const built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
 const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8854',readAsset:async input=>{const url=new URL(input,'http://127.0.0.1:8854');if(url.pathname.endsWith('.css'))return new Response('.ar-output-reader{color:black}');const value=await h.media.preview(Object.fromEntries(url.searchParams));return new Response(value.body,{headers:{'Content-Type':value.contentType}});}});assert.ok(html.includes('data:image/png;base64,'+bytes.toString('base64')));assert.ok(html.includes('Unused chosen photograph'));
 const exported=await h.post('export',{storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:withBoth.document.hash,renderRevision:edition.revision,name:'inserted-photo.html',body:html});assert.equal(exported.status,200,JSON.stringify(exported.body));await h.restart();assert.equal(await h.readExport(exported.body.artifact.url),html);
 assert.equal((await h.post('undo',{...selection,undoOperationId:operationB,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,prepared.body.content);const afterUndoB=await h.libraryUsage();assert.equal(afterUndoB.usage.items.find(r=>r.sourceId===sourceB).usage.status,'not-used-in-article');assert.equal(afterUndoB.usage.items.find(r=>r.sourceId===sourceId).usage.status,'used');assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.deepEqual(treeHashes(h.f.vault),beforeVault);assert.deepEqual(treeHashes(h.f.files),beforePhotos);assert.deepEqual(treeHashes(h.publication),beforePublication);assert.equal((await h.inspect()).sources.some(r=>r.name===token),false);
});

test('intro-only article accepts one Library photograph after its exact intro and preserves opening/render/Undo',async t=>{
 const minimal=original.replace(/%%photo: same.png · Invented wide[\s\S]*?(?=%%ending%%)/,''),h=await fixture(t,{initialDraft:minimal}),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=','base64'),imported=await h.importPhoto(bytes,'intro-unused.png'),catalog=await h.get('/api/magazine/library-photos'),asset=catalog.items.find(r=>r.sourceId===imported.receipts[0].source.id),first=await h.read();assert.equal(first.photoInsertionAnchors.length,1);const anchor=first.photoInsertionAnchors[0],row=first.projection.find(r=>r.id===anchor.id);assert.equal(row.words,'Invented opening 瓷 😀.');
 const prepared=await h.post('prepare',{...selection,expectedHash:first.document.hash,operations:[{kind:'photoInsertAsset',id:anchor.id,seenBlockHash:anchor.blockHash,rootId:asset.rootId,sourceId:asset.sourceId,revision:asset.revision,sourceHash:asset.sourceHash,description:'After the intro'}]});assert.equal(prepared.status,200,JSON.stringify(prepared.body));const operationId=randomUUID();assert.equal((await h.post('save',{...selection,expectedHash:first.document.hash,content:prepared.body.content,operationId})).status,200);await h.restart();const fresh=await h.read(),edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:fresh.document.hash});assert.equal(edition.spec.intro,'Invented opening 瓷 😀.');assert.ok(edition.media.sources.some(r=>r.placements.some(p=>p.alt==='After the intro')));const built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8854',readAsset:async input=>{const url=new URL(input,'http://127.0.0.1:8854');if(url.pathname.endsWith('.css'))return new Response('.ar-output-reader{color:black}');const value=await h.media.preview(Object.fromEntries(url.searchParams));return new Response(value.body,{headers:{'Content-Type':value.contentType}});}});const rendered=new (require('jsdom').JSDOM)(html);assert.ok(rendered.window.document.body.textContent.includes('Invented opening 瓷 😀.'));rendered.window.close();assert.ok(html.includes('After the intro'));assert.ok(html.includes('data:image/png;base64,'+bytes.toString('base64')));assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);
});

test('intro-only article verifies one unopened original before insertion after its exact intro and preserves opening/render/Undo',async t=>{
 const minimal=original.replace(/%%photo: same.png · Invented wide[\s\S]*?(?=%%ending%%)/,''),h=await fixture(t,{initialDraft:minimal}),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6ioAAAAASUVORK5CYII=','base64');const file=path.join(h.f.files,'Unopened Story/Photos/unopened.png');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);await h.restart();const catalog=await h.get('/api/magazine/library-photos'),asset=catalog.items.find(r=>r.relativePath==='Unopened Story/Photos/unopened.png'),first=await h.read();assert.equal(asset.sourceHash,null);assert.equal(asset.selectable,false);const selected=await h.verifyPhoto(asset);assert.deepEqual(selected.body,bytes);Object.assign(asset,{sourceHash:selected.hash,revision:selected.revision});assert.equal(first.photoInsertionAnchors.length,1);const anchor=first.photoInsertionAnchors[0],row=first.projection.find(r=>r.id===anchor.id);assert.equal(row.words,'Invented opening 瓷 😀.');
 const prepared=await h.post('prepare',{...selection,expectedHash:first.document.hash,operations:[{kind:'photoInsertAsset',id:anchor.id,seenBlockHash:anchor.blockHash,rootId:asset.rootId,sourceId:asset.sourceId,revision:asset.revision,sourceHash:asset.sourceHash,description:'After the intro'}]});assert.equal(prepared.status,200,JSON.stringify(prepared.body));const operationId=randomUUID();assert.equal((await h.post('save',{...selection,expectedHash:first.document.hash,content:prepared.body.content,operationId})).status,200);await h.restart();const fresh=await h.read(),edition=await h.media.workingEdition({storyId:selection.storyId,pieceId:selection.pieceId,expectedHash:fresh.document.hash});assert.equal(edition.spec.intro,'Invented opening 瓷 😀.');const originalUse=await h.libraryUsage();assert.equal(originalUse.usage.items.find(row=>row.sourceId===asset.sourceId).usage.status,'used');assert.ok(edition.media.sources.some(r=>r.placements.some(p=>p.alt==='After the intro')));const built=await require('esbuild').build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);const html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8854',readAsset:async input=>{const url=new URL(input,'http://127.0.0.1:8854');if(url.pathname.endsWith('.css'))return new Response('.ar-output-reader{color:black}');const value=await h.media.preview(Object.fromEntries(url.searchParams));return new Response(value.body,{headers:{'Content-Type':value.contentType}});}});const rendered=new (require('jsdom').JSDOM)(html);assert.ok(rendered.window.document.body.textContent.includes('Invented opening 瓷 😀.'));rendered.window.close();assert.ok(html.includes('After the intro'));assert.ok(html.includes('data:image/png;base64,'+bytes.toString('base64')));assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);assert.equal((await h.read()).document.text,first.document.text);
});

test('configured runtime publication owner forwards retained-origin metadata through Save and actual restart',async t=>{
 const h=await fixture(t),bytes=Buffer.from([137,80,78,71,13,10,26,10,21,22,23]),file=path.join(h.publication,'public/read/synthetic/unopened-extra.png');fs.writeFileSync(file,bytes);await h.restart();const catalog=await h.get('/api/magazine/library-photos'),pending=catalog.items.find(row=>row.name==='unopened-extra.png');assert.equal(pending.sourceHash,null);const verified=await h.verifyPhoto(pending),first=await h.read(),anchor=first.photoInsertionAnchors[0],op={kind:'photoInsertAsset',id:anchor.id,seenBlockHash:anchor.blockHash,rootId:pending.rootId,sourceId:pending.sourceId,revision:verified.revision,sourceHash:verified.hash,description:'Publication choice'};const prepared=await h.post('prepare',{...selection,expectedHash:first.document.hash,operations:[op]});assert.equal(prepared.status,200,JSON.stringify(prepared.body));const operationId=randomUUID();assert.equal((await h.post('save',{...selection,expectedHash:first.document.hash,content:prepared.body.content,operationId})).status,200);await h.restart();const reopened=await h.get('/api/magazine/library-photos'),same=reopened.items.find(row=>row.sourceId===pending.sourceId);assert.equal(same.sourceHash,sha(bytes));assert.equal(same.revision,verified.revision);assert.equal(same.byteVerification,'retained-origin-current-stat');assert.ok(reopened.items.filter(row=>row.sourceLabel==='Publication photos'&&row.sourceId!==same.sourceId).every(row=>row.sourceHash===null));const usage=await h.libraryUsage();assert.equal(usage.usage.items.find(row=>row.sourceId===pending.sourceId).usage.status,'used');fs.appendFileSync(file,'changed');const changed=await h.get('/api/magazine/library-photos');assert.equal(changed.items.find(row=>row.sourceId===pending.sourceId).sourceHash,null);assert.equal((await h.post('undo',{...selection,undoOperationId:operationId,operationId:randomUUID()})).status,200);
});
