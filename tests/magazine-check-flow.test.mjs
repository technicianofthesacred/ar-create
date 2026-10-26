import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';import {buildMagazineFixture} from './helpers/magazine-fixture.mjs';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),code=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8'),tick=()=>new Promise(r=>setTimeout(r,0)),H='d'.repeat(64),origin='http://127.0.0.1:59879';
async function setup(t,{linked=true,mount=true,initialStage=6,htmlBlocks=null,standaloneDOM=false}={}){const f=buildMagazineFixture();t.after(f.cleanup);const vault=createMagazineVault({vaultRoot:f.vault,dataDir:f.data,writable:false}),draft='Workflow/3-Develop/DEV - Clay Teacher (story).md',src='Workflow/1-Source/SRC - Clay Teacher (Kiln Day).md',context='Workflow/1-Source/CONTEXT - Clay Teacher.md',files=()=>[draft,src,context].map(p=>vault.read({path:p}));let [d,s,c]=files(),owner={kind:'magazine',storyId:'registered-clay',pieceId:'registered-clay:article',path:draft,partKey:'article',title:'Invented Clay Teacher'},proof={owner:{...owner},parentStudyId:'native-parent',draftHash:d.hash,expected:{workflow:{draft:d.hash}},sequence:4,dirty:false};const p={id:'native-parent',view:initialStage===5?'article':'record',viewedStage:initialStage,blocks:[{id:'exact-river',text:'The river taught me to throw thin walls.'}]},dom=new JSDOM('<div id="app"><main id="workspace"><article id="manuscript"><p data-draft-passage="exact-river">The river taught me to throw thin walls.</p></article><aside id="drawer"></aside></main></div>',{runScripts:'outside-only',url:origin}),w=dom.window,calls=[];if(htmlBlocks){p.blocks=htmlBlocks;p.magazineDraft={storyId:owner.storyId,pieceId:owner.pieceId};w.document.querySelector('#manuscript').remove();}w.structuredClone=structuredClone;w.current=()=>p;w.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');w.historicalNotice=()=>'';w.workflowBar=()=>'';w.phaseReader=()=>'<p>Earlier retained checks</p>';w.render=()=>{if(standaloneDOM)w.document.querySelector('#drawer').innerHTML=w.phaseReader(p);};w.studyDraft={currentProof:()=>structuredClone(proof),currentBinding:()=>null,currentOwner:()=>({...owner}),flush:async()=>{calls.push('FLUSH');return proof;},read:()=>{calls.push('READ');p.view='article';p.viewedStage=5;w.document.body.dataset.writeView='preview';},edit:()=>{calls.push('EDIT');p.view='article';p.viewedStage=5;w.document.body.dataset.writeView='edit';},viewMode:()=>w.document.body.dataset.writeView||'edit',focusPassage:async(id,options)=>{calls.push({focus:id,options});return p.blocks.some(b=>b.id===id);}};w.fetch=async url=>{calls.push(url);throw Error('Unexpected native request');};for(const name of ['display-format.js','magazine-check-adapter.js','draft-check-flow.js'])w.eval(code(name));let gate=null;
 let resolutions=0;const resolve=async()=>{resolutions++;const [dev,source,ctx]=files();return {rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:H},catalogRevision:H,target:{kind:'magazine',edition:'working',storyId:owner.storyId,pieceId:owner.pieceId,partKey:'article',nativeProjectId:p.id,artifactId:'exact-original',hash:dev.hash},artifact:{artifactId:'exact-original',hash:dev.hash,kind:'DEV',relativePath:draft},story:{storyId:owner.storyId,pieces:[{pieceId:owner.pieceId,kind:'article',rel:draft}],vaultRecords:{draft:[{rel:draft,currentHash:dev.hash}],src:[{rel:src,currentHash:source.hash}],context:[{rel:context,currentHash:ctx.hash}]}},...(linked?{pieceInputs:{storyId:owner.storyId,pieceId:owner.pieceId,draftPath:draft,sourcePath:src,contextPaths:[context],revision:H}}:{})};};const adapter=w.createMagazineCheckAdapter({origin,actor:'human:adrian',resolve,read:async relative=>vault.read({path:relative}),run:async(body,guard)=>{calls.push({body,guard});if(gate)await gate;return vault.extra.checks.run(body);}});w.studyDraftCheck.setMagazineAdapter(adapter);const editor=w.document.querySelector('#manuscript');if(mount)w.studyDraftCheck.mount(w.document.querySelector('#drawer'));await tick();await tick();return {w,p,proof,owner,calls,editor,f,src,context,draft,dom,adapter,resolve,vault,resolutions:()=>resolutions,setGate:value=>gate=value,close:()=>w.close()};}
