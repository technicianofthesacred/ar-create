import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
async function settle(){for(let n=0;n<8;n++)await pause();}
const hash='a'.repeat(64),recordPath='Workflow/3-Develop/NOTES - Invented.md';

function fixture(t,{holdCatalog=false,holdDraft=false,holdChoices=false,holdFindings=false,catalogFailure=false,choicesStale=false}={}){
 const dom=new JSDOM('<div id="app"><main id="workspace"></main></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window,calls=[];
 t.after(()=>w.close());
 const gates={catalog:deferred(),draft:deferred(),choices:deferred(),findings:deferred()};
 for(const [name,held]of Object.entries({catalog:holdCatalog,draft:holdDraft,choices:holdChoices,findings:holdFindings}))if(!held)gates[name].resolve();
 const record={name:'NOTES - Invented.md',path:recordPath,role:'research notes',hash,raw:'Invented retained note.'};
 const point=id=>({id:'finding-'+id,title:'Invented finding for '+id,originalText:record.raw,clarity:{supported:'An invented account is recorded.',uncertain:'No independent verification.',storyImplication:'Preserve attribution.'},spoken:[{speaker:'Invented speaker',quote:'Exact invented quotation.'}],sources:[{name:record.name,path:recordPath,recordPath,hash,recordHash:hash}],canPlan:true});
 w.fetch=async(url,options={})=>{
  calls.push({url,method:options.method||'GET'});
  assert.equal(options.method||'GET','GET','opening research must never POST');
  let data,status=200;const query=new URL(url,'http://localhost').searchParams;
  if(url.startsWith('/api/study-originals?'))data={projectKey:query.get('projectKey'),records:[record]};
  else if(url==='/api/study-draft/catalog'){
   await gates.catalog.promise;
   if(catalogFailure){status=503;data={error:'Invented catalog unavailable'};}
   else data={drafts:[{parentStudyId:'hk',bindingStatus:'ready',bindingId:'invented-part',title:'Invented manuscript'}]};
  }else if(url.startsWith('/api/study-research/findings?')){
   await gates.findings.promise;const id=query.get('parentStudyId');data={projectKey:query.get('projectKey'),parentStudyId:id,available:true,stale:false,points:[point(id)]};
  }else if(url.startsWith('/api/study-draft/read?')){
   await gates.draft.promise;data={expected:{revision:1,hash},projection:[{id:'paragraph-1',blockKind:'paragraph',raw:'Invented manuscript words.'}]};
  }else if(url.startsWith('/api/study-research/choices?')){
   await gates.choices.promise;data={choices:[],sourceExpected:{hash},sourceRecords:[{path:recordPath,hash:choicesStale?'b'.repeat(64):hash}]};
  }else{status=404;data={error:'No existing binding'};}
  return {ok:status===200,status,json:async()=>data};
 };
 w.eval(`var state={projects:[{id:'hk',name:'Invented project',view:'record',viewedStage:3}]};function current(){return state.projects[0]}var WORKFLOW_RECORDS={},ORIGINAL_STEPS=['Material','Source','Research','Direction'];function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}function shortRecordName(s){return s}function retainedSection(){return ''}function originalURL(){return '#'}function createLocalProject(){}function modalHTML(){return ''}var modal=null;function workflowBar(){return ''}function historicalNotice(){return ''}function phaseReader(){return ''}function render(){document.getElementById('workspace').innerHTML=phaseReader(current())}function save(){}function viewPhase(n){current().viewedStage=n;render()}function toast(){}`);
 for(const name of ['research-standard-adapter.js','research-standard.js','stage-flow.js'])w.eval(read(name));
 const finding=()=>w.document.querySelector('[data-research-point="finding-hk"]');
 const decision=()=>finding()?.querySelector('[data-research-decision="include"]');
 return {w,calls,gates,finding,decision};
}

async function assertReadOnly(f){
 const button=f.decision();assert.ok(button,'returned finding has its existing planning action');assert.equal(button.disabled,true);
 // A disabled DOM button is not the only safety boundary: invoke its wired handler
 // directly to prove that pending context also refuses a programmatic attempt.
 if(button.onclick)await button.onclick();
 assert.ok(f.calls.every(call=>call.method==='GET'));
}

test('validated findings render before a pending manuscript catalog and keep planning read-only',async t=>{
 const f=fixture(t,{holdCatalog:true});await settle();
 assert.equal(f.finding()?.querySelector('h2').textContent,'Invented finding for hk');
 await assertReadOnly(f);
 f.gates.catalog.resolve();await settle();assert.equal(f.decision().disabled,false,'planning becomes available only after exact context reads');
});

for(const pending of ['Draft','Choices'])test('findings remain readable while '+pending.toLowerCase()+' is pending; pending narration survives context arrival',async t=>{
 const f=fixture(t,{['hold'+pending]:true});await settle();
 assert.ok(f.finding(),'findings do not wait for manuscript/choices');await assertReadOnly(f);
 const input=f.finding().querySelector('[data-research-narration]');assert.ok(input);
 input.value='My unsaved invented narration';input.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 f.gates[pending.toLowerCase()].resolve();await settle();
 assert.equal(f.finding().querySelector('[data-research-narration]').value,'My unsaved invented narration');
 assert.equal(f.decision().disabled,false);
});

test('catalog failure leaves returned findings readable and refuses planning without POST',async t=>{
 const f=fixture(t,{catalogFailure:true});await settle();
 assert.ok(f.finding(),'independent findings survive a failed catalog');await assertReadOnly(f);
 assert.match(f.w.document.getElementById('workspace').textContent,/Invented catalog unavailable/);
});

test('source-mismatched choices never enable a returned finding planning mutation',async t=>{
 const f=fixture(t,{holdChoices:true,choicesStale:true});await settle();assert.ok(f.finding());await assertReadOnly(f);
 f.gates.choices.resolve();await settle();await assertReadOnly(f);
 assert.match(f.w.document.getElementById('workspace').textContent,/source revision changed/i);
});

test('late findings for an earlier project never appear in the newly selected project',async t=>{
 const f=fixture(t,{holdFindings:true,holdCatalog:true});await settle();
 f.w.eval("state.projects[0]={id:'ref-collector',name:'Other invented project',view:'record',viewedStage:3};render()");await settle();
 f.gates.findings.resolve();await settle();
 assert.equal(f.finding(),null,'wrong-room finding is not rendered');
 assert.equal(f.w.document.querySelector('[data-research-point="finding-ref-collector"] h2')?.textContent,'Invented finding for ref-collector');
 f.gates.catalog.resolve();await settle();
 assert.equal(f.finding(),null,'late catalog/context completion cannot repaint the previous room');
 assert.ok(f.calls.every(call=>call.method==='GET'));
});
