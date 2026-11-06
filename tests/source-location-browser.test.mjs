import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const scope='a'.repeat(64),revision='b'.repeat(64),hash='c'.repeat(64),treeHash='d'.repeat(64),tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const source={id:'source-one',authority:'library',rootId:'library',rel_path:'Notes/Tea/one.md',hash,title:'Shared title',kind:'note'},original={id:'artifact-one',artifactId:'artifact-one',authority:'magazine-original',storyId:'story-one',relativePath:'Story/Research/one.md',hash,title:'Shared title',kind:'NOTES'};
const tree=()=>({indexHash:treeHash,sources:[source],roots:[{id:'library',name:'My existing library',path:'/private/never-shown',tree:{rel_path:'',files:[],folders:[{rel_path:'Notes',files:[],folders:[{rel_path:'Notes/Tea',files:[{sourceId:source.id,rel_path:source.rel_path}],folders:[]}]}]}}]});
async function setup({treeRead=async()=>tree(),active=true}={}){
 const dom=new JSDOM('<div id="app"><div id="workspace"><textarea id="native">Unsaved words</textarea></div></div>',{runScripts:'outside-only',url:'http://localhost/'}),w=dom.window,calls=[],opened=[],current={view:'record',viewedStage:active?1:5};
 w.current=()=>current;w.AR_CREATE_REVIEW_MODE={actualWork:true};w.matchMedia=()=>({matches:false});w.c3Shell={register(){}};w.c3Workbench={registerPanel(){},decorate(){},toggle(){}};
 w.fetch=async(url,options={})=>{calls.push({url,options});if(options.method==='POST')throw Error('Unexpected mutation');const data=url==='/api/sources/tree'?await treeRead():url==='/api/collections'?{collections:[]}:{schema:'ar-create.library-folders.v1',domain:url.includes('media')?'media':'library',revision:2,indexHash:hash,folders:[{id:'logical-kept',name:'Kept',parentId:null,sourceIds:[source.id]}],sources:[source]};return {ok:true,json:async()=>data};};
 for(const name of ['display-format.js','catalog-projection.js','source-location-projection.js','folder-browser.js'])w.eval(read(name));
 await w.workbenchFolderBrowser.refresh();const base={sources:[source,original],scope,revision,ready:true,storyNames:{'story-one':'A real story'},openSource:async descriptor=>opened.push(descriptor)};
 w.workbenchFolderBrowser.setLibraryCatalog(base);await tick();w.workbenchFolderBrowser.panelSpec('library').press('all');await tick();
 const spec=w.workbenchFolderBrowser.panelSpec('library');let panel;
 const paint=()=>{panel?.remove();panel=w.document.createElement('aside');panel.innerHTML=spec.body();w.document.body.append(panel);spec.afterRender(panel);return panel;};
 const locationKey=name=>{paint();return [...panel.querySelectorAll('[data-wb-row^="location:"]')].find(node=>node.textContent.trim()===name)?.dataset.wbRow;};
 const expand=name=>{paint();const button=[...panel.querySelectorAll('[data-wfb-location-expand]')].find(node=>node.getAttribute('aria-label')==='Expand '+name);assert.ok(button,'Expandable '+name);button.click();paint();};
 return {w,d:w.document,calls,opened,current,base,spec,paint,locationKey,expand,close:()=>w.close()};
}
test('nested Locations filter one existing list and open exact source owner; logical filing remains separate',async()=>{
 const x=await setup();try{let panel=x.paint();assert.match(panel.textContent,/Locations/);assert.ok(x.locationKey('My existing library'));assert.ok(x.locationKey('A real story'));assert.equal(x.locationKey('Notes'),undefined,'roots begin collapsed');assert.ok(panel.querySelector('[data-wfb-new]').disabled);
 x.expand('My existing library');x.expand('Notes');const key=x.locationKey('Tea');x.spec.press(key);assert.equal(x.d.querySelectorAll('.wfb-vrow').length,1);assert.equal(x.d.querySelector('.wfb-vrow').dataset.wfbId,source.id);assert.match(x.d.querySelector('.wfb-crumbs').textContent,/All sources.*My existing library.*Notes.*Tea/);
 x.d.querySelector('[data-wfb-preview]').click();await tick();assert.equal(x.opened[0].id,source.id);assert.equal(x.opened[0].hash,hash);assert.equal(x.opened[0].authority,'library');
 x.d.querySelector('[data-wfb-folder-pick="all"]').click();assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);x.spec.press('folder:logical-kept');assert.equal(x.d.querySelectorAll('.wfb-vrow').length,1);assert.match(x.d.querySelector('.wfb-crumbs').textContent,/Kept/);
 x.spec.press(x.locationKey('A real story'));assert.equal(x.d.querySelector('.wfb-vrow').dataset.wfbId,original.id);x.d.querySelector('[data-wfb-preview]').click();await tick();assert.equal(x.opened[1].artifactId,original.artifactId);assert.equal(x.opened[1].storyId,original.storyId);
 assert.equal(x.calls.filter(call=>call.options.method==='POST').length,0);assert.equal(x.d.querySelector('#native').value,'Unsaved words');assert.ok(!x.paint().textContent.includes('story-one'));assert.ok(!x.paint().textContent.includes('/private'));assert.ok(!x.w.localStorage.getItem('workbench-folders-nav-library').includes('location-'));
 }finally{x.close();}
});
test('catalog revision and root changes reject stale sidebar keys and clear location selection',async()=>{
 const x=await setup();try{const stale=x.locationKey('My existing library');x.spec.press(stale);assert.equal(x.d.querySelector('[data-wfb-select]'),null);x.d.querySelector('[data-wfb-action="selectionmode"]').click();x.d.querySelector('[data-wfb-select]').click();x.w.workbenchFolderBrowser.setLibraryCatalog({...x.base,scope:'e'.repeat(64),revision:'f'.repeat(64)});await tick();assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);assert.equal(x.d.querySelector('[data-wfb-select]').checked,false);x.spec.press(stale);assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);assert.match(x.paint().textContent,/folder changed/);assert.equal(x.opened.length,0);}finally{x.close();}
});
test('lazy tree reader shares one pending request; late old-scope response cannot replace current locations',async()=>{
 let resolveFirst,reads=0;const first=new Promise(resolve=>{resolveFirst=resolve;});const x=await setup({active:false,treeRead:async()=>++reads===1?first:tree()});try{assert.equal(reads,0);x.current.viewedStage=1;x.spec.rows();x.spec.rows();await tick();assert.equal(reads,1);x.w.workbenchFolderBrowser.setLibraryCatalog({...x.base,scope:'e'.repeat(64),revision:'f'.repeat(64)});await tick();assert.equal(reads,2);resolveFirst({...tree(),indexHash:'1'.repeat(64),roots:[]});await tick();assert.ok(x.locationKey('My existing library'));assert.equal(x.calls.filter(call=>call.options.method==='POST').length,0);}finally{x.close();}
});
test('failed and mismatched location reads preserve exact catalog and never manufacture folders',async()=>{
 const x=await setup({treeRead:async()=>({...tree(),sources:[{...source,hash:'e'.repeat(64)}]})});try{assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);assert.equal(x.locationKey('My existing library'),undefined);assert.match(x.paint().textContent,/Existing folders could not refresh/);assert.ok(x.paint().querySelector('[data-wfb-new]').disabled);assert.equal(x.calls.filter(call=>call.url==='/api/sources/tree').length,1);}finally{x.close();}
});


test('a fresh tree revision clears physical selection and old keys while preserving logical filing records',async()=>{
 let currentTree=tree();const x=await setup({treeRead:async()=>currentTree});try{const stale=x.locationKey('My existing library');x.spec.press(stale);currentTree={...tree(),indexHash:'2'.repeat(64)};await x.w.workbenchFolderBrowser.refresh();assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);x.spec.press(stale);assert.equal(x.d.querySelectorAll('.wfb-vrow').length,2);x.spec.press('folder:logical-kept');assert.equal(x.d.querySelectorAll('.wfb-vrow').length,1);assert.equal(x.d.querySelector('.wfb-vrow').dataset.wfbId,source.id);assert.equal(x.calls.filter(call=>call.options.method==='POST').length,0);}finally{x.close();}
});
