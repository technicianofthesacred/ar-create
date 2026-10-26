import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import {planMagazinePlacementReplace} from '../runtime/services/magazine-placement-plan.mjs';
import * as native from '../runtime/services/draft-correspondence.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const parserCode=fs.readFileSync(new URL('../runtime/src/donors/mag/mag-send.ts',import.meta.url),'utf8');
const specCode=fs.readFileSync(new URL('../runtime/src/donors/mag/spec.ts',import.meta.url),'utf8');
const compiled=await require('esbuild').transform(parserCode,{loader:'ts',format:'esm'});
const parser=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const BODY=[
 '%%photo: same.png · Invented cover · cover%%','Invented opening 瓷 😀.',
 '%%photo: replacement.png · Actual source description · bleed x=0.1 y=0.9%%',
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
 const image=path.join(root,'public/read/synthetic/same.png');fs.mkdirSync(path.dirname(image),{recursive:true});fs.writeFileSync(image,Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));fs.writeFileSync(path.join(path.dirname(image),'replacement.png'),Buffer.from([137,80,78,71,13,10,26,10,4,5,6]));
 const text=['---','type: DEV','published: https://www.teajia.com/read/synthetic','---','Invented metadata.','','---','',body.join('\n\n'),'','---','','Invented retained notes.'].join('\n').replaceAll('\n',crlf?'\r\n':'\n');
 const storyId='mag-synthetic',pieceId=storyId+':article',hash=sha(text),model=native.capture(text,pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(pieceId)+':'+i);
 const working={supportedNativeOperations:['photoFocus','photoAspect','photoReplace'],document:{text,hash},authority:{kind:'magazine',storyId,pieceId},target:{nativeProjectId:'synthetic-native',artifactId:'synthetic-working',hash},projection:native.projection(model).map((r,i)=>({...r,raw:model.blocks[i].raw}))};
 let reads=0,mutateRead=()=>{};
 const tracedParser=parseCode===parserCode?parser:await import('data:text/javascript;base64,'+Buffer.from((await require('esbuild').transform(parseCode,{loader:'ts',format:'esm'})).code).toString('base64'));
 const media=createMagazineMediaInspection({repoRoot:root,resolveWorking:async()=>{reads++;mutateRead(reads);return structuredClone(working);},originTrace:{parserHash:sha(parseCode),specHash:sha(specCode),loadParser:async()=>tracedParser}});
 const selection={storyId,pieceId,expectedHash:hash},inspection=await media.inspect(selection),photo=alt=>inspection.sources.flatMap(s=>s.placements).find(p=>p.alt===alt);
 assert.equal(inspection.originTrace.status,'ready');
 const replacement=photo('Actual source description');const request={...selection,revision:inspection.revision,placementId:photo('Invented chosen').placementId,replacementPlacementId:replacement.placementId,sourceId:replacement.sourceRef.sourceId,sourceHash:replacement.sourceRef.hash};
 return {root,image,text,model,working,media,inspection,selection,photo,request,input:()=>({inspection,working,request}),onRead:fn=>{reads=0;mutateRead=fn;}};
}
test('replacement planning preserves every other byte and uses actual source alt under LF and CRLF',async t=>{
 for(const crlf of [false,true]){
  const f=await fixture(t,{crlf}),plan=await f.media.planReplace(f.request),candidate=native.apply(f.model,f.text,plan.operations);
  assert.equal(candidate.raw,f.text.replace('same.png · Invented chosen · wide x=0.2 y=0.8 narrow left','replacement.png · Actual source description · wide x=0.2 y=0.8 narrow left'));
  assert.equal(plan.expectedContentHash,sha(candidate.raw));assert.equal(native.undo(candidate.snapshot,candidate.raw,candidate.inverse).raw,f.text);assert.ok(Object.isFrozen(plan.operations[0]));
 }
});
test('replacement requires exact owner, source identity, occurrence and current bytes',async t=>{
 const f=await fixture(t),changes=[i=>i.request.storyId='foreign',i=>i.request.pieceId='foreign',i=>i.request.sourceId='0'.repeat(64),i=>i.request.sourceHash='0'.repeat(64),i=>i.request.replacementPlacementId='0'.repeat(64),i=>i.request.revision='0'.repeat(64),i=>i.request.expectedHash='0'.repeat(64),i=>i.request.file='../replacement.png',i=>i.request.alt='invented',i=>i.working.document.text+='changed',i=>i.working.target.artifactId='other',i=>i.working.supportedNativeOperations=['photoFocus'],i=>i.inspection.originTrace.status='unavailable',i=>i.inspection.sources.find(s=>s.id===i.request.sourceId).sourceRef.hash='0'.repeat(64),i=>i.inspection.sources[0].placements[0].nativeOrigin.blockHash='0'.repeat(64)];
 for(const mutate of changes){const i=structuredClone(f.input());mutate(i);assert.throws(()=>planMagazinePlacementReplace(i),{status:409},String(mutate));}
 for(const mutate of [r=>r.sourceHash='0'.repeat(64),r=>r.sourceId='0'.repeat(64),r=>r.replacementPlacementId='0'.repeat(64),r=>r.file='/tmp/replacement.png',r=>r.alt='not owned']){const r={...f.request};mutate(r);await assert.rejects(f.media.planReplace(r),e=>[400,409].includes(e.status));}
});
test('replacement refuses covers, openers, groups, side, nested and ending on either side',async t=>{
 const f=await fixture(t);
 for(const alt of ['Invented cover','Invented group A','Invented group B','Invented opener','Invented side','Invented nested','Invented ending']){
  const p=f.photo(alt);
  for(const key of ['placementId','replacementPlacementId']){const i=structuredClone(f.input());i.request[key]=p.placementId;assert.throws(()=>planMagazinePlacementReplace(i),{status:409});}
 }
 const i=structuredClone(f.input()),same=f.photo('Invented square');Object.assign(i.request,{replacementPlacementId:same.placementId,sourceId:same.sourceRef.sourceId,sourceHash:same.sourceRef.hash});assert.throws(()=>planMagazinePlacementReplace(i),{code:'unchanged-photo'});
});
test('native preparation cannot forge filename, alt, stale source, foreign source, hidden group or arbitrary path',async t=>{
 const f=await fixture(t),plan=await f.media.planReplace(f.request);
 const fails=[op=>op.file='unrelated.png',op=>op.path='/tmp/replacement.png',op=>op.alt='forged',op=>op.replacementId='magazine:foreign:1',op=>op.seenReplacementHash='0'.repeat(64),op=>op.seenBlockHash='0'.repeat(64),op=>op.replacementId=op.id,
  ...['Invented cover','Invented group A','Invented opener','Invented nested','Invented ending'].map(alt=>op=>{const p=f.photo(alt);op.replacementId=p.nativeOrigin.blockId;op.seenReplacementHash=p.nativeOrigin.blockHash;})];
 for(const mutate of fails){const op={...plan.operations[0]};mutate(op);assert.throws(()=>native.apply(f.model,f.text,[op]));}
 assert.throws(()=>native.apply(f.model,f.text,[...plan.operations,...plan.operations]));
 for(const file of ['../replacement.png','/tmp/replacement.png','x\\replacement.png','.hidden.png','https://foreign.invalid/replacement.png']){
  const raw=f.text.replace('replacement.png',file),model=native.capture(raw,'synthetic');const target=model.blocks.find(b=>b.raw.includes('Invented chosen')),source=model.blocks.find(b=>b.raw.includes('Actual source description'));assert.throws(()=>native.apply(model,raw,[{kind:'photoReplace',id:target.id,seenBlockHash:sha(target.raw),replacementId:source.id,seenReplacementHash:sha(source.raw)}]));
 }
});
test('unrelated same-filename bytes, symlinks, changing asset/code and changing owner are refused',async t=>{
 const f=await fixture(t);const source=path.join(f.root,'public/read/synthetic/replacement.png');fs.writeFileSync(source,Buffer.from([137,80,78,71,13,10,26,10,8,8,8]));await assert.rejects(f.media.planReplace(f.request),{status:409});
 const g=await fixture(t);g.onRead(n=>{if(n===4)fs.appendFileSync(path.join(g.root,'public/read/synthetic/replacement.png'),Buffer.from([8]));});await assert.rejects(g.media.planReplace(g.request),{status:409});
 const h=await fixture(t);h.onRead(n=>{if(n===4)h.working.target.nativeProjectId='other';});await assert.rejects(h.media.planReplace(h.request),{status:409});
 const j=await fixture(t);const file=path.join(j.root,'public/read/synthetic/replacement.png'),other=path.join(j.root,'replacement.png');fs.renameSync(file,other);fs.symlinkSync(other,file);await assert.rejects(j.media.planReplace(j.request),{status:409});
 const k=await fixture(t);fs.appendFileSync(path.join(k.root,'src/pages/read/conversation/spec.ts'),'\n// foreign revision');await assert.rejects(k.media.planReplace(k.request),{status:409});
});