test('Magazine current part is ready beside Read; actual maintained checks return exact revision findings without native UUID or writes',async t=>{const x=await setup(t);try{const host=x.w.document.querySelector('#drawer');assert.doesNotMatch(host.textContent,/No ready working part/);assert.match(host.textContent,/Ready to check this exact saved part/);assert.equal(host.querySelector('[data-current-check="run"]').disabled,false);const before=x.p.blocks.map(b=>({...b}));host.querySelector('[data-current-check="run"]').click();await tick();await tick();assert.match(host.textContent,/Review needed/);assert.match(host.textContent,/Quote needs review/);assert.equal(x.calls.includes('FLUSH'),false);assert.equal(x.calls.some(c=>typeof c==='string'&&c.includes('/api/study-draft/')),false);assert.equal(x.w.document.querySelector('#manuscript'),x.editor);assert.deepEqual(x.p.blocks,before);host.querySelector('[data-magazine-issue]').click();await tick();assert.equal(x.calls.find(c=>c.focus).focus,'exact-river');assert.equal(x.calls.find(c=>c.focus).options.edit,false);assert.equal(x.p.viewedStage,6);}finally{x.close();}});
test('unique story SRC without explicit piece link is held, never backend-run or guessed; dirty and source changes make results stale',async t=>{const unlinked=await setup(t,{linked:false});try{const host=unlinked.w.document.querySelector('#drawer');assert.match(host.textContent,/no verified transcript connection/);assert.equal(host.querySelector('[data-current-check="run"]').disabled,true);assert.equal(unlinked.calls.some(c=>c.body),false);}finally{unlinked.close();}const x=await setup(t);try{let button=x.w.document.querySelector('[data-current-check="run"]');button.click();await tick();await tick();assert.equal(x.w.studyDraftCheck.state().current,true);fs.appendFileSync(path.join(x.f.vault,x.src),'\nAn invented source revision.\n');x.w.dispatchEvent(new x.w.Event('ar-live-change'));await tick();await tick();assert.match(x.w.document.querySelector('#drawer').textContent,/Outdated result/);x.proof.dirty=true;x.w.dispatchEvent(new x.w.Event('study-draft-change'));assert.equal(x.w.document.querySelector('[data-current-check="run"]').disabled,true);assert.equal(x.w.document.querySelector('[data-magazine-issue]'),null);}finally{x.close();}});
test('switching owner during inflight Magazine check never applies old findings to another piece',async t=>{const x=await setup(t);try{let release;x.setGate(new Promise(r=>release=r));x.w.document.querySelector('[data-current-check="run"]').click();await tick();x.owner.pieceId='another-piece';x.proof.owner.pieceId='another-piece';x.p.id='another-parent';x.proof.parentStudyId='another-parent';release();await tick();await tick();assert.equal(x.w.studyDraftCheck.state().findings,0);assert.equal(x.p.viewedStage,6);assert.equal(x.editor.textContent,'The river taught me to throw thin walls.');}finally{x.close();}});


