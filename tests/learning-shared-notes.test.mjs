import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const script=await readFile(new URL('../public/document-study/human-direction.js',import.meta.url),'utf8');
const clone=x=>JSON.parse(JSON.stringify(x));
const RECOVERY='ar-study-human-direction-recovery-v1';
const refs=[0,1,2].map(i=>({sourceId:`00000000-0000-4000-8000-00000000000${i}`,sourceHash:String(i+1).repeat(64),title:['A remembered visit','A changed source','A missing book'][i],start:12,quote:`Exact source words ${i}.`}));
const body='# Learning a topic\n\n## Author questions\n\nWhy does this matter? '+('Substantial learning stays readable. '.repeat(14))+'\n\n## My manual section\n\nKeep these exact unconventional notes.\n\n## Provisional directions\n\nQuestions stay provisional.\n\n## Source passages\n\n'+refs.map(r=>'### '+r.title+'\n\nSource ID: `'+r.sourceId+'` · SHA-256: `'+r.sourceHash+'` · character '+r.start+'\n\n> '+r.quote+'\n').join('\n');
const record=(text=body)=>({bound:true,body:text,hash:'a'.repeat(64),revision:2,path:'/synthetic/project/HUMAN-DIRECTION.md',history:[]});
const response=(value,status=200)=>({ok:status<400,status,json:async()=>clone(value)});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function setup({recovery,initialStage=3,parts=[],conceptMissing=false,catalogMissing=false,records,sourceSelections=refs,sourceConnections}={}){
 const dom=new JSDOM('<div id="app"><div id="stage-working-lane"><section id="retained-research">Existing research remains readable.</section></div></div>',{url:'http://localhost/',runScripts:'outside-only'});
 const w=dom.window;const current={id:'p-one',name:'Project One',view:'record',viewedStage:initialStage};let data=records||{'p-one':record(),'p-two':record('# Another project\n\nIndependent learning.')};const posts=[],gets=[],proseInputs=[];
 w.current=()=>current;w.state={projects:[current]};w.render=()=>{w.document.getElementById('app').innerHTML='<div id="stage-working-lane"><section id="retained-research">Existing research remains readable.</section></div>';};w.viewPhase=stage=>{current.viewedStage=stage;w.render();};
 const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 w.studyStageProse={render:text=>{proseInputs.push(text);return text.split(/\n\n/).map(chunk=>chunk.startsWith('## ')?'<h2>'+escape(chunk.slice(3))+'</h2>':chunk.startsWith('# ')?'<h1>'+escape(chunk.slice(2))+'</h1>':'<p>'+escape(chunk)+'</p>').join('');}};
 if(recovery)w.localStorage.setItem(RECOVERY,recovery);
 const concept=id=>({...clone(data[id]),parentStudyId:id,title:'Learning project',sourceSelections:clone(sourceSelections),sourceConnections:sourceConnections||sourceSelections.map((r,i)=>({sourceId:r.sourceId,sourceHash:r.sourceHash,stale:i>0,...(i===2?{unavailable:true,reason:'Not available in this synthetic library.'}:{})}))});
 w.fetch=async(url,options={})=>{
  const path=new URL(url,'http://localhost/'),id=path.searchParams.get('parentStudyId')||'p-one';
  if(!options.method){gets.push(url);if(path.pathname==='/api/study-draft/catalog')return catalogMissing?response({error:'Unavailable'},503):response({drafts:parts});if(path.pathname==='/api/study/human-direction'){if(path.searchParams.get('scope')==='part')return response({...record('Part-only direction.'),hash:'e'.repeat(64)});return response(data[id]);}if(path.pathname==='/api/concept')return conceptMissing?response({error:'Ready collection unavailable'},503):response(concept(id));throw Error('Unexpected GET '+url);}
  const input=JSON.parse(options.body);posts.push({url,input});const saved=data[input.parentStudyId];if(input.expectedRevision!==saved.revision||input.expectedHash!==saved.hash)return response({error:'Shared notes changed. Preserve both versions.'},409);
  if(path.pathname==='/api/concept/save'||path.pathname==='/api/study/human-direction/write'){
   if(input.body.includes('FORGED SOURCE'))return response({error:'New source reference changed or quote does not match. Refresh before saving.'},409);
   const previous=clone(saved);saved.body=input.body;saved.hash='b'.repeat(64);saved.revision++;saved.history.push({before:previous,after:{body:saved.body},operationId:input.operationId});return response(path.pathname==='/api/concept/save'?concept(input.parentStudyId):saved);
  }
  if(path.pathname==='/api/study/human-direction/undo'){const prior=saved.history.at(-1);saved.body=prior.before.body;saved.hash='c'.repeat(64);saved.revision++;return response(saved);}
  throw Error('Unexpected POST '+url);
 };
 w.eval(script);await tick();await tick();
 const q=s=>w.document.querySelector(s),click=s=>q(s).click(),edit=text=>{q('[data-human-direction]').value=text;q('[data-human-direction]').dispatchEvent(new w.Event('input',{bubbles:true}));};
 return {w,q,click,edit,posts,gets,data,proseInputs,switchProject:id=>{current.id=id;w.render();},stage:n=>{current.viewedStage=n;w.render();},focus:async()=>{w.dispatchEvent(new w.Event('focus'));await tick();await tick();},close:()=>{w.dispatchEvent(new w.Event('pagehide'));dom.window.close();}};
}
test('Research renders full same shared body through existing prose with source disclosures and no output',async()=>{
 const x=await setup();assert.match(x.q('.human-direction-editor h3').textContent,/Learning & project notes/);assert.ok(x.q('[data-learning-shared-body].recordBody'));assert.match(x.q('[data-learning-shared-body]').textContent,/Keep these exact unconventional notes/);assert.match(x.q('[data-learning-shared-body]').textContent,/Questions stay provisional/);assert.ok(x.q('[data-learning-shared-body]').textContent.length>500);assert.doesNotMatch(x.q('[data-learning-shared-body]').textContent,/Source ID:|SHA-256:/);assert.equal(x.q('[data-human-direction]').value,body);assert.ok(x.proseInputs.at(-1).includes('## My manual section'));assert.equal(x.q('#downstream-human-direction'),null);assert.match(x.q('[data-learning-sources]').textContent,/Sources · 3/);for(const text of ['Current source wording','Source changed since','Source unavailable',refs[0].quote])assert.ok(x.q('[data-learning-sources]').textContent.includes(text));assert.ok(x.q('#retained-research'));assert.equal(x.q('[data-direction-scope]'),null);assert.equal(x.posts.length,0);x.close();
});
test('Research saves exact raw manual sections and references through concept guards then uses saved Undo',async()=>{
 const x=await setup();const changed=body+'\n\n## Human comment\n\nMy exact new thought.';x.edit(changed);x.click('[data-direction-save]');await tick();await tick();assert.equal(x.posts[0].url,'/api/concept/save');assert.deepEqual(Object.keys(x.posts[0].input).sort(),['body','expectedHash','expectedRevision','operationId','parentStudyId']);assert.equal(x.posts[0].input.body,changed);assert.equal(x.posts[0].input.expectedHash,'a'.repeat(64));assert.equal(x.posts[0].input.expectedRevision,2);assert.equal(x.data['p-one'].body,changed);assert.equal(x.q('[data-human-direction]').value,changed);assert.ok(x.gets.filter(url=>url.startsWith('/api/concept?')).length>=2);x.click('[data-direction-undo]');await tick();await tick();assert.equal(x.posts[1].url,'/api/study/human-direction/undo');assert.equal(x.posts[1].input.scope,'project');assert.equal(x.posts[1].input.expectedRevision,3);assert.equal(x.data['p-one'].body,body);assert.equal(x.q('[data-human-direction]').value,body);x.close();
});
test('dirty shared notes survive switch/reload and focus refresh preserves caret while exposing conflict',async()=>{
 const x=await setup();const unfinished=body+'\n\nMy unfinished addition.';x.edit(unfinished);x.switchProject('p-two');await tick();await tick();assert.match(x.q('[data-learning-shared-body]').textContent,/Another project/);x.switchProject('p-one');await tick();await tick();assert.equal(x.q('[data-human-direction]').value,unfinished);const input=x.q('[data-human-direction]');input.focus();input.setSelectionRange(21,27);input.scrollTop=33;x.data['p-one'].body=body+'\n\nSaved by another agent.';x.data['p-one'].hash='d'.repeat(64);x.data['p-one'].revision=4;await x.focus();assert.equal(x.q('[data-human-direction]'),input);assert.equal(input.selectionStart,21);assert.equal(input.selectionEnd,27);assert.equal(input.scrollTop,33);assert.equal(input.value,unfinished);assert.ok(x.q('[data-direction-save]').disabled);assert.match(x.q('[data-direction-current]').textContent,/Saved by another agent/);
 const recovery=x.w.localStorage.getItem(RECOVERY),records=clone(x.data);x.close();const y=await setup({recovery,records});assert.equal(y.q('[data-human-direction]').value,unfinished);assert.ok(y.q('[data-direction-save]').disabled);assert.equal(y.posts.length,0);y.close();
});
test('source-reference rejection preserves exact draft without a legacy write bypass',async()=>{
 const x=await setup();const changed=body.replace(refs[0].quote,'FORGED SOURCE');x.edit(changed);x.click('[data-direction-save]');await tick();await tick();assert.equal(x.posts.length,1);assert.equal(x.posts[0].url,'/api/concept/save');assert.equal(x.q('[data-human-direction]').value,changed);assert.equal(x.data['p-one'].body,body);assert.equal(x.q('[data-human-direction]').value.includes('Source ID:'),true);x.close();
});
test('Direction navigation deliberately selects same project notes without POST or adoption',async()=>{
 const part={bindingId:'part-a',parentStudyId:'p-one',bindingStatus:'ready',title:'One part',partKey:'I'};const recovery=JSON.stringify({'p-one':{scope:'part-a',drafts:{},bases:{}}});const x=await setup({recovery,parts:[part]});assert.equal(x.q('[data-human-direction]').value,body);assert.equal(x.gets.some(url=>url.includes('scope=part')),false);x.edit(body+'\n\nStill provisional.');x.click('[data-learning-direction]');await tick();await tick();assert.equal(x.w.current().viewedStage,4);assert.equal(x.q('[data-direction-scope]').value,'project');assert.equal(x.q('[data-human-direction]').value,body+'\n\nStill provisional.');assert.equal(x.posts.length,0);assert.equal(x.data['p-one'].body,body);x.close();
});
test('missing optional collection/catalog keeps readable notes and existing research; missing owned record is explicit',async()=>{
 const x=await setup({conceptMissing:true,catalogMissing:true});assert.match(x.q('[data-learning-shared-body]').textContent,/My manual section/);assert.match(x.q('.human-direction-editor').textContent,/Source connections are unavailable/);assert.ok(x.q('#retained-research'));assert.equal(x.posts.length,0);x.close();const y=await setup({conceptMissing:true,records:{'p-one':{...record(''),bound:false,revision:0}}});assert.match(y.q('.human-direction-editor').textContent,/not connected to an owned project/);assert.ok(y.q('[data-direction-save]').disabled);assert.ok(y.q('#retained-research'));y.close();
});
test('existing Direction part-scoped editor remains separate and keeps legacy write endpoint',async()=>{
 const part={bindingId:'part-a',parentStudyId:'p-one',bindingStatus:'ready',title:'One part',partKey:'I'};const recovery=JSON.stringify({'p-one':{scope:'part-a',drafts:{},bases:{}}});const x=await setup({initialStage:4,recovery,parts:[part]});assert.equal(x.q('[data-direction-scope]').value,'part-a');assert.equal(x.q('[data-human-direction]').value,'Part-only direction.');/* ab607cc: Direction at stage 4 reads the shared author page to show 'Your page'; separation is the part editor below. */assert.equal(x.q('[data-learning-shared-body]'),null);x.close();
});

