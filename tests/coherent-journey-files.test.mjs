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
 const photos=f.board.groups.flatMap(g=>g.blocks).filter(b=>b.kind==='photo').map(b=>b.photo.sourceId);
 let a=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.article.output.id}));
 a=(await f.request('/api/study/outputs/save',{...f.group,selectedOutputId:a.output.id,expectedOutput:a.expectedOutput,expectedNative:a.writingProof.expected,operationId:op(),changes:{placements:[{slot:'cover',url:'/api/sources/blob?id='+photos[0],x:.3,y:.7,zoom:1,caption:'Invented cup seam',credit:'Synthetic fixture — no real photographer'}]}},200,'human:adrian')).view;
 const doc={id:f.scope.bindingId,title:a.output.title,revision:a.output.manuscriptRevision,paragraphs:a.output.manuscript,outputs:[a.output]};
 const assetBytes=[];const readAsset=createExportAssetReader({image:async url=>{const response=await fetch(f.url+url.pathname+url.search),body=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assetBytes.push({url:url.pathname+url.search,hash:digest(body)});return {body,contentType:response.headers.get('content-type'),hash:digest(body)};}});
 const body=await outputHtml(doc,a.output,{stylesheetUrl:'/assets/study-output-canvas.css',readAsset});
 const html=await f.request('/api/study/outputs/export',{...f.group,selectedOutputId:a.output.id,kind:'article',expectedOutput:a.expectedOutput,expectedNative:a.writingProof.expected,manuscriptRevision:a.output.manuscriptRevision,name:'Invented cup HTML',mimeType:'text/html',body});
 const read=await(await fetch(f.url+html.artifact.url)).text();assert.equal(read,body);assert.ok(read.includes('瓷 😀'));assert.ok(read.includes(words.phrase));assert.ok(read.includes('<style'));
 assert.ok(read.includes('Synthetic fixture — no real photographer'));assert.ok(read.includes('data:image/png;base64,'));assert.equal(assetBytes.length,1);
 let c=await f.request(f.query('/api/study/outputs',{...f.group,selectedOutputId:f.carousel.output.id}));
 c=(await f.request('/api/study/outputs/save',{...f.group,selectedOutputId:c.output.id,expectedOutput:c.expectedOutput,operationId:op(),changes:{slides:c.output.slides.map((s,i)=>({...s,template:'H4',photos:[{src:'/api/sources/blob?id='+photos[i%3],x:25+i*20,y:65-i*15}],credit:'Invented image '+(i+1)})).reverse()}},200,'human:adrian')).view;
 c=(await f.request('/api/study/outputs/review-words',{...f.group,selectedOutputId:c.output.id,expectedOutput:c.expectedOutput,expectedWords:c.writingProof.expected,wordsHash:c.writingProof.wordsHash,operationId:op()},200,'human:adrian')).view;
 const png=await f.request('/api/study/outputs/export',{...f.group,selectedOutputId:c.output.id,kind:'carousel',expectedOutput:c.expectedOutput,outputRevision:c.output.outputRevision});
 const saved=[];for(const file of png.export.files){const r=await fetch(f.url+file.url),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);assert.equal(digest(bytes),file.hash);if(file.mimeType==='image/png'){assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1350);}saved.push({...file,bytes});}
 assert.equal(saved.filter(r=>r.mimeType==='image/png').length,c.output.slides.length);assert.equal(saved.find(r=>r.name==='caption.txt').bytes.toString(),c.output.caption+'\n');
 assert.deepEqual(JSON.parse(saved.find(r=>r.name==='output.json').bytes).slides,c.output.slides);
 await f.close();await f.start();for(const file of saved){const bytes=Buffer.from(await(await fetch(f.url+file.url)).arrayBuffer());assert.deepEqual(bytes,file.bytes);}
 assert.equal(await(await fetch(f.url+html.artifact.url)).text(),body);
 if(process.env.W8_PROOF_DIR){fs.mkdirSync(process.env.W8_PROOF_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'invented-article.html'),body);for(const file of saved)fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,path.basename(file.name)),file.bytes);fs.writeFileSync(path.join(process.env.W8_PROOF_DIR,'files.json'),JSON.stringify({source:sourceRevision,article:html.artifact,carousel:png.export,retainedAfterRestart:true,photoPlacement:true,cropsAndOrder:c.output.slides.map(s=>({id:s.id,photos:s.photos,credit:s.credit})),assetBytes,fontsVisuallyReviewed:false,actualHumanVisualReview:false},null,2));}
});