test('registering Magazine checks outside an open Check surface performs no catalog resolution; opening the drawer resolves exactly once',async t=>{
 for(const initialStage of [1,5,6]){const x=await setup(t,{mount:false,initialStage});try{
  assert.equal(x.resolutions(),0,'Registering on Library, Write or Read must not rebuild the catalog');
  const before=x.editor.textContent;x.p.viewedStage=6;x.p.view='record';x.w.studyDraftCheck.mount(x.w.document.querySelector('#drawer'));await tick();await tick();
  assert.equal(x.resolutions(),1,'Opening Check must freshly resolve its exact saved manuscript');assert.equal(x.editor.textContent,before);assert.equal(x.calls.some(c=>c.body),false,'Opening does not run a check');
  const host=x.w.document.querySelector('.wn-check-findings');host.remove();x.w.dispatchEvent(new x.w.Event('focus'));await tick();assert.equal(x.resolutions(),1,'A closed drawer must not refresh its target on focus');
 }finally{x.close();}}
});
test('a standalone Check entrance and an adapter replacement inside the mounted drawer still resolve fresh targets',async t=>{
 const x=await setup(t,{mount:false,initialStage:7});try{assert.equal(x.resolutions(),1,'Standalone Check still inspects at registration');assert.equal(x.calls.some(c=>c.body),false);}finally{x.close();}
 const y=await setup(t);try{y.w.studyDraftCheck.setMagazineAdapter(y.adapter);await tick();await tick();assert.equal(y.resolutions(),2,'Replacing the adapter in an open drawer must freshly inspect');const before=y.resolutions();y.proof.dirty=true;y.w.dispatchEvent(new y.w.Event('study-draft-change'));assert.equal(y.w.document.querySelector('[data-current-check="run"]').disabled,true);assert.equal(y.resolutions(),before,'Unsent wording must not trigger target resolution');}finally{y.close();}
});

test('direct Check entrance anchors exact owned HTML-only words without an editor or Read visit',async t=>{
 const blocks=[{id:'owned-river',tag:'blockquote',html:'The river taught me to throw thin walls.'}],x=await setup(t,{initialStage:7,htmlBlocks:blocks});try{assert.equal(x.w.document.querySelector('#manuscript'),null);const before=JSON.stringify(x.p.blocks),host=x.w.document.querySelector('#drawer');host.querySelector('[data-current-check="run"]').click();await tick();await tick();const jump=host.querySelector('[data-magazine-issue]');assert.ok(jump);jump.click();await tick();const focused=x.calls.find(c=>c.focus);assert.equal(focused.focus,'owned-river');assert.equal(focused.options.edit,false);assert.equal(JSON.stringify(x.p.blocks),before);assert.equal(x.calls.includes('FLUSH'),false);}finally{x.close();}
});
test('HTML fallback decodes entities and preserves explicit line breaks without adding presentation labels',async t=>{
 const x=await setup(t,{initialStage:7,htmlBlocks:[{id:'encoded-line',html:'Tea &amp; clay<br>“Walls” &lt;thin&gt; <em>again</em><summary>Read only</summary>'}]});try{let captured;x.w.studyDraftCheck.setMagazineAdapter({inspect:async snapshot=>{captured=snapshot;return {source:{hash:H},signature:'synthetic'};}});await tick();assert.equal(captured.paragraphs[0].id,'encoded-line');assert.equal(captured.paragraphs[0].text,'Tea & clay\n“Walls” <thin> again');assert.equal(x.w.document.querySelector('#manuscript'),null);}finally{x.close();}
});
test('direct HTML Check keeps duplicate passages unanchored and dirty or switched proof cannot jump',async t=>{
 const x=await setup(t,{initialStage:7,htmlBlocks:[{id:'one',html:'The river taught me to throw thin walls.'},{id:'two',html:'The river taught me to throw thin walls.'}]});try{const host=x.w.document.querySelector('#drawer');host.querySelector('[data-current-check="run"]').click();await tick();await tick();assert.equal(host.querySelector('[data-magazine-issue]'),null);assert.match(host.textContent,/No unique exact passage/);}finally{x.close();}
 const y=await setup(t,{initialStage:7,htmlBlocks:[{id:'owned',html:'The river taught me to throw thin walls.'}]});try{const host=y.w.document.querySelector('#drawer');host.querySelector('[data-current-check="run"]').click();await tick();await tick();const oldJump=host.querySelector('[data-magazine-issue]');assert.ok(oldJump);y.proof.dirty=true;oldJump.click();await tick();assert.equal(y.calls.some(c=>c.focus),false);y.proof.dirty=false;y.owner.path='Workflow/3-Develop/DEV - Foreign.md';oldJump.click();await tick();assert.equal(y.calls.some(c=>c.focus),false);y.owner.pieceId='foreign-part';oldJump.click();await tick();assert.equal(y.calls.some(c=>c.focus),false);}finally{y.close();}
});
test('HTML fallback refuses foreign project block provenance and mismatched owner proof',async t=>{
 for(const mismatch of ['part','path','project','hash']){const x=await setup(t,{initialStage:7,htmlBlocks:[{id:'owned',html:'The river taught me to throw thin walls.'}]});try{if(mismatch==='part')x.p.magazineDraft.pieceId='foreign';if(mismatch==='path')x.proof.owner.path='Workflow/3-Develop/DEV - Foreign.md';if(mismatch==='project')x.proof.parentStudyId='foreign';if(mismatch==='hash')x.proof.expected.workflow.draft='f'.repeat(64);let captured;x.w.studyDraftCheck.setMagazineAdapter({inspect:async snapshot=>{captured=snapshot;return {source:{hash:H},signature:'synthetic'};}});await tick();assert.deepEqual(Array.from(captured.paragraphs),[],mismatch);}finally{x.close();}}
});

