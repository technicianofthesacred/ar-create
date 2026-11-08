import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {createRequire} from 'node:module';import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),code=fs.readFileSync(new URL('../public/document-study/draft-flow.js',import.meta.url),'utf8'),tick=()=>new Promise(r=>setTimeout(r,35));
async function owner(t,parentStudyId='invented-ui'){const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'one-copy-ui-'))),service=createStudyDraftCopies({dataDir,originals:{catalog:()=>({drafts:[]}),readDraft:()=>null}});const d=await service.createCollection({parentStudyId,title:'Invented piece',operationId:randomUUID()});const windows=[];t.after(()=>{for(const dom of windows)dom.window.close();fs.rmSync(dataDir,{recursive:true,force:true});});return {service,parentStudyId,bindingId:d.binding.id,windows};}
async function fixture(o,{storage,delay=false,shared,session,project,saveError=false,bindingKind,locks,lastDurable}={}){const dom=new JSDOM('<main id="app"></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,calls=[];let offline=false,release,saveGate=null,saveRelease;const gate=delay?new Promise(r=>release=r):Promise.resolve();const p={id:o.parentStudyId,title:'Invented piece',collectionKind:'collection-root',collectionBindingId:o.bindingId,view:'article',viewedStage:5,blocks:[{id:'initial',tag:'p',html:'<br>'}],history:[],note:null,positions:{}};
 Object.assign(w,{state:{projects:[p]},current:()=>p,selected:null,activeBlock:null,keyboardBlock:null,typingSession:null,WORKFLOW_RECORDS:{},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),readonlyHTML:s=>s,shortRecordName:s=>s,toast:()=>{},rememberPosition:()=>{},commitTyping:()=>{},save:()=>{if(saveError)throw Error('quota exceeded');},onTyping:el=>{p.blocks=[...el.children].map(c=>({id:c.dataset.block,tag:c.tagName.toLowerCase(),html:c.innerHTML}));},viewPhase:n=>{p.viewedStage=n;w.render();},setView:v=>{p.view=v;w.render();},blockHTML:b=>'<'+b.tag+' data-block="'+b.id+'">'+b.html+'</'+b.tag+'>',article:()=>'<div class="workbar"><span class="saved"></span></div><div id="manuscript" contenteditable="true">'+p.blocks.map(b=>w.blockHTML(b)).join('')+'</div>',undo:()=>{},workflowBar:()=>'',refreshDiscussion:()=>{},phaseReader:()=>'',historicalNotice:()=>'',wireDocument:()=>{},openInstruction:()=>{},render:()=>{w.document.getElementById('app').innerHTML='<section id="workspace">'+w.article(p)+'</section>';w.wireDocument();}});
 w.fetch=async(url,init)=>{const input=init?JSON.parse(init.body):Object.fromEntries(new URL(url,'http://localhost').searchParams);calls.push({url,input});if(url.includes('/catalog'))await gate;if(offline&&url.endsWith('/save'))throw Error('Offline');try{const route=url.split('/').at(-1).split('?')[0],value=route==='catalog'?await o.service.catalog():route==='read'?await o.service.read(input):route==='inspect'?await o.service.inspect(input):route==='save'?await o.service.save(input):route==='history-preview'?await o.service.previewVersion(input):route==='history-restore'?await o.service.restoreVersion(input):route==='undo'?await o.service.undo(input):await o.service.openCopy(input);if(bindingKind&&value.binding)value.binding.kind=bindingKind;if(route==='save'&&saveGate)await saveGate;return {ok:true,json:async()=>value};}catch(error){return {ok:false,status:error.status||500,json:async()=>({error:error.message})};}};
 if(locks)Object.defineProperty(w.navigator,'locks',{value:locks});if(lastDurable)w.sessionStorage.setItem('ar-document-study-owned-drafts-v1:last-durable',lastDurable);if(project)Object.assign(p,structuredClone(project));if(shared)Object.defineProperty(w,'localStorage',{value:shared});if(session)w.sessionStorage.setItem('ar-document-study-owned-drafts-v1:current',session);o.windows.push(dom);if(storage)w.localStorage.setItem('ar-document-study-owned-drafts-v1',storage);w.eval(fs.readFileSync(new URL('../public/document-study/recovery-storage.js',import.meta.url),'utf8'));w.eval(code);if(!delay)await tick();return {w,p,dom,calls,release,setOffline:v=>offline=v,holdSave(){saveGate=new Promise(r=>saveRelease=r);},releaseSave(){saveRelease();saveGate=null;},type(words){const editor=w.document.getElementById('manuscript');editor.firstElementChild.textContent=words;w.onTyping(editor);},saved:()=>w.localStorage.getItem(PREFIX+w.sessionStorage.getItem(SESSION))};}

