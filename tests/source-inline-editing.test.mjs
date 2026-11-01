import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const source=(await readFile(new URL('../public/document-study/source-imported.js',import.meta.url),'utf8')).replace("'./source-dialogue.js'",JSON.stringify(new URL('../public/document-study/source-dialogue.mjs',import.meta.url).href)).replace("'./translation-readiness.js'",JSON.stringify(new URL('../public/document-study/translation-readiness.js',import.meta.url).href)).replace("'./interpretation-view.js'",JSON.stringify(new URL('../public/document-study/interpretation-view.js',import.meta.url).href)).replace("'./source-language-review.js'",JSON.stringify(new URL('../public/document-study/source-language-review.js',import.meta.url).href));
const {installSourceReader}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const copy=x=>JSON.parse(JSON.stringify(x));
const storageKey='ar-create:source-reader:v1';
const sourceId='11111111-1111-4111-8111-111111111111';
const fixture={revision:7,sessions:[{id:'visit-a',title:'Invented visit A',sourceId,sourceHash:'a'.repeat(64),version:1,turns:[{id:'remark-a',speaker:'Speaker 1',text:'A fictional sample was offered.',originalText:'A fictional sample was offered.'},{id:'remark-next',speaker:'Speaker 2',text:'No agreement was made.'}]},{id:'visit-b',title:'Invented visit B',sourceId:'22222222-2222-4222-8222-222222222222',sourceHash:'b'.repeat(64),version:1,turns:[{id:'remark-b',speaker:'Speaker 3',text:'Another invented remark.'}]}],notes:{}};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const settle=async()=>{await tick();await tick();};
function server(){
 const state=copy(fixture),requests=[],receipts=new Map();let undo=null,loseNext=false,conflictNext=false,reads=0,ids=100;
 const fetch=async(url,options={})=>{
  if(!options.method){reads++;assert.equal(url,'/api/source-sessions');return {ok:true,json:async()=>copy(state)};}
  const body=JSON.parse(options.body);requests.push({url,body});
  if(receipts.has(body.operationId))return {ok:true,status:200,json:async()=>copy(receipts.get(body.operationId))};
  const session=state.sessions.find(s=>s.id===body.sessionId);assert.ok(session,'exact existing session');
  if(conflictNext){conflictNext=false;state.revision++;session.sourceHash='c'.repeat(64);session.turns[0].text='A correction saved by another editor.';return {ok:false,status:409};}
  if(body.expectedRevision!==state.revision||body.expectedSourceHash!==session.sourceHash)return {ok:false,status:409};
  if(url==='/api/source-sessions/edit'){
   const turn=session.turns.find(t=>t.id===body.turnId);assert.ok(turn,'exact existing turn');undo={sessionId:session.id,turnId:turn.id,speaker:turn.speaker,text:turn.text,operationId:body.operationId};
   turn.speaker=body.speaker;turn.text=body.text;session.undoOperationId=body.operationId;
  }else{
   assert.equal(url,'/api/source-sessions/undo');assert.equal(body.undoOperationId,undo.operationId);assert.equal(body.sessionId,undo.sessionId);
   const turn=session.turns.find(t=>t.id===undo.turnId);turn.speaker=undo.speaker;turn.text=undo.text;delete session.undoOperationId;
  }
  state.revision++;session.sourceHash=(url.endsWith('/edit')?'d':'e').repeat(64);session.version++;
  const receipt={revision:state.revision};receipts.set(body.operationId,receipt);
  if(loseNext){loseNext=false;throw Error('Synthetic response lost after commit');}
  return {ok:true,status:200,json:async()=>copy(receipt)};
 };
 return {state,requests,fetch,makeId:()=>`synthetic-op-${++ids}`,get reads(){return reads;},lose(){loseNext=true;},conflict(){conflictNext=true;}};
}
async function setup(owner=server(),saved){
 const dom=new JSDOM('<main id="app"><div id="stage-working-lane"><div class="material-reading"><p id="retained-source">Retained source stays readable.</p></div></div></main>',{url:'http://localhost/'}),{window}=dom;
 if(saved)window.localStorage.setItem(storageKey,saved);
 let project={id:'synthetic-project',view:'record',viewedStage:2};
 const api=installSourceReader({document:window.document,getProject:()=>project,fetch:owner.fetch,makeId:owner.makeId});await settle();
 const q=s=>window.document.querySelector(s),turn=id=>q(`[data-source-reader-turn="${id}"]`),click=action=>q(`[data-source-reader-action="${action}"]`).click();
 const choose=id=>{q('[data-source-reader-select]').value=id;q('[data-source-reader-select]').dispatchEvent(new window.Event('change',{bubbles:true}));};
 if(!saved)choose('visit-a');
 const enter=(id='remark-a')=>{const node=turn(id);assert.ok(node);node.click();assert.strictEqual(turn(id),node,'the clicked transcript node itself becomes editable');assert.strictEqual(q('[data-source-reader-field="text"]'),node,'the wording field is the transcript remark');assert.match(node.getAttribute('contenteditable'),/^(true|plaintext-only)$/);assert.equal(q('textarea[data-source-reader-field="text"]'),null);return node;};
 const input=(node,text)=>{node.textContent=text;node.dispatchEvent(new window.Event('input',{bubbles:true}));};
 return {api,window,q,turn,click,choose,enter,input,owner,saved:()=>window.localStorage.getItem(storageKey),setProject:next=>{project=next;api.mount();},close:()=>{api.dispose();window.close();}};
}

