// Self-contained synthetic native proof. No provider, private data or installed port.
// AR_CREATE_PLAYWRIGHT=/absolute/path/playwright/index.mjs AR_CREATE_SIMMER_SHOTS=/tmp/proof node tests/simmer-recovery.browser.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createLibrary} from '../runtime/services/library.mjs';
import {createSimmerBoards} from '../runtime/services/simmer-board.mjs';
import {createSimmerChat} from '../runtime/services/simmer-chat.mjs';
import {withActor} from '../runtime/services/actor.mjs';
import {inventedPhoto} from './helpers/simmer-demo.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const proof=process.env.AR_CREATE_SIMMER_SHOTS||fs.mkdtempSync(path.join(os.tmpdir(),'simmer-recovery-proof-'));fs.mkdirSync(proof,{recursive:true});
const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config)),photos=path.join(fixture.dir,'incoming');fs.mkdirSync(photos);fs.writeFileSync(path.join(photos,'Kettle.png'),inventedPhoto(0,64,80));
let server=await createServer({dataDir:config.dataDir,publicDir:path.resolve('public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,headers={'Content-Type':'application/json','X-AR-Actor':'agent:codex','X-AR-Client':'http'};
const post=async(route,input)=>{const r=await fetch(base+route,{method:'POST',headers,body:JSON.stringify(input)});return {status:r.status,body:await r.json()};};
const first=await post('/api/simmer/intake',{title:'Invented kettle at dawn',words:['Invented: the first note is already here.'],operationId:randomUUID()});assert.equal(first.status,200);const subject=first.body.subject;
const input={subject,folder:photos,words:[{text:'Invented: “Keep the crack.” These are my exact words.',said:'spoken'}],operationId:randomUUID()};
await new Promise(r=>server.close(r));
const library=createLibrary({dataDir:config.dataDir}),boards=createSimmerBoards({dataDir:config.dataDir,library});let compete=true;
const chat=createSimmerChat({dataDir:config.dataDir,library,boards,checkpoint:async key=>{if(key!=='note'||!compete)return;compete=false;const b=await boards.read({subject});await boards.save({subject,operationId:randomUUID(),expectedRevision:b.revision,expectedHash:b.hash,board:{...b,title:'Invented kettle at dawn · changed elsewhere'}});}});
let partial;await assert.rejects(withActor({actor:'agent:codex',client:'cli'},()=>chat.intake(input)),e=>{partial=e.receipt;return e.status===409;});
server=await createServer({dataDir:config.dataDir,publicDir:path.resolve('public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});await new Promise(r=>server.listen(Number(new URL(base).port),'127.0.0.1',r));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/document-study/index.html?reviewActor=agent:codex');await page.waitForFunction(()=>!!window.arSimmer);
 await page.evaluate(subject=>window.arSimmer.open({subject,title:'Invented kettle at dawn'}),subject);
 await page.locator('.sm-intake:not([hidden])').waitFor();assert.match(await page.locator('.sm-intake').innerText(),/2 sources kept.*Collection saved/);assert.match(await page.locator('.sm-intake').innerText(),/board awaiting confirmation/);
 const noteLink=page.getByRole('link',{name:'Open your words'}),href=await noteLink.getAttribute('href'),bytes=await (await fetch(base+href)).text();assert.ok(bytes.includes(input.words[0].text));assert.ok(bytes.includes('carried_by: "agent:codex"'));
 for(const theme of ['light','dark'])for(const [width,height,size] of [[1440,900,'desktop'],[390,844,'phone']]){
  await page.setViewportSize({width,height});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.equal(await page.locator('.sm-intake').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
  await page.screenshot({path:path.join(proof,`partial-${size}-${theme}.png`)});
 }
 await page.getByRole('button',{name:'Check again',exact:true}).click();await page.locator('.sm-intake:not([hidden])').waitFor();
 const current=await boards.read({subject}),retry=await post('/api/simmer/intake',{...input,resume:{expectedRevision:current.revision,expectedHash:current.hash}});assert.equal(retry.status,200,JSON.stringify(retry.body));
 await page.getByRole('button',{name:'Check again',exact:true}).click();await page.locator('.sm-intake').waitFor({state:'hidden'});assert.equal(await page.locator('.sm-blk').count(),3);
 await page.screenshot({path:path.join(proof,'recovered-phone-dark.png')});
 const reread=await (await fetch(base+'/api/simmer/material?subject='+encodeURIComponent(subject))).json();assert.equal(reread.operations.find(r=>r.operationId===input.operationId).status,'complete');assert.equal(reread.collection.sourceIds.length,3);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(proof,'proof.json'),JSON.stringify({base,subject,partial,final:{revision:retry.body.revision,sources:reread.collection.sourceIds.length,blocks:reread.groups.flatMap(g=>g.blocks).length},exactNoteOpened:true,screenWidths:[1440,390],themes:['light','dark'],pageErrors:errors},null,2));
 console.log('Native recovery proof passed: partial and source links, four screens, reload, guarded resume, exact words, three unique sources/blocks. Evidence: '+proof);
}finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});}
