import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/project-library.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function fixture(){
 const dom=new JSDOM('<div class="workspace"><header class="topbar"><h1>Current work</h1></header><aside class="rail"></aside><div id="manuscript" contenteditable="true">My exact words. 保留原话</div></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 const rows=[],calls=[];let blocked=false;
 w.state={project:'current',projects:[{id:'current',name:'Current work',viewedStage:4}]};w.current=()=>w.state.projects.find(p=>p.id===w.state.project);w.mobileProjects=false;w.render=()=>{};w.save=()=>{};w.switchProject=async id=>{w.state.project=id;};w.studyOutputConnection={flush:async()=>{if(blocked)throw Error('Save current changes first.');}};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async route=>{calls.push(route);assert.equal(route,'/api/study-draft/catalog');return {ok:true,json:async()=>({collections:rows})};};
 w.eval(code);await tick();
 return {w,dom,rows,calls,block(value){blocked=value;}};
}
test('opening existing All projects discovers external collections without switching or replacing words',async()=>{
 const f=await fixture(),editor=f.w.document.querySelector('#manuscript');editor.focus();
 f.rows.push({parentStudyId:'external-concept',bindingId:'collection-external',kind:'collection-root',bindingStatus:'ready',title:'Garden concept'});
 await f.w.projectLibrary.open();
 assert.equal(f.calls.length,2);assert.equal(f.w.state.project,'current');assert.equal(f.w.document.querySelector('#manuscript'),editor);assert.equal(editor.textContent,'My exact words. 保留原话');
 assert.match(f.w.document.querySelector('#project-library').textContent,/Garden concept/);assert.equal(f.w.studyCollectionWorkspace.supports('external-concept'),true);
 f.dom.window.close();
});
test('library save guard runs before external discovery and preserves current work when blocked',async()=>{
 const f=await fixture(),editor=f.w.document.querySelector('#manuscript');f.block(true);f.rows.push({parentStudyId:'external-concept',bindingId:'collection-external',kind:'collection-root',bindingStatus:'ready',title:'Garden concept'});
 await assert.rejects(f.w.projectLibrary.open(),/Save current changes first/);assert.equal(f.calls.length,1);assert.equal(f.w.state.projects.length,1);assert.equal(f.w.state.project,'current');assert.equal(f.w.document.querySelector('#manuscript'),editor);assert.equal(f.w.document.querySelector('#project-library'),null);
 f.dom.window.close();
});