test('inline correction saves the exact guarded owner request, reloads saved wording and undoes through the same owner',async()=>{
 const owner=server();let x=await setup(owner);
 try{
  const node=x.enter();x.input(node,'The invented offer was only a sample.');
  assert.equal(owner.requests.length,0,'typing never autosaves');assert.equal(x.q('[data-source-reader-action="save"]').textContent,'Save correction');assert.ok(x.q('[data-source-reader-action="cancel"]'));
  x.click('save');await settle();
  assert.deepEqual(owner.requests[0],{url:'/api/source-sessions/edit',body:{operationId:'synthetic-op-101',expectedRevision:7,expectedSourceHash:'a'.repeat(64),sessionId:'visit-a',turnId:'remark-a',speaker:'Speaker 1',text:'The invented offer was only a sample.'}});
  assert.ok(owner.reads>=2,'saved wording comes from a fresh owner GET');assert.equal(x.turn('remark-a').textContent,'The invented offer was only a sample.');
  const saved=x.saved();x.close();x=await setup(owner,saved);assert.equal(x.turn('remark-a').textContent,'The invented offer was only a sample.');
  x.click('undo');await settle();assert.deepEqual(owner.requests[1],{url:'/api/source-sessions/undo',body:{operationId:'synthetic-op-102',undoOperationId:'synthetic-op-101',expectedRevision:8,expectedSourceHash:'d'.repeat(64),sessionId:'visit-a'}});
  assert.equal(x.turn('remark-a').textContent,fixture.sessions[0].turns[0].text);assert.equal(owner.state.sessions[0].turns[0].originalText,fixture.sessions[0].turns[0].originalText);
 }finally{x.close();}
});

test('stale inline correction retains its exact local wording and original guards, and blocks another save',async()=>{
 const owner=server(),x=await setup(owner);try{
  x.input(x.enter(),'My unsaved invented wording');owner.conflict();x.click('save');await settle();
  assert.equal(x.turn('remark-a').textContent,'My unsaved invented wording');assert.equal(x.q('[data-source-reader-action="save"]').disabled,true);
  const draft=Object.values(x.api.getState().drafts)[0];assert.equal(draft.text,'My unsaved invented wording');assert.equal(draft.baseRevision,7);assert.equal(draft.baseSourceHash,'a'.repeat(64));assert.equal(draft.baseText,fixture.sessions[0].turns[0].text);
  x.click('save');await settle();assert.equal(owner.requests.length,1);x.api.mount();assert.equal(x.turn('remark-a').textContent,'My unsaved invented wording');
 }finally{x.close();}
});

test('lost response survives reload and retries the identical idempotent inline request',async()=>{
 const owner=server();let x=await setup(owner);try{
  x.input(x.enter(),'Saved once despite a lost receipt.');owner.lose();x.click('save');await settle();assert.ok(x.q('[data-source-reader-action="retry"]'));
  const first=copy(owner.requests[0]),saved=x.saved();assert.equal(owner.state.revision,8);x.close();x=await setup(owner,saved);
  assert.equal(x.turn('remark-a').textContent,'Saved once despite a lost receipt.');assert.ok(x.q('[data-source-reader-action="retry"]'));x.click('retry');await settle();
  assert.deepEqual(owner.requests[1],first);assert.equal(owner.state.revision,8,'retry receives historical receipt without applying twice');assert.equal(x.turn('remark-a').textContent,'Saved once despite a lost receipt.');assert.ok(x.q('[data-source-reader-action="undo"]'));
 }finally{x.close();}
});