test('unavailable concept validation blocks source-bound Research saves and preserves exact local wording',async()=>{
 const x=await setup({conceptMissing:true});const draft=body+'\n\nKeep this human comment while reconnecting.';x.edit(draft);assert.ok(x.q('[data-direction-save]').disabled);assert.match(x.q('[data-direction-reload]').textContent,/Reload source connections/);x.q('[data-direction-save]').dispatchEvent(new x.w.Event('click',{bubbles:true}));await tick();await tick();assert.equal(x.posts.length,0);assert.equal(x.q('[data-human-direction]').value,draft);assert.equal(x.data['p-one'].body,body);assert.ok(x.w.localStorage.getItem(RECOVERY).includes('Keep this human comment'));
 x.edit('# Plain replacement draft');x.q('[data-direction-save]').dispatchEvent(new x.w.Event('click',{bubbles:true}));await tick();assert.equal(x.posts.length,0);x.close();
});

test('plain legacy Research notes stay editable while new reference metadata immediately requires validation',async()=>{
 const plain='# A plain legacy note\n\nA human question.';const x=await setup({conceptMissing:true,records:{'p-one':record(plain)}});
 assert.equal(x.q('[data-direction-save]').disabled,false);x.edit(body);assert.ok(x.q('[data-direction-save]').disabled);assert.match(x.q('[data-direction-reload]').textContent,/Reload source connections/);x.edit(plain+'\n\nAn exact comment.');assert.equal(x.q('[data-direction-save]').disabled,false);x.click('[data-direction-save]');await tick();await tick();assert.equal(x.posts[0].url,'/api/study/human-direction/write');assert.equal(x.posts[0].input.body,plain+'\n\nAn exact comment.');x.close();
});

test('separate passages from one source retain their corresponding connection status by exact report order',async()=>{
 const repeated=[{...refs[0],start:12,quote:'Earlier passage.'},{...refs[0],start:46,quote:'Later passage.'},{...refs[0],start:78,quote:'An unmatched report row.'}];
 const x=await setup({sourceSelections:repeated,sourceConnections:[{sourceId:refs[0].sourceId,sourceHash:refs[0].sourceHash,stale:false},{sourceId:refs[0].sourceId,sourceHash:refs[0].sourceHash,stale:true},{sourceId:refs[1].sourceId,sourceHash:refs[1].sourceHash,stale:false}]});
 const sections=x.q('[data-learning-sources]').querySelectorAll(':scope > section');assert.match(sections[0].textContent,/Current source wording/);assert.doesNotMatch(sections[0].textContent,/Source changed since/);assert.match(sections[1].textContent,/Source changed since this passage was saved/);assert.doesNotMatch(sections[1].textContent,/Current source wording/);assert.match(sections[2].textContent,/Source connection not checked/);x.close();
});
