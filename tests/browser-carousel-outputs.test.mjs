import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const script=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
function boot({outputs=[],read,local=true}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document;
 const p={id:'p',name:'Synthetic carousel',view:'record',viewedStage:12,slides:Array.from({length:8},(_,i)=>({id:'s'+i,text:'Original '+i}))},q={id:'q',name:'Other',view:'record',viewedStage:12},before=JSON.stringify(p),calls=[];let active=p;
 let descriptor=local?{schema:'ar-create.browser-carousel-pickup.v1',projectId:'p',id:'carousel',authority:'browser-local',edition:'Browser copy',slideCount:8,slideIds:p.slides.map(s=>s.id),wordsSignature:'PRIVATE_SIGNATURE',arrangementSignature:'PRIVATE_LAYOUT'}:null;
 w.current=()=>active;w.state={projects:[p,q]};w.historicalNotice=()=>'';w.workflowBar=()=>'';w.phaseReader=()=>'';w.render=()=>{d.getElementById('app').innerHTML='<div class="workspace"><div class="c3-ws-title"></div>'+w.phaseReader(active)+'</div>';};w.c3Shell={register(){}};w.workspaceNavigation={outputs:()=>outputs};w.viewPhase=async n=>{active.viewedStage=n;};w.structuredClone=structuredClone;
 w.workbenchPieces={carouselEdition:id=>descriptor?.projectId===id?structuredClone(descriptor):null,openCarousel:async expected=>{calls.push(['browser',structuredClone(expected)]);if(expected.projectId!==active.id||JSON.stringify(expected)!==JSON.stringify(descriptor))throw Error('Guarded browser copy changed');active.view='carousel';return true;}};
 w.realOutputOverview={read:read||(async({projectId})=>({projectId,outputs})),onAction:async value=>calls.push(['native',value])};
 w.eval(script('output-overview.js'));
 return {w,d,p,q,before,calls,setDescriptor:v=>descriptor=v,getDescriptor:()=>descriptor,select:v=>active=v,render:()=>w.render(),close:()=>dom.window.close()};
}
test('one compact browser row coexists with saved outputs, preserves exact descriptor and opens through guarded owner',async()=>{
 const native={id:'saved',title:'Saved carousel',format:'Carousel',kind:'carousel',edition:2,status:'in-progress',nextAction:{kind:'words',label:'Open saved words'}},b=boot({outputs:[native]});await tick();
 assert.equal(b.d.querySelectorAll('[data-browser-carousel]').length,1);assert.equal(b.d.querySelectorAll('[data-overview-output]').length,1);assert.match(b.d.querySelector('[data-browser-carousel]').textContent,/Browser copy · 8 slides/);assert.doesNotMatch(b.d.getElementById('app').innerHTML,/PRIVATE_SIGNATURE|PRIVATE_LAYOUT/);assert.equal(b.d.querySelector('[data-browser-carousel] [data-output-id]'),null);
 await b.w.outputOverview.refresh();await b.w.outputOverview.refresh();assert.equal(b.d.querySelectorAll('[data-browser-carousel]').length,1);
 b.d.querySelector('[data-output-action="words"]').click();await tick();assert.equal(b.calls[0][0],'native');assert.equal(b.calls[0][1].outputId,'saved');const expected=structuredClone(b.getDescriptor());b.d.querySelector('[data-output-browser-carousel]').click();await tick();assert.deepEqual(b.calls[1],['browser',expected]);assert.equal(b.p.view,'carousel');assert.equal(JSON.stringify({...b.p,view:'record'}),b.before);b.close();
});
test('empty register retains browser row and owner empty card cannot hide it; header and sidebar describe browser copy',async()=>{
 const b=boot();await tick();b.w.eval(script('piece-state.js'));b.w.MutationObserver=class{observe(){}};b.w.eval(script('empty-states.js'));assert.equal(b.d.querySelector('.c3-empty'),null);assert.equal(b.w.c3Empty.steps[12].empty(),false);assert.equal(b.d.querySelector('[data-c3-empty-hidden]'),null);assert.match(b.d.getElementById('app').textContent,/No saved project outputs yet/);assert.doesNotMatch(b.d.getElementById('app').textContent,/No outputs made yet|No connected outputs yet/);assert.equal(b.d.querySelectorAll('.oo-empty [data-output-action]').length,0);assert.equal(b.w.c3PieceState.word(12).word,'browser copy');assert.equal(b.w.c3PieceState.primary(12).label,'Open browser copy');b.close();
});
test('changed or unavailable browser descriptor rejects pickup while native output rows remain',async()=>{
 for(const changed of [null,{slideCount:9}]){const b=boot({outputs:[{id:'saved',title:'Saved',format:'Article',kind:'post',status:'in-progress'}]});await tick();const previous=b.getDescriptor();b.setDescriptor(changed?{...previous,...changed}:null);b.d.querySelector('[data-output-browser-carousel]').click();await tick();assert.equal(b.calls.length,0);assert.match(b.d.querySelector('[role=alert]').textContent,/browser copy changed/);assert.ok(b.d.querySelector('[data-overview-output="saved"]'));assert.equal(JSON.stringify(b.p),b.before);b.close();}
});
test('saved-register errors and unavailable states remain visible beside the independent browser copy',async()=>{
 for(const mode of ['error','unavailable']){const b=boot({read:async({projectId})=>{if(mode==='error')throw Error('Saved outputs could not be read.');return {projectId,outputs:[],availability:{state:'unavailable',message:'Saved register unavailable'}};}});await tick();assert.ok(b.d.querySelector('[data-browser-carousel]'));assert.match(b.d.getElementById('app').textContent,/could not be read|register unavailable/);assert.ok(b.d.querySelector('[data-output-retry]'));b.d.querySelector('[data-output-browser-carousel]').click();await tick();assert.equal(b.calls[0][0],'browser');b.close();}
});
test('project switches reject old browser actions and late old register reads never populate another project',async()=>{
 let release;const held=new Promise(r=>release=r),b=boot({read:async({projectId})=>projectId==='p'?held:{projectId,outputs:[]}});const button=b.d.querySelector('[data-output-browser-carousel]');b.select(b.q);button.click();await tick();assert.equal(b.calls.length,0);b.render();release({projectId:'p',outputs:[{id:'old',title:'Old saved project'}]});await tick();await tick();assert.equal(b.d.querySelector('[data-browser-carousel]'),null);assert.doesNotMatch(b.d.getElementById('app').textContent,/Old saved project|Synthetic carousel/);assert.equal(JSON.stringify(b.p),b.before);b.close();
});
test('without a descriptor the existing saved-output empty state and native actions stay intact',async()=>{
 const b=boot({local:false});await tick();b.w.eval(script('piece-state.js'));assert.equal(b.d.querySelector('[data-browser-carousel]'),null);assert.match(b.d.getElementById('app').textContent,/No connected outputs yet/);assert.equal(b.w.c3PieceState.word(12).word,'none');assert.equal(b.w.c3PieceState.primary(12).label,'New output');b.close();
});
