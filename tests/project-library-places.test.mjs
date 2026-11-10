import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createSubjectPlaces} from '../runtime/services/subject-places.mjs';
import {withActor} from '../runtime/services/actor.mjs';

// The page reads and writes where each project lives through the subject place commands, while every screen keeps its
// look. A fake fetch hands the page's requests to the real service over a temporary data folder. Invented projects only.
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/project-library.js',import.meta.url),'utf8');

function server(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-places-page-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const places=createSubjectPlaces({dataDir:dir}),calls=[];let offline=false;
 const call=async(route,body,actor={actor:'human:adrian',client:'ui'})=>withActor(actor,async()=>{
  if(route==='/api/subject-places')return places.read({});
  if(route==='/api/subject-places/save')return places.save(body);
  if(route==='/api/subject-places/carry')return places.carry(body);
  throw Object.assign(Error('unknown '+route),{status:404});
 });
 const fetch=async(route,options)=>{
  const body=options?.body?JSON.parse(options.body):undefined;
  if(route==='/api/study-draft/catalog')return {ok:true,status:200,json:async()=>({collections:[]})};
  calls.push({route,body});
  if(offline)throw TypeError('Failed to fetch');
  try{const value=await call(route,body);return {ok:true,status:200,json:async()=>value};}
  catch(error){return {ok:false,status:error.status||500,json:async()=>({error:error.message})};}
 };
 return {dir,places,calls,fetch,call,set offline(value){offline=value;},
  read:id=>call('/api/subject-places').then(v=>v.places.find(p=>p.parentStudyId===id)||null),
  agent:body=>call('/api/subject-places/save',{operationId:randomUUID(),...body},{actor:'agent:codex',client:'cli'})};
}
function page(t,srv,{projects,live=true,storage={}}={}){
 const dom=new JSDOM('<div class="workspace"><header class="topbar"><h1>Work</h1></header><aside class="rail"></aside><div id="manuscript" contenteditable="true">Unsaved invented words</div></div>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 t.after(()=>dom.window.close());
 for(const [k,v] of Object.entries(storage))w.localStorage.setItem(k,v);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.CSS={escape:s=>s};
 w.state={project:projects[0].id,projects:structuredClone(projects)};w.current=()=>w.state.projects.find(p=>p.id===w.state.project);
 w.mobileProjects=false;w.render=()=>{};let saves=0;w.save=()=>{saves++;};w.switchProject=async id=>{w.state.project=id;};w.studyOutputConnection={flush:async()=>{}};
 w.crypto.randomUUID=()=>randomUUID();
 const listeners=[];if(live)w.c3Shell={live:{on(filter,fn){listeners.push({filter,fn});return ()=>{};}}};
 w.fetch=srv.fetch;w.eval(code);
 const idle=async()=>{await w.projectLibrary.whenIdle();await w.projectLibrary.placesIdle();};
 return {w,listeners,idle,get saves(){return saves;},p:id=>w.state.projects.find(p=>p.id===id),
  click:async selector=>{w.document.querySelector(selector).click();await idle();},
  change:async()=>{for(const l of listeners)l.fn({kind:'subject-places.save',scope:{kind:'project'}});await idle();}};
}
const invented=()=>[
 {id:'p-current',name:'Invented current',folder:'Projects',step:'Material'},
 {id:'p-tea',name:'Invented tea',folder:'Tea',step:'Material'},
 {id:'p-old',name:'Invented resting',folder:'Projects',archived:true,step:'Material'},
 {id:'p-pin',name:'Invented pinned',folder:'Art/Studio',pinnedAt:Date.parse('2026-10-30T08:00:00Z'),step:'Material'},
 {id:'p-plain',name:'Invented plain',folder:'Projects',step:'Material'},
];

test('the rail and the library say plainly where pins and filing are kept',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 assert.match(f.w.document.querySelector('.pl-rail-bottom small').textContent,/^Pins and filing are saved with each project\.$/);
 assert.doesNotMatch(f.w.document.body.innerHTML,/stay in this browser\.<\/small>|browser-local/);
 await f.click('[data-pl-library]');
 assert.equal(f.w.document.querySelector('.pl-results-head small').textContent,'Recents stay in this browser; pins and filing are saved with each project');
 // The hooks the look modules find are unchanged.
 for(const hook of ['[data-pl-library]','[data-pl-new]','[data-pl-file]','[data-pl-pin]','[data-pl-search]','[data-pl-filter]','[data-pl-results]'])assert.ok(f.w.document.querySelector(hook),hook);
});