test('unsaved inline words recover after remark, source, project, stage and browser reload navigation',async()=>{
 const owner=server();let x=await setup(owner);try{
  x.input(x.enter(),'Unfinished invented words\nSecond line');x.enter('remark-next');x.enter('remark-a');assert.equal(x.turn('remark-a').textContent,'Unfinished invented words\nSecond line');
  x.choose('visit-b');await x.api.selectSource({sourceId,expectedSourceHash:'a'.repeat(64),expectedVersion:1});assert.equal(x.turn('remark-a').textContent,'Unfinished invented words\nSecond line');
  x.setProject({id:'another-synthetic-project',view:'record',viewedStage:2});x.setProject({id:'synthetic-project',view:'record',viewedStage:2});assert.equal(x.turn('remark-a').textContent,'Unfinished invented words\nSecond line');
  x.setProject({id:'synthetic-project',view:'record',viewedStage:1});assert.equal(x.q('[data-source-reader]'),null);x.setProject({id:'synthetic-project',view:'record',viewedStage:2});
  const saved=x.saved();x.close();x=await setup(owner,saved);assert.equal(x.turn('remark-a').textContent,'Unfinished invented words\nSecond line');assert.equal(owner.requests.length,0);
 }finally{x.close();}
});

test('repeated caret clicks and mount leave the active remark node and selection untouched',async()=>{
 const x=await setup();try{
  const node=x.enter();x.input(node,'Caret stays among these invented words.');const text=node.firstChild,selection=x.window.getSelection(),range=x.window.document.createRange();range.setStart(text,8);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
  node.click();x.api.mount();await settle();assert.strictEqual(x.turn('remark-a'),node);assert.strictEqual(selection.anchorNode,text);assert.equal(selection.anchorOffset,8);assert.equal(selection.focusOffset,8);assert.equal(node.textContent,'Caret stays among these invented words.');
 }finally{x.close();}
});

test('inline newlines and markup-looking words remain plain text; original wording remains read-only',async()=>{
 const owner=server(),x=await setup(owner);try{
  const words='First invented line\n<script>untrusted example</script>\n<img src=x onerror="example"> & last line';x.input(x.enter(),words);
  assert.equal(x.turn('remark-a').querySelector('script,img'),null);x.click('save');await settle();assert.equal(owner.requests[0].body.text,words);assert.equal(x.turn('remark-a').textContent,words);assert.equal(x.turn('remark-a').querySelector('script,img'),null);
  const original=x.q('[data-source-reader-original-for="remark-a"]');assert.ok(original);assert.ok(!['true','plaintext-only'].includes(original.getAttribute('contenteditable')));assert.equal(original.querySelector('[contenteditable="true"],[contenteditable="plaintext-only"],input,textarea'),null);assert.match(original.textContent,/A fictional sample was offered\./);assert.equal(owner.state.sessions[0].turns[0].originalText,fixture.sessions[0].turns[0].originalText);
  x.enter();x.input(x.turn('remark-a'),'A correction to cancel');x.click('cancel');assert.equal(x.turn('remark-a').textContent,words);assert.equal(owner.requests.length,1);
 }finally{x.close();}
});

test('another active remark never hides an unsaved buffer through source, project and reload navigation',async()=>{
 const owner=server();let x=await setup(owner);try{
  const a=x.enter();x.input(a,'Visible unfinished A.');const b=x.enter('remark-next');x.input(b,'Visible unfinished B.');
  assert.strictEqual(x.turn('remark-a'),a,'focusing B keeps the original A node');assert.equal(a.textContent,'Visible unfinished A.','inactive A continues to display its unsaved buffer');
  x.enter('remark-a');assert.equal(a.textContent,'Visible unfinished A.');assert.equal(b.textContent,'Visible unfinished B.','returning to A keeps B visible');x.enter('remark-next');
  const checkBuffers=()=>{assert.equal(x.turn('remark-a').textContent,'Visible unfinished A.');assert.equal(x.turn('remark-next').textContent,'Visible unfinished B.');};
  x.choose('visit-b');x.choose('visit-a');checkBuffers();x.enter('remark-next');
  x.setProject({id:'another-synthetic-project',view:'record',viewedStage:2});x.setProject({id:'synthetic-project',view:'record',viewedStage:2});checkBuffers();
  const saved=x.saved();x.close();x=await setup(owner,saved);checkBuffers();assert.equal(x.q('[data-source-reader-field="text"]').dataset.sourceReaderTurn,'remark-next','reload keeps B active while displaying A draft');assert.equal(owner.requests.length,0);
 }finally{x.close();}
});