test('a standalone Check owner moved by Workbench repaints its completed inspection while viewing Read',async t=>{
 const x=await setup(t,{initialStage:7,mount:false,standaloneDOM:true});try{
  const owner=x.w.document.querySelector('#current-draft-check');assert.ok(owner);
  const drawer=x.w.document.createElement('aside');drawer.id='wbf-drawer';drawer.innerHTML='<div class="dr-body" data-tool="check"></div>';x.w.document.querySelector('#app').append(drawer);drawer.firstChild.append(owner);x.p.viewedStage=6;
  let release,inspections=0;x.w.studyDraftCheck.setMagazineAdapter({inspect:async()=>{inspections++;await new Promise(resolve=>release=resolve);return {source:{hash:H},signature:'fresh-exact'};}});
  assert.match(owner.textContent,/Confirming this part/);release();await tick();await tick();assert.equal(inspections,1);assert.doesNotMatch(owner.textContent,/Confirming this part/);assert.match(owner.textContent,/Ready to check this exact saved part/);assert.equal(owner.querySelector('[data-current-check="run"]').disabled,false);
 }finally{x.close();}
});

test('successful Check jump closes the phone tool only; desktop, failed and dirty jumps retain it',async t=>{
 for(const scenario of ['phone','desktop','failed','dirty']){const x=await setup(t,{initialStage:7,htmlBlocks:[{id:'owned',html:'The river taught me to throw thin walls.'}]});try{
  let closed=0,focused=0;x.w.matchMedia=query=>{assert.equal(query,'(max-width:760px)');return {matches:scenario!=='desktop'};};x.w.c3WorkbenchFrame={closeTool:()=>closed++};x.w.studyDraft.focusPassage=async(id,options)=>{assert.equal(id,'owned');assert.equal(options.edit,false);assert.equal(options.highlight,true);focused++;return scenario!=='failed';};
  const host=x.w.document.querySelector('#drawer');host.querySelector('[data-current-check="run"]').click();await tick();await tick();const jump=host.querySelector('[data-magazine-issue]');assert.ok(jump);if(scenario==='dirty')x.proof.dirty=true;jump.click();await tick();assert.equal(closed,scenario==='phone'?1:0,scenario);assert.equal(focused,scenario==='dirty'?0:1,scenario);
 }finally{x.close();}}
});


