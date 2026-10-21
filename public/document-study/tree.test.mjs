import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const rail=fs.readFileSync(new URL('./checkpoint-rail.js',import.meta.url),'utf8'),tree=fs.readFileSync(new URL('./tree.js',import.meta.url),'utf8');
const families=[['Gather',[1,2]],['Develop',[3,4]],['Make',[5,6,7,8,9]],['Deliver',[10,11,12]]],names=['Material','Source','Research','Direction','Write','Read','Check','Media','Arrange','Audience','Share','Outputs'];
function grouped(){
 const step=n=>`<button class="workflowStep" aria-label="View step ${n}" onclick="viewPhase(${n})"><span class="stepNumber">${n}</span><span class="stepName">${names[n-1]}</span></button>`;
 const fam=families.map(([label,steps])=>`<section class="wn-family" data-family="${label.toLowerCase()}" aria-label="${label}"><span class="wn-family-label">${label}</span><div class="wn-family-steps">${steps.map(step).join('')}</div></section>`).join('');
 return `<div class="shell"><aside class="rail"></aside><main class="workspace"><nav class="workflowNavigation"><div class="workflowSteps" data-work-groups="true">${fam}</div></nav><button onclick="modal='history';render()">History</button><div id="manuscript">Words</div></main></div>`;
}
function fixture({outputs={},stage=1,selected=null,folders=['Tea','Tea','Repair']}={}){
 const dom=new JSDOM(`<button data-ht-home>Home</button><div id="app">${grouped()}</div>`,{url:'http://localhost',runScripts:'dangerously'}),w=dom.window;
 w.state={project:'p1',projects:folders.map((f,i)=>({id:'p'+(i+1),name:'Piece '+(i+1),folder:f,view:'record',viewedStage:stage})),projectNavigation:{recent:[],openTabs:[]}};
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);
 w.phases=[];w.viewPhase=n=>{w.phases.push(n);w.current().viewedStage=n;};
 w.switches=[];w.switchProject=async id=>{w.switches.push(id);w.state.project=id;};
 w.reads=[];w.realOutputOverview={read:async({projectId})=>{w.reads.push(projectId);return {projectId,outputs:outputs[projectId]||[]};}};
 w.workspaceNavigation={selectedOutput:()=>selected};
 w.render=()=>{w.document.getElementById('app').innerHTML=grouped();};
 w.eval(fs.readFileSync(new URL('./shell.js',import.meta.url),'utf8'));w.eval(rail);w.eval(tree);
 return {dom,w,d:w.document};
}
const tick=()=>new Promise(r=>setTimeout(r,20));

test('the sidebar names each activity and its question, and keeps the twelve steps calling viewPhase',async()=>{
 const {w,d}=fixture();await tick();
 assert.deepEqual([...d.querySelectorAll('.tr-act b')].map(n=>n.textContent),['Gather','Develop','Make','Deliver']);
 assert.match(d.querySelector('.wn-family[data-family="gather"] .tr-act').textContent,/What do I have\?/);
 assert.equal(d.querySelectorAll('.workflowStep').length,12);
 for(const b of d.querySelectorAll('.workflowStep'))b.click();
 assert.deepEqual([...w.phases],[1,2,3,4,5,6,7,8,9,10,11,12]);
});

test('counts come only from saved output records and land on the step of their next action',async()=>{
 const {d}=fixture({outputs:{p1:[{id:'o1',status:'correction-needed',nextAction:{kind:'native'}},{id:'o2',status:'review-needed',nextAction:{kind:'review'}},{id:'o3',status:'draft'}],p2:[{id:'o4',status:'review-needed'}]}});await tick();
 const n=k=>[...d.querySelectorAll('.workflowStep')].find(b=>b.querySelector('.stepNumber').textContent===String(k)).querySelector('.tr-n')?.textContent||'';
 assert.equal(n(5),'1');assert.equal(n(10),'2');assert.equal(n(1),'');assert.equal(n(12),'');
});

