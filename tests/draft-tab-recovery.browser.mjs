// Full application + actual file owner in two same-origin Chromium tabs.
// Run: AR_CREATE_PLAYWRIGHT=/path/to/playwright/index.mjs node tests/draft-tab-recovery.browser.mjs
// No installed app, private files or production permission changes are used.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {syntheticHome} from '../scripts/demo.mjs';
import {createServer} from '../runtime/server.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {withActor} from '../runtime/services/actor.mjs';
const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config)),actor={actor:'agent:codex',client:'ui'};
fs.mkdirSync(config.dataDir,{recursive:true});
const drafts=createStudyDraftCopies({dataDir:config.dataDir,originals:createStudyOriginals(config.studyOriginalRoots)});
const base=await withActor(actor,()=>drafts.createCollection({parentStudyId:'w1-invented',title:'Recovery proof · invented tea garden',operationId:randomUUID()}));
const copies=[];
for(const title of ['Recovery Article','Independent Article'])copies.push(await withActor(actor,()=>drafts.cloneStructureTest({sourceBindingId:base.binding.id,sourceParentStudyId:base.binding.parentStudyId,expected:base.expected,title,operationId:randomUUID()})));
const allowed=new Set(copies.map(d=>d.binding.id));
for(let i=0;i<copies.length;i++){let d=copies[i];copies[i]=await withActor(actor,()=>drafts.save({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId,expected:d.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:i?'Independent sibling wording stays exact.':'The invented tea garden waits for rain.'}]}));}
const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false});
// Test-only HTTP bridge: the real manuscript owner and provenance are used.
// Agent prose writes are permitted ONLY for this process's registered synthetic
// copies. This is not a production permission change or a human impersonation.
const handler=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',async(req,res)=>{
 if(req.method==='POST'&&req.url==='/api/study-draft/save'){
  try{let body='';for await(const c of req)body+=c;const input=JSON.parse(body);if(!allowed.has(input.bindingId)||req.headers['x-ar-actor']!=='agent:codex')throw Object.assign(Error('Synthetic stand-in only'),{status:403});const out=await withActor(actor,()=>drafts.save(input));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out));}catch(e){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}return;
 }
 handler(req,res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const cfg={url:'http://127.0.0.1:'+server.address().port,fixture,copies},dir=process.env.AR_CREATE_RECOVERY_PROOF||path.join(fixture.dir,'proof');fs.mkdirSync(dir,{recursive:true});
const api=async(route,input)=>{const response=await fetch(cfg.url+route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json','X-AR-Actor':'agent:codex','X-AR-Client':'ui'},...(input?{body:JSON.stringify(input)}:{})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;};
for(const copy of copies)await api('/api/study/structure-tests',{sourceBindingId:base.binding.id,sourceParentStudyId:base.binding.parentStudyId,expected:base.expected,title:copy.binding.title,operationId:copy.binding.parentStudyId.replace('structure-test-','')});
const group={rootBindingId:copies[0].binding.id,parentStudyId:copies[0].binding.parentStudyId},outputBefore=await api('/api/study/outputs?'+new URLSearchParams(group));
const carousel=(await api('/api/study/outputs/stand-in-create',{...group,kind:'carousel',sourceBindingId:group.rootBindingId,expectedNative:(await api('/api/study-draft/read?'+new URLSearchParams({bindingId:group.rootBindingId,parentStudyId:group.parentStudyId}))).expected,expectedOutput:outputBefore.expectedOutput,operationId:randomUUID()})).view;
const carouselBefore=JSON.stringify(carousel.output),carouselHash=carousel.writingProof.wordsHash;
function hashes(root){return Object.fromEntries(fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const file=path.join(e.parentPath,e.name);return [path.relative(root,file),createHash('sha256').update(fs.readFileSync(file)).digest('hex')];}));}
const originalsBefore=hashes(fixture.vault);
const browser=await chromium.launch({headless:true});let context=await browser.newContext({viewport:{width:1440,height:1000}});const errors=[];
try{
const K='ar-document-study-owned-drafts-v1',P=K+':session:';
const read=async d=>(await(await fetch(cfg.url+'/api/study-draft/read?'+new URLSearchParams({bindingId:d.binding.id,parentStudyId:d.binding.parentStudyId}))).json());
async function open(d=cfg.copies[0]){const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto(cfg.url+'/document-study/index.html?reviewActor=agent:codex');await page.waitForFunction(()=>!!window.studyDraft);await page.evaluate(d=>{let p=state.projects.find(p=>p.id===d.binding.parentStudyId);if(!p){p={id:d.binding.parentStudyId,name:d.binding.title,title:d.binding.title,collectionKind:'collection-root',collectionBindingId:d.binding.id,view:'article',viewedStage:5,blocks:[],history:[],note:null,positions:{},slides:[],rev:1};state.projects.push(p);}state.project=p.id;render();window.w1Open=studyDraft.openBinding({bindingId:d.binding.id,parentStudyId:p.id});},d);await page.waitForFunction(id=>studyDraft.currentBinding()?.id===id,d.binding.id,{timeout:15000});await page.locator('#manuscript').waitFor();return page;}
async function type(page,text){const block=page.locator('#manuscript [data-block]').first();await block.click(); // Select text only within the paragraph with a DOM range; typing itself uses keyboard input.
await page.evaluate(()=>{const el=document.querySelector('#manuscript [data-block]'),r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);});await page.keyboard.insertText(text);await page.evaluate(()=>{window.w1Flush=studyDraft.flush();});await page.waitForTimeout(300);}
const snapshot=page=>page.evaluate(({K,P})=>({mine:JSON.parse(localStorage.getItem(P+sessionStorage.getItem(K+':current'))),records:Object.keys(localStorage).filter(k=>k.startsWith(P)).map(k=>[k,localStorage.getItem(k)])}),{K,P});
async function recovery(page){if(await page.locator('#draft-recovery').isVisible())return;await page.locator('#combined-piece-frame .cp-more').click();await page.getByRole('button',{name:'Recover writing',exact:true}).click();await page.locator('#wbf-drawer').waitFor({state:'visible'});}
async function choose(page,words){const buttons=page.locator('[data-draft-action^="tab-preview:"]');for(let i=0;i<await buttons.count();i++){await buttons.nth(i).click();const shown=page.locator('[aria-label="Retained writing comparison"]');if((await shown.innerText()).includes(words)){await page.screenshot({path:dir+'/compare-'+(words.includes(' A ')?'a':'b')+'.png'});await page.getByRole('button',{name:'Recover these words',exact:true}).click();await page.waitForFunction(text=>document.querySelector('#manuscript')?.textContent.includes(text),words);return;}}throw Error('Missing '+words);}
const original=await read(cfg.copies[0]),sibling=await read(cfg.copies[1]);
let a=await open(),b=await open();await context.setOffline(true);await type(a,'Offline A exact words kept.');await type(b,'Offline B exact words kept.');const sa=await snapshot(a),sb=await snapshot(b);assert.match(JSON.stringify(sa.mine),/Offline A exact words/);assert.match(JSON.stringify(sb.mine),/Offline B exact words/);assert.notEqual(sa.mine.documents[original.binding.id].pending.request.operationId,sb.mine.documents[original.binding.id].pending.request.operationId);
await a.close();await b.close();await context.setOffline(false);a=await open();b=await open();assert.equal((await read(cfg.copies[0])).raw,original.raw);
await recovery(a);await pageShot(a,'reopened-two-versions');await choose(a,'Offline A exact words kept.');assert.equal((await snapshot(a)).mine.documents[original.binding.id].pending.request.operationId,sa.mine.documents[original.binding.id].pending.request.operationId);await a.getByRole('button',{name:'Retry exact save',exact:true}).click();await a.waitForFunction(({K,P,id})=>!JSON.parse(localStorage.getItem(P+sessionStorage.getItem(K+':current'))).documents[id].pending,{K,P,id:original.binding.id});assert.match((await read(cfg.copies[0])).raw,/Offline A exact words kept/);
// Existing eligible Undo owner restores exact original bytes.
await a.locator('#wbf-drawer [data-wbf-close]').click();await a.locator('#combined-piece-frame .cp-more').click();await a.getByRole('button',{name:'Undo saved',exact:true}).click();await a.waitForTimeout(350);const undone=await read(cfg.copies[0]);assert.equal(undone.raw,original.raw);assert.equal(fs.readFileSync(undone.paths.draft,'utf8'),original.raw);
await recovery(b);await choose(b,'Offline B exact words kept.');await b.evaluate(()=>studyDraft.flush());let bs=(await snapshot(b)).mine.documents[original.binding.id];assert.equal(bs.status,'Conflict');await pageShot(b,'stale-recovery');
await b.getByRole('button',{name:'Keep mine',exact:true}).click();await b.waitForTimeout(450);const reconciled=await read(cfg.copies[0]);assert.match(reconciled.raw,/Offline B exact words kept/);assert.equal((await read(cfg.copies[1])).raw,sibling.raw);

console.log('PASS same-piece native UI');
const clean=async()=>{await context.close();context=await browser.newContext({viewport:{width:1440,height:1000}});};
await clean();a=await open();b=await open(cfg.copies[1]);await context.setOffline(true);
await type(a,'Different piece A retained exactly.');const stale=(await snapshot(a)).mine;delete stale.recoverySession;
await type(b,'Different piece B retained exactly.');await a.evaluate(({K,stale})=>localStorage.setItem(K,JSON.stringify(stale)),{K,stale});await type(a,'Different piece A newest words.');
assert.match(JSON.stringify((await snapshot(b)).mine),/Different piece B retained exactly/);await a.close();await b.close();await context.setOffline(false);a=await open();b=await open(cfg.copies[1]);await recovery(b);await choose(b,'Different piece B retained exactly.');assert.equal(await b.evaluate(()=>studyDraft.currentBinding().id),sibling.binding.id);await pageShot(b,'different-piece-recovery');
console.log('PASS different pieces');
// A late successful response updates the submitted base, never the newer text.
await clean();a=await open();let releaseLate,lateCommitted;const committed=new Promise(r=>lateCommitted=r),gate=new Promise(r=>releaseLate=r);let first=true;
await a.route('**/api/study-draft/save',async route=>{if(!first)return route.continue();first=false;const response=await route.fetch();lateCommitted();await gate;await route.fulfill({response});});
await type(a,'Older submitted browser request.');await committed;await type(a,'Newer browser words survive late success.');const delayed=(await snapshot(a)).mine.documents[original.binding.id];assert.ok(delayed.pending);assert.match(delayed.blocks.map(b=>b.html).join(''),/Newer browser words/);releaseLate();
await a.waitForFunction(({K,P,id})=>!JSON.parse(localStorage.getItem(P+sessionStorage.getItem(K+':current'))).documents[id].pending,{K,P,id:original.binding.id});await a.evaluate(()=>studyDraft.flush());assert.match((await read(cfg.copies[0])).raw,/Newer browser words survive late success/);await pageShot(a,'late-save-newer-words');
console.log('PASS delayed response');
// Total localStorage write exhaustion, including the editor's ordinary cache.
await clean();a=await open();await context.setOffline(true);await type(a,'Durable browser words before quota.');const durable=(await snapshot(a)).mine;
await a.evaluate(()=>{window.w1SetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage)throw new DOMException('Synthetic quota exhausted','QuotaExceededError');return window.w1SetItem.call(this,k,v);};});
await type(a,'Keep this open tab exact words.');assert.match(await a.locator('#manuscript').innerText(),/Keep this open tab exact words/);assert.deepEqual((await snapshot(a)).mine,durable);await recovery(a);assert.match(await a.locator('#wbf-drawer').innerText(),/Device recovery is unavailable/);await pageShot(a,'storage-quota-warning');
await a.evaluate(()=>{Storage.prototype.setItem=window.w1SetItem;});await context.setOffline(false);await a.waitForTimeout(350);await a.evaluate(()=>studyDraft.flush());await a.evaluate(()=>studyDraft.flush());assert.match((await read(cfg.copies[0])).raw,/Keep this open tab exact words/);
console.log('PASS quota');
// Exact v1 migration and an independently malformed record, in real storage.
await clean();const legacy=structuredClone(sa.mine);delete legacy.recoverySession;await context.addInitScript(({K,legacy})=>localStorage.setItem(K,JSON.stringify(legacy)),{K,legacy});a=await open();const migrated=await snapshot(a);assert.ok(migrated.records.some(([k,v])=>k.includes(':legacy:')&&v===JSON.stringify(legacy)));assert.deepEqual(migrated.mine.documents[original.binding.id].pending.request,legacy.documents[original.binding.id].pending.request);await recovery(a);await pageShot(a,'legacy-migration');
await clean();await context.addInitScript(K=>localStorage.setItem(K,'{malformed exact legacy bytes'),K);a=await open();assert.equal(await a.evaluate(K=>localStorage.getItem(K),K),'{malformed exact legacy bytes');await recovery(a);assert.match(await a.locator('#wbf-drawer').innerText(),/older recovery record could not be read/);await pageShot(a,'malformed-kept');
// The same recovery entrance and content fit the actual narrow screen.
await a.setViewportSize({width:390,height:844});await pageShot(a,'recovery-phone-dark');assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await a.evaluate(()=>{state.theme='light';applyTheme();});await pageShot(a,'recovery-phone-light');assert.ok(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
assert.equal((await read(cfg.copies[1])).raw,sibling.raw);const carouselAfter=await api('/api/study/outputs?'+new URLSearchParams({...group,selectedOutputId:carousel.output.id}));assert.equal(JSON.stringify(carouselAfter.output),carouselBefore);assert.equal(carouselAfter.writingProof.wordsHash,carouselHash);assert.deepEqual(hashes(fixture.vault),originalsBefore);assert.equal(errors.length,0,errors.join('\n'));
const result={samePiece:'both variants retained after closing/reopening two Chromium tabs',requests:{a:sa.mine.documents[original.binding.id].pending.request,b:sb.mine.documents[original.binding.id].pending.request},undo:{before:createHash('sha256').update(original.raw).digest('hex'),restored:createHash('sha256').update(undone.raw).digest('hex')},reconciled,siblingUnchanged:true,carouselUnchanged:{outputId:carousel.output.id,wordsHash:carouselHash},originalsUnchanged:originalsBefore,checks:['same piece offline close/reopen','different pieces and stale v1 writer','menu to compare/recover','deliberate guarded save and conflict reconciliation','exact eligible saved Undo','late response preserves newer typing','total localStorage quota and retry','legacy migration exact request','malformed bytes preserved','390px dark/light no horizontal overflow'],fixture:cfg.fixture,errors};fs.writeFileSync(dir+'/browser-proof.json',JSON.stringify(result,null,2));console.log('PASS all native recovery cases, exact file Undo, sibling Carousel and originals unchanged',errors);
async function pageShot(p,name){await p.screenshot({path:dir+'/'+name+'.png'});}

}catch(error){console.error('NATIVE FAILURE',error);throw error;}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
