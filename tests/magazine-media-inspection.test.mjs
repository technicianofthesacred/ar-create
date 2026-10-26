import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import {createMagazineLibraryPhotos} from '../runtime/services/magazine-library-photos.mjs';
import {projectMagazineMediaUsage} from '../runtime/services/magazine-media-usage.mjs';
const sha = v => createHash('sha256').update(v).digest('hex');
const PNG = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
function fixture(t,{duplicate=false,unsafe=false,symlink=false,noPublication=false,libraryPhotos=null}={}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'magazine-publication-reader-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const conv = path.join(root,'src/pages/read/conversation');fs.mkdirSync(path.join(conv,'pieces'),{recursive:true});
  // Synthetic maintained-parser boundary: grouped directive expands into independent shots.
  fs.writeFileSync(path.join(conv,'magSend.ts'), `
export const draftBody = text => ({body:text.split('\\n---\\n')[1]});
export const memoryOf = spec => spec;
export function parseDraft(body, spec) { const files = body.trim().replace(/^%%photos: |%%$/g,'').split(' | '); return {opening:[{kind:'photos',aspect:'4/5',shots:files.map((file,i)=>({file,slot:'slot-'+i,alt:'Photograph '+i,x:0.4,y:0.6}))}],parts:[],ending:{blocks:[]}}; }
`);
  const item = `{path:'/read/synthetic',slug:'synthetic',images:'/read/synthetic/',title:['Invented','Publication']}`;
  fs.writeFileSync(path.join(conv,'pieces/index.ts'),`export const CONVERSATIONS = [${item}${duplicate?','+item:''}];`);
  const imageRoot = path.join(root,'public/read/synthetic');fs.mkdirSync(imageRoot,{recursive:true});
  const names=Array.from({length:25},(_,i)=>`photo-${i}.png`);
  for(const name of names)fs.writeFileSync(path.join(imageRoot,name),PNG);
  if(libraryPhotos)names[0]='library-photo-'+sha(PNG)+'.png';
  if(unsafe)names[0]='../elsewhere.png';
  if(symlink){fs.unlinkSync(path.join(imageRoot,names[0]));fs.symlinkSync(path.join(imageRoot,names[1]),path.join(imageRoot,names[0]));}
  const text=`---\ntype: DEV\n${noPublication?'':'published: https://www.teajia.com/read/synthetic (historical annotation)\n'}---\n%%photos: ${names.join(' | ')}%%`;
  const input={storyId:'mag-synthetic',pieceId:'mag-synthetic:article',expectedHash:sha(text)};
  let stale=false,wrongOwner=false;
  const reader=createMagazineMediaInspection({repoRoot:root,libraryPhotos,resolveWorking:async()=>({document:{text,path:'Workflow/3-Develop/DEV - Synthetic.md',hash:stale?'0'.repeat(64):sha(text)},authority:{kind:'magazine',storyId:wrongOwner?'other':input.storyId,pieceId:input.pieceId},target:{nativeProjectId:'native-synthetic',artifactId:'working-artifact',hash:sha(text)}})});
  return {root,conv,imageRoot,input,reader,stale:()=>stale=true,wrongOwner:()=>wrongOwner=true};
}
const previewInput=(f,view,row=view.sources[0])=>({...f.input,sourceId:row.id,sourceHash:row.sourceRef.hash,revision:view.revision});
test('one grouped directive projects 25 exact publication assets and placements without persisted copies',async t=>{
  const f=fixture(t), before=fs.readdirSync(f.imageRoot);const view=await f.reader.inspect(f.input);
  assert.equal(view.sources.length,25);assert.equal(view.sources.reduce((n,s)=>n+s.placements.length,0),25);
  assert.equal(view.ownerRef.artifactId,'working-artifact');assert.equal(view.sources[0].title,'Photograph 0');
  assert.deepEqual(view.sources[0].placements[0].crop,{x:0.4,y:0.6,aspect:'4/5'});
  assert.equal(view.sources[0].placements[0].structuralPath,'opening/0/photos/0');
  assert.deepEqual(view.sources[0].originRef,{kind:'publication',rootId:view.sources[0].sourceRef.rootId,relativePath:view.sources[0].sourceRef.relativePath});
  assert.equal(view.sources[0].sourceRef.hash,sha(PNG));assert.ok(!JSON.stringify(view).includes(f.root));
  const result=await f.reader.preview(previewInput(f,view));assert.deepEqual(result.body,PNG);assert.equal(result.contentType,'image/png');
  assert.deepEqual(fs.readdirSync(f.imageRoot),before);
});
test('rejects stale working owner/hash, stale revision and unknown asset identity',async t=>{
  const f=fixture(t),view=await f.reader.inspect(f.input),request=previewInput(f,view);
  await assert.rejects(f.reader.preview({...request,revision:'0'.repeat(64)}));
  await assert.rejects(f.reader.preview({...request,sourceId:'other'}));
  await assert.rejects(f.reader.preview({...request,sourceHash:'0'.repeat(64)}));
  f.wrongOwner();await assert.rejects(f.reader.preview(request));
  const g=fixture(t),v=await g.reader.inspect(g.input);g.stale();await assert.rejects(g.reader.preview(previewInput(g,v)));
});
test('rejects ambiguous registry identity, unsafe asset names and symlinks',async t=>{
  for(const option of [{duplicate:true},{unsafe:true},{symlink:true}]){const f=fixture(t,option);await assert.rejects(f.reader.inspect(f.input));}
});
test('rejects changed image bytes, changed code and newly substituted symlink',async t=>{
  const f=fixture(t),view=await f.reader.inspect(f.input),row=view.sources[0];fs.writeFileSync(path.join(f.imageRoot,row.name),Buffer.concat([PNG,Buffer.from('changed')]));await assert.rejects(f.reader.preview(previewInput(f,view)));
  const g=fixture(t),v=await g.reader.inspect(g.input);fs.appendFileSync(path.join(g.conv,'magSend.ts'),'\n// changed module');await assert.rejects(g.reader.preview(previewInput(g,v)));
  const h=fixture(t),w=await h.reader.inspect(h.input);const file=path.join(h.imageRoot,w.sources[0].name);fs.unlinkSync(file);fs.symlinkSync(path.join(h.imageRoot,w.sources[1].name),file);await assert.rejects(h.reader.preview(previewInput(h,w)));
});
test('rejects caller paths, wrong draft hash, unsafe module imports and unsupported image bytes',async t=>{
  const f=fixture(t);await assert.rejects(f.reader.inspect({...f.input,path:'/private/secret'}));await assert.rejects(f.reader.inspect({...f.input,expectedHash:'0'.repeat(64)}));
  fs.appendFileSync(path.join(f.conv,'magSend.ts'),"\nimport fs from 'node:fs'; console.log(fs);\n");await assert.rejects(f.reader.inspect(f.input));
  const g=fixture(t);fs.writeFileSync(path.join(g.imageRoot,'photo-0.png'),'not an image');await assert.rejects(g.reader.inspect(g.input));
});
test('rejects direct root symlinks, replaced root inode and hardlinked image bytes',async t=>{
  const f=fixture(t),alias=f.root+'-alias';fs.symlinkSync(f.root,alias);t.after(()=>fs.rmSync(alias,{force:true}));
  assert.throws(()=>createMagazineMediaInspection({repoRoot:alias,resolveWorking:async()=>{}}));
  const view=await f.reader.inspect(f.input),old=f.root+'-old';fs.renameSync(f.root,old);fs.mkdirSync(f.root);t.after(()=>fs.rmSync(old,{recursive:true,force:true}));
  await assert.rejects(f.reader.preview(previewInput(f,view)));
  const g=fixture(t),v=await g.reader.inspect(g.input),file=path.join(g.imageRoot,v.sources[0].name);fs.linkSync(file,path.join(g.imageRoot,'hardlink.png'));
  await assert.rejects(g.reader.preview(previewInput(g,v)));
  await assert.rejects(g.reader.inspect(g.input));
});

