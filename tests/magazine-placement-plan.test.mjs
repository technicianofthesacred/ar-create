import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMagazineMediaInspection} from '../scripts/magazine-media-inspection.mjs';
import {planMagazinePlacementMove,planMagazinePlacementFocus} from '../runtime/services/magazine-placement-plan.mjs';
import * as native from '../runtime/services/draft-correspondence.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const code=fs.readFileSync(new URL('../runtime/src/donors/mag/mag-send.ts',import.meta.url),'utf8');
const specCode=fs.readFileSync(new URL('../runtime/src/donors/mag/spec.ts',import.meta.url),'utf8');
const compiled=await require('esbuild').transform(code,{loader:'ts',format:'esm'});
const parser=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const BODY=[
 '%%photo: same.png · Invented cover · cover%%',
 'Invented opening 瓷 😀.',
 '%%photo: same.png · Invented wide · wide x=0.2 y=0.8%%',
 'Invented first words.',
 '%%photos: same.png · First group member | same.png · Second group member · aspect=4/5%%',
 'Invented words after the group.',
 '## Invented part',
 '%%photo: same.png · Invented opener · opener%%',
 'Invented part words.',
 '%%photo: same.png · Invented part wide · wide%%',
 'Invented second part paragraph.',
 '%%side: same.png · Invented side%%',
 'Invented nested words.',
 '%%photo: same.png · Invented nested wide · bleed%%',
 'Invented nested after.',
 '%%photo: same.png · Invented nested second · wide%%',
 '%%/side%%',
 '%%photo: same.png · Invented outside · wide%%',
 '%%ending%%',
 'Invented ending words.',
 '%%photo: same.png · Invented ending detail · wide%%',
 '%%saying: same.png · Invented last · aspect=4/5%%\n> "An invented closing saying."',
 'Invented close.'
];
async function fixture(t,{crlf=false}={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'magazine-placement-plan-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const conv=path.join(root,'src/pages/read/conversation');fs.mkdirSync(path.join(conv,'pieces'),{recursive:true});fs.writeFileSync(path.join(conv,'magSend.ts'),code);fs.writeFileSync(path.join(conv,'spec.ts'),specCode);
 fs.writeFileSync(path.join(conv,'pieces/index.ts'),"export const CONVERSATIONS=[{path:'/read/synthetic',slug:'synthetic',images:'/read/synthetic/',opening:[],parts:[],ending:{blocks:[]}}];");
 fs.mkdirSync(path.join(root,'public/read/synthetic'),{recursive:true});fs.writeFileSync(path.join(root,'public/read/synthetic/same.png'),Buffer.from([137,80,78,71,13,10,26,10,1,2,3]));
 const text=['---','type: DEV','published: https://www.teajia.com/read/synthetic','---','Invented metadata.','','---','',BODY.join('\n\n'),'','---','','Invented retained notes.'].join('\n').replaceAll('\n',crlf?'\r\n':'\n');
 const storyId='mag-synthetic',pieceId='mag-synthetic:article',hash=sha(text),model=native.capture(text,pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(pieceId)+':'+i);
 const projection=native.projection(model).map((r,i)=>({...r,raw:model.blocks[i].raw}));
 const working={supportedNativeOperations:['photoFocus'],document:{text,hash},authority:{kind:'magazine',storyId,pieceId},target:{nativeProjectId:'synthetic-native',artifactId:'synthetic-working',hash},projection};
 const inspection=await createMagazineMediaInspection({repoRoot:root,resolveWorking:async()=>working,originTrace:{parserHash:sha(code),specHash:sha(specCode),loadParser:async()=>parser}}).inspect({storyId,pieceId,expectedHash:hash});
 assert.equal(inspection.originTrace.status,'ready');
 const all=inspection.sources.flatMap(s=>s.placements),photo=alt=>all.find(p=>p.alt===alt),block=words=>projection.find(p=>p.raw.trim()===words);
 const request={storyId,pieceId,expectedHash:hash,revision:inspection.revision,placementId:photo('First group member').placementId,beforeId:photo('Invented wide').nativeOrigin.blockId};
 return {root,working,inspection,request,all,photo,block,model};
}
const input=f=>({inspection:f.inspection,working:f.working,request:f.request});
function refused(f,code){assert.throws(()=>planMagazinePlacementMove(input(f)),e=>e.name==='MagazinePlacementPlanError'&&e.status===409&&(!code||e.code===code));}
test('plans one existing native move for a complete repeated-photo group, preserving every input and identity',async t=>{
 const f=await fixture(t),before=JSON.stringify(input(f)),plan=planMagazinePlacementMove(input(f));
 assert.deepEqual(plan.operations,[{kind:'move',id:f.photo('First group member').nativeOrigin.blockId,beforeId:f.request.beforeId}]);
 assert.equal(plan.expectedHash,f.request.expectedHash);assert.equal(plan.revision,f.inspection.revision);assert.deepEqual(plan.ownerRef,f.inspection.ownerRef);
 assert.deepEqual(plan.placementIds,[f.photo('First group member').placementId,f.photo('Second group member').placementId]);assert.equal(JSON.stringify(input(f)),before);assert.equal(Object.isFrozen(plan.operations[0]),true);assert.ok(!JSON.stringify(plan).includes('%%photos'));assert.ok(!JSON.stringify(plan).includes(f.root));
});
test('native apply moves the whole group with exact words, CRLF, frontmatter and notes retained, then exact Undo',async t=>{
 for(const crlf of [false,true]){const f=await fixture(t,{crlf}),plan=planMagazinePlacementMove(input(f)),moved=native.apply(f.model,f.working.document.text,plan.operations),old=f.model.blocks,newBlocks=moved.snapshot.blocks;
 assert.deepEqual(newBlocks.map(b=>b.id).sort(),old.map(b=>b.id).sort());for(const b of old)assert.equal(newBlocks.find(n=>n.id===b.id).raw,b.raw);
 assert.equal(moved.snapshot.prefix,f.model.prefix);assert.equal(newBlocks.at(-1).raw,old.at(-1).raw);const ids=newBlocks.map(b=>b.id);assert.equal(ids.indexOf(plan.operations[0].id)+1,ids.indexOf(plan.operations[0].beforeId));
 assert.equal(moved.raw.includes('\r\n'),crlf);assert.equal(moved.ledger.length,1);assert.equal(native.undo(moved.snapshot,moved.raw,moved.inverse).raw,f.working.document.text);
 }
});
test('single photos can move within a part or an existing nested container without moving its boundary',async t=>{
 for(const [alt,target]of [['Invented part wide','Invented part words.'],['Invented nested second','Invented nested words.']]){const f=await fixture(t);f.request.placementId=f.photo(alt).placementId;f.request.beforeId=f.block(target).id;const plan=planMagazinePlacementMove(input(f));assert.equal(plan.operations.length,1);const moved=native.apply(f.model,f.working.document.text,plan.operations);assert.equal(native.undo(moved.snapshot,moved.raw,moved.inverse).raw,f.working.document.text);}
});
test('stale owner, working file, target and expected revisions refuse a plan',async t=>{
 const mutations=[f=>f.request.storyId='other',f=>f.request.pieceId='other',f=>f.request.expectedHash='0'.repeat(64),f=>f.request.revision='0'.repeat(64),f=>f.working.target.artifactId='other',f=>f.working.target.hash='0'.repeat(64),f=>f.working.document.text+='changed',f=>f.inspection.ownerRef.editionId='published',f=>f.working.authority.kind='other'];
 for(const mutate of mutations){const f=await fixture(t);mutate(f);refused(f);}
});
test('missing, ambiguous and stale native occurrence evidence never falls back to matching a filename',async t=>{
 const mutations=[f=>f.inspection.originTrace.status='unavailable',f=>delete f.photo('First group member').nativeOrigin,f=>f.inspection.sources[0].placements.push(structuredClone(f.all[0])),f=>f.photo('First group member').nativeOrigin.fileHash='0'.repeat(64),f=>f.photo('First group member').nativeOrigin.blockHash='0'.repeat(64),f=>f.photo('First group member').nativeOrigin.directiveStart++,f=>f.photo('First group member').nativeOrigin.groupSize=3,f=>f.photo('Second group member').nativeOrigin.groupIndex=0,f=>f.inspection.sources[0].placements.splice(f.inspection.sources[0].placements.indexOf(f.photo('Second group member')),1),f=>f.request.placementId='0'.repeat(64)];
 for(const mutate of mutations){const f=await fixture(t);f.inspection=structuredClone(f.inspection);f.all=f.inspection.sources.flatMap(s=>s.placements);f.photo=alt=>f.all.find(p=>p.alt===alt);mutate(f);refused(f);}
});
test('native projection drift, omissions, ambiguous IDs and misplaced offsets refuse a plan',async t=>{
 for(const mutate of [f=>f.working.projection[3].raw+='x',f=>f.working.projection[3].origin.offset++,f=>f.working.projection[3].origin.fileHash='0'.repeat(64),f=>f.working.projection[3].blockHash='0'.repeat(64),f=>f.working.projection[3].id=f.working.projection[4].id,f=>f.working.projection.splice(3,1)]){const f=await fixture(t);mutate(f);refused(f);}
});
test('cover, opener, side and ending placements retain their specialized layout owners',async t=>{
 for(const alt of ['Invented cover','Invented opener','Invented side','Invented ending detail','Invented last']){const f=await fixture(t);f.request.placementId=f.photo(alt).placementId;refused(f,'unsupported-placement');}
});
test('moves cannot cross a part, nested container or ending boundary or enter metadata and notes',async t=>{
 const targets=['Invented part words.','Invented nested words.','Invented ending words.','Invented metadata.','Invented retained notes.','## Invented part'];
 for(const words of targets){const f=await fixture(t);f.request.beforeId=f.block(words).id;refused(f);}
 const f=await fixture(t);f.request.placementId=f.photo('Invented nested second').placementId;f.request.beforeId=f.photo('Invented outside').nativeOrigin.blockId;refused(f);
});
test('same-position, unknown, tail and caller-invented command fields are rejected',async t=>{
 const mutations=[f=>f.request.beforeId=f.photo('First group member').nativeOrigin.blockId,f=>f.request.beforeId=f.block('Invented words after the group.').id,f=>f.request.beforeId='missing',f=>f.request.beforeId=null,f=>f.request.operations=[],f=>f.request.path='/private/file'];
 for(const mutate of mutations){const f=await fixture(t);mutate(f);refused(f);}
});

test('moving a single photo later preserves the maintained parser’s words and every photo focal point',async t=>{
 const f=await fixture(t);f.request.placementId=f.photo('Invented wide').placementId;f.request.beforeId=f.block('Invented words after the group.').id;
 const plan=planMagazinePlacementMove(input(f)),moved=native.apply(f.model,f.working.document.text,plan.operations);
 const before=parser.parseDraft(parser.draftBody(f.working.document.text).body),after=parser.parseDraft(parser.draftBody(moved.raw).body,parser.memoryOf(before));
 const words=v=>Array.isArray(v)?v.filter(x=>!['photos','wide','bleed'].includes(x?.kind)).map(words):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['portrait','opener','shot'].includes(k)).map(([k,v])=>[k,words(v)])):v;
 assert.deepEqual(words(after),words(before));
 const shots=story=>{const out=[];const visit=v=>{if(!v||typeof v!=='object')return;if(typeof v.file==='string'&&typeof v.slot==='string')out.push([v.file,v.alt,v.x??null,v.y??null]);for(const value of Object.values(v))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(visit):visit(value);};visit(story);return out.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));};
 assert.deepEqual(shots(after),shots(before));assert.equal(native.undo(moved.snapshot,moved.raw,moved.inverse).raw,f.working.document.text);
});
test('a consumed plan cannot be reused against changed working bytes or old photo revision evidence',async t=>{
 const f=await fixture(t),plan=planMagazinePlacementMove(input(f)),moved=native.apply(f.model,f.working.document.text,plan.operations);
 assert.throws(()=>native.apply(f.model,moved.raw,plan.operations),/External file change/);
 const hash=sha(moved.raw),model=native.capture(moved.raw,f.request.pieceId);model.blocks.forEach((b,i)=>b.id='magazine:'+encodeURIComponent(f.request.pieceId)+':'+i);
 f.working.document={text:moved.raw,hash};f.working.target.hash=hash;f.working.projection=native.projection(model).map((r,i)=>({...r,raw:model.blocks[i].raw}));f.request.expectedHash=hash;refused(f,'stale-inspection');
});
test('prototype kind names, invalid nesting and block range boundaries fail as ordinary guarded refusals',async t=>{
 for(const mutate of [o=>o.kind='toString',o=>o.depth=-1,o=>o.chunkEnd++,o=>o.blockOffset++,o=>o.groupIndex=0.5]){const f=await fixture(t);f.inspection=structuredClone(f.inspection);mutate(f.inspection.sources.flatMap(s=>s.placements).find(p=>p.placementId===f.request.placementId).nativeOrigin);refused(f,'invalid-origins');}
});

