import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const source=(await readFile(new URL('../public/document-study/source-imported.js',import.meta.url),'utf8')).replace("'./source-dialogue.js'",JSON.stringify(new URL('../public/document-study/source-dialogue.mjs',import.meta.url).href));
const {installSourceReader}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const clone=x=>JSON.parse(JSON.stringify(x));
const base={revision:3,sessions:[{id:'a',title:'First visit',date:'2026-01-01',sourceId:'source-a',sourceHash:'hash-a',version:1,turns:[{id:'a1',speaker:'Source',text:'A sample was offered.',originalText:'A sample was offered.'},{id:'a2',speaker:'Response',text:'The price remains unknown.'},{id:'a3',speaker:'Response',text:'No purchase yet.'}]},{id:'b',title:'Second visit',sourceId:'source-b',sourceHash:'hash-b',version:1,turns:[{id:'b1',speaker:'Unknown',text:'A different conversation.'}]}],notes:{a:{sourceHash:'hash-a',stories:[],interests:[],business:[{text:'Offer, price unresolved.',turnIds:['a1','a3']}]}}};
const tick=()=>new Promise(r=>setTimeout(r,0));
async function setup({saved,send,read,chrome=''}={}) {
 const dom=new JSDOM('<div id="app"><div id="stage-working-lane">'+chrome+'<div class="material-reading"><article id="legacy">Existing controls</article></div></div></div>',{url:'http://localhost/'});
 const {window}=dom;let project={id:'project-one',view:'record',viewedStage:2};let state=clone(base),posts=[],ids=0;
 if(saved)window.localStorage.setItem('ar-create:source-reader:v1',saved);
 const api=installSourceReader({document:window.document,getProject:()=>project,makeId:()=>`op-${++ids}`,fetch:async(url,options={})=>{if(!options.method)return read?read({url,options,state}):{ok:true,json:async()=>clone(state)};const body=JSON.parse(options.body);posts.push({url,body});return send?send({url,body,state,posts}):{ok:true,status:200,json:async()=>({revision:0})};}});
 await tick();
 const q=s=>window.document.querySelector(s),click=s=>q(s).click(),edit=(field,value)=>{q(`[data-source-reader-field="${field}"]`).value=value;q(`[data-source-reader-field="${field}"]`).dispatchEvent(new window.Event('input',{bubbles:true}));};
 const choose=id=>{q('[data-source-reader-select]').value=id;q('[data-source-reader-select]').dispatchEvent(new window.Event('change',{bubbles:true}));};
 return {api,window,q,click,edit,choose,posts,state,setProject:p=>{project=p;api.mount();},close:()=>{api.dispose();dom.window.close();}};
}
test('notes target exact remarks and navigate surrounding compact dialogue',async()=>{
 const x=await setup();x.click('[data-source-reader-note-section="business"]');assert.equal(x.q('[data-source-reader-highlight]').dataset.sourceReaderTurn,'a1');x.click('[data-source-reader-action="next"]');assert.equal(x.q('[data-source-reader-highlight]').dataset.sourceReaderTurn,'a3');assert.equal(x.q('[data-source-reader-dialogue]').querySelectorAll('[data-source-reader-turn]').length,3);assert.equal(x.q('[data-source-reader-dialogue]').querySelectorAll('.source-dialogue-group').length,2);x.click('[data-source-reader-action="notes"]');assert.equal(x.q('[data-source-reader-highlight]'),null);assert.ok(x.q('#legacy'));assert.ok(x.q('[data-source-reader-legacy]'));x.close();
});
test('dirty wording survives base re-render, session/project switches and reload',async()=>{
 const x=await setup();x.click('[data-source-reader-turn="a1"]');x.edit('text','Keep my unfinished words');
 x.q('#stage-working-lane').innerHTML='<div class="material-reading"><p>Fresh native render</p></div>';await tick();assert.equal(x.q('[data-source-reader-field="text"]').value,'Keep my unfinished words');
 x.choose('b');x.choose('a');assert.equal(x.q('[data-source-reader-field="text"]').value,'Keep my unfinished words');
 x.setProject({id:'another',view:'record',viewedStage:2});x.setProject({id:'project-one',view:'record',viewedStage:2});assert.equal(x.q('[data-source-reader-field="text"]').value,'Keep my unfinished words');
 const saved=x.window.localStorage.getItem('ar-create:source-reader:v1');x.close();const y=await setup({saved});assert.equal(y.q('[data-source-reader-field="text"]').value,'Keep my unfinished words');y.close();
});
test('network retry keeps complete operation and refreshes after historical success receipt',async()=>{
 let calls=0;const x=await setup({send:({state,body})=>{if(++calls===1)throw Error('lost response');state.revision=4;state.sessions[0].sourceHash='hash-edited';state.sessions[0].turns[0].text=body.text;state.sessions[0].undoOperationId=body.operationId;return {ok:true,status:200,json:async()=>({revision:2,session:{text:'historical'}})};}});
 x.click('[data-source-reader-turn="a1"]');x.edit('speaker','Known only as Source');x.edit('text','A sample, not a purchase.');x.click('[data-source-reader-action="save"]');await tick();assert.ok(x.q('[data-source-reader-action="retry"]'));x.click('[data-source-reader-action="retry"]');await tick();assert.deepEqual(x.posts[0],x.posts[1]);assert.deepEqual(Object.keys(x.posts[0].body),['operationId','expectedRevision','expectedSourceHash','sessionId','turnId','speaker','text']);assert.equal(x.posts[0].body.expectedRevision,3);assert.match(x.q('[data-source-reader-dialogue]').textContent,/A sample, not a purchase/);assert.ok(x.q('[data-source-reader-action="undo"]'));assert.match(x.q('.conversation-notes-stale').textContent,/earlier wording/);x.close();
});
test('409 keeps exact draft base, blocks stale save, and refuses stale notes',async()=>{
 const x=await setup({send:({state})=>{state.revision=5;state.sessions[0].sourceHash='new-hash';state.sessions[0].turns[0].text='Someone else saved this.';return {ok:false,status:409};}});
 x.click('[data-source-reader-turn="a1"]');x.edit('text','My wording survives');x.click('[data-source-reader-action="save"]');await tick();assert.equal(x.q('[data-source-reader-field="text"]').value,'My wording survives');assert.ok(x.q('[data-source-reader-action="save"]').disabled);assert.match(x.q('[data-source-reader-edit]').textContent,/revision 3 \/ hash-a/);assert.equal(x.q('[data-source-reader-note-section]'),null);x.api.mount();assert.equal(x.q('[data-source-reader-field="text"]').value,'My wording survives');x.close();
});
test('pending operation and selected session recover after reload; Undo sends exact latest guard',async()=>{
 const x=await setup({send:()=>{throw Error('offline');}});x.choose('b');x.click('[data-source-reader-turn="b1"]');x.edit('text','Second unfinished');x.click('[data-source-reader-action="save"]');await tick();const saved=x.window.localStorage.getItem('ar-create:source-reader:v1'),first=x.posts[0];x.close();
 const y=await setup({saved,send:({state,body})=>{state.revision=4;state.sessions[1].sourceHash='b-edited';state.sessions[1].undoOperationId=body.operationId;return {ok:true,status:200,json:async()=>({})};}});assert.equal(y.q('[data-source-reader-select]').value,'b');y.click('[data-source-reader-action="retry"]');await tick();assert.deepEqual(y.posts[0],first);y.click('[data-source-reader-action="undo"]');await tick();assert.deepEqual(Object.keys(y.posts[1].body),['operationId','undoOperationId','expectedRevision','expectedSourceHash','sessionId']);assert.equal(y.posts[1].body.expectedRevision,4);assert.equal(y.posts[1].body.expectedSourceHash,'b-edited');assert.equal(y.posts[1].body.undoOperationId,first.body.operationId);y.close();
});
test('Material is untouched and reader installs only in Source',async()=>{const x=await setup();x.setProject({id:'project-one',view:'record',viewedStage:1});assert.equal(x.q('[data-source-reader]'),null);assert.ok(x.q('#legacy'));assert.equal(x.q('[data-source-reader-legacy]'),null);x.close();});

