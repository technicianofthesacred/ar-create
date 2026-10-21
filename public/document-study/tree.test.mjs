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

test('the sidebar names each activity, with no question under it, and keeps the twelve steps calling viewPhase',async()=>{
 const {w,d}=fixture();await tick();
 assert.deepEqual([...d.querySelectorAll('.tr-act b')].map(n=>n.textContent),['Gather','Develop','Make','Deliver']);
 assert.equal(d.querySelector('.wn-family[data-family="gather"] .tr-act').textContent,'Gather');
 assert.equal(d.querySelectorAll('.workflowStep').length,12);
 for(const b of d.querySelectorAll('.workflowStep'))b.click();
 assert.deepEqual([...w.phases],[1,2,3,4,5,6,7,8,9,10,11,12]);
});

test('counts come only from saved output records; they are read, not drawn as a second badge beside the state word',async()=>{
 const {w,d}=fixture({outputs:{p1:[{id:'o1',status:'correction-needed',nextAction:{kind:'native'}},{id:'o2',status:'review-needed',nextAction:{kind:'review'}},{id:'o3',status:'draft'}],p2:[{id:'o4',status:'review-needed'}]}});await tick();await tick();
 assert.deepEqual(JSON.parse(JSON.stringify(w.c3Tree.counts())),{5:1,10:2});
 assert.equal(d.querySelectorAll('.workflowStep .tr-n').length,0);
});

test('one list of pieces: no pieces column beside the sidebar, no Working on switch, no duplicate Find entries',async()=>{
 const {d}=fixture({stage:2});await tick();
 assert.equal(d.getElementById('c3-queue'),null);
 assert.equal(d.querySelector('[data-tr-scope]'),null);
 assert.equal(d.querySelector('[data-tr-list]'),null);
 assert.equal(d.querySelector('.tr-find [data-tr-all]'),null,'Everything that’s here lives in the bar’s More');
 assert.ok(d.querySelector('.tr-find [data-tr-history]'),'History stays at the bottom');
 assert.equal(d.body.classList.contains('c3-queue-on'),false);
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

test('the fold arrow leaves a slim rail and is remembered',async()=>{
 const {w,d}=fixture({stage:2});await tick();
 d.querySelector('[data-tr-fold]').click();
 assert.ok(d.body.classList.contains('c3-tree-slim'));
 assert.equal(JSON.parse(w.localStorage.getItem('c3-tree-v1')).slim,true);
 assert.equal(d.querySelector('[data-tr-fold]').getAttribute('aria-expanded'),'false');
});

test('Everything that’s here lists every part with an honest status, and Open goes through the real owners',async()=>{
 const {w,d}=fixture();await tick();
 w.c3Tree.everything();
 const rows=[...d.querySelectorAll('#c3-everything .te-row')];
 assert.equal(rows.length,w.c3Tree.parts.length);
 assert.ok(rows.some(r=>/Not built here yet/.test(r.textContent)));
 const write=rows.find(r=>r.querySelector('strong').textContent==='Write');write.querySelector('[data-te-go]').click();
 assert.deepEqual([...w.phases],[5]);
 let home=0;d.querySelector('[data-ht-home]').addEventListener('click',()=>home++);
 w.c3Tree.everything();[...d.querySelectorAll('#c3-everything .te-row')].find(r=>r.querySelector('strong').textContent==='Home').querySelector('[data-te-go]').click();
 assert.equal(home,1);
});

test('the Tree saves nothing: no output record is changed and only reads are made',async()=>{
 const {w}=fixture({outputs:{p1:[{id:'o',status:'review-needed'}]}});await tick();
 assert.ok(w.reads.length>=1);
 assert.equal(Object.keys(w.realOutputOverview).join(),'read');
});
