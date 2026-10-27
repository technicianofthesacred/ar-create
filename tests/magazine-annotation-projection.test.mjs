import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {annotationFixture,sha} from './helpers/magazine-annotation-fixture.mjs';import * as native from '../runtime/services/draft-correspondence.mjs';
const value={caption:'Caption 瓷 😀 <literal> **plain** 100%',credit:'Photograph: Invented Maker'};
for(const nl of ['\n','\r\n'])test('exact occurrence and group captions reach working edition while upstream Story/publication remain unchanged '+JSON.stringify(nl),async t=>{
 const f=await annotationFixture(t,{nl}),publication=fs.readFileSync(path.join(f.conv,'pieces/index.ts'),'utf8'),upstream=f.parser.parseDraft(f.parser.draftBody(f.text()).body);
 for(const alt of ['First occurrence','Second occurrence','Group first']){
  const {inspection,photo}=await f.photo(alt),plan=await f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation:value});
  assert.equal(plan.schema,'ar-create.magazine-placement-plan.v1');assert.equal(plan.placementIds.length,alt==='Group first'?2:1);
  const saved=native.apply(f.model(),f.text(),plan.operations);assert.equal(sha(saved.raw),plan.expectedContentHash);f.setText(saved.raw);
 }
 const edition=await f.media.workingEdition(f.selection());assert.equal(edition.media.originTrace.status,'ready');
 const groups=edition.spec.opening.filter(b=>['wide','bleed','photos'].includes(b.kind));for(const b of groups.slice(0,3)){assert.equal(b.caption.text,value.caption);assert.equal(b.photoCredit,value.credit);}
 assert.equal(groups.at(-1).caption,undefined);assert.deepEqual(f.parser.parseDraft(f.parser.draftBody(f.text()).body),upstream);
 assert.equal(fs.readFileSync(path.join(f.conv,'pieces/index.ts'),'utf8'),publication);assert.deepEqual(edition.annotations,{schema:'ar-create.magazine-annotations.v1',credits:null,publicationCredits:['Published original credit']});
});
test('article credit override distinguishes absent, deliberately empty, removal and exact Undo',async t=>{
 const f=await annotationFixture(t),before=f.text();let i=await f.media.inspect(f.selection());
 assert.deepEqual(i.annotations.credits,null);assert.deepEqual(i.annotations.publicationCredits,['Published original credit']);
 for(const credits of [['Words: Invented author','Photos: 瓷 😀'],[],null]){
  i=await f.media.inspect(f.selection());const plan=await f.media.planCredits({...f.selection(),revision:i.revision,credits}),saved=native.apply(f.model(),f.text(),plan.operations);f.setText(saved.raw);
  const edition=await f.media.workingEdition(f.selection());assert.deepEqual(edition.spec.credit,credits??['Published original credit']);assert.deepEqual(edition.media.annotations.credits,credits);
 }
 assert.equal(f.text(),before);
});
test('canonical caption survives focus, shape, description, replacement and move through exact existing planner',async t=>{
 const f=await annotationFixture(t);let target=await f.photo('First occurrence');const plan=await f.media.planAnnotation({...f.selection(),revision:target.inspection.revision,placementId:target.photo.placementId,annotation:value});let saved=native.apply(f.model(),f.text(),plan.operations);f.setText(saved.raw);
 for(const [method,extra] of [['planFocus',{x:.7,y:.8}],['planAspect',{aspect:'4/5'}],['planDescription',{description:'Changed description'}]]){
  target=await f.photo(method==='planDescription'?'First occurrence':'First occurrence');const request={...f.selection(),revision:target.inspection.revision,placementId:target.photo.placementId,...extra};const p=await f.media[method](request);saved=native.apply(f.model(),f.text(),p.operations);f.setText(saved.raw);assert.equal((await f.photo(method==='planDescription'?'Changed description':'First occurrence')).photo.annotation.caption,value.caption);
 }
 target=await f.photo('Changed description');const replacement=target.inspection.sources.flatMap(s=>s.placements).find(p=>p.alt==='Replacement'),source=target.inspection.sources.find(s=>s.placements.includes(replacement));
 const replace=await f.media.planReplace({...f.selection(),revision:target.inspection.revision,placementId:target.photo.placementId,replacementPlacementId:replacement.placementId,sourceId:source.id,sourceHash:source.sourceRef.hash});saved=native.apply(f.model(),f.text(),replace.operations);f.setText(saved.raw);
 const photos=(await f.media.inspect(f.selection())).sources.flatMap(s=>s.placements),chosen=photos.find(p=>p.annotation),working=f.working(),destination=working.projection.find(p=>p.raw==='Invented paragraph before the second frame.');
 // Move into the same section over an ordinary paragraph, preserving complete annotated block.
 const beforeId=working.projection.find(p=>p.raw.startsWith('%%photo: same.png · Second occurrence')).id;
 const move=await f.media.planMove({...f.selection(),revision:(await f.media.inspect(f.selection())).revision,placementId:chosen.placementId,beforeId});saved=native.apply(f.model(),f.text(),move.operations);f.setText(saved.raw);
 assert.equal((await f.media.inspect(f.selection())).sources.flatMap(s=>s.placements).filter(p=>p.annotation).length,1);assert.ok(destination);
});
test('annotation planner refuses stale, malformed, duplicate and unsupported associations',async t=>{
 const f=await annotationFixture(t),{inspection,photo}=await f.photo('First occurrence'),request={...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation:value};
 await assert.rejects(f.media.planAnnotation({...request,revision:'0'.repeat(64)}),{status:409});
 for(const annotation of [{caption:'Only caption'}, {caption:'x',credit:'y',extra:'z'},{caption:'x\ny',credit:''}, {caption:' x ',credit:''}])await assert.rejects(f.media.planAnnotation({...request,annotation}),{status:409});
 const p=await f.media.planAnnotation(request),saved=native.apply(f.model(),f.text(),p.operations);f.setText(saved.raw.replace('%%ar-create-photo:', '%%ar-create-photo: malformed %%\n%%ar-create-photo:'));
 await assert.rejects(f.media.inspect(f.selection()),{status:409});
});
test('visible working HTML includes literal standalone/group captions and actual working credits',async t=>{
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url)),{build}=require('esbuild'),{JSDOM}=require('jsdom');
 const built=await build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
 const f=await annotationFixture(t);
 for(const alt of ['First occurrence','Second occurrence','Group first']){const {inspection,photo}=await f.photo(alt),p=await f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation:value});f.setText(native.apply(f.model(),f.text(),p.operations).raw);}
 const i=await f.media.inspect(f.selection()),p=await f.media.planCredits({...f.selection(),revision:i.revision,credits:['Working credit 瓷 😀']} );f.setText(native.apply(f.model(),f.text(),p.operations).raw);
 const read=await f.media.workingEdition(f.selection()),before=JSON.stringify(read),html=await module.exports.prepareMagazineHtml(read,{origin:'http://127.0.0.1:8854',readAsset:async url=>String(url).endsWith('.css')?new Response('.tj-conv-caption{color:#333}'):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}})}),dom=new JSDOM(html);
 try{const captions=[...dom.window.document.querySelectorAll('figcaption')];assert.equal(captions.filter(el=>el.textContent.includes(value.caption)).length,3);assert.equal(captions.filter(el=>el.textContent.includes(value.credit)).length,3);assert.ok(dom.window.document.querySelector('.tj-conv-credit').textContent.includes('Working credit 瓷 😀'));assert.ok(!dom.window.document.body.textContent.includes('Published original credit'));assert.equal(dom.window.document.querySelectorAll('script,input,textarea,[contenteditable=true]').length,0);assert.equal(JSON.stringify(read),before);}finally{dom.window.close();}
});
test('photo group caption moves with its whole block and cannot cross into publication or closing ownership',async t=>{
 const f=await annotationFixture(t),{inspection,photo}=await f.photo('Group first'),p=await f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation:value});f.setText(native.apply(f.model(),f.text(),p.operations).raw);
 const next=await f.photo('Group first'),before=(await f.photo('First occurrence')).photo.nativeOrigin.blockId,move=await f.media.planMove({...f.selection(),revision:next.inspection.revision,placementId:next.photo.placementId,beforeId:before});assert.equal(move.placementIds.length,2);f.setText(native.apply(f.model(),f.text(),move.operations).raw);
 const after=await f.media.workingEdition(f.selection());assert.equal(after.spec.opening.find(b=>b.kind==='photos').caption.text,value.caption);assert.equal(after.media.sources.flatMap(s=>s.placements).filter(p=>p.annotation).length,2);
});
test('GET annotation plan transport accepts one JSON value and rejects malformed/duplicate/foreign inputs and writes',async t=>{
 const {createExistingWorkReview}=await import('../scripts/review-existing.mjs'),{server}=await createExistingWorkReview({config:{authorityURL:'http://127.0.0.1:65530',allowedAuthorityPort:65530,magazineRoots:[]},fetchImpl:async()=>{throw Error('Unexpected authority call.');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.closeAllConnections();server.close(r);}));
 const base='http://127.0.0.1:'+server.address().port,selection={storyId:'synthetic',pieceId:'synthetic:article',expectedHash:'a'.repeat(64),revision:'b'.repeat(64)};
 for(const [route,data] of [['annotation-plan',{placementId:'c'.repeat(64),annotation:JSON.stringify(value)}],['credits-plan',{credits:'[]'}]]){
  const url=base+'/api/review/magazine-media/'+route+'?'+new URLSearchParams({...selection,...data});assert.equal((await fetch(url)).status,503);assert.equal((await fetch(url+'&file=elsewhere')).status,400);assert.equal((await fetch(url+'&'+Object.keys(data).at(-1)+'=null')).status,400);assert.equal((await fetch(url,{method:'POST'})).status,423);assert.equal((await fetch(url,{headers:{origin:'http://foreign.invalid'}})).status,403);
 }
 assert.equal((await fetch(base+'/api/review/magazine-media/credits-plan?'+new URLSearchParams({...selection,credits:'malformed'}))).status,400);
});