const LEGACY='ar-document-study-owned-drafts-v1',PREFIX=LEGACY+':session:',SESSION=LEGACY+':current';
function sharedStore(){const m=new Map();return {m,fail:false,get length(){return m.size},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,setItem(k,v){if(this.fail)throw Error('quota exceeded');m.set(k,String(v));},removeItem:k=>m.delete(k)};}
const variants=f=>[...f.w.document.querySelectorAll('[data-draft-action^="tab-preview:"]')];
async function recover(f,words){f.w.render();for(const key of variants(f).map(b=>b.dataset.draftAction)){variants(f).find(b=>b.dataset.draftAction===key).click();if(f.w.document.querySelector('[aria-label="Retained writing comparison"]')?.textContent.includes(words)){f.w.document.querySelector('[data-draft-action="tab-restore"]').click();await tick();assert.match(f.w.document.getElementById('manuscript').textContent,new RegExp(words),[...f.w.document.querySelectorAll('[data-draft-error]')].map(e=>e.textContent).join(' | '));return;}}assert.fail('Missing recovery '+words);}

test('same-piece offline writers retain separate exact requests across closed tabs; explicit recovery and guarded save preserve Undo',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared}),b=await fixture(o,{shared});
 const before=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});
 a.setOffline(true);b.setOffline(true);a.type('Unsaved A exact words.');await a.w.studyDraft.flush();b.type('Unsaved B exact words.');await b.w.studyDraft.flush();
 const ar=JSON.parse(a.saved()).documents[o.bindingId],br=JSON.parse(b.saved()).documents[o.bindingId];assert.notEqual(ar.pending.request.operationId,br.pending.request.operationId);assert.match(a.saved(),/Unsaved A/);assert.match(b.saved(),/Unsaved B/);
 a.w.close();b.w.close();const reopened=await fixture(o,{shared});assert.equal(variants(reopened).length,2);assert.doesNotMatch((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/Unsaved/);
 await recover(reopened,'Unsaved A exact words.');assert.deepEqual(JSON.parse(reopened.saved()).documents[o.bindingId].pending.request,ar.pending.request);await reopened.w.studyDraft.flush();assert.match((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/Unsaved A/);
 reopened.w.document.querySelector('[data-draft-action="disk-undo"]').click();await tick();assert.equal((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,before.raw);
 await recover(reopened,'Unsaved B exact words.');await reopened.w.studyDraft.flush();assert.equal(JSON.parse(reopened.saved()).documents[o.bindingId].status,'Conflict');assert.match(reopened.w.document.getElementById('manuscript').textContent,/Unsaved B/);
});
test('different pieces and a stale v1 whole-object writer cannot erase another page recovery',async t=>{
 const x=await owner(t,'piece-a'),y=await owner(t,'piece-b'),shared=sharedStore(),a=await fixture(x,{shared}),b=await fixture(y,{shared});a.setOffline(true);b.setOffline(true);
 a.type('Independent A retained.');await a.w.studyDraft.flush();const stale=JSON.parse(a.saved());delete stale.recoverySession;
 b.type('Independent B retained.');await b.w.studyDraft.flush();shared.setItem(LEGACY,JSON.stringify(stale));a.type('Independent A newer.');await a.w.studyDraft.flush();assert.match(b.saved(),/Independent B retained/);
 a.w.close();b.w.close();const reopenB=await fixture(y,{shared});await recover(reopenB,'Independent B retained');assert.equal(reopenB.w.studyDraft.currentBinding().id,y.bindingId);
});
test('late older save completion keeps newer typing and pending base, then retry saves exact words',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared});a.holdSave();a.type('Older request words.');const pending=a.w.studyDraft.flush();await tick();a.type('Newer exact words remain.');const before=JSON.parse(a.saved()).documents[o.bindingId];assert.match(before.pending.blocks[0].html,/Older/);assert.match(before.blocks[0].html,/Newer/);
 a.releaseSave();await pending;assert.match(a.saved(),/Newer exact words remain/);assert.match(a.w.document.getElementById('manuscript').textContent,/Newer exact/);await a.w.studyDraft.flush();assert.match((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/Newer exact words remain/);
});
test('quota failure leaves current DOM and prior durable words, warns, and can retry after storage returns',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared});a.setOffline(true);a.type('Durable before quota.');await a.w.studyDraft.flush();shared.fail=true;a.type('Only in this open window.');await a.w.studyDraft.flush();assert.match(a.saved(),/Durable before quota/);assert.match(a.w.document.body.textContent,/Device recovery is unavailable/);assert.match(a.w.document.getElementById('manuscript').textContent,/Only in this open window/);
 shared.fail=false;a.setOffline(false);await a.w.studyDraft.flush();await a.w.studyDraft.flush();assert.match((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/Only in this open window/);assert.doesNotMatch(a.w.document.querySelector('[data-draft-status]').textContent,/Device recovery is unavailable/);
});
test('legacy migration preserves exact pending request and malformed bytes without replacing them',async t=>{
 const o=await owner(t),seed=await fixture(o);seed.setOffline(true);seed.type('Legacy exact pending words.');await seed.w.studyDraft.flush();const legacy=JSON.parse(seed.saved());delete legacy.recoverySession;seed.w.close();const shared=sharedStore();shared.setItem(LEGACY,JSON.stringify(legacy));const f=await fixture(o,{shared});assert.match(f.saved(),/Legacy exact pending words/);assert.ok([...shared.m.entries()].some(([k,v])=>k.startsWith(PREFIX+'legacy:')&&v===JSON.stringify(legacy)));
 f.w.close();const broken=sharedStore();broken.setItem(LEGACY,'{bad JSON exact bytes');const g=await fixture(o,{shared:broken});assert.equal(broken.getItem(LEGACY),'{bad JSON exact bytes');assert.equal([...broken.m.keys()].some(k=>k.startsWith(PREFIX+'legacy:')),false,'Malformed mirror stays unchanged rather than allocating a redundant startup archive');assert.match(g.w.document.body.textContent,/older recovery record could not be read/);
});


