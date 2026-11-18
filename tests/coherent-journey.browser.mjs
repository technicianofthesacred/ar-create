import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {digest} from '../runtime/services/files.mjs';
import {coherentFixture,op,words,sourceRevision} from './helpers/coherent-journey-fixture.mjs';
const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright');
const cleanup=[],f=await coherentFixture({after:fn=>cleanup.push(fn)}),proof=process.env.W8_PROOF_DIR;
assert.ok(proof&&path.isAbsolute(proof),'Explicit synthetic evidence destination required');fs.mkdirSync(proof,{recursive:true});
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],checks=[];
const K='ar-document-study-owned-drafts-v1',P=K+':session:';
async function open(scope=f.scope,expectedText=words.phrase){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await page.goto(f.url+'/document-study/index.html?reviewActor=agent:codex');await page.waitForFunction(()=>!!window.studyDraft);await page.evaluate(({scope})=>{let p=state.projects.find(p=>p.id===scope.parentStudyId);if(!p){p={id:scope.parentStudyId,name:'Invented cup, uncertain age',title:'Invented cup, uncertain age',view:'article',viewedStage:5,blocks:[],history:[],note:null,positions:{},slides:[],rev:1};state.projects.push(p);}p.name=p.title='Invented cup, uncertain age';state.project=p.id;p.view='article';p.viewedStage=5;render();},{scope});await page.waitForTimeout(500);await page.evaluate(scope=>{window.w8Open=studyDraft.openBinding(scope);},scope);await page.waitForFunction(id=>studyDraft.currentBinding()?.id===id,scope.bindingId);await page.waitForFunction(text=>document.querySelector('#manuscript')?.textContent.includes(text),expectedText);await page.locator('#manuscript [data-block]').first().waitFor();return page;}
async function type(page,text){const block=page.locator('#manuscript [data-block]').first();await block.click();await page.evaluate(()=>{const el=document.querySelector('#manuscript [data-block]'),r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);});await page.keyboard.insertText(text);await page.evaluate(()=>{window.w8Save=studyDraft.flush();});await page.waitForTimeout(300);}
async function shot(page,name){await page.screenshot({path:path.join(proof,name+'.png')});return {name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),title:await page.title()};}
try{
 let a=await open(),b=await open();assert.ok((await a.locator('#manuscript').innerText()).includes(words.phrase));
 for(const [name,width,height,theme] of [['desktop-dark',1440,1000,'dark'],['desktop-light',1440,1000,'light'],['phone-dark',390,844,'dark'],['phone-light',390,844,'light']]){await a.setViewportSize({width,height});await a.evaluate(theme=>{state.theme=theme;applyTheme();},theme);const screen=await shot(a,name);checks.push(screen);assert.equal(screen.overflow,false,name+' horizontal overflow');}
 await a.setViewportSize({width:1440,height:1000});await context.setOffline(true);await type(a,'Offline cup A — exact unsaved words.');await type(b,'Offline cup B — independent unsaved words.');
 const records=page=>page.evaluate(({K,P})=>({mine:JSON.parse(localStorage.getItem(P+sessionStorage.getItem(K+':current'))),all:Object.keys(localStorage).filter(k=>k.startsWith(P)).map(k=>({key:k,value:JSON.parse(localStorage.getItem(k))}))}),{K,P});
 const ra=await records(a),rb=await records(b);assert.ok(JSON.stringify(ra.mine).includes('Offline cup A'));assert.ok(JSON.stringify(rb.mine).includes('Offline cup B'));
 assert.notEqual(ra.mine.documents[f.scope.bindingId].pending.request.operationId,rb.mine.documents[f.scope.bindingId].pending.request.operationId);
 await a.close();await b.close();await context.setOffline(false);a=await open();b=await open();const recovered=await records(a);assert.ok(JSON.stringify(recovered.all).includes('Offline cup A'));assert.ok(JSON.stringify(recovered.all).includes('Offline cup B'));assert.equal((await f.native()).raw,f.raw);
 const pieceTools=a.getByRole('button',{name:'Piece tools',exact:true});
 await pieceTools.click();
 await a.getByRole('button',{name:'Recover writing',exact:true}).click();
 const recoveryTask=a.getByRole('region',{name:'Recover writing',exact:true});
 await recoveryTask.waitFor({state:'visible'});
 const retainedCopies=recoveryTask.getByRole('combobox',{name:'Retained copy',exact:true});
 assert.ok(await retainedCopies.getByRole('option',{name:/^Unsaved tab /}).count()>=2);
 await shot(a,'two-tabs-recovery');
 await recoveryTask.getByRole('button',{name:'Back to Write',exact:true}).click();
 await recoveryTask.waitFor({state:'hidden'});
 checks.push({name:'same-piece two offline tabs close/reopen',bothVariantsRetained:true,canonicalBytesUnchanged:true});
 await pieceTools.click();
 await a.getByRole('button',{name:'Sources',exact:true}).click();
 const sources=a.locator('#wbf-drawer[data-tool="sources"]');
 await sources.waitFor({state:'visible'});
 await shot(a,'source-detour');
 await a.keyboard.press('Escape');
 await sources.waitFor({state:'hidden'});
 assert.equal(await a.evaluate(()=>studyDraft.currentBinding()?.id),f.scope.bindingId);assert.equal((await f.native()).raw,f.raw);checks.push({name:'Sources detour and Esc',sameNativeBinding:true,canonicalWordsUnchanged:true});
 const secondRaw=fs.readFileSync(path.join(f.home.vault,'Workflow/3-Develop/DEV - Synthetic Two.md'),'utf8'),second=await f.request('/api/study-draft/open',{parentStudyId:'ref-an-cha',originalId:'ancha-1',originalHash:digest(secondRaw),operationId:op()}),secondScope={parentStudyId:'ref-an-cha',bindingId:second.binding.id};
 await a.close();await b.close();a=await open();b=await open(secondScope,words.second);await context.setOffline(true);await type(a,'Different cup piece retains these words.');await type(b,'Different owl piece retains separate words.');await a.close();await b.close();await context.setOffline(false);a=await open();b=await open(secondScope,words.second);const different=await records(a);assert.ok(JSON.stringify(different.all).includes('Different cup piece'));assert.ok(JSON.stringify(different.all).includes('Different owl piece'));assert.equal((await f.request(f.query('/api/study-draft/read',secondScope))).raw,secondRaw);checks.push({name:'different-piece offline tabs close/reopen',bothVariantsRetained:true,unrelatedCanonicalWordsUnchanged:true});
 fs.writeFileSync(path.join(proof,'browser.json'),JSON.stringify({schema:'ar-create.w8-browser-proof.v1',base:sourceRevision,checks,errors,actor:'agent:codex',savedHumanDecisions:'authored-synthetic-fixture-only',actualHumanAcceptance:false,appOnly:false,realCloudClients:false},null,2));
 assert.deepEqual(errors,[]);console.log('PASS populated four screens and independent same-piece offline recovery; actual human acceptance/app-only remain open');
}finally{await browser.close();for(const fn of cleanup.reverse())await fn();}