test('publication reference exposes only the attributed URL and exact working owner, independently of photo availability',async t=>{
 const f=fixture(t);fs.rmSync(f.imageRoot,{recursive:true});const before=fs.readdirSync(f.root),ref=await f.reader.publicationReference(f.input);
 assert.equal(ref.schema,'ar-create.magazine-publication-reference.v1');assert.equal(ref.nativeProjectId,'native-synthetic');assert.equal(ref.workingOwnerRef.hash,f.input.expectedHash);assert.equal(ref.workingOwnerRef.editionId,'working');assert.equal(ref.publication.url,'https://www.teajia.com/read/synthetic');assert.equal(ref.publication.title,'Invented Publication');assert.equal(ref.publication.recordedBy,'working-draft-frontmatter');assert.equal(ref.publication.edition,null);assert.equal(ref.publication.date,null);assert.match(ref.publication.id,/^[a-f0-9]{64}$/);assert.match(ref.revision,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(ref).includes('%%photos'));assert.ok(!JSON.stringify(ref).includes(f.root));assert.deepEqual(fs.readdirSync(f.root),before);
 f.wrongOwner();await assert.rejects(()=>f.reader.publicationReference(f.input),/owner|hash/);
});
test('publication reference refuses duplicate registry identity and caller paths rather than inventing a delivered edition',async t=>{
 const f=fixture(t,{duplicate:true});await assert.rejects(()=>f.reader.publicationReference(f.input),/ambiguous/);await assert.rejects(()=>f.reader.publicationReference({...f.input,path:'public/read/synthetic'}),/exact/);
});