test('an old client that retained a v2 marker still has its changed whole snapshot archived exactly',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared});a.setOffline(true);a.type('New writer exact words.');await a.w.studyDraft.flush();
 const old=JSON.parse(a.saved());old.documents[o.bindingId].blocks[0].html='Old client exact words.';const raw=JSON.stringify(old);shared.setItem(LEGACY,raw);a.type('New writer newer words.');await a.w.studyDraft.flush();
 assert.ok([...shared.m.entries()].some(([k,v])=>k.includes(':legacy:')&&v===raw));a.w.render();assert.ok(variants(a).length);await recover(a,'Old client exact words.');
});


test('a malformed retained entry cannot hide a valid later recovery',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared});a.setOffline(true);a.type('Valid later recovered words.');await a.w.studyDraft.flush();const good=JSON.parse(a.saved()),bad=structuredClone(good);delete bad.recoverySession;delete bad.documents[o.bindingId].pending;bad.documents[o.bindingId].blocks[0].html='<table><tr><td>Unsupported retained words.</td></tr></table>';
 const first=sharedStore();first.setItem(PREFIX+'broken',JSON.stringify(bad));first.setItem(PREFIX+'valid',JSON.stringify(good));const f=await fixture(o,{shared:first});await recover(f,'Valid later recovered words.');assert.equal(first.getItem(PREFIX+'broken'),JSON.stringify(bad));
});
test('reload uses this tab snapshot instead of another tab browser cache, even when all writes fail at startup',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared});a.setOffline(true);a.type('This tab exact reload words.');await a.w.studyDraft.flush();const session=a.w.sessionStorage.getItem(SESSION),project=structuredClone(a.p);project.blocks[0].html='Other tab global browser cache.';project.ownedDraft.sequence=0;a.w.close();shared.fail=true;
 const reopened=await fixture(o,{shared,session,project,saveError:true});assert.ok(reopened.w.studyDraft);assert.match(reopened.w.document.getElementById('manuscript').textContent,/This tab exact reload words/);assert.match(reopened.w.document.body.textContent,/Device recovery is unavailable/);assert.match(shared.getItem(PREFIX+session),/This tab exact reload words/);
});