test('Check view handoff uncovers exact phone Edit/Preview only after maintained navigation preserves owner and buffer',async t=>{
 for(const action of ['draft','read'])for(const scenario of ['phone','desktop','dirty','failed','rejected','wrong-mode','switched','revision','buffer','stale-button','foreign-proof','initial-foreign-proof']){
  const x=await setup(t,{initialStage:7});try{
   let closed=0;x.w.matchMedia=()=>({matches:scenario!=='desktop'});x.w.c3WorkbenchFrame={closeTool:()=>closed++};
   if(scenario==='dirty'){x.proof.dirty=true;x.p.blocks[0].text+=' Exact unsaved words.';x.w.dispatchEvent(new x.w.Event('study-draft-change'));}
   if(scenario==='initial-foreign-proof'){x.proof.owner.path='Workflow/3-Develop/DEV - Foreign.md';x.w.dispatchEvent(new x.w.Event('study-draft-change'));}
   const before=JSON.stringify(x.p.blocks),proofBefore=JSON.stringify(x.proof),button=x.w.document.querySelector('[data-current-check="'+action+'"]'),method=action==='draft'?'edit':'read',navigate=x.w.studyDraft[method];
   let release;x.w.studyDraft[method]=async()=>{
    if(scenario==='failed')return false;
    if(scenario==='rejected')throw Error('Navigation unavailable; words retained.');
    if(['switched','revision','buffer'].includes(scenario))await new Promise(r=>release=r);
    navigate();if(scenario==='wrong-mode')x.w.document.body.dataset.writeView=action==='draft'?'preview':'edit';
    if(scenario==='foreign-proof')x.proof.owner.path='Workflow/3-Develop/DEV - Foreign.md';
   };
   if(scenario==='stale-button'){x.owner.pieceId='another-piece';x.proof.owner.pieceId='another-piece';}
   button.click();
   if(release){if(scenario==='switched'){x.p.id='another-parent';x.owner.pieceId='another-piece';}if(scenario==='revision')x.proof.sequence++;if(scenario==='buffer')x.p.blocks[0].text+=' Newer typing.';release();}
   await tick();await tick();
   assert.equal(closed,['phone','dirty'].includes(scenario)?1:0,action+' '+scenario);
   if(['phone','desktop','dirty'].includes(scenario)){assert.equal(x.p.view,'article');assert.equal(x.p.viewedStage,5);assert.equal(x.w.studyDraft.viewMode(),action==='draft'?'edit':'preview');assert.equal(JSON.stringify(x.proof),proofBefore);}
   if(['stale-button','initial-foreign-proof'].includes(scenario))assert.equal(x.calls.includes(action==='draft'?'EDIT':'READ'),false);
   if(scenario!=='buffer')assert.equal(JSON.stringify(x.p.blocks),before,scenario);
   assert.equal(x.calls.includes('FLUSH'),false);assert.equal(x.calls.some(c=>c.body),false);
  }finally{x.close();}
 }
});


test('deferred same-owner inspection preserves open Check options; switched owner starts closed',async t=>{
 const x=await setup(t,{initialStage:7});try{
  let release;x.w.studyDraftCheck.setMagazineAdapter({inspect:async()=>{await new Promise(resolve=>release=resolve);return {source:{hash:H},signature:'deferred-options'};}});
  const host=x.w.document.querySelector('#current-draft-check');host.querySelector('[data-check-options]').open=true;
  release();await tick();await tick();
  assert.equal(host.querySelector('[data-check-options]').open,true);assert.ok(host.querySelector('[data-check-options][open] [data-current-check="draft"]'));assert.ok(host.querySelector('[data-check-options][open] [data-current-check="read"]'));
  x.p.id='another-parent';x.proof.parentStudyId='another-parent';x.owner.pieceId='another-piece';x.proof.owner.pieceId='another-piece';x.proof.dirty=true;x.w.dispatchEvent(new x.w.Event('study-draft-change'));
  assert.equal(host.querySelector('[data-check-options]').open,false);assert.equal(x.calls.includes('FLUSH'),false);assert.equal(x.calls.some(c=>c.body),false);
 }finally{x.close();}
});