test('an exact working part without a published field stays resumable and does not fabricate a publication',async t=>{const f=fixture(t,{noPublication:true});const ref=await f.reader.publicationReference(f.input);assert.equal(ref.publication,null);assert.equal(ref.workingOwnerRef.hash,f.input.expectedHash);assert.equal(ref.nativeProjectId,'native-synthetic');await assert.rejects(()=>f.reader.inspect(f.input),/explicit publication/);});

function originFixture(t, {mutate=()=>{}, trace=()=>{}, crlf=false, parity=false, drift=false, loadError=false, bodyRange=()=>{}}={}) {
  const f=fixture(t), nl=crlf?'\r\n':'\n';
  const raw='%%photos: photo-0.png | photo-0.png%%';
  const text=['---','type: DEV','published: https://www.teajia.com/read/synthetic','---','前言 😀','',raw].join(nl);
  const start=text.indexOf(raw), hash=sha(text), input={...f.input,expectedHash:hash};
  const parser=`export const draftBody = text => ({body:text.slice(text.indexOf('%%photos:'))});
export const memoryOf = spec => spec;
export function parseDraft(body, spec) { return {opening:[{kind:'photos',shots:[0,1].map(i=>({file:'photo-0.png',slot:'repeat-'+i,alt:'Repeated '+i}))}],parts:[],ending:{blocks:[]}}; }`;
  fs.writeFileSync(path.join(f.conv,'magSend.ts'),parser);fs.writeFileSync(path.join(f.conv,'spec.ts'),'// invented spec');
  const projection=[{id:'magazine:'+encodeURIComponent(input.pieceId)+':0',raw,safe:false,blockHash:sha(raw),origin:{fileHash:hash,blockHash:sha(raw),offset:start}}];
  const originTrace={parserHash:sha(parser),specHash:sha('// invented spec'),loadParser:async()=>{if(loadError)throw Error('private loader detail must not escape');return {
    draftBody(value,observe){const r={start,end:value.length,offsetUnit:'utf16'};bodyRange(r);observe(r);return {body:value.slice(start)};},
    parseDraft(body,memory,observe){const shots=[0,1].map(i=>({file:'photo-0.png',slot:'repeat-'+i,alt:'Repeated '+i}));const value={opening:[{kind:'photos',shots}],parts:[],ending:{blocks:[]}};for(const [i,shot] of shots.entries()){const o={chunkStart:0,chunkEnd:body.length,directiveStart:0,directiveEnd:body.length,kind:'photos',role:'photos',groupIndex:i,groupSize:2,depth:0,offsetUnit:'utf16'};trace(o,i,shot);observe(shot,o);}if(parity)value.extra='mismatch';return value;}
  };}};
  const resolved={document:{text,hash},authority:{kind:'magazine',storyId:input.storyId,pieceId:input.pieceId},target:{nativeProjectId:'native-synthetic',artifactId:'working-artifact',hash},projection};mutate(resolved);
  const reader=createMagazineMediaInspection({repoRoot:f.root,resolveWorking:async()=>resolved,originTrace});
  if(drift)fs.appendFileSync(path.join(f.conv,'magSend.ts'),'\n// drift');
  return {...f,input,reader,resolved,originTrace,start,raw};
}
test('verified origins identify repeated photo occurrences by Shot identity with exact native block metadata',async t=>{
  for(const crlf of [false,true]){const f=originFixture(t,{crlf}),v=await f.reader.inspect(f.input);assert.equal(v.originTrace.status,'ready');assert.equal(v.originTrace.occurrences,2);assert.equal(v.originTrace.blocks,1);assert.equal(v.sources.length,1);const placements=v.sources[0].placements;assert.equal(placements.length,2);assert.notEqual(placements[0].placementId,placements[1].placementId);for(const [i,p] of placements.entries()){assert.equal(p.nativeOrigin.blockId,f.resolved.projection[0].id);assert.equal(p.nativeOrigin.directiveStart,f.start);assert.equal(p.nativeOrigin.directiveEnd,f.start+f.raw.length);assert.equal(p.nativeOrigin.fileHash,f.input.expectedHash);assert.equal(p.nativeOrigin.blockHash,sha(f.raw));assert.equal(p.nativeOrigin.groupIndex,i);assert.equal(p.nativeOrigin.groupSize,2);assert.equal(p.nativeOrigin.offsetUnit,'utf16');assert.equal(Object.hasOwn(p.nativeOrigin,'raw'),false);}assert.ok(!JSON.stringify(v).includes('%%photos'));assert.deepEqual((await f.reader.preview(previewInput(f,v))).body,PNG);}
});
test('unverified traces keep exact original gallery identities, crops and revision without native origins',async t=>{
 const f=originFixture(t),ready=await f.reader.inspect(f.input);delete f.resolved.projection;const fallback=await f.reader.inspect(f.input);assert.equal(fallback.originTrace.status,'unavailable');assert.equal(fallback.revision,ready.revision);const strip=v=>v.sources.map(s=>({...s,placements:s.placements.map(({nativeOrigin,...p})=>p)}));assert.deepEqual(strip(ready),strip(fallback));assert.ok(fallback.sources.every(s=>s.placements.every(p=>!p.nativeOrigin)));assert.deepEqual((await f.reader.preview(previewInput(f,fallback))).body,PNG);
});
test('projection drift, duplicate identity, unprotected blocks and wrong offsets never become native origins',async t=>{
 for(const mutate of [r=>r.projection[0].origin.fileHash='0'.repeat(64),r=>r.projection[0].origin.blockHash='0'.repeat(64),r=>r.projection[0].blockHash='0'.repeat(64),r=>r.projection[0].origin.offset++,r=>r.projection[0].safe=true,r=>r.projection.push({...r.projection[0]}),r=>r.projection[0].id='invented',r=>r.projection[0].raw+='x']){const f=originFixture(t,{mutate}),v=await f.reader.inspect(f.input);assert.equal(v.originTrace.status,'unavailable');assert.equal(v.sources.length,1);assert.ok(v.sources[0].placements.every(p=>!p.nativeOrigin));}
});
test('parity, upstream pin and incomplete/invalid groups fail closed for tracing while photos remain readable',async t=>{
 for(const options of [{parity:true},{drift:true},{trace:o=>o.groupSize=3},{trace:o=>o.groupIndex=0},{trace:o=>o.directiveEnd--},{trace:o=>o.chunkStart=-1},{trace:o=>o.depth=9},{trace:o=>o.role='invented'}]){const f=originFixture(t,options),v=await f.reader.inspect(f.input);assert.equal(v.originTrace.status,'unavailable');assert.equal(v.sources.length,1);assert.ok(v.sources[0].placements.every(p=>!p.nativeOrigin));assert.deepEqual((await f.reader.preview(previewInput(f,v))).body,PNG);}
});
test('request data cannot supply parser loaders, pins, projection or origin configuration',async t=>{const f=originFixture(t);for(const key of ['originTrace','loadParser','projection','parserHash'])await assert.rejects(f.reader.inspect({...f.input,[key]:'invented'}),/exact/);});