test('equal wording keeps each distinct retained tab identity and exact request',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared}),b=await fixture(o,{shared});
 a.setOffline(true);b.setOffline(true);a.type('Same words, separate unfinished requests.');await a.w.studyDraft.flush();b.type('Same words, separate unfinished requests.');await b.w.studyDraft.flush();
 const ar=JSON.parse(a.saved()).documents[o.bindingId],br=JSON.parse(b.saved()).documents[o.bindingId];assert.notEqual(ar.pending.request.operationId,br.pending.request.operationId);
 a.w.close();b.w.close();const reopened=await fixture(o,{shared});assert.equal(variants(reopened).length,2);assert.equal(reopened.w.studyDraft.recoveryState().count>=2,true);
});


test('focused recovery hides foreign-original and output-fork legacy actions and refuses synthetic discard',async t=>{
 for(const mode of ['foreign-original','output-fork']){
  const o=await owner(t,mode),storage=JSON.stringify({projects:{[o.parentStudyId]:{active:null,browser:{blocks:[{id:'legacy',tag:'p',html:'Foreign earlier words remain exact.'}],history:[],note:null,...(mode==='foreign-original'?{originalId:'another-original'}:{})}}},documents:{}}),f=await fixture(o,{storage,...(mode==='output-fork'?{bindingKind:'output-fork'}:{})});
  const before=JSON.parse(f.saved()).projects[o.parentStudyId].browser,raw=(await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw;
  assert.equal(f.w.studyDraft.openRecovery(),true);assert.equal(f.w.document.querySelector('#rp-version option[value="legacy-browser"]'),null);assert.equal(f.w.document.querySelector('#draft-recovery-task [data-recovery-task-action="discard-earlier"]'),null);
  const attempted=f.w.document.createElement('button');attempted.dataset.draftAction='discard-earlier';f.w.document.getElementById('draft-recovery-task').append(attempted);attempted.click();await tick();
  assert.deepEqual(JSON.parse(f.saved()).projects[o.parentStudyId].browser,before);assert.equal((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,raw);assert.match(f.w.document.getElementById('draft-recovery-task').textContent,/belongs to its original piece/);
 }
});

test('focused failed-save recovery reads latest saved comparison and renders inspection failures in the task',async t=>{
 const o=await owner(t),f=await fixture(o);f.setOffline(true);f.type('Unsent exact current words.');await f.w.studyDraft.flush();
 const before=JSON.parse(f.saved()).documents[o.bindingId].pending.request,saved=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});
 await o.service.save({bindingId:o.bindingId,parentStudyId:o.parentStudyId,expected:saved.expected,operationId:randomUUID(),operations:[{kind:'insert',id:randomUUID(),beforeId:null,raw:'New outside saved words.'}]});
 f.w.studyDraft.openRecovery();f.w.document.querySelector('#draft-recovery-task [data-draft-action="read"]').click();await tick();
 assert.match(f.w.document.querySelector('#draft-recovery-task .rp-saved').textContent,/New outside saved words/);assert.ok(f.w.document.querySelector('#draft-recovery-task [data-draft-action="use-saved"]'));assert.deepEqual(JSON.parse(f.saved()).documents[o.bindingId].pending.request,before);
 f.w.document.querySelector('#draft-recovery-task [data-draft-action="inspect"]').click();await tick();assert.match(f.w.document.querySelector('#draft-recovery-task .draft-error').textContent,/Save receipt|unavailable|not found|Unknown|expected/i);
});

test('document Enter can pause on a new empty paragraph without sending an unsupported split',async t=>{
 const o=await owner(t),f=await fixture(o);f.type('First paragraph.');await f.w.studyDraft.flush();await tick();const before=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});
 const editor=f.w.document.getElementById('manuscript'),empty=f.w.document.createElement('p');empty.innerHTML='<br>';editor.append(empty);f.w.onTyping(editor);await f.w.studyDraft.flush();await tick();
 assert.equal((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,before.raw);assert.equal(f.w.studyDraft.currentProof().dirty,false);assert.equal(editor.lastElementChild,empty);
 empty.textContent='Second paragraph.';f.w.onTyping(editor);await f.w.studyDraft.flush();await tick();const saved=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});assert.deepEqual(saved.projection.filter(p=>p.safe).map(p=>p.words),['First paragraph.','Second paragraph.']);assert.equal(f.w.studyDraft.currentProof().dirty,false);
});
test('document Shift+Enter uses an explicit line-break save and reloads the same paragraph structure',async t=>{
 const o=await owner(t),f=await fixture(o);f.type('First line.');await f.w.studyDraft.flush();await tick();const editor=f.w.document.getElementById('manuscript'),first=editor.firstElementChild;first.innerHTML='First line.<br>Second line.';f.w.onTyping(editor);await f.w.studyDraft.flush();await tick();
 const saves=f.calls.filter(c=>c.url.endsWith('/save'));assert.equal(saves.at(-1).input.operations[0].kind,'lineBreakText');const saved=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});assert.equal(saved.projection.find(p=>p.safe).words,'First line.\nSecond line.');assert.equal(f.w.studyDraft.currentProof().dirty,false);assert.equal(editor.firstElementChild,first);
 const reopened=await fixture(o);assert.equal(reopened.w.document.getElementById('manuscript').firstElementChild.innerHTML,'First line.<br>Second line.');
});