test('full Check render and following inspection retain open Options only for the same owner',async t=>{
 const x=await setup(t,{initialStage:7,mount:false,standaloneDOM:true});try{
  const options=x.w.document.querySelector('[data-check-options]');options.querySelector('summary').click();assert.equal(options.open,true);
  x.w.render();await tick();await tick();
  const currentOptions=x.w.document.querySelector('[data-check-options]');assert.notEqual(currentOptions,options);assert.equal(currentOptions.open,true);assert.ok(currentOptions.querySelector('[data-current-check="draft"]'));assert.ok(currentOptions.querySelector('[data-current-check="read"]'));
  x.p.id='another-parent';x.proof.parentStudyId='another-parent';x.owner.pieceId='another-piece';x.proof.owner.pieceId='another-piece';x.w.render();await tick();await tick();assert.equal(x.w.document.querySelector('[data-check-options]').open,false);
  assert.equal(x.calls.includes('FLUSH'),false);assert.equal(x.calls.some(c=>c.body),false);
 }finally{x.close();}
});


test('focus inspection preserves the actual Options controls until activation and still invalidates changed sources',async t=>{
 const x=await setup(t,{initialStage:7});try{
  let release,deferred=false;x.w.studyDraftCheck.setMagazineAdapter({inspect:async(...args)=>{if(deferred)await new Promise(resolve=>release=resolve);return x.adapter.inspect(...args);},execute:(...args)=>x.adapter.execute(...args)});await tick();await tick();
  x.w.document.querySelector('[data-current-check="run"]').click();await tick();await tick();assert.equal(x.w.studyDraftCheck.state().current,true);deferred=true;
  const options=x.w.document.querySelector('[data-check-options]'),summary=options.querySelector('summary'),button=options.querySelector('[data-current-check="draft"]');
  fs.appendFileSync(path.join(x.f.vault,x.src),'\nA newly captured invented source revision.\n');
  x.w.dispatchEvent(new x.w.Event('focus'));
  assert.equal(summary.isConnected,true);assert.equal(button.isConnected,true);assert.strictEqual(x.w.document.querySelector('[data-check-options]'),options);
  assert.equal(x.w.studyDraftCheck.state().current,false,'An inspection in progress must still invalidate old passage routes');
  summary.click();assert.equal(options.open,true);
  release();await tick();await tick();
  assert.equal(x.w.document.querySelector('[data-check-options]').open,true);assert.match(x.w.document.querySelector('#drawer').textContent,/Outdated result/);assert.equal(x.w.document.querySelector('[data-magazine-issue]'),null);
  assert.equal(x.calls.includes('FLUSH'),false);
 }finally{x.close();}
});

