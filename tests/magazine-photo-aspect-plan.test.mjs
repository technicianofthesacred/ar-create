import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import {createExistingWorkReview} from '../scripts/review-existing.mjs';
import {planMagazinePlacementAspect} from '../runtime/services/magazine-placement-plan.mjs';
import * as native from '../runtime/services/draft-correspondence.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const parserCode=fs.readFileSync(new URL('../runtime/src/donors/mag/mag-send.ts',import.meta.url),'utf8');
const specCode=fs.readFileSync(new URL('../runtime/src/donors/mag/spec.ts',import.meta.url),'utf8');
const compiled=await require('esbuild').transform(parserCode,{loader:'ts',format:'esm'});
const parser=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const BODY=[
 '%%photo: same.png · Invented cover · cover%%','Invented opening 瓷 😀.',
 '%%photo: same.png · Invented chosen · wide x=0.2 y=0.8 narrow left%%','Invented words **kept**.',
 '%%photo: same.png · Invented square · wide aspect=1/1%%',
 '%%photo: same.png · Invented bleed · bleed%%',
 '%%photos: same.png · Invented group A | same.png · Invented group B · aspect=4/5%%',
 '## Invented part','%%photo: same.png · Invented opener · opener%%','Invented part words.',
 '%%photo: same.png · Invented part wide · wide aspect=4/5%%',
 '%%side: same.png · Invented side%%','Invented nested words.',
 '%%photo: same.png · Invented nested · wide%%','%%/side%%',
 '%%ending%%','Invented ending words.','%%photo: same.png · Invented ending · wide%%',
 '%%saying%%\n> "An invented saying."','Invented close.'
];
async function fixture(t,{crlf=false,body=BODY,parseCode=parserCode}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'magazine-photo-aspect-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const conv=path.join(root,'src/pages/read/conversation');fs.mkdirSync(path.join(conv,'pieces'),{recursive:true});fs.writeFileSync(path.join(conv,'magSend.ts'),parseCode);fs.writeFileSync(path.join(conv,'spec.ts'),specCode);
 fs.writeFileSync(path.join(conv,'pieces/index.ts'),"export const CONVERSATIONS=[{path:'/read/synthetic',slug:'synthetic',images:'/read/synthetic/',opening:[],parts:[],ending:{blocks:[]}}];");
 const image=path.join(root,'public/read/synthetic/same.png');fs.mkdirSync(path.dirname(image),{recursive:true});fs.writeFileSync(image,Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));
 const text=['---','type: DEV','published: https://www.teajia.com/read/synthetic','---','Invented metadata.','','---','',body.join('\n\n'),'','---','','Invented retained notes.'].join('\n').replaceAll('\n',crlf?'\r\n':'\n');
 const storyId='mag-synthetic',pieceId=storyId+':article',hash=sha(text),model=native.capture(text,pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(pieceId)+':'+i);
 const working={supportedNativeOperations:['photoFocus','photoAspect'],document:{text,hash},authority:{kind:'magazine',storyId,pieceId},target:{nativeProjectId:'synthetic-native',artifactId:'synthetic-working',hash},projection:native.projection(model).map((r,i)=>({...r,raw:model.blocks[i].raw}))};
 let reads=0,mutateRead=()=>{};
 const tracedParser=parseCode===parserCode?parser:await import('data:text/javascript;base64,'+Buffer.from((await require('esbuild').transform(parseCode,{loader:'ts',format:'esm'})).code).toString('base64'));
 const media=createMagazineMediaInspection({repoRoot:root,resolveWorking:async()=>{reads++;mutateRead(reads);return structuredClone(working);},originTrace:{parserHash:sha(parseCode),specHash:sha(specCode),loadParser:async()=>tracedParser}});
 const selection={storyId,pieceId,expectedHash:hash},inspection=await media.inspect(selection),photo=alt=>inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt);
 assert.equal(inspection.originTrace.status,'ready');
 const request={...selection,revision:inspection.revision,placementId:photo('Invented chosen').placementId,aspect:'4/5'};
 return {root,image,text,model,working,media,inspection,selection,photo,request,input:()=>({inspection,working,request}),onRead:fn=>{reads=0;mutateRead=fn;}};
}
test('aspect planner emits one immutable native operation for one exact occurrence under LF and CRLF',async t=>{
 for(const crlf of [false,true]){
  const f=await fixture(t,{crlf}),before=JSON.stringify(f.input()),plan=planMagazinePlacementAspect(f.input()),chosen=f.photo('Invented chosen');
  assert.deepEqual(plan.operations,[{kind:'photoAspect',id:chosen.nativeOrigin.blockId,seenBlockHash:chosen.nativeOrigin.blockHash,aspect:'4/5'}]);
  assert.deepEqual(plan.ownerRef,f.inspection.ownerRef);assert.equal(plan.scope,f.inspection.scope);assert.equal(plan.revision,f.inspection.revision);assert.deepEqual(plan.placementIds,[chosen.placementId]);
  assert.equal(plan.expectedHash,sha(f.text));assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.operations)&&Object.isFrozen(plan.operations[0]));assert.equal(JSON.stringify(f.input()),before);assert.ok(!JSON.stringify(plan).includes(f.root));assert.ok(!Object.hasOwn(plan,'content'));
 }
});
test('read-only maintained aspect preparation changes only chosen aspect, preserves bytes and supports exact native Undo',async t=>{
 for(const crlf of [false,true])for(const aspect of ['4/5','1/1']){
  const f=await fixture(t,{crlf});f.request.aspect=aspect;
  const originalFiles=[f.image,path.join(f.root,'src/pages/read/conversation/magSend.ts')].map(p=>[p,sha(fs.readFileSync(p))]);
  const plan=await f.media.planAspect(f.request),result=native.apply(f.model,f.text,plan.operations);
  assert.equal(plan.schema,'ar-create.magazine-placement-plan.v1');assert.equal(plan.expectedContentHash,sha(result.raw));
  assert.equal(result.raw,f.text.replace('wide x=0.2 y=0.8 narrow left%%','wide x=0.2 y=0.8 narrow left aspect='+aspect+'%%'));
  assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,f.text);assert.deepEqual(originalFiles.map(([p])=>[p,sha(fs.readFileSync(p))]),originalFiles);
 }
 const f=await fixture(t);f.request.placementId=f.photo('Invented part wide').placementId;f.request.aspect='4/3';assert.equal((await f.media.planAspect(f.request)).operations[0].aspect,'4/3');
});
test('planner refuses specialized, grouped, nested and ending occurrences and semantic no-ops',async t=>{
 const f=await fixture(t);
 for(const alt of ['Invented cover','Invented bleed','Invented group A','Invented group B','Invented opener','Invented side','Invented nested','Invented ending']){
  const input=structuredClone(f.input());input.request.placementId=f.photo(alt).placementId;assert.throws(()=>planMagazinePlacementAspect(input),{name:'MagazinePlacementPlanError',status:409});
 }
 for(const [alt,aspect]of [['Invented chosen','4/3'],['Invented square','1/1'],['Invented part wide','4/5']]){
  const input=structuredClone(f.input());Object.assign(input.request,{placementId:f.photo(alt).placementId,aspect});assert.throws(()=>planMagazinePlacementAspect(input),{code:'unchanged-aspect'});
 }
});
test('strict request, fresh owner, exact projection and complete origins are required',async t=>{
 const f=await fixture(t),changes=[
  i=>i.working.supportedNativeOperations=['photoFocus'],i=>delete i.working.supportedNativeOperations,
  i=>i.request.aspect='16/9',i=>i.request.aspect='4/3 ',i=>i.request.aspect=4/3,i=>i.request.aspect=null,i=>i.request.x=.2,i=>i.request.y=.8,i=>i.request.beforeId='other',i=>i.request.content='other',
  i=>i.request.storyId='other',i=>i.request.pieceId='other',i=>i.request.expectedHash='0'.repeat(64),i=>i.request.revision='0'.repeat(64),i=>i.request.placementId='0'.repeat(64),
  i=>i.working.document.text+='changed',i=>i.working.target.hash='0'.repeat(64),i=>i.working.target.artifactId='other',i=>i.working.authority.kind='other',
  i=>i.inspection.ownerRef.editionId='published',i=>i.inspection.originTrace.status='unavailable',i=>i.inspection.originTrace.occurrences++,i=>i.inspection.sources[0].ownerRef.pieceId='other',
  i=>i.working.projection[0].origin.offset++,i=>i.working.projection[0].id='other',i=>i.working.projection[0].origin.fileHash='0'.repeat(64),i=>i.working.projection[0].blockHash='0'.repeat(64),
  ...['blockId','blockHash','fileHash','offsetUnit'].map(k=>i=>i.inspection.sources[0].placements[1].nativeOrigin[k]='other'),
  ...['chunkStart','chunkEnd','directiveStart','directiveEnd','blockOffset','groupIndex','groupSize','depth'].map(k=>i=>i.inspection.sources[0].placements[1].nativeOrigin[k]++),
 ];
 for(const mutate of changes){const input=structuredClone(f.input());mutate(input);assert.throws(()=>planMagazinePlacementAspect(input),{name:'MagazinePlacementPlanError',status:409});}
});
test('service rejects stale revision, extra fields, malformed aspects and changed publication or owner during preparation',async t=>{
 const f=await fixture(t);
 for(const change of [r=>r.revision='0'.repeat(64),r=>r.expectedHash='0'.repeat(64),r=>r.placementId='0'.repeat(64),r=>r.aspect='16/9',r=>r.aspect='',r=>r.aspect=NaN,r=>r.x=.2,r=>r.sourceId='other']){const request=structuredClone(f.request);change(request);await assert.rejects(f.media.planAspect(request),e=>[400,409].includes(e.status));}
 for(const change of [w=>w.target.artifactId='other',w=>w.target.nativeProjectId='other',w=>w.supportedNativeOperations=['photoFocus']]){
  const g=await fixture(t);g.onRead(n=>{if(n===4)change(g.working);});await assert.rejects(g.media.planAspect(g.request),{status:409});
 }
 const g=await fixture(t);fs.appendFileSync(g.image,Buffer.from([5]));await assert.rejects(g.media.planAspect(g.request),{status:409});
});
test('preparation refuses parser changes to non-photo article semantics as well as other photo attributes',async t=>{
 for(const mutation of ["result.intro+=' Changed.';","result.opening.find(b=>b.kind==='wide').shot.x=.9;"]){
  const parseCode=parserCode.replace('export function parseDraft(', 'function parseDraftInner(')+`\nexport function parseDraft(body,...args){const result=parseDraftInner(body,...args);if(body.includes('narrow left aspect=4/5')){${mutation}}return result;}\n`;
  const f=await fixture(t,{parseCode});await assert.rejects(f.media.planAspect(f.request),{status:409});
 }
});
test('aspect-plan HTTP route accepts exact GET selection, rejects extra/duplicate fields, writes and foreign origins',async t=>{
 const {server}=await createExistingWorkReview({config:{authorityURL:'http://127.0.0.1:65530',allowedAuthorityPort:65530,magazineRoots:[]},fetchImpl:async()=>{throw Error('Unexpected authority call.');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const request={storyId:'synthetic',pieceId:'synthetic:article',expectedHash:'a'.repeat(64),revision:'b'.repeat(64),placementId:'c'.repeat(64),aspect:'4/5'},url='http://127.0.0.1:'+server.address().port+'/api/review/magazine-media/aspect-plan?'+new URLSearchParams(request);
 const exact=await fetch(url);assert.equal(exact.status,503);assert.match((await exact.json()).error,/not configured/);
 for(const suffix of ['&x=.2','&file=other','&aspect=1/1'])assert.equal((await fetch(url+suffix)).status,400);
 assert.equal((await fetch(url.replace('aspect=4%2F5','aspect='))).status,400);
 assert.equal((await fetch(url,{method:'POST'})).status,423);assert.equal((await fetch(url,{headers:{origin:'http://evil.invalid'}})).status,403);
});