// A reload must not require another full copy before retained words can be used.
test('reopening retained writing near quota preserves exact recovery and remains writable',async t=>{
 const o=await owner(t),shared=sharedStore(),seed=await fixture(o,{shared});
 seed.setOffline(true);seed.type('Synthetic retained words. '+ 'x'.repeat(1000));seed.p.history=Array.from({length:150},()=>({blocks:structuredClone(seed.p.blocks),note:null}));seed.type('Synthetic retained words. '+ 'x'.repeat(1000)+' retained tail');await seed.w.studyDraft.flush();
 const session=seed.w.sessionStorage.getItem(SESSION),project=structuredClone(seed.p),before=new Map(shared.m);seed.w.close();
 const limit=[...shared.m.values()].reduce((n,s)=>n+s.length,0)+160000,put=shared.setItem.bind(shared);
 shared.setItem=(k,v)=>{const size=[...shared.m.entries()].reduce((n,[key,s])=>n+(key===k?0:s.length),0)+String(v).length;if(size>limit)throw new DOMException('Synthetic browser quota exhausted','QuotaExceededError');put(k,v);};
 const reopened=await fixture(o,{shared,session,project});
 assert.match(reopened.w.document.getElementById('manuscript').textContent,/Synthetic retained words/);
 for(const [key,value] of before)if(key.startsWith(PREFIX))assert.equal(shared.getItem(key),value,'Prior recovery bytes remain exact');
 assert.equal(reopened.w.studyDraft.recoveryState().unavailable,false,'Recovery must remain usable without clearing older copies');
 const decode=f=>f.w.arRecoveryStorage.parse(f.saved()),pending=JSON.parse(JSON.stringify(reopened.w.arRecoveryStorage.parse(before.get(PREFIX+session)).documents[o.bindingId].pending.request));
 assert.deepEqual(JSON.parse(JSON.stringify(decode(reopened).documents[o.bindingId].pending.request)),pending);
 await reopened.w.studyDraft.flush();assert.match((await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId})).raw,/Synthetic retained words/);
 reopened.type('New exact words after quota repair.');await reopened.w.studyDraft.flush();
 const saved=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});assert.match(saved.raw,/New exact words after quota repair/);
 const nextSession=reopened.w.sessionStorage.getItem(SESSION),nextProject=structuredClone(reopened.p);reopened.w.close();
 const fresh=await fixture(o,{shared,session:nextSession,project:nextProject});assert.equal(fresh.w.studyDraft.recoveryState().unavailable,false);
 assert.match(fresh.w.document.getElementById('manuscript').textContent,/New exact words after quota repair/);
 fresh.w.document.querySelector('[data-draft-action="disk-undo"]').click();await tick();
 const undone=await o.service.read({bindingId:o.bindingId,parentStudyId:o.parentStudyId});assert.match(undone.raw,/Synthetic retained words/);assert.doesNotMatch(undone.raw,/New exact words after quota repair/);
 fresh.setOffline(true);fresh.p.history=Array.from({length:150},()=>({blocks:structuredClone(fresh.p.blocks),note:null}));fresh.type('Local words kept before explicit recovery.');await fresh.w.studyDraft.flush();
 await recover(fresh,'Synthetic retained words');
 const archives=[...shared.m].filter(([key])=>key.startsWith(PREFIX+'before-recovery:'));assert.ok(archives.length,'Explicit recovery durably archives the replaced current buffer');
 assert.ok(archives.some(([,raw])=>JSON.stringify(fresh.w.arRecoveryStorage.parse(raw)).includes('Local words kept before explicit recovery.')));
 for(const [key,value] of before)if(key.startsWith(PREFIX))assert.equal(shared.getItem(key),value,'Original recovery bytes survive edit, save, reload and Undo');
});