test('saving A preserves visible unsaved B with its original base and blocks B until explicitly resolved',async()=>{
 const owner=server(),x=await setup(owner);try{
  x.input(x.enter(),'A correction ready to save.');x.input(x.enter('remark-next'),'B remains unfinished after A saves.');x.enter('remark-a');x.click('save');await settle();
  assert.equal(owner.requests.length,1);assert.equal(owner.requests[0].body.turnId,'remark-a');assert.equal(owner.state.sessions[0].turns[1].text,'No agreement was made.','saving A never submits B');
  assert.equal(x.turn('remark-next').textContent,'B remains unfinished after A saves.','owner refresh must preserve visible unsaved B');
  const draft=Object.values(x.api.getState().drafts)[0];assert.equal(draft.text,'B remains unfinished after A saves.');assert.equal(draft.baseRevision,7,'A save never rebases B');assert.equal(draft.baseSourceHash,'a'.repeat(64));assert.equal(draft.baseText,'No agreement was made.');
  x.enter('remark-next');assert.equal(x.q('[data-source-reader-action="save"]').disabled,true);x.click('save');await settle();assert.equal(owner.requests.length,1,'stale B cannot create a second owner request');
  const saved=x.saved();x.close();const y=await setup(owner,saved);try{assert.equal(y.turn('remark-next').textContent,'B remains unfinished after A saves.');assert.equal(y.q('[data-source-reader-action="save"]').disabled,true);}finally{y.close();}
 }finally{x.close();}
});

 test('caret entry retains the text node and keeps every save control outside speech flow',async()=>{const x=await setup();try{const node=x.turn('remark-a'),words=node.firstChild;x.enter();assert.strictEqual(node.firstChild,words);assert.equal(x.q('[data-source-reader-dialogue] .source-reader-inline-tools'),null);assert.equal(x.q('.source-reader-inline-tools'),null);x.input(node,'A real invented edit.');assert.ok(x.q('.source-reader-inline-tools'));}finally{x.close();}});
test('returning browser focus never repaints an open correction or replaces its caret',async()=>{const x=await setup();try{const node=x.enter(),reads=x.owner.reads,text=node.firstChild;const selection=x.window.getSelection(),range=x.window.document.createRange();range.setStart(text,5);range.collapse(true);selection.removeAllRanges();selection.addRange(range);x.window.dispatchEvent(new x.window.Event('focus'));await settle();assert.equal(x.owner.reads,reads);assert.strictEqual(x.turn('remark-a'),node);assert.strictEqual(selection.anchorNode,text);assert.equal(selection.anchorOffset,5);}finally{x.close();}});
test('ordinary caret placement never creates a draft, mounts tools, changes prose nodes or marks words unsaved',async()=>{const x=await setup();try{const a=x.turn('remark-a'),b=x.turn('remark-next'),text=a.firstChild;assert.equal(a.getAttribute('contenteditable'),'plaintext-only');a.focus();a.click();b.focus();b.click();a.focus();a.click();assert.deepEqual(x.api.getState().drafts,{});assert.equal(x.q('.source-reader-inline-tools'),null);assert.equal(a.hasAttribute('data-source-reader-unsaved'),false);assert.strictEqual(a.firstChild,text);assert.equal(b.getAttribute('contenteditable'),'plaintext-only');assert.equal(x.owner.requests.length,0);}finally{x.close();}});
test('browser activation before a caret click cannot refresh or replace untouched prose',async()=>{const x=await setup();try{const node=x.turn('remark-a'),text=node.firstChild,reads=x.owner.reads;x.window.dispatchEvent(new x.window.Event('focus'));await settle();assert.equal(x.owner.reads,reads);assert.strictEqual(x.turn('remark-a'),node);assert.strictEqual(node.firstChild,text);assert.deepEqual(x.api.getState().drafts,{});}finally{x.close();}});