test('filing this browser already holds is carried over once as an import, and the saved place wins afterwards',async t=>{
 const srv=server(t),first=page(t,srv,{projects:invented()});await first.idle();
 const carries=srv.calls.filter(c=>c.route==='/api/subject-places/carry');
 assert.deepEqual(carries.map(c=>c.body.parentStudyId).sort(),['p-old','p-pin','p-tea'],'only projects with filing are carried; plain ones stay without a place');
 const tea=await srv.read('p-tea'),pin=await srv.read('p-pin'),old=await srv.read('p-old');
 assert.deepEqual([tea.folder,tea.updatedBy,tea.importedFrom,tea.carriedBy],[['Tea'],'import:browser','browser','human:adrian']);
 assert.deepEqual([pin.folder,pin.pinnedAt],[['Art','Studio'],'2026-10-30T08:00:00.000Z']);assert.equal(old.archived,true);
 assert.equal(await srv.read('p-plain'),null);assert.equal(await srv.read('p-current'),null);
 // The screens look as they did: same folder labels, pin and archive.
 assert.deepEqual([first.p('p-tea').folder,first.p('p-pin').folder,first.p('p-pin').pinnedAt,first.p('p-old').archived],['Tea','Art/Studio',Date.parse('2026-10-30T08:00:00Z'),true]);
 // A second sync carries nothing again.
 srv.calls.length=0;await first.change();
 assert.deepEqual(srv.calls.map(c=>c.route),['/api/subject-places']);
 // Another browser with different old filing: the saved place wins, and its own copy is kept aside, never thrown away.
 const other=invented().map(p=>p.id==='p-tea'?{...p,folder:'Other tea'}:p.id==='p-old'?{...p,archived:false}:p);
 const second=page(t,srv,{projects:other});await second.idle();
 assert.equal(srv.calls.filter(c=>c.route==='/api/subject-places/carry').length,0);
 assert.equal(second.p('p-tea').folder,'Tea');assert.equal(second.p('p-old').archived,true);
 const book=JSON.parse(second.w.localStorage.getItem('ar-create-subject-places-v1'));
 assert.deepEqual(book.replaced['p-tea'].folder,['Other tea']);
 assert.equal((await srv.read('p-tea')).revision,1,'the server copy was not touched');
});

test('a pin or Organize made in the page is saved with the project as Adrian, with its revision',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 await f.click('[data-pl-library]');
 await f.click('[data-pl-pin="p-plain"]');
 const pinned=await srv.read('p-plain');
 assert.ok(pinned,'a project with no place gets one when it is pinned here');
 assert.equal(pinned.updatedBy,'human:adrian');assert.equal(Date.parse(pinned.pinnedAt),f.p('p-plain').pinnedAt);
 const save=srv.calls.find(c=>c.route==='/api/subject-places/save'&&c.body.parentStudyId==='p-plain');
 assert.equal(save.body.expectedRevision,0);
 await f.click('[data-pl-file="p-tea"]');
 const form=f.w.document.querySelector('[data-pl-file-form]');
 assert.match(form.textContent,/This is saved with the project, so every window and assistant sees it\./);
 form.elements.folder.value='Tea / Gardens';form.elements.archived.checked=true;
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.idle();
 const tea=await srv.read('p-tea');
 assert.deepEqual([tea.folder,tea.archived,tea.revision,tea.updatedBy],[['Tea','Gardens'],true,2,'human:adrian']);
 const sent=srv.calls.filter(c=>c.route==='/api/subject-places/save'&&c.body.parentStudyId==='p-tea').at(-1).body;
 assert.deepEqual([sent.expectedRevision,typeof sent.expectedHash,Object.hasOwn(sent,'pinnedAt')],[1,'string',false],'only what changed is sent, over the read revision');
 assert.equal(f.w.document.querySelector('[data-pl-status]').textContent,'Organization saved.');
});

test('when the app cannot be reached the filing is kept here and sent later; nothing is dropped',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 srv.offline=true;
 await f.click('[data-pl-library]');await f.click('[data-pl-pin="p-plain"]');
 assert.ok(f.p('p-plain').pinnedAt,'the pin shows at once');
 assert.equal(f.w.document.querySelectorAll('[aria-label="Pinned projects"] .pl-project').length,2);
 await f.click('[data-pl-file="p-current"]');
 const form=f.w.document.querySelector('[data-pl-file-form]');form.elements.folder.value='Offline folder';
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.idle();
 assert.equal(f.w.document.querySelector('[data-pl-status]').textContent,'Organization kept in this browser. It will be saved when the app can be reached.');
 assert.equal(f.p('p-current').folder,'Offline folder');
 // Back online: the next sync (the app's change stream, focus or the retry timer) sends both.
 srv.offline=false;await f.change();
 assert.ok((await srv.read('p-plain')).pinnedAt);assert.deepEqual((await srv.read('p-current')).folder,['Offline folder']);
 assert.equal(f.p('p-current').folder,'Offline folder');assert.ok(f.p('p-plain').pinnedAt);
});