test('kept reader clarifies default project-source labels and restores originals without replacing connected status',async()=>{
 const original='Retained source words are read-only. Choose a connected transcript to use passage and speaker correction.';
 const x=await setup({chrome:`<p class="sws-revision">${original}</p><p class="sws-revision" id="connected">Editable transcript · revision 8. Save and review use the transcript controls below.</p><aside class="material-index"><h3>Sessions &amp; versions</h3><p>No retained source records are connected.</p></aside>`});
 assert.equal(x.q('.sws-revision').textContent,'Choose a kept conversation to correct a remark. Other project source records remain available.');
 assert.equal(x.q('.material-index h3').textContent,'Project source records');assert.equal(x.q('.material-index p').textContent,'No source records are attached to this project.');
 assert.match(x.q('#connected').textContent,/Editable transcript · revision 8/);
 x.setProject({id:'project-one',view:'record',viewedStage:1});assert.equal(x.q('.sws-revision').textContent,original);assert.equal(x.q('.material-index h3').textContent,'Sessions & versions');assert.equal(x.q('.material-index p').textContent,'No retained source records are connected.');
 x.setProject({id:'project-one',view:'record',viewedStage:2});assert.equal(x.q('.material-index h3').textContent,'Project source records');x.api.dispose();assert.equal(x.q('.sws-revision').textContent,original);assert.equal(x.q('.material-index h3').textContent,'Sessions & versions');x.close();
});