test('a first saved review arriving at an editing caret waits for explicit review without changing prose layout',async()=>{
 const owner=server(),fetch=owner.fetch;let release;
 const session=owner.state.sessions[0];Object.assign(session.turns[0],{sourceLanguage:'zh',text:'虚构茶。',originalText:'虚构茶。'});
 owner.fetch=(url,options)=>url.startsWith('/api/source-sessions/translation-review?')?new Promise(resolve=>{release=resolve;}):fetch(url,options);
 const x=await setup(owner);try{
  const node=x.turn('remark-next'),text=node.firstChild,panel=x.q('[data-source-reader]'),dialogue=x.q('[data-source-reader-dialogue]');
  node.focus();node.click();const range=x.window.document.createRange(),selection=x.window.getSelection();range.setStart(text,4);range.collapse(true);selection.removeAllRanges();selection.addRange(range);
  const classes=[panel.className,...dialogue.querySelectorAll('*')].map(n=>typeof n==='string'?n:n.className),saved=x.saved();assert.equal(typeof release,'function');
  release({ok:true,json:async()=>({state:'proposal-ready',applied:false,savedReview:true,receiptSha256:'d'.repeat(64),acceptedTurnIds:[],sourceContext:{sessionId:session.id,sourceId:session.sourceId,expectedRevision:7,expectedSourceHash:session.sourceHash},proposals:[{turnId:'remark-a',text:'An invented tea.'}]})});await settle();
  assert.deepEqual([panel.className,...dialogue.querySelectorAll('*')].map(n=>typeof n==='string'?n:n.className),classes,'passive pickup does not reserve a margin or highlight any passage');
  assert.equal(x.q('[data-source-translation-review]').hidden,true);assert.equal(x.q('[data-source-reader-action="review-translation"]').closest('.source-reader-tools-sheet')!==null,true,'availability stays in existing Tools without adding a footer row');
  assert.strictEqual(x.turn('remark-next'),node);assert.strictEqual(node.firstChild,text);assert.strictEqual(selection.anchorNode,text);assert.equal(selection.anchorOffset,4);assert.equal(node.textContent,'No agreement was made.');assert.equal(x.saved(),saved);assert.deepEqual(x.api.getState().drafts,{});
  node.blur();x.api.mount();assert.equal(x.q('[data-source-translation-review]').hidden,true,'blur never opens the deferred review');
  const tools=x.q('.source-reader-tools-sheet');tools.open=true;x.click('review-translation');assert.equal(tools.open,false);assert.equal(x.q('[data-source-translation-review]').hidden,false);assert.equal(panel.classList.contains('source-reader-has-proposal'),true);assert.equal(x.q('.source-reader-proposal-target [data-source-reader-turn]').dataset.sourceReaderTurn,'remark-a');assert.equal(x.q('[data-source-translation-proposal]').textContent,'An invented tea.');assert.equal(owner.requests.length,0);
 }finally{x.close();}
});

test('boxed speaker entry stages only its explicit remark and Cancel preserves the source and every English line',async()=>{
 const owner=server();owner.state.sessions[0].turns.splice(1,0,{id:'remark-same',speaker:'Speaker 1',text:'A separate short English remark.'});const x=await setup(owner);
 try{const first=x.turn('remark-a'),second=x.turn('remark-same'),label=x.q('[data-source-reader-speaker-turn="remark-a"]');assert.ok(label);assert.equal(label.tagName,'BUTTON');label.click();const input=x.q('[data-source-reader-field="speaker"]');assert.ok(input);assert.equal(x.window.document.activeElement,input);assert.match(input.closest('.source-reader-speaker-edit').textContent,/this remark/i);assert.strictEqual(x.turn('remark-a'),first);assert.strictEqual(x.turn('remark-same'),second);input.value='Invented host';input.dispatchEvent(new x.window.Event('input',{bubbles:true}));assert.equal(owner.requests.length,0);assert.equal(owner.state.sessions[0].turns[0].speaker,'Speaker 1');assert.equal(owner.state.sessions[0].turns[1].speaker,'Speaker 1');assert.equal(x.api.getState().drafts[JSON.stringify(['synthetic-project','visit-a','remark-a'])].speaker,'Invented host');x.click('cancel');assert.deepEqual(x.api.getState().drafts,{});assert.equal(x.turn('remark-a').textContent,first.textContent);assert.equal(x.turn('remark-same').textContent,second.textContent);assert.equal(owner.requests.length,0);}finally{x.close();}
});

