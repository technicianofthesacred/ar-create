// A failed v3 Write save must be visible in Read and Check without changing saved words.
// Run against this checkout or AR_CREATE_PUBLIC_DIR=<installed public> to prove the installed baseline.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {syntheticHome} from '../scripts/demo.mjs';
import {fillDemo} from '../scripts/demo-fill.mjs';
import {createServer} from '../runtime/server.mjs';

const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const repo=path.resolve(import.meta.dirname,'..');
const expectWarning=process.env.AR_CREATE_EXPECT_MISSING!=='1';
const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8'));
const server=await createServer({dataDir:config.dataDir,publicDir:process.env.AR_CREATE_PUBLIC_DIR||path.join(repo,'public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,packageView:{syntheticFixtures:true}});
let browser;
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 await fillDemo(base,{only:['the-first-cup','studio-after-rain']});
 const subject='demo-the-first-cup',H={'X-AR-Actor':'human:adrian','X-AR-Client':'ui'};
 const standing=await (await fetch(base+'/api/subject/standing?parentStudyId='+subject,{headers:H})).json();
 const binding=standing.facts.bindingId,piece=standing.forms.find(f=>f.kind==='article').id;
 const readSaved=async()=>await (await fetch(base+`/api/study-draft/read?bindingId=${binding}&parentStudyId=${subject}`,{headers:H})).json();
 const before=await readSaved();
 browser=await chromium.launch({executablePath:process.env.AR_CREATE_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1280,height:900},extraHTTPHeaders:H});
 const address=mode=>`${base}/v3/index.html#/${mode}/${subject}?piece=${encodeURIComponent(piece)}`;
 const write=await context.newPage();
 await write.route('**/api/study-draft/save',route=>route.abort());
 await write.goto(address('write'));await write.waitForSelector('.wr-ed[data-ed]');
 const edit=write.locator('.wr-ed[data-ed]').first();
 const words=locator=>locator.evaluate(el=>el.value??el.textContent);
 const original=await words(edit),typed=original+' My invented sentence stays here.';
 await edit.fill(typed);
 await write.waitForFunction(b=>Object.keys(localStorage).some(k=>k.startsWith('ar-v3-write:'+b)),binding);
 await write.waitForTimeout(1700);
 const read=await context.newPage();await read.goto(address('read'));
 await read.waitForSelector('.rd-text');
 assert.equal(await read.locator('.rd-text').getByText(original,{exact:true}).count()>0,true,'Read shows saved text');
 assert.equal(await read.locator('[data-rd-unsaved]').isVisible(),expectWarning,'Read labels the saved text as older');
 const check=await context.newPage();await check.goto(address('check'));
 await check.waitForSelector('.ck-work');
 assert.equal(await check.locator('.ck-note').isVisible(),expectWarning,'Check says it covers saved words only');
 assert.equal((await readSaved()).expected.workflow.draft,before.expected.workflow.draft,'failed save did not change file revision');
 assert.equal(await words(edit),typed,'Write retains exact words');
 const second=await context.newPage();await second.route('**/api/study-draft/save',route=>route.abort());
 await second.goto(address('write'));await second.waitForSelector('.wr-ed[data-ed]');
 const secondEdit=second.locator('.wr-ed[data-ed]').nth(1);
 const secondTyped=(await words(secondEdit))+' Another tab has separate invented words.';
 await secondEdit.fill(secondTyped);
 await second.waitForFunction(b=>Object.keys(localStorage).filter(k=>k.startsWith('ar-v3-write:'+b)).length===2,binding);
 assert.equal(await words(edit),typed,'second tab did not replace first tab’s unsaved words');
 assert.equal(await words(secondEdit),secondTyped);
 assert.equal(await read.locator('[data-rd-unsaved]').isVisible(),expectWarning);
 assert.equal(await check.locator('.ck-note').isVisible(),expectWarning);
 await write.reload();await write.waitForSelector('.wr-ed[data-ed]');
 assert.equal(await words(write.locator('.wr-ed[data-ed]').first()),typed,'failed-save words return after reload');
 assert.equal(await words(secondEdit),secondTyped,'the other tab keeps its separate words after reload');
 const shots=process.env.AR_CREATE_SHOTS;
 if(shots){
  fs.mkdirSync(shots,{recursive:true});
  await read.screenshot({path:path.join(shots,'read.png')});await check.screenshot({path:path.join(shots,'check.png')});await write.screenshot({path:path.join(shots,'write.png')});
  await read.setViewportSize({width:390,height:844});await check.setViewportSize({width:390,height:844});
  assert.equal(await read.locator('[data-rd-unsaved]').isVisible(),expectWarning);
  assert.equal(await check.locator('.ck-note').isVisible(),expectWarning);
  await read.screenshot({path:path.join(shots,'read-phone.png')});await check.screenshot({path:path.join(shots,'check-phone.png')});
 }
 await context.close();
 console.log('ok - failed save retains exact words and two tabs stay separate; Read and Check warning visible:',expectWarning);
}finally{
 await browser?.close();
 if(server.listening){const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));server.closeAllConnections();await closed;}
 fs.rmSync(fixture.dir,{recursive:true,force:true});
}