test('packed startup retains an unchanged legacy mirror instead of allocating a redundant archive',async t=>{
 const o=await owner(t),shared=sharedStore(),seed=await fixture(o,{shared});seed.setOffline(true);seed.type('Invented exact retained words.');seed.p.history=Array.from({length:400},()=>({blocks:structuredClone(seed.p.blocks),note:{text:'An invented retained note '.repeat(10)}}));seed.type('Invented exact retained words. Tail.');await seed.w.studyDraft.flush();
 const session=seed.w.sessionStorage.getItem(SESSION),project=structuredClone(seed.p),legacy=seed.w.arRecoveryStorage.parse(seed.saved());delete legacy.recoverySession;const legacyRaw=JSON.stringify(legacy);shared.setItem(LEGACY,legacyRaw);seed.w.close();
 const before=new Map(shared.m),limit=[...shared.m.values()].reduce((n,v)=>n+v.length,0)+35000,put=shared.setItem.bind(shared);shared.setItem=(key,value)=>{if([...shared.m].reduce((n,[k,v])=>n+(k===key?0:v.length),0)+value.length>limit)throw Error('quota');put(key,value);};
 const reopened=await fixture(o,{shared,session,project});assert.equal(reopened.w.studyDraft.recoveryState().unavailable,false);assert.match(reopened.w.document.getElementById('manuscript').textContent,/Invented exact retained words. Tail./);
 assert.equal(shared.getItem(LEGACY),legacyRaw);for(const [key,value]of before)assert.equal(shared.getItem(key),value);
 assert.equal([...shared.m.keys()].filter(key=>!before.has(key)&&key.startsWith(PREFIX)).length,1,'Only the new tab writer is allocated; no unchanged-mirror archive');
});

function exclusiveLocks(){const held=new Map(),requests=[];let paused=false;return {held,pause(){paused=true;},resume(){paused=false;for(const r of requests.splice(0))r();},request(name,options,callback){return new Promise((resolve,reject)=>{const invoke=()=>{if(held.has(name)){Promise.resolve(callback(null)).then(resolve,reject);return;}const token={};held.set(name,token);Promise.resolve(callback(token)).then(value=>{if(held.get(name)===token)held.delete(name);resolve(value);},reject);};if(paused)requests.push(invoke);else queueMicrotask(invoke);});}};}
const unload=f=>f.w.dispatchEvent(new f.w.Event('pagehide'));
test('exclusive same-tab reload reuses only its last durable writer while a duplicate stays independent',async t=>{
 const o=await owner(t),shared=sharedStore(),locks=exclusiveLocks(),a=await fixture(o,{shared,locks});a.setOffline(true);a.type('Retained owned words.');await a.w.studyDraft.flush();const id=a.w.sessionStorage.getItem(SESSION);assert.equal(a.w.sessionStorage.getItem(LEGACY+':last-durable'),id);const own=shared.getItem(PREFIX+id),project=structuredClone(a.p),duplicate=await fixture(o,{shared,locks,session:id,lastDurable:id,project});assert.notEqual(duplicate.w.sessionStorage.getItem(SESSION),id);assert.equal(shared.getItem(PREFIX+id),own);
 unload(a);await tick();const reload=await fixture(o,{shared,locks,session:id,lastDurable:id,project});assert.equal(reload.w.sessionStorage.getItem(SESSION),id);assert.match(reload.saved(),/Retained owned words/);assert.equal(reload.w.studyDraft.recoveryState().unavailable,false);assert.deepEqual(JSON.parse(reload.saved()).documents[o.bindingId].pending.request,JSON.parse(own).documents[o.bindingId].pending.request);
});
test('pending ownership queues early current-buffer typing and refuses a changed prior record',async t=>{
 const o=await owner(t),shared=sharedStore(),locks=exclusiveLocks(),a=await fixture(o,{shared,locks});a.setOffline(true);a.type('Earlier exact words.');await a.w.studyDraft.flush();const id=a.w.sessionStorage.getItem(SESSION),project=structuredClone(a.p);unload(a);await tick();const beforePending=shared.getItem(PREFIX+id);locks.pause();const reload=await fixture(o,{shared,locks,session:id,lastDurable:id,project});reload.setOffline(true);reload.type('Early typing while the lock is pending.');assert.equal(shared.getItem(PREFIX+id),beforePending,'Pending writer cannot touch the shared slot');const original=shared.getItem(PREFIX+id),changed=JSON.parse(original);changed.externalMarker='A newer writer value';shared.setItem(PREFIX+id,JSON.stringify(changed));locks.resume();await tick();assert.equal(shared.getItem(PREFIX+id),JSON.stringify(changed));assert.notEqual(reload.w.sessionStorage.getItem(SESSION),id);assert.match(reload.saved(),/Early typing while the lock is pending/);assert.equal(reload.w.studyDraft.recoveryState().unavailable,false);
});
test('unleased legacy and unavailable Web Locks never reuse a previous writer',async t=>{
 const o=await owner(t),shared=sharedStore(),a=await fixture(o,{shared}),id=a.w.sessionStorage.getItem(SESSION),own=shared.getItem(PREFIX+id),project=structuredClone(a.p);
 for(const locks of [undefined,{request(){return Promise.reject(Error('Unavailable'));}},exclusiveLocks()]){const next=await fixture(o,{shared,locks,session:id,project});assert.notEqual(next.w.sessionStorage.getItem(SESSION),id);assert.equal(shared.getItem(PREFIX+id),own);}
});
test('pagehide releases the lease and BFCache return cannot overwrite another holder',async t=>{
 const o=await owner(t),shared=sharedStore(),locks=exclusiveLocks(),a=await fixture(o,{shared,locks}),id=a.w.sessionStorage.getItem(SESSION),project=structuredClone(a.p);unload(a);await tick();const b=await fixture(o,{shared,locks,session:id,lastDurable:id,project}),before=shared.getItem(PREFIX+id);const event=new a.w.Event('pageshow');Object.defineProperty(event,'persisted',{value:true});a.w.dispatchEvent(event);await tick();assert.notEqual(a.w.sessionStorage.getItem(SESSION),id);assert.equal(b.w.sessionStorage.getItem(SESSION),id);assert.equal(shared.getItem(PREFIX+id),before);
});