test('finding quotation opens only its exact registered source with a currentness guard and no write',async t=>{
 const x=await setup(t);try{const opened=[];x.w.existingWork={openCheckSource:async(descriptor,options)=>{opened.push({descriptor,options});assert.equal(options.isCurrent(),true);return {opened:true,anchored:false};}};
 const before=JSON.stringify(x.p.blocks);x.w.document.querySelector('[data-current-check="run"]').click();await tick();await tick();const quote=x.w.document.querySelector('[data-magazine-source="0"]');assert.ok(quote);assert.match(quote.textContent,/View source/);quote.click();await tick();assert.equal(opened.length,1);const {descriptor,options}=opened[0];assert.equal(descriptor.parentStudyId,x.p.id);assert.equal(descriptor.owner.pieceId,x.owner.pieceId);assert.equal(descriptor.owner.path,x.owner.path);assert.equal(descriptor.draftHash,x.proof.draftHash);assert.equal(descriptor.source.path,x.src);assert.equal(descriptor.source.hash,createHash('sha256').update(fs.readFileSync(path.join(x.f.vault,x.src))).digest('hex'));assert.equal(descriptor.passage,'The river taught me to throw thin walls.');assert.equal(descriptor.catalogRevision,H);assert.equal(descriptor.rootFingerprint,H);assert.equal(JSON.stringify(x.p.blocks),before);assert.equal(x.calls.includes('FLUSH'),false);
 x.proof.dirty=true;assert.equal(options.isCurrent(),false);quote.click();await tick();assert.equal(opened.length,1);x.proof.dirty=false;x.owner.pieceId='foreign-part';assert.equal(options.isCurrent(),false);quote.click();await tick();assert.equal(opened.length,1);
 }finally{x.close();}
});
test('changed registered source invalidates an open evidence reader guard',async t=>{
 const x=await setup(t);try{const opened=[];x.w.existingWork={openCheckSource:async(descriptor,options)=>{opened.push({descriptor,options});return {opened:true};}};x.w.document.querySelector('[data-current-check="run"]').click();await tick();await tick();const split=x.w.document.querySelector('[data-magazine-source="0"]');assert.ok(split);split.click();await tick();assert.equal(opened.length,1);assert.equal(opened[0].descriptor.passage,'The river taught me to throw thin walls.');assert.equal(opened[0].options.isCurrent(),true);
 fs.appendFileSync(path.join(x.f.vault,x.src),'\nA later invented source revision.\n');x.w.dispatchEvent(new x.w.Event('ar-live-change'));await tick();await tick();assert.equal(opened[0].options.isCurrent(),false);assert.equal(x.w.document.querySelector('[data-magazine-source]'),null);assert.equal(x.calls.includes('FLUSH'),false);
 }finally{x.close();}
});

