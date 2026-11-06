import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {coherentFixture,op,words,sourceRevision} from './helpers/coherent-journey-fixture.mjs';
import {outputHtml} from '../runtime/services/render-helper.mjs';
import {createExportAssetReader} from '../runtime/services/exports.mjs';
import {digest} from '../runtime/services/files.mjs';
import {chromeSkip} from './helpers/headless-chrome.mjs';

test('actual HTML and Carousel PNG files match independent editions and reopen after restart',{skip:chromeSkip},async t=>{
 const f=await coherentFixture(t);await f.consent('people/answer',{personId:f.person.id,state:'yes'},'human:adrian');
 const a=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.article.output.id})),doc={id:f.scope.bindingId,title:a.output.title,revision:a.output.manuscriptRevision,paragraphs:a.output.manuscript,outputs:[a.output]};
 const body=await outputHtml(doc,a.output,{stylesheetUrl:'/assets/study-output-canvas.css',readAsset:createExportAssetReader()});
 const html=await f.request('/api/study/outputs/export',{...f.group,selectedOutputId:a.output.id,kind:'article',expectedOutput:a.expectedOutput,expectedNative:a.writingProof.expected,manuscriptRevision:a.output.manuscriptRevision,name:'Invented cup HTML',mimeType:'text/html',body});
 const read=await(await fetch(f.url+html.artifact.url)).text();assert.equal(read,body);assert.ok(read.includes('瓷 😀'));assert.ok(read.includes(words.phrase));assert.ok(read.includes('<style'));
 let c=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.carousel.output.id}));c=(await f.request('/api/study/outputs/review-words',{...f.group,selectedOutputId:c.output.id,expectedOutput:c.expectedOutput,expectedWords:c.writingProof.expected,wordsHash:c.writingProof.wordsHash,operationId:op()},200,'human:adrian')).view;
 const png=await f.request('/api/study/outputs/export',{...f.group,selectedOutputId:c.output.id,kind:'carousel',expectedOutput:c.expectedOutput,outputRevision:c.output.outputRevision});
 const saved=[];for(const file of png.export.files){const r=await fetch(f.url+file.url),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);assert.equal(digest(bytes),file.hash);if(file.mimeType==='image/png'){assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);}saved.push({...file,bytes});}
 assert.equal(saved.filter(r=>r.mimeType==='image/png').length,c.output.slides.length);assert.equal(saved.find(r=>r.name==='caption.txt').bytes.toString(),c.output.caption+'\n');
 await f.close();await f.start();for(const file of saved){const bytes=Buffer.from(await(await fetch(f.url+file.url)).arrayBuffer());assert.deepEqual(bytes,file.bytes);}
 assert.equal(await(await fetch(f.url+html.artifact.url)).text(),body);
 if(process.env.W8_PROOF_DIR){fs.mkdirSync(process.env.W8_PROOF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'invented-article.html'),body);for(const file of saved)fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,path.basename(file.name)),file.bytes);fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'files.json'),JSON.stringify({source:sourceRevision,article:html.artifact,carousel:png.export,retainedAfterRestart:true,photoPlacement:false,fontsVisuallyReviewed:false,actualHumanVisualReview:false},null,2));}
});
