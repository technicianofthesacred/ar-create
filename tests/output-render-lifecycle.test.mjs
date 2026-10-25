import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const overview=fs.readFileSync(new URL('../public/document-study/output-overview.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

// The previous renderer stands for Arrange's asynchronous save/teardown seam.
// Its promise is the navigation contract; this test does not replace a save owner.
function fixture(){
 const dom=new JSDOM('<main id="app">Retained Arrange canvas</main>',{runScripts:'outside-only',url:'http://localhost/document-study/'}),w=dom.window;
 let p={id:'hk',view:'record',viewedStage:9};const renders=[],reads=[];
 w.current=()=>p;w.historicalNotice=()=>'';w.workflowBar=()=>'';w.phaseReader=()=>'<p>Retained Arrange canvas</p>';
 w.render=function(){const gate=deferred(),owner=p;renders.push({gate,owner});const pending=gate.promise.then(value=>{w.document.getElementById('app').innerHTML=w.phaseReader(p);return value;});void pending.catch(()=>{});return pending;};
 w.switchProject=async id=>{p={...p,id,viewedStage:12};return w.render();};
 w.realOutputOverview={read:async({projectId})=>{reads.push(projectId);return {projectId,outputs:[],emptyMessage:'Invented empty '+projectId};},onAction:async()=>{}};
 w.eval(overview);
 return {dom,w,renders,reads,setProject:id=>{p={...p,id,viewedStage:12};},get project(){return p;}};
}

test('Outputs preserves delayed Arrange render completion before awaited project navigation',async()=>{
 const f=fixture();try{
  const marker={saved:true},rendering=f.w.render();assert.equal(typeof rendering?.then,'function','the outer Outputs renderer must expose its predecessor promise');
  let settled=false;void rendering.then(()=>{settled=true;});await turn();assert.equal(settled,false);assert.deepEqual(f.reads,[]);
  f.renders[0].gate.resolve(marker);assert.equal(await rendering,marker);
  const switching=f.w.switchProject('ref-an-cha');let switched=false;void switching.then(()=>{switched=true;});await turn();assert.equal(switched,false);assert.deepEqual(f.reads,[]);
  f.renders[1].gate.resolve('new-project-rendered');assert.equal(await switching,'new-project-rendered');await turn();
  assert.equal(f.project.id,'ref-an-cha');assert.deepEqual(f.reads,['ref-an-cha']);assert.match(f.w.document.body.textContent,/Invented empty ref-an-cha/);assert.doesNotMatch(f.w.document.body.textContent,/Composition has closed/);
 }finally{for(const render of f.renders)render.gate.resolve();await turn();f.dom.window.close();}
});

test('Outputs propagates an owning render refusal without reading or replacing its retained canvas',async()=>{
 const f=fixture();try{
  f.setProject('hk');const failure=Error('Exact output save refused; edits remain retained.'),rendering=f.w.render();assert.equal(typeof rendering?.then,'function');
  const refused=assert.rejects(rendering,error=>error===failure);f.renders[0].gate.reject(failure);await refused;await turn();
  assert.deepEqual(f.reads,[]);assert.equal(f.w.document.body.textContent,'Retained Arrange canvas');
 }finally{for(const render of f.renders)render.gate.resolve();await turn();f.dom.window.close();}
});

test('a late earlier-project render cannot start an Outputs read or repaint the current project',async()=>{
 const f=fixture();try{
  f.setProject('hk');const earlier=f.w.render();f.setProject('ref-an-cha');const current=f.w.render();
  f.renders[1].gate.resolve();await current;await turn();assert.deepEqual(f.reads,['ref-an-cha']);
  f.renders[0].gate.resolve();await earlier;await turn();assert.deepEqual(f.reads,['ref-an-cha']);
  assert.equal(f.w.document.querySelector('#output-overview').dataset.outputProject,'ref-an-cha');assert.match(f.w.document.body.textContent,/Invented empty ref-an-cha/);
 }finally{for(const render of f.renders)render.gate.resolve();await turn();f.dom.window.close();}
});