const receiptId='1d9bf75f-c3db-4fe3-803b-46d18c779bf8';
function savedFixture(x,{status='needs-review',proof={},result}={}){const inputs=[x.draft,x.src,x.context].map(path=>x.vault.read({path}));return {schema:'ar-create.magazine-mechanical-check-response.v1',available:true,record:{schema:'ar-create.magazine-mechanical-check.v1',checkId:receiptId,operationId:receiptId,status,...status==='held'?{notRun:true}:{},persisted:true,createdAt:'2026-10-26T00:00:00.000Z',finishedAt:'2026-10-26T00:00:01.000Z',proof:{rootIdentity:{scheme:'canonical-directory-sha256-v1',fingerprint:H},parentStudyId:x.p.id,storyId:x.owner.storyId,pieceId:x.owner.pieceId,partKey:x.owner.partKey,draft:{path:x.draft,hash:inputs[0].hash},source:{path:x.src,hash:inputs[1].hash},context:[{path:x.context,hash:inputs[2].hash}],inputRevision:H,checkerRevision:H,...proof},result:result===undefined?x.vault.extra.checks.run({draft:x.draft,source:x.src,context:[x.context]}):result,scope:{mechanicalOnly:true}}};}
function savedAdapter(x,options={}){return x.w.createMagazineCheckAdapter({origin,actor:'human:adrian',resolve:x.resolve,read:async path=>x.vault.read({path}),run:async()=>assert.fail('Opening Check must never run checks'),...options});}
test('direct Check pickup restores saved exact findings and fresh source navigation without any run or save',async t=>{
 const x=await setup(t,{initialStage:7,htmlBlocks:[{id:'reopened-river',html:'The river taught me to throw thin walls.'}]});try{let gets=0,posts=0;const receipt=savedFixture(x);receipt.record.issues=[{locator:{kind:'native-paragraph',nativeId:'forged'}}];x.w.studyDraftCheck.setMagazineAdapter(savedAdapter(x,{readSaved:async()=>{gets++;return receipt;},runSaved:async()=>{posts++;}}));await tick();await tick();const host=x.w.document.querySelector('#drawer');assert.equal(gets,1);assert.equal(posts,0);assert.match(host.textContent,/Saved mechanical check receipt/);assert.equal(x.w.studyDraftCheck.state().current,true);assert.equal(x.w.studyDraftCheck.state().findings,1);host.querySelector('[data-magazine-issue]').click();await tick();assert.equal(x.calls.find(c=>c.focus).focus,'reopened-river');assert.equal(x.calls.includes('FLUSH'),false);
 }finally{x.close();}
});
test('saved stale and unfinished pickup is truthful and offers no passage or source jump',async t=>{
 for(const status of ['stale','failed','interrupted','running','held']){const x=await setup(t);try{x.w.studyDraftCheck.setMagazineAdapter(savedAdapter(x,{readSaved:async()=>savedFixture(x,{status,result:null})}));await tick();await tick();const host=x.w.document.querySelector('#drawer');assert.equal(host.querySelector('[data-magazine-issue]'),null,status);assert.equal(host.querySelector('[data-magazine-source]'),null,status);assert.equal(x.w.studyDraftCheck.state().complete,false,status);assert.match(host.textContent,status==='stale'?/Outdated result/:status==='held'?/Checks held/:status==='failed'?/Check did not finish/:/Check unfinished/);assert.doesNotMatch(host.textContent,/Mechanical checks complete/);assert.equal(x.calls.some(c=>c.body),false);}finally{x.close();}}
});
test('dirty or switched owner during saved pickup cannot install a receipt or enable stale jumps',async t=>{
 for(const change of ['dirty','switched','sequence']){const x=await setup(t);try{let release;const receipt=savedFixture(x);x.w.studyDraftCheck.setMagazineAdapter(savedAdapter(x,{readSaved:async()=>{await new Promise(resolve=>release=resolve);return receipt;}}));await tick();assert.ok(release);if(change==='dirty')x.proof.dirty=true;if(change==='switched'){x.owner.pieceId='foreign';x.proof.owner.pieceId='foreign';}if(change==='sequence')x.proof.sequence++;release();await tick();await tick();assert.equal(x.w.studyDraftCheck.state().findings,0);assert.equal(x.w.document.querySelector('[data-magazine-issue]'),null);assert.equal(x.calls.some(c=>c.body),false);}finally{x.close();}}
});
test('saved write errors remain visible without replacing the last saved receipt or claiming success',async t=>{
 const x=await setup(t);try{let posts=0;const receipt=savedFixture(x);x.w.studyDraftCheck.setMagazineAdapter(savedAdapter(x,{readSaved:async()=>receipt,runSaved:async()=>{posts++;throw Error('Saved check receipt could not be written.');}}));await tick();await tick();x.w.document.querySelector('[data-current-check="run"]').click();await tick();await tick();assert.equal(posts,1);assert.match(x.w.document.querySelector('[role="alert"]').textContent,/could not be written/);assert.match(x.w.document.querySelector('#drawer').textContent,/Saved mechanical check receipt/);assert.equal(x.w.studyDraftCheck.state().findings,1);assert.equal(x.calls.some(c=>c.body),false);}finally{x.close();}
});

test('unrelated catalog revisions discovered during receipt pickup refresh navigation proof without staling the saved result',async t=>{
 const x=await setup(t);try{const receipt=savedFixture(x),opened=[];x.w.existingWork={openCheckSource:async descriptor=>{opened.push(descriptor);}};let resolved=0;x.w.studyDraftCheck.setMagazineAdapter(savedAdapter(x,{resolve:async()=>{const value=await x.resolve();if(resolved++){value.catalogRevision='e'.repeat(64);value.artifact.artifactId=value.target.artifactId='newly-observed-artifact';}return value;},readSaved:async()=>receipt}));await tick();await tick();assert.equal(x.w.studyDraftCheck.state().current,true);assert.ok(x.w.document.querySelector('[data-magazine-issue]'));x.w.document.querySelector('[data-magazine-source]').click();await tick();assert.equal(opened[0].catalogRevision,'e'.repeat(64));assert.equal(x.calls.some(c=>c.body),false);}finally{x.close();}
});
