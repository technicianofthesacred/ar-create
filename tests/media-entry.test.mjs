import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom');
const code=await fs.readFile(new URL('../public/document-study/folder-browser.js',import.meta.url),'utf8');
for(const remembered of [null,'native'])test(`Media enters ${remembered?'remembered This piece':'All media'} and preserves native edits`,async()=>{
 const dom=new JSDOM('<div id="app"><div id="workspace"><textarea id="caption">Unsaved caption</textarea><input id="selected" type="checkbox" checked></div></div>',{runScripts:'outside-only',url:'http://localhost'}),w=dom.window;
 try{
  if(remembered)w.localStorage.setItem('workbench-folders-nav-media',JSON.stringify({folder:remembered,expanded:[]}));
  w.current=()=>({view:'record',viewedStage:8});w.matchMedia=()=>({matches:false});w.c3Shell={register(){}};w.c3Workbench={registerPanel(){},decorate(){},toggle(){}};
  w.fetch=async()=>({ok:true,json:async()=>({schema:'ar-create.library-folders.v1',domain:'media',revision:1,indexHash:'h',folders:[],sources:[]})});
  w.eval(code);await w.workbenchFolderBrowser.refresh();
  assert.equal(!!w.document.querySelector('.k-media'),!remembered);
  const spec=w.workbenchFolderBrowser.panelSpec('media');spec.press('native');
  assert.equal(w.document.querySelector('.k-media'),null);assert.equal(w.document.querySelector('#caption').value,'Unsaved caption');assert.equal(w.document.querySelector('#selected').checked,true);
  spec.press('all');assert.ok(w.document.querySelector('.lb.compact.k-med'));assert.ok(w.document.querySelector('.wfb-thead.thead'));assert.equal(w.document.querySelector('#caption').value,'Unsaved caption');
 }finally{w.close();}
});