test('a changed admitted own record fails closed while retaining new words in the current buffer',async t=>{
 const o=await owner(t),shared=sharedStore(),locks=exclusiveLocks(),a=await fixture(o,{shared,locks});a.setOffline(true);const id=a.w.sessionStorage.getItem(SESSION),changed=JSON.parse(shared.getItem(PREFIX+id));changed.externalMetadata='Do not overwrite';const exact=JSON.stringify(changed);shared.setItem(PREFIX+id,exact);a.type('Current words stay in this open buffer.');await a.w.studyDraft.flush();assert.equal(shared.getItem(PREFIX+id),exact);assert.match(a.w.document.getElementById('manuscript').textContent,/Current words stay/);assert.equal(a.w.studyDraft.recoveryState().unavailable,true);
});

for(const change of ['timestamp','words','history','metadata'])test('BFCache same-owner re-admission checks every field except recoveryAt: '+change,async t=>{
 const o=await owner(t),shared=sharedStore(),locks=exclusiveLocks(),a=await fixture(o,{shared,locks}),id=a.w.sessionStorage.getItem(SESSION);unload(a);await tick();const value=JSON.parse(shared.getItem(PREFIX+id));
 if(change==='timestamp')value.recoveryAt='2099-01-01T00:00:00.000Z';if(change==='words')value.documents[o.bindingId].blocks[0].html='Another page changed these words.';if(change==='history')value.documents[o.bindingId].history.push({words:'Another page history'});if(change==='metadata')value.otherMetadata={exact:'Another page metadata'};
 const changed=JSON.stringify(value),keys=[...shared.m.keys()];shared.setItem(PREFIX+id,changed);const event=new a.w.Event('pageshow');Object.defineProperty(event,'persisted',{value:true});a.w.dispatchEvent(event);await tick();
 if(change==='timestamp'){assert.equal(a.w.sessionStorage.getItem(SESSION),id);assert.deepEqual([...shared.m.keys()].filter(k=>!k.startsWith(PREFIX+'legacy:')),keys.filter(k=>!k.startsWith(PREFIX+'legacy:')));const after=JSON.parse(shared.getItem(PREFIX+id));delete after.recoveryAt;delete value.recoveryAt;assert.deepEqual(after,value);assert.equal(a.w.studyDraft.recoveryState().unavailable,false);}else{assert.notEqual(a.w.sessionStorage.getItem(SESSION),id);assert.equal(shared.getItem(PREFIX+id),changed);}
});
