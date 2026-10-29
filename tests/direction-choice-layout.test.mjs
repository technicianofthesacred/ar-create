import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/direction-choice-surface.js',import.meta.url),'utf8').replace("import {parsePreparedDirections} from '../lib/direction-choice.js';",'const parsePreparedDirections=()=>({});').replace('export function','function');
const css=fs.readFileSync(new URL('../public/document-study/direction-choice-surface.css',import.meta.url),'utf8');
for(const ready of [false,true])test('Direction keeps the outer source owner and existing writer; hides original angles only after validated options: '+ready,async()=>{
 const dom=new JSDOM('<style>'+css+'</style><body class="wbf-on"><main id="workspace"><div id="stage-working-lane"><div id="study-source-continuation"><div data-continuation-panel><section class="source-continuation"><div data-continuation-direction-mount><textarea id="material-human-direction">Exact unsaved invented notes.</textarea></div></section></div></div><section class="flow-existing">Retained original directions</section></div></main>',{url:'http://localhost',runScripts:'outside-only'}),w=dom.window;
 try{let finish,calls=0;w.current=()=>({id:'invented-subject',view:'record',viewedStage:4});w.inlineDirectionChoices={mount:()=>{calls++;return new Promise(r=>finish=r);}};w.eval(code);
 const owner=w.document.getElementById('study-source-continuation'),writer=w.document.getElementById('material-human-direction'),original=w.document.querySelector('.flow-existing');
 assert.equal(owner.parentElement.className,'combined-direction-author');assert.ok(owner.contains(writer));assert.equal(w.getComputedStyle(original).display,'block');
 w.directionChoiceSurface.decorate();assert.equal(calls,1);assert.equal(w.document.querySelectorAll('.source-continuation').length,1);assert.equal(writer.value,'Exact unsaved invented notes.');
 finish(ready);await Promise.resolve();await Promise.resolve();assert.equal(w.document.getElementById('workspace').classList.contains('combined-direction-ready'),ready);assert.equal(w.getComputedStyle(original).display,ready?'none':'block');assert.equal(w.document.getElementById('material-human-direction'),writer);
 }finally{w.close();}
});