test('default production pins and loader failures preserve photos without leaking internal errors',async t=>{
 const f=originFixture(t);const defaultReader=createMagazineMediaInspection({repoRoot:f.root,resolveWorking:async()=>f.resolved}),v=await defaultReader.inspect(f.input);assert.deepEqual(v.originTrace,{status:'unavailable',reason:'upstream-code-mismatch'});assert.equal(v.sources.length,1);const g=originFixture(t,{loadError:true}),failed=await g.reader.inspect(g.input);assert.deepEqual(failed.originTrace,{status:'unavailable',reason:'trace-unavailable'});assert.ok(!JSON.stringify(failed).includes('private loader'));assert.deepEqual((await g.reader.preview(previewInput(g,failed))).body,PNG);
});
test('exact body range and per-group role/depth must agree before evidence is attached',async t=>{
 for(const options of [{bodyRange:r=>r.start++},{bodyRange:r=>r.end--},{bodyRange:r=>r.offsetUnit='bytes'},{trace:(o,i)=>{if(i)o.depth=1;}},{trace:(o,i)=>{if(i)o.role='wide';}}]){const f=originFixture(t,options),v=await f.reader.inspect(f.input);assert.equal(v.originTrace.status,'unavailable');assert.equal(v.sources.length,1);assert.ok(v.sources[0].placements.every(p=>!p.nativeOrigin));}
});