test('a place an assistant changes reaches the open page through the change stream; a stale page change is merged, not forced',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 const tea=await srv.read('p-tea');
 await srv.agent({parentStudyId:'p-tea',expectedRevision:tea.revision,expectedHash:tea.hash,folder:['Tea','Oolong'],tags:['invented']});
 await f.change();
 assert.equal(f.p('p-tea').folder,'Tea/Oolong');assert.deepEqual([...f.p('p-tea').tags],['invented']);
 // The page pins while an assistant has just moved the same project: the pin goes over the newer revision and the move is kept.
 const now=await srv.read('p-tea');
 await f.click('[data-pl-library]');
 srv.offline=true;await f.click('[data-pl-pin="p-tea"]');srv.offline=false;
 await srv.agent({parentStudyId:'p-tea',expectedRevision:now.revision,expectedHash:now.hash,folder:['Tea','Green']});
 await f.change();
 const merged=await srv.read('p-tea');
 assert.deepEqual([merged.folder,!!merged.pinnedAt],[['Tea','Green'],true]);
 assert.equal(f.p('p-tea').folder,'Tea/Green');assert.ok(f.p('p-tea').pinnedAt);
});

test('without the app shell (older pages, unit fixtures) the page works from this browser alone, as before',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented(),live:false});await f.idle();
 await f.click('[data-pl-library]');await f.click('[data-pl-pin="p-plain"]');
 assert.ok(f.p('p-plain').pinnedAt);assert.deepEqual(srv.calls,[],'no place request is made');
 await f.click('[data-pl-file="p-tea"]');
 const form=f.w.document.querySelector('[data-pl-file-form]');form.elements.folder.value='Still local';
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.idle();
 assert.equal(f.w.document.querySelector('[data-pl-status]').textContent,'Organization saved in this browser.');
});

test('an offline edit never overwrites a newer saved place: per field, only what the page alone changed is sent',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 // Browser A goes offline and changes the folder and the archived flag of the same project.
 srv.offline=true;
 await f.click('[data-pl-library]');await f.click('[data-pl-file="p-tea"]');
 const form=f.w.document.querySelector('[data-pl-file-form]');form.elements.folder.value='Mine offline';form.elements.archived.checked=true;
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.idle();
 // Meanwhile an assistant moves it and pins it on the server.
 srv.offline=false;const before=await srv.read('p-tea');
 await srv.agent({parentStudyId:'p-tea',expectedRevision:before.revision,expectedHash:before.hash,folder:['Tea','Assistant'],pinned:true});
 await f.change();
 const after=await srv.read('p-tea');
 assert.deepEqual([after.folder,after.archived,!!after.pinnedAt],[['Tea','Assistant'],true,true],'the server folder and pin stay; the archive only A made is sent');
 const sent=srv.calls.filter(c=>c.route==='/api/subject-places/save'&&c.body.parentStudyId==='p-tea').at(-1).body;
 assert.equal(Object.hasOwn(sent,'folder'),false,'the folder both changed is not sent');assert.equal(sent.archived,true);
 assert.deepEqual([f.p('p-tea').folder,f.p('p-tea').archived,!!f.p('p-tea').pinnedAt],['Tea/Assistant',true,true]);
 const book=JSON.parse(f.w.localStorage.getItem('ar-create-subject-places-v1'));
 assert.deepEqual(book.replaced['p-tea'].folder,['Mine offline'],'A\'s folder is kept aside, not lost');
});

test('carry-over is per field: a place an assistant gave only tags still takes the browser\'s pin and folder once',async t=>{
 const srv=server(t);
 await srv.agent({parentStudyId:'p-pin',expectedRevision:0,tags:['invented']});
 const f=page(t,srv,{projects:invented()});await f.idle();
 const place=await srv.read('p-pin');
 assert.deepEqual([place.tags,place.folder,place.pinnedAt,place.updatedBy],[['invented'],['Art','Studio'],'2026-10-30T08:00:00.000Z','import:browser']);
 assert.deepEqual([f.p('p-pin').folder,[...f.p('p-pin').tags]],['Art/Studio',['invented']]);
 srv.calls.length=0;await f.change();
 assert.equal(srv.calls.filter(c=>c.route==='/api/subject-places/carry').length,0,'carried once');
});

test('a folder label with a backslash is refused with the plain folder message, and nothing changes',async t=>{
 const srv=server(t),f=page(t,srv,{projects:invented()});await f.idle();
 await f.click('[data-pl-library]');await f.click('[data-pl-file="p-tea"]');
 const form=f.w.document.querySelector('[data-pl-file-form]');form.elements.folder.value='a\\b';
 form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await f.idle();
 assert.equal(f.w.document.querySelector('[data-pl-status]').textContent,'Use a short folder name without paths or control characters.');
 assert.equal(f.p('p-tea').folder,'Tea');assert.deepEqual((await srv.read('p-tea')).folder,['Tea']);
});
