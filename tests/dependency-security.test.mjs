import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const lock=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../runtime/package-lock.json'),'utf8'));
const atLeast=(version,minimum)=>{const actual=version.split('.').map(Number),wanted=minimum.split('.').map(Number);for(let i=0;i<3;i++){if(actual[i]>wanted[i])return true;if(actual[i]<wanted[i])return false;}return true;};
test('every installed Tiptap core and ProseMirror view is past the advisory ranges',()=>{
 for(const [name,entry] of Object.entries(lock.packages)){
  if(name.endsWith('/@tiptap/core'))assert.ok(atLeast(entry.version,'3.30.5'),`${name} retains vulnerable Markdown attribute parsers`);
  if(name.endsWith('/prosemirror-view'))assert.ok(atLeast(entry.version,'1.42.3'),`${name} retains vulnerable paste handling`);
 }
});
test('Tiptap packages keep their exact matching peer family',()=>{const versions=new Set(Object.entries(lock.packages).filter(([name])=>/node_modules\/@tiptap\/[^/]+$/.test(name)).map(([,entry])=>entry.version));assert.equal(versions.size,1,'Mixed Tiptap families risk schema/peer incompatibility');});