test('actual Source surface leads with full-width reader before readiness, tools and project records',async()=>{
 const x=await setup();
 x.q('#stage-working-lane').innerHTML='<div class="material-surface"><header class="material-heading"><h2>Transcripts &amp; sources</h2></header><div class="material-readiness">Readiness</div><details class="material-tools"><summary>Add more material</summary><button id="recording-action">Connected recording action</button></details><section class="sws-work-tools">Source tools</section><div class="material-layout"><aside class="material-index"><h3>Sessions &amp; versions</h3><p>No retained source records are connected.</p></aside><div class="material-reading"><article id="project-record">Project source record</article></div></div></div>';
 await tick();const reader=x.q('[data-source-reader]'),surface=x.q('.material-surface');
 assert.equal(reader.parentElement,surface);assert.equal(x.q('.material-heading').nextElementSibling,reader);assert.equal(reader.nextElementSibling,x.q('.material-readiness'));
 assert.ok(x.q('#recording-action'));assert.ok(x.q('#project-record'));assert.equal(x.q('[data-source-reader-legacy]'),null);
 x.click('[data-source-reader-turn="a1"]');x.edit('text','Still my unfinished correction');const field=x.q('[data-source-reader-field="text"]');x.api.mount();await tick();assert.equal(x.q('[data-source-reader-field="text"]'),field);assert.equal(field.value,'Still my unfinished correction');
 x.close();
});
test('one transcript-wide original-wording toggle replaces a disclosure under every corrected line',async()=>{
 const turns=base.sessions[0].turns;turns[1].originalText='The prize remains unknown.';turns[2].originalText='No purchase yet!';let x;try{x=await setup();await tick();}finally{delete turns[1].originalText;delete turns[2].originalText;}
 const dialogue=x.q('[data-source-reader-dialogue]');
 assert.equal(dialogue.querySelectorAll('details').length,0,'no per-turn disclosure');
 const toggle=x.q('[data-source-original-toggle]');assert.ok(toggle,'one toggle for the transcript');assert.match(toggle.textContent,/2 corrected lines/);
 assert.equal([...dialogue.querySelectorAll('.source-reader-original')].every(n=>n.hidden),true);
 toggle.click();
 assert.equal(x.q('[data-source-original-toggle]').getAttribute('aria-pressed'),'true');
 assert.equal([...x.q('[data-source-reader-dialogue]').querySelectorAll('.source-reader-original')].filter(n=>!n.hidden).length,2);
 x.close();
});


test('startup-unconfigured 503 is Not connected and keeps original retained source readable',async()=>{
 const x=await setup({read:async()=>({ok:false,status:503,json:async()=>({error:'Kept conversation editing is not connected in this workspace.'})})});try{const status=x.q('[data-source-reader-status]');assert.match(status.textContent,/Not connected/);assert.doesNotMatch(status.textContent,/Try Refresh|could not be loaded/);assert.match(status.textContent,/Existing source records remain readable/);assert.equal(x.q('[data-source-reader-action="refresh"]').textContent,'Check connection');assert.ok(x.q('#legacy'));assert.equal(x.q('#legacy').textContent,'Existing controls');assert.equal(x.q('#legacy').closest('details'),null);}finally{x.close();}
});

for(const failure of ['other503','server500','malformed','network'])test('transient '+failure+' retains honest retry rather than startup Not connected',async()=>{
 const x=await setup({read:async()=>{if(failure==='network')throw Error('Network request failed');return{ok:false,status:failure==='other503'?503:500,json:async()=>{if(failure==='malformed')throw Error('Invalid JSON');return{error:'Temporary source owner failure'};}};}});try{assert.doesNotMatch(x.q('[data-source-reader-status]').textContent,/Not connected/);assert.match(x.q('[data-source-reader-status]').textContent,/Refresh|Network request failed/);assert.equal(x.q('[data-source-reader-action="refresh"]').textContent,'Refresh');assert.ok(x.q('#legacy'));}finally{x.close();}
});

test('checking the connection after runtime setup restores actual kept owner data',async()=>{
 let reads=0;const x=await setup({read:async({state})=>++reads===1?{ok:false,status:503,json:async()=>({error:'Kept conversation editing is not connected in this workspace.'})}:{ok:true,status:200,json:async()=>clone(state)}});try{assert.match(x.q('[data-source-reader-status]').textContent,/Not connected/);x.click('[data-source-reader-action="refresh"]');await tick();assert.equal(reads,2);assert.equal(x.q('[data-source-reader-action="refresh"]').textContent,'Refresh');assert.equal(x.q('[data-source-reader-select]').options.length,2);assert.ok(x.q('[data-source-reader-turn="a1"]'));assert.doesNotMatch(x.q('[data-source-reader-status]').textContent,/Not connected/);}finally{x.close();}
});

test('late unconfigured response after disposal cannot restore a reader or hide the retained source',async()=>{
 let release;const held=new Promise(resolve=>release=resolve),x=await setup({read:async()=>held});try{const legacy=x.q('#legacy');x.api.dispose();release({ok:false,status:503,json:async()=>({error:'Kept conversation editing is not connected in this workspace.'})});await tick();await tick();assert.equal(x.q('[data-source-reader]'),null);assert.strictEqual(x.q('#legacy'),legacy);assert.equal(legacy.closest('details'),null);}finally{x.close();}
});