test('the Working on switch narrows the pieces list and the counts to one folder',async()=>{
 const {w,d}=fixture({outputs:{p3:[{id:'o',status:'review-needed'}]},stage:10});await tick();
 assert.equal(d.querySelectorAll('#c3-queue .tq-row').length,3);
 const s=d.querySelector('[data-tr-scope]');s.value='Tea';s.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
 assert.equal(d.querySelectorAll('#c3-queue .tq-row').length,2);
 assert.equal([...d.querySelectorAll('.workflowStep')].find(b=>b.querySelector('.stepNumber').textContent==='10').querySelector('.tr-n'),null);
 const s2=d.querySelector('[data-tr-scope]');s2.value='Repair';s2.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
 assert.equal(d.querySelectorAll('#c3-queue .tq-row').length,1);
 assert.match(d.querySelector('#c3-queue .tq-row').textContent,/Review needed/);
});

test('opening a piece from the list switches through switchProject and stays on the same step',async()=>{
 const {w,d}=fixture({stage:2});await tick();
 d.querySelector('[data-tq-open="p2"]').click();await tick();
 assert.deepEqual([...w.switches],['p2']);
 assert.equal(w.current().id,'p2');
 assert.equal(d.querySelector('#c3-queue .tq-row.on').dataset.tqOpen,'p2');
});

test('a refused switch keeps the current piece and says why',async()=>{
 const {w,d}=fixture({stage:2});await tick();
 w.switchProject=async()=>{throw Error('Save or resolve the current changes first.');};
 d.querySelector('[data-tq-open="p3"]').click();await tick();
 assert.equal(w.current().id,'p1');
 assert.match(d.querySelector('#c3-queue .tq-msg').textContent,/Save or resolve/);
});

test('no step path bar: Next is one quiet link at the end of the work, in step order, skipping what does not apply',async()=>{
 const {w,d}=fixture({stage:5});await tick();
 assert.equal(d.getElementById('c3-path'),null);
 const link=d.querySelector('#c3-next [data-c3-next]');
 assert.equal(link.textContent.replace(/\s*→\s*$/,''),'Next: Read');
 assert.equal(link.closest('#c3-next'),d.querySelector('.workspace').lastElementChild,'at the end of the work column');
 link.click();assert.deepEqual([...w.phases],[6]);
 const media=fixture({stage:8});media.w.c3PieceState={notApplicable:n=>n===9?'words only':''};media.w.c3Tree.decorate();
 assert.match(media.d.querySelector('#c3-next').textContent,/Next: Audience/);
 const last=fixture({stage:12});await tick();assert.equal(last.d.getElementById('c3-next'),null);
});

test('the fold arrow leaves a slim rail and is remembered; the pieces list can be hidden',async()=>{
 const {w,d}=fixture({stage:2});await tick();
 d.querySelector('[data-tr-fold]').click();
 assert.ok(d.body.classList.contains('c3-tree-slim'));
 assert.equal(JSON.parse(w.localStorage.getItem('c3-tree-v1')).slim,true);
 assert.equal(d.querySelector('[data-tr-fold]').getAttribute('aria-expanded'),'false');
 d.querySelector('[data-tr-list]').click();
 assert.equal(d.getElementById('c3-queue'),null);
});

test('Everything that’s here lists every part with an honest status, and Open goes through the real owners',async()=>{
 const {w,d}=fixture();await tick();
 d.querySelector('[data-tr-all]').click();
 const rows=[...d.querySelectorAll('#c3-everything .te-row')];
 assert.equal(rows.length,w.c3Tree.parts.length);
 assert.ok(rows.some(r=>/Not built here yet/.test(r.textContent)));
 const write=rows.find(r=>r.querySelector('strong').textContent==='Write');write.querySelector('[data-te-go]').click();
 assert.deepEqual([...w.phases],[5]);
 let home=0;d.querySelector('[data-ht-home]').addEventListener('click',()=>home++);
 d.querySelector('[data-tr-all]').click();[...d.querySelectorAll('#c3-everything .te-row')].find(r=>r.querySelector('strong').textContent==='Home').querySelector('[data-te-go]').click();
 assert.equal(home,1);
});

test('the Tree saves nothing: no output record is changed and only reads are made',async()=>{
 const {w}=fixture({outputs:{p1:[{id:'o',status:'review-needed'}]}});await tick();
 assert.ok(w.reads.length>=1);
 assert.equal(Object.keys(w.realOutputOverview).join(),'read');
});