test('ambiguous descriptions refuse; exact Unicode description and target spacing/layout remain intact',async t=>{
 const f=await fixture(t),base=f.text.replace('replacement.png · Actual source description','replacement.png ·  源描述 🌱  ').replace('same.png · Invented chosen ·','same.png  ·  Old description  ·'),model=native.capture(base,'synthetic'),target=model.blocks.find(b=>b.raw.includes('Old description')),source=model.blocks.find(b=>b.raw.includes('源描述'));
 const op={kind:'photoReplace',id:target.id,seenBlockHash:sha(target.raw),replacementId:source.id,seenReplacementHash:sha(source.raw)},result=native.apply(model,base,[op]);
 assert.equal(result.raw,base.replace('same.png  ·  Old description  ·','replacement.png  ·  源描述 🌱  ·'));
 const blank=base.replace('  Old description  ','    '),blankModel=native.capture(blank,'synthetic'),blankTarget=blankModel.blocks.find(b=>b.raw.includes('same.png  ·')) ,blankSource=blankModel.blocks.find(b=>b.raw.includes('源描述'));assert.equal(native.apply(blankModel,blank,[{...op,id:blankTarget.id,seenBlockHash:sha(blankTarget.raw),replacementId:blankSource.id,seenReplacementHash:sha(blankSource.raw)}]).raw,blank.replace('same.png  ·    ·','replacement.png  ·   源描述 🌱 ·'));
 const ambiguous=f.text.replace('Actual source description','Ambiguous · description'),other=native.capture(ambiguous,'synthetic'),a=other.blocks.find(b=>b.raw.includes('Invented chosen')),b=other.blocks.find(b=>b.raw.includes('Ambiguous'));
 assert.throws(()=>native.apply(other,ambiguous,[{...op,id:a.id,seenBlockHash:sha(a.raw),replacementId:b.id,seenReplacementHash:sha(b.raw)}]));
});
test('full maintained article comparison refuses unrelated parser changes in replacement candidate',async t=>{
 const parseCode=parserCode.replace('export function parseDraft(', 'function parseDraftInner(')+`\nexport function parseDraft(body,...args){const result=parseDraftInner(body,...args);if(body.includes('replacement.png · Actual source description · wide'))result.intro+=' Changed.';return result;}\n`;
 const f=await fixture(t,{parseCode});await assert.rejects(f.media.planReplace(f.request),{status:409});
});