const focusInput=f=>({inspection:f.inspection,working:f.working,request:{storyId:f.request.storyId,pieceId:f.request.pieceId,expectedHash:f.request.expectedHash,revision:f.request.revision,placementId:f.photo('Invented wide').placementId,x:0.7,y:0.3}});
test('standalone focal adjustment changes only its exact repeated-photo occurrence and restores exact LF/CRLF bytes',async t=>{
 for(const crlf of [false,true]){const f=await fixture(t,{crlf}),input=focusInput(f),plan=planMagazinePlacementFocus(input),before=f.working.document.text,result=native.apply(f.model,before,plan.operations),id=f.photo('Invented wide').nativeOrigin.blockId;
 assert.deepEqual(plan.operations,[{kind:'photoFocus',id,seenBlockHash:f.model.blocks.find(b=>b.id===id).origin.blockHash,x:0.7,y:0.3}]);
 assert.equal(result.raw,before.replace('Invented wide · wide x=0.2 y=0.8','Invented wide · wide x=0.7 y=0.3'));
 assert.deepEqual(result.snapshot.blocks.map(b=>b.id),f.model.blocks.map(b=>b.id));
 for(const b of f.model.blocks)if(b.id!==id)assert.equal(result.snapshot.blocks.find(n=>n.id===b.id).raw,b.raw);
 assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,before);
 }
});
test('focal plans refuse groups, cover, opener, nested, ending, stale, forged and nonfinite/out-of-range values',async t=>{
 const f=await fixture(t);
 for(const alt of ['First group member','Invented cover','Invented opener','Invented nested wide','Invented ending detail','Invented last']){const input=focusInput(f);input.request.placementId=f.photo(alt).placementId;assert.throws(()=>planMagazinePlacementFocus(input));}
 for(const value of [NaN,Infinity,-0.1,1.1,'0.5',null]){const input=focusInput(f);input.request.x=value;assert.throws(()=>planMagazinePlacementFocus(input));}
 for(const mutate of [i=>i.request.revision='0'.repeat(64),i=>i.request.expectedHash='0'.repeat(64),i=>i.request.placementId='0'.repeat(64),i=>i.request.extra=true,i=>i.inspection.sources[0].placements[0].nativeOrigin.blockHash='0'.repeat(64)]){const input=structuredClone(focusInput(f));mutate(input);assert.throws(()=>planMagazinePlacementFocus(input));}
});
test('native focal operation independently rejects unsupported/stale/forged/invalid operations without relying on the planner',async t=>{
 const f=await fixture(t),op=(alt='Invented wide')=>{const id=f.photo(alt).nativeOrigin.blockId;return {kind:'photoFocus',id,seenBlockHash:f.model.blocks.find(b=>b.id===id).origin.blockHash,x:0.7,y:0.3};};
 for(const alt of ['First group member','Invented cover','Invented opener','Invented nested wide','Invented ending detail','Invented last'])assert.throws(()=>native.apply(f.model,f.working.document.text,[op(alt)]));
 for(const extra of [{x:NaN},{y:Infinity},{x:-1},{y:1.1},{x:'0.4'},{seenBlockHash:'0'.repeat(64)},{caption:'invented'},{file:'other.png'}])assert.throws(()=>native.apply(f.model,f.working.document.text,[{...op(),...extra}]));
 assert.throws(()=>native.apply(f.model,f.working.document.text+'external',[op()]));
});