test('unchanged photo and publication revisions do not depend on parallel module load order',async t=>{
 const f=fixture(t),registry=path.join(f.conv,'pieces/index.ts');
 const imports=Array.from({length:12},(_,i)=>{fs.writeFileSync(path.join(f.conv,'pieces','proof-'+i+'.ts'),'export const proof = '+i+';\n');return "import './proof-"+i+".ts';";}).join('\n');
 fs.writeFileSync(registry,imports+'\n'+fs.readFileSync(registry,'utf8'));
 const inspections=await Promise.all(Array.from({length:12},()=>f.reader.inspect(f.input)));
 assert.equal(new Set(inspections.map(v=>v.revision)).size,1,'the same exact code/working/photo bytes must retain one revision');
 const references=await Promise.all(Array.from({length:6},()=>f.reader.publicationReference(f.input)));
 assert.equal(new Set(references.map(v=>v.revision)).size,1,'unchanged publication references must also remain stable');
});

 test('retained usage identity preserves the maintained Library source rather than its derived placement source',async t=>{
  const libraryRoot=sha('invented-library-root'),libraryId='invented-retained-photo',libraryPhotos={resolve:async()=>({body:PNG,hash:sha(PNG),rootId:libraryRoot,sourceId:libraryId,contentType:'image/png'})};
  const f=fixture(t,{libraryPhotos}),view=await f.reader.inspect(f.input),row=view.sources.find(row=>row.previewKind==='library-owned');
  assert.deepEqual(row.originRef,{kind:'library',rootId:libraryRoot,sourceId:libraryId});
  assert.notEqual(row.sourceRef.sourceId,libraryId);assert.equal(row.placements.length,1);
  assert.deepEqual(row.placements[0].sourceRef,row.sourceRef);
  assert.deepEqual((await f.reader.preview(previewInput(f,view,row))).body,PNG);
 });

test('real publication catalog and working inspection join identities without marking equal-byte unused asset as placed',async t=>{
 const f=fixture(t);fs.writeFileSync(path.join(f.imageRoot,'unused.png'),PNG);
 const library={photosSnapshot:async()=>({items:[],coverage:{complete:true,issues:[]}}),binarySnapshot:async()=>{throw Error('No Library photo expected');},retainAlbumPhoto:async()=>{throw Error('Read-only usage must not retain');}};
 const photos=createMagazineLibraryPhotos({library,publication:{catalog:f.reader.libraryCatalog,preview:f.reader.libraryPreview}});
 const catalog=await photos.catalog(),inspection=await f.reader.inspect(f.input),result=projectMagazineMediaUsage({catalog,inspection,expectedOwnerRef:inspection.ownerRef,expectedCatalogRevision:catalog.revision});
 assert.equal(result.status,'complete');assert.equal(result.items.length,26);
 assert.equal(result.items.filter(row=>row.usage.status==='used').length,25);
 assert.equal(result.items.find(row=>row.name==='unused.png').usage.status,'not-used-in-article');
 assert.equal(new Set(result.items.map(row=>row.sourceHash)).size,1,'identical bytes do not collapse distinct publication files');
 assert.equal(result.items.reduce((n,row)=>n+(row.usage.count||0),0),25);
});
