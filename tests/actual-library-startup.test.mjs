// Browser script order + delayed authority: generic fixture rows must never be
// presented as the actual Library while the real catalog is being read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const script=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
async function startup(t,{warm=false,folder=null}={}){
 const dom=new JSDOM('<div id="app"><div id="workspace"><header class="topbar"></header><nav class="workflowNavigation"></nav><textarea id="writer">Unsaved human words</textarea></div></div><aside class="wfb-panel" data-wfb-domain="library"><button data-wb-row="unsorted">Unsorted</button><button data-wb-row="all">All sources</button></aside>',{url:'http://localhost/document-study/index.html',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 const p={id:'story',view:'record',viewedStage:1,blocks:[{id:'human',html:'Exact unsaved words'}]},callbacks=[],calls=[];
 w.state={project:p.id,projects:[p]};w.current=()=>p;w.matchMedia=()=>({matches:false});w.AR_CREATE_REVIEW_MODE={actualWork:true,catalogCacheScope:'c'.repeat(64)};
 w.c3Shell={register(_name,callback){callbacks.push(callback);callback();}};w.c3Workbench={registerPanel(){},decorate(){for(const callback of callbacks)callback();}};
 if(folder)w.localStorage.setItem('workbench-folders-nav-library',JSON.stringify({folder,expanded:[]}));
 let resolveCatalog;const gate=new Promise(resolve=>{resolveCatalog=resolve;});
 w.fetch=async(url,options)=>{calls.push({url,options});if(url==='/api/review/catalog')return gate;const domain=url.includes('domain=media')?'media':'library';return {ok:true,json:async()=>({schema:'ar-create.library-folders.v1',domain,revision:1,indexHash:'a'.repeat(64),folders:[],sources:[{id:'qa-source',title:'Synthetic QA fallback',kind:'note'}]})};};
 w.eval(script('display-format.js'));w.eval(script('source-list-cache.js'));if(warm)w.createSourceListCache({scope:'c'.repeat(64)}).write([{id:'remembered',title:'Remembered actual source',authority:'library'}]);
 w.eval(script('catalog-projection.js'));w.eval(script('folder-browser.js'));await w.workbenchFolderBrowser.refresh();
 const beforeExisting=[...w.document.querySelectorAll('[data-wfb-preview]')].map(n=>n.textContent);
 w.eval(script('existing-work.js'));
 const finish=async(failed=false)=>{resolveCatalog({ok:!failed,json:async()=>failed?{error:'Invented unavailable authority'}:({mode:'existing-work-read-only',revision:'d'.repeat(64),stories:[],sources:[{id:'actual-source',title:'Current actual source',authority:'library',kind:'note'}],diagnostics:[]})});await w.existingWork.load();};
 return {w,p,calls,beforeExisting,finish};
}
test('cold actual Library keeps the maintained loading table and never exposes generic rows',async t=>{
 const {w,p,calls,beforeExisting,finish}=await startup(t),writer=w.document.getElementById('writer'),before=JSON.stringify(p);
 assert.deepEqual(beforeExisting,[]);assert.equal(w.document.querySelector('.ew-source-library'),null);assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
 assert.match(w.document.querySelector('.wfb-browser [role="status"]').textContent,/Reading.*sources/i);await Promise.resolve();assert.equal(JSON.stringify(p),before);assert.equal(w.document.getElementById('writer'),writer);
 await finish();assert.ok(w.document.querySelector('[data-wfb-preview="actual-source"]'));assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);assert.equal(calls.some(c=>c.options?.method==='POST'),false);
});
test('warm same-authority rows appear in the table, then fresh sources replace them',async t=>{
 const {w,beforeExisting,finish}=await startup(t,{warm:true});assert.deepEqual(beforeExisting,[]);assert.ok(w.document.querySelector('[data-wfb-preview="remembered"]'));assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
 await finish();assert.equal(w.document.querySelector('[data-wfb-preview="remembered"]'),null);assert.ok(w.document.querySelector('[data-wfb-preview="actual-source"]'));
});
test('deliberate indexed-folder navigation remains within the same real catalog table',async t=>{
 const {w,finish}=await startup(t);const button=w.document.querySelector('[data-wb-row="unsorted"]');button.addEventListener('click',()=>w.workbenchFolderBrowser.panelSpec('library').press('unsorted'));button.click();assert.equal(w.document.querySelector('.ew-source-library'),null);assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
 await finish();assert.ok(w.document.querySelector('[data-wfb-preview="actual-source"]'));const table=w.document.querySelector('.wfb-browser.k-library');w.document.querySelector('[data-wfb-action="filters"]').click();w.document.querySelector('[data-wfb-view="all"]').click();assert.equal(w.document.querySelector('.wfb-browser.k-library'),table);assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
});
test('remembered explicit folder choice and pending writing survive catalog startup',async t=>{
 const {w,finish}=await startup(t,{folder:'unsorted'});assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);await finish();assert.equal(w.workbenchFolderBrowser.librarySurface(),'files');assert.ok(w.document.querySelector('[data-wfb-preview="actual-source"]'));assert.equal(w.document.getElementById('writer').value,'Unsaved human words');
});
test('failed cold catalog keeps a compact retry state without falling back to generic rows',async t=>{
 const {w,finish}=await startup(t);await finish(true);assert.match(w.document.querySelector('.wfb-browser [role="status"]').textContent,/could not refresh/i);assert.ok(w.document.querySelector('.wfb-browser [data-wfb-action="refresh"]'));assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
});
test('unavailable remembered folder falls back to the actual table, preserving its records',async t=>{
 const {w,finish}=await startup(t,{folder:'missing-folder'});assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);assert.match(w.document.querySelector('.wfb-browser [role="status"]').textContent,/Reading.*sources/i);await finish();assert.ok(w.document.querySelector('[data-wfb-preview="actual-source"]'));assert.equal(w.document.querySelector('[data-wfb-preview="qa-source"]'),null);
});

test('settled actual Library decoration does not replace an unchanged sidebar count',async t=>{
 const {w,finish}=await startup(t);await finish();
 const button=w.document.querySelector('[data-wb-row="all"]'),row=button.closest('.wfb-tn')||button.parentElement;row.classList.add('wfb-tn');
 let count=row.querySelector('.wfb-tc');if(!count){count=w.document.createElement('span');count.className='wfb-tc';row.append(count);}
 w.existingWork.decorate();const text=count.firstChild,records=[];const observer=new w.MutationObserver(entries=>records.push(...entries));observer.observe(count,{childList:true,subtree:true});
 w.existingWork.decorate();w.existingWork.decorate();await Promise.resolve();observer.disconnect();
 assert.equal(count.textContent,'1');assert.equal(count.firstChild,text,'unchanged count must retain its text node');assert.equal(records.length,0,'stable decoration must not wake global child-list observers');
});
