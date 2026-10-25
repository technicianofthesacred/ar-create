import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/document-study/piece-state.js',import.meta.url),'utf8');
function status({maintained=false,hidden=false,view='record',stage=6}={}){
 const surface={isConnected:true,hidden,closest:()=>null};
 const window={addEventListener(){}};
 const document={querySelector:selector=>maintained&&selector==='#app .workspace .phaseReader.draft-reading>.document .draft-read-words'?surface:null};
 vm.runInNewContext(source,{window,document,current:()=>({view,viewedStage:stage})});
 return window.c3PieceState.readOnlyReason(stage,{});
}
test('maintained Read identifies current manuscript without implying editing',()=>assert.equal(status({maintained:true}),'Current manuscript · read-only'));
test('retained Read remains explicitly retained',()=>assert.equal(status(),'Retained record · read-only'));
test('hidden maintained surface cannot relabel a retained record',()=>assert.equal(status({maintained:true,hidden:true}),'Retained record · read-only'));
test('Write and retained Check meanings are unchanged',()=>{assert.equal(status({maintained:true,view:'article',stage:5}),'');assert.equal(status({maintained:true,stage:7}),'Retained record · read-only')});
