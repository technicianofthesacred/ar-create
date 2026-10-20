import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const library=fs.readFileSync(new URL('./project-library.js',import.meta.url),'utf8'),tabs=fs.readFileSync(new URL('./home-tabs.js',import.meta.url),'utf8'),band=fs.readFileSync(new URL('./waiting-band.js',import.meta.url),'utf8');
function fixture({records={},failing=[]}={}){
 const dom=new JSDOM('<div id="app"><aside class="rail"></aside><main id="workspace"><div class="topbar"></div><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 w.CSS={escape:s=>s};
 w.state={project:'p0',projects:Array.from({length:12},(_,i)=>({id:'p'+i,name:'Invented tea '+i,folder:'Tea',step:'Writing'})),projectNavigation:{recent:['p0','p1','p2','p3','p4','p5','p6','p7','p8','p9']}};
 Object.assign(w,{rememberPosition(){},selected:null,activeBlock:null,keyboardBlock:null,modal:null,mobileProjects:false});
 const calls=[],reads=[];let fail=false;
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);w.save=()=>{};w.projectBrowser=()=>'';w.render=()=>{};
 w.viewPhase=async n=>{calls.push(['viewPhase',n]);};
 w.switchProject=id=>{calls.push(['switchProject',id]);w.state.project=id;};
 w.fetch=async()=>({ok:true,json:async()=>({collections:[]})});
 w.studyOutputConnection={flush:async()=>{if(fail)throw Error('Save failed. Your words remain here.');},selectOutput:async()=>{}};
 w.realOutputOverview={read:async({projectId})=>{reads.push(projectId);if(failing.includes(projectId))throw Error('unreadable');return {projectId,outputs:records[projectId]||[]};},onAction:async a=>{calls.push(['onAction',a.projectId,a.outputId,a.kind]);}};
 w.workspaceNavigation={selectedOutput:()=>null};
 w.eval(library);w.eval(tabs);w.eval(band);
 const settle=async()=>{for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,0));await w.waitingBand.whenIdle();await w.projectLibrary.whenIdle();await w.homeTabs.whenIdle();}};
 return {w,d:w.document,calls,reads,settle,set fail(v){fail=v;}};
}
const json=v=>JSON.parse(JSON.stringify(v));
const out=(id,status,kind,label,format='Article')=>({id,title:'Output '+id,format,status,nextAction:kind?{kind,label}:null});

test('lists only outputs whose recorded status needs the author, with their recorded next action',async()=>{
 const f=fixture({records:{p1:[out('a','review-needed','review','Review correction'),out('b','complete','export','Get export')],p2:[out('c','correction-needed','native','Approve wording','Carousel')],p3:[out('d','in-progress','native','Continue')]}});
 f.d.querySelector('[data-ht-home]').click();await f.settle();
 const rows=[...f.d.querySelectorAll('.wb-row')].map(r=>[r.querySelector('.wb-t').textContent,r.querySelector('.wb-act').textContent]);
 assert.deepEqual(json(rows),[['Output a','Review correction'],['Output c','Approve wording']]);
 assert.ok(f.reads.length<=8,'bounded to open and recent pieces');
});

test('nothing waiting means no band at all; unreadable pieces are reported, not hidden',async()=>{
 const f=fixture({records:{p1:[out('b','complete','export','Get export')]}});
 f.d.querySelector('[data-ht-home]').click();await f.settle();
 assert.equal(f.d.querySelector('.wb-band'),null);
 const g=fixture({records:{p1:[out('a','review-needed','review','Review')]},failing:['p2']});
 g.d.querySelector('[data-ht-home]').click();await g.settle();
 assert.match(g.d.querySelector('.wb-sub').textContent,/1 piece could not be read/);
});

test('opening a row switches piece through the save check, leaves Home, then uses the output owner',async()=>{
 const f=fixture({records:{p2:[out('c','review-needed','review','Review correction')]}});
 f.d.querySelector('[data-ht-home]').click();await f.settle();
 f.d.querySelector('[data-wb-open="0"]').click();await f.settle();
 assert.deepEqual(json(f.calls),[['switchProject','p2'],['onAction','p2','c','review'],['viewPhase',10]]);
 assert.equal(f.d.querySelector('#project-library').open,false);
});

test('a failed save refuses opening a row and keeps the editor and words',async()=>{
 const f=fixture({records:{p2:[out('c','review-needed','review','Review correction')]}});
 const editor=f.d.querySelector('#manuscript');
 f.d.querySelector('[data-ht-home]').click();await f.settle();
 f.fail=true;
 f.d.querySelector('[data-wb-open="0"]').click();await f.settle();
 assert.equal(f.w.current().id,'p0');
 assert.equal(f.calls.some(c=>c[0]==='onAction'),false);
 assert.equal(f.d.querySelector('#manuscript'),editor);
 assert.equal(editor.textContent,'Unsaved human writing');
 assert.match(f.d.querySelector('.wb-msg')?.textContent||'',/Save failed|saving|resolve/i);
});
