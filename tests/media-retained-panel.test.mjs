import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
async function setup({retained=true,phone=false}={}){
 const dom=new JSDOM('<div id="app"><div class="shell"><nav class="workflowNavigation c3-rail"><div class="wn-family" data-family="make"><button class="workflowStep" aria-current="step"><span class="stepNumber">8</span><span class="stepName">Media</span></button></div></nav><main id="workspace"><h1 class="c3-ctitle">Media</h1><section id="owned-photo-stage"><div class="study-photos"><p>No photos added yet</p><textarea>Exact pending caption</textarea></div></section>'+(retained?'<details data-retained-photo-records><summary>2 earlier photo placements · read-only</summary><div class="stagePhotoGrid"><img src="/invented-a.jpg"><figcaption>Earlier caption A</figcaption><img src="/invented-b.jpg"><figcaption>Earlier caption B</figcaption></div></details>':'')+'</main></div></div>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document,calls=[];let stage=8;
 w.current=()=>({id:'synthetic-photo-essay',view:'record',viewedStage:stage});w.matchMedia=()=>({matches:phone,addEventListener(){}});w.c3Shell={register(){}};
 w.fetch=async(url,opts={})=>{calls.push({url,opts});return {ok:true,json:async()=>({schema:'ar-create.library-folders.v1',domain:url.includes('domain=media')?'media':'library',revision:1,indexHash:'invented-hash',folders:[],sources:[]})};};
 for(const name of ['workbench-rail.js','folder-browser.js','media-outputs-tools.js'])w.eval(read(name));await w.workbenchFolderBrowser.refresh();await pause();
 return {w,d,calls,stage(n){stage=n;w.c3Workbench.decorate();},async close(){w.mediaOutputsTools.destroy();await pause();w.close();}};
}
test('actual custom Media panel reaches retained placements while All media remains legitimately empty',async()=>{
 const b=await setup();try{const retained=b.d.querySelector('[data-retained-photo-records]'),caption=b.d.querySelector('textarea');caption.value='Unsaved exact native caption';assert.ok(b.d.querySelector('.wfb-browser'));assert.match(b.d.querySelector('[data-wb-row="all"]').parentElement.textContent,/All media0/);
 const row=b.d.querySelector('#wb-panel .wfb-panel [data-wb-row="retained"]');assert.ok(row,'custom panel, which replaces generic rows, must expose retained records');assert.match(row.textContent,/2 earlier photo placements/);row.click();await pause();assert.ok(retained.open);assert.equal(b.d.querySelector('.wfb-browser'),null);assert.strictEqual(b.d.querySelector('[data-retained-photo-records]'),retained);assert.strictEqual(b.d.querySelector('textarea'),caption);assert.equal(caption.value,'Unsaved exact native caption');assert.equal(b.d.querySelectorAll('.stagePhotoGrid img').length,2);assert.equal(b.calls.filter(c=>c.opts.method==='POST').length,0);
 b.d.querySelector('[data-wb-row="all"]').click();assert.ok(b.d.querySelector('.wfb-browser'));assert.equal(b.d.querySelectorAll('.wfb-vrow').length,0);assert.equal(caption.value,'Unsaved exact native caption');
 }finally{await b.close();}
});
test('native-empty Media summary distinguishes accessible retained placements from the native collection',async()=>{
 const b=await setup();try{b.d.querySelector('[data-wb-row="native"]').click();b.w.mediaOutputsTools.refresh();const text=b.d.querySelector('[data-mot-context]').textContent;assert.match(text,/0.*native/);assert.match(text,/2 retained photo placements/);assert.doesNotMatch(text,/must connect before assets can be inspected/);assert.equal(b.d.querySelectorAll('[data-photo-occurrence]').length,0);}finally{await b.close();}
});
test('retained entrance is scoped to Media with actual retained content and works through the phone sheet',async()=>{
 const b=await setup({phone:true});try{b.d.querySelector('#wb-open').click();b.d.querySelector('[data-wb-row="retained"]').click();await pause();assert.ok(b.d.querySelector('[data-retained-photo-records]').open);assert.equal(b.d.querySelector('#wb-panel'),null);b.stage(1);b.d.querySelector('#wb-open').click();assert.equal(b.d.querySelector('[data-wb-row="retained"]'),null);}finally{await b.close();}
 const empty=await setup({retained:false});try{assert.equal(empty.d.querySelector('[data-wb-row="retained"]'),null);assert.doesNotMatch(empty.d.querySelector('[data-mot-context]').textContent,/retained photo placements/);}finally{await empty.close();}
});