test('native focal edits preserve file, Unicode alt, aspect, layout flags, unknown options and coordinate spelling outside changed fields',async t=>{
 const f=await fixture(t),original=f.working.document.text,old='%%photo: same.png · Invented wide · wide x=0.2 y=0.8%%';
 for(const directive of ['%%photo:same.png · Invented wide 瓷 😀%%','%%photo: same.png · Invented wide 瓷 😀 · aspect=4/5%%','%%photo: same.png · Invented wide 瓷 😀 · wide aspect=16/9 narrow right custom=keep x=2e-1 y=.8   %%','%%photo: same.png · Invented wide 瓷 😀 · bleed aspect=4/5 custom=keep%%']){
 const raw=original.replace(old,directive),model=native.capture(raw,f.request.pieceId),chosen=model.blocks.find(b=>b.raw.includes('Invented wide 瓷')),op={kind:'photoFocus',id:chosen.id,seenBlockHash:chosen.origin.blockHash,x:0,y:1},result=native.apply(model,raw,[op]);
 const expected=directive.includes('x=')?directive.replace('x=2e-1 y=.8','x=0 y=1'):directive.includes('custom=keep')?directive.replace('custom=keep%%','custom=keep x=0 y=1%%'):directive.includes('aspect=4/5')?directive.replace('aspect=4/5%%','aspect=4/5 x=0 y=1%%'):directive.replace('😀%%','😀 · x=0 y=1%%');assert.equal(result.raw,raw.replace(directive,expected));assert.equal(native.undo(result.snapshot,result.raw,result.inverse).raw,raw);
 }
 for(const tail of ['wide x=.2 x=.3 y=.8','wide x=NaN y=.8','wide x=.2 y=Infinity']){const raw=original.replace(old,'%%photo: same.png · Invented wide · '+tail+'%%'),model=native.capture(raw,f.request.pieceId),chosen=model.blocks.find(b=>b.raw.includes('Invented wide'));assert.throws(()=>native.apply(model,raw,[{kind:'photoFocus',id:chosen.id,seenBlockHash:chosen.origin.blockHash,x:.7,y:.3}]));}
 const input=focusInput(f);delete input.working.supportedNativeOperations;assert.throws(()=>planMagazinePlacementFocus(input),e=>e.code==='unsupported-owner');
});