test('Cancel during an unchanged refresh restores the verified tea link after loading without replacing remarks',async()=>{
 const owner=server(),read=owner.fetch;let held=false,finish;
 owner.fetch=(url,options={})=>held&&!options.method?new Promise(resolve=>{finish=async()=>{held=false;resolve(await read(url,options));};}):read(url,options);
 const x=await setup(owner);try{
  assert.ok(x.q('[data-source-tea-link]'));x.q('[data-source-reader-speaker-turn="remark-a"]').click();assert.equal(x.q('[data-source-tea-link]'),null);
  held=true;const refreshing=x.api.refresh();x.click('cancel');const nodes=[x.turn('remark-a'),x.turn('remark-next')];assert.equal(x.q('[data-source-tea-link]'),null,'no link is presented while the exact source read is still in flight');
  await finish();await refreshing;await settle();const link=x.q('[data-source-tea-link]');assert.ok(link,'fresh verified source link must return after Cancel, even when the source bytes did not change');assert.equal(new URL(link.href).searchParams.get('arSource'),sourceId);assert.notEqual(x.q('[data-source-translation-readiness]').dataset.sourceTranslationReadiness,'busy');assert.equal(x.api.getTranslationBatch().expectedRevision,owner.state.revision);assert.strictEqual(x.turn('remark-a'),nodes[0]);assert.strictEqual(x.turn('remark-next'),nodes[1]);assert.deepEqual(x.api.getState().drafts,{});assert.equal(owner.requests.length,0);
 }finally{x.close();}
});

test('refresh completion keeps another unsaved correction and its tea-link guard intact',async()=>{
 const owner=server(),read=owner.fetch;let held=false,finish;owner.fetch=(url,options={})=>held&&!options.method?new Promise(resolve=>{finish=async()=>{held=false;resolve(await read(url,options));};}):read(url,options);
 const x=await setup(owner);try{x.enter('remark-next');x.input(x.turn('remark-next'),'Retained invented words.');x.q('[data-source-reader-speaker-turn="remark-a"]').click();held=true;const pending=x.api.refresh();x.click('cancel');await finish();await pending;await settle();assert.equal(x.q('[data-source-tea-link]'),null);assert.equal(x.turn('remark-next').textContent,'Retained invented words.');assert.equal(Object.keys(x.api.getState().drafts).length,1);assert.throws(()=>x.api.getTranslationBatch(),/Save or cancel/);assert.equal(owner.requests.length,0);}finally{x.close();}
});
test('late refresh completion restores the current selected source link instead of the earlier source',async()=>{
 const owner=server(),read=owner.fetch;let held=false,finish;owner.fetch=(url,options={})=>held&&!options.method?new Promise(resolve=>{finish=async()=>{held=false;resolve(await read(url,options));};}):read(url,options);
 const x=await setup(owner);try{held=true;const pending=x.api.refresh();x.choose('visit-b');await finish();await pending;await settle();const link=x.q('[data-source-tea-link]');assert.equal(new URL(link.href).searchParams.get('arSource'),fixture.sessions[1].sourceId);assert.equal(x.turn('remark-b').textContent,fixture.sessions[1].turns[0].text);assert.equal(x.turn('remark-a'),null);assert.equal(owner.requests.length,0);}finally{x.close();}
});

test('Source edits like a document: leaving a changed line saves it, Enter moves on, Esc puts it back',async()=>{
 const owner=server();const x=await setup(owner);try{
  const KeyboardEvent=x.window.KeyboardEvent,FocusEvent=x.window.FocusEvent;
  let node=x.enter('remark-a');x.input(node,'A fictional sample was handed over.');
  node.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:x.turn('remark-next')}));await settle();await settle();
  assert.equal(owner.requests.length,1,'leaving the changed line saved it');assert.equal(owner.requests[0].url,'/api/source-sessions/edit');assert.equal(owner.requests[0].body.text,'A fictional sample was handed over.');
  node=x.enter('remark-next');x.input(node,'Words I will take back.');
  node.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await settle();
  assert.equal(x.turn('remark-next').textContent,'No agreement was made.','Esc puts the saved words back');
  node.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));await settle();assert.equal(owner.requests.length,1,'an unchanged line saves nothing');
  node=x.enter('remark-a');node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  assert.strictEqual(x.window.document.activeElement,x.turn('remark-next'),'Enter moves to the next line');
 }finally{x.close();}
});
