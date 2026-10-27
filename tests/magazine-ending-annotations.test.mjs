import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
import {annotationFixture,sha} from './helpers/magazine-annotation-fixture.mjs';import * as native from '../runtime/services/draft-correspondence.mjs';
const closingBody=['Invented opening 瓷 😀.','%%photo: same.png · Opening occurrence · wide%%','## Invented part','Invented part words.','%%ending%%','Invented ending context.','%%photo: same.png · Closing wide · wide x=0.2%%','%%photo: other.png · Closing bleed · bleed%%','%%photos: same.png · Closing group first | other.png · Closing group second · aspect=4/5%%','%%saying: same.png · Special closing shot · aspect=4/5%%\n> "The retained closing saying."','A retained author closing.'];
const annotation={caption:'Closing caption 瓷 😀 100% <literal>',credit:'Photograph: Invented Maker'};
for(const nl of ['\n','\r\n'])test('ending standalone wide/bleed/group retain exact occurrence and unchanged maintained ending structure '+JSON.stringify(nl),async t=>{
 const f=await annotationFixture(t,{nl,body:closingBody}),before=f.parser.parseDraft(f.parser.draftBody(f.text()).body),published=fs.readFileSync(path.join(f.conv,'pieces/index.ts'));
 for(const alt of ['Closing wide','Closing bleed','Closing group first']){
  const {inspection,photo}=await f.photo(alt);assert.ok(photo.structuralPath.startsWith('ending/blocks/'));
  const plan=await f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation}),saved=native.apply(f.model(),f.text(),plan.operations);assert.equal(plan.expectedContentHash,sha(saved.raw));assert.equal(plan.placementIds.length,alt==='Closing group first'?2:1);
  assert.equal(native.undo(saved.snapshot,saved.raw,saved.inverse).raw,f.text());f.setText(saved.raw);
 }
 const read=await f.media.workingEdition(f.selection()),blocks=read.spec.ending.blocks.filter(b=>['wide','bleed','photos'].includes(b.kind));assert.equal(blocks.length,3);for(const b of blocks){assert.equal(b.caption.text,annotation.caption);assert.equal(b.photoCredit,annotation.credit);}
 assert.deepEqual(f.parser.parseDraft(f.parser.draftBody(f.text()).body),before);assert.deepEqual(read.spec.ending.saying,before.ending.saying);assert.deepEqual(read.spec.ending.shot,before.ending.shot);assert.equal(read.spec.closing,before.closing);assert.deepEqual(fs.readFileSync(path.join(f.conv,'pieces/index.ts')),published);
 for(const alt of ['Closing wide','Closing bleed','Closing group first']){
  const {inspection,photo}=await f.photo(alt),dest=(await f.photo('Opening occurrence')).photo.nativeOrigin.blockId;
  await assert.rejects(f.media.planMove({...f.selection(),revision:inspection.revision,placementId:photo.placementId,beforeId:dest}),{status:409});
 }
 const {inspection,photo}=await f.photo('Special closing shot');await assert.rejects(f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation}),{status:409});
});
test('working HTML renders ending captions without replacing the saying, closing photo or author close',async t=>{
 const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{build}=require('esbuild'),{JSDOM}=require('jsdom'),built=await build({entryPoints:['public/document-study/mountMagazineAudience.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'}),module={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,module,module.exports);
 const f=await annotationFixture(t,{body:closingBody});for(const alt of ['Closing wide','Closing bleed','Closing group first']){const {inspection,photo}=await f.photo(alt),plan=await f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation});f.setText(native.apply(f.model(),f.text(),plan.operations).raw);}
 const edition=await f.media.workingEdition(f.selection()),html=await module.exports.prepareMagazineHtml(edition,{origin:'http://127.0.0.1:8854',readAsset:async url=>String(url).endsWith('.css')?new Response('.tj-conv-caption{color:#333}'):new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}})}),dom=new JSDOM(html);
 try{assert.equal([...dom.window.document.querySelectorAll('figcaption')].filter(n=>n.textContent.includes(annotation.caption)&&n.textContent.includes(annotation.credit)).length,3);assert.ok(dom.window.document.body.textContent.includes('The retained closing saying.'));assert.ok(dom.window.document.body.textContent.includes('A retained author closing.'));assert.equal(dom.window.document.querySelectorAll('img').length,6);assert.equal(dom.window.document.querySelectorAll('script,input,textarea,[contenteditable=true]').length,0);}finally{dom.window.close();}
});
test('composed and closing-saying roles still refuse without mutating their different canonical layouts',async t=>{
 const body=['%%photo: same.png · Cover · cover%%','Invented opening.','## Part','%%photo: same.png · Opener · opener%%','Part words.','%%side: same.png · Side figure%%','Side words.','%%photo: same.png · Nested wide · wide%%','%%/side%%','%%on-photo: same.png · On-photo figure · aspect=4/5 ink=#fff accent=#000%%\n> "Words on the photograph."','%%ending%%','%%photo: same.png · Closing supported wide · wide%%','%%saying: same.png · Saying figure · aspect=4/5%%\n> "Preserved saying."','Preserved author closing.'];
 const f=await annotationFixture(t,{body}),before=f.text();
 for(const alt of ['Nested wide','On-photo figure','Saying figure']){const {inspection,photo}=await f.photo(alt);assert.ok(photo,alt);await assert.rejects(f.media.planAnnotation({...f.selection(),revision:inspection.revision,placementId:photo.placementId,annotation}),{status:409});assert.equal(f.text(),before);}
});
