import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(new URL('../public/document-study/'+name,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,0));
// Opening an original digests it with webcrypto, which settles on the libuv pool: under CI load that
// takes more than a fixed number of ticks, so wait for the visible result instead of counting ticks.
const until=async(check,limit=2000)=>{for(let i=0;i<limit&&!check();i++)await tick();assert.ok(check(),'timed out waiting for the reader');};
const digest=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
function fixture(id='one'){
 const output={id,kind:'carousel',title:'Synthetic <b>same</b>',outputRevision:3,createdAt:'2026-01-02T03:00:00Z',slides:[{id:'a',text:'<img src=x onerror="window.bad=1"> & original',template:'F1',role:'cover',photos:[{src:'https://invalid.example/private.jpg',x:22,y:65}]},{id:'b',text:'Second original slide',template:'M12',photos:[]}],caption:'Caption <script>bad()</script>'};
 const item={projectId:'original-project',documentId:'original-document',outputId:id,kind:'carousel',title:output.title,outputRevision:3,createdAt:output.createdAt,slideCount:2,sourceHash:'a'.repeat(64),outputHash:digest(output)};
 return {item,value:{...item,readOnly:true,authority:'retained-original',output}};
}
function boot(fetcher){
 const dom=new JSDOM('<dialog id="project-library" open></dialog>',{url:'http://localhost',runScripts:'dangerously'}),w=dom.window,d=w.document;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let calls=[];const original={id:'current',name:'Current8',slides:Array.from({length:8},(_,i)=>({id:'s'+i,text:'Current '+i}))},before=JSON.stringify(original);
 w.state={projects:[original]};w.current=()=>original;w.matchMedia=()=>({matches:false});w.studyDraft={flush(){throw Error('Must not flush');}};w.projectLibrary={close(){throw Error('Must not close Pieces');}};w.realOutputOverview={read:async({projectId})=>({projectId,outputs:[]})};w.fetch=async(url,options)=>{calls.push([url,options]);if(url==='/api/study-draft/catalog')return {ok:true,json:async()=>({drafts:[]})};return {ok:true,json:async()=>fetcher(url)};};
 for(const name of ['donor/layouts.js','donor/catalog-browser.js','donor/ig-templates.browser.js','retained-carousel-reader.js']){const script=d.createElement('script');script.textContent=read(name);d.body.append(script);}
 return {dom,w,d,calls,original,before,close:()=>dom.window.close()};
}
test('complete readable words and caption escape content; preview reuses exact donor templates without photo requests or editors',async()=>{
 const f=fixture(),original=JSON.stringify(f.value),b=boot(()=>structuredClone(f.value));
 b.w.eval("const retainedOriginalRender=IG.render;IG.render=(...args)=>{window.retainedRenderArgs=args;return retainedOriginalRender(...args);};");
 assert.equal(await b.w.retainedCarouselReader.open(f.item),true);
 assert.match(b.d.querySelector('.rc-words').textContent,/Second original slide/);assert.match(b.d.querySelector('.rc-words').textContent,/<script>bad\(\)<\/script>/);assert.equal(b.d.querySelector('.rc-words img'),null);
 b.d.querySelector('[data-rc-mode="preview"]').click();assert.ok(b.d.querySelector('.rc-canvas [data-slot="0"]'));assert.match(b.d.querySelector('.rc-canvas').textContent,/no photo matched/);assert.equal(b.d.querySelector('.rc-canvas img')?.getAttribute('src'),'/ig-assets/teajia-wordmark.png');assert.equal(b.d.querySelector('[contenteditable],textarea,input'),null);assert.doesNotMatch(b.d.querySelector('.retained-carousel-reader').innerHTML,/https:\/\/invalid/);
 assert.deepEqual(JSON.parse(JSON.stringify(b.w.retainedRenderArgs[1].photos)),[{src:'',x:22,y:65}]);
 assert.equal(b.d.querySelector('.rc-canvas>div').style.width,'1080px');assert.equal(b.d.querySelector('.rc-canvas>div').style.height,'1350px');
 b.d.querySelector('[data-rc-next]').click();assert.match(b.d.querySelector('.rc-canvas').textContent,/Second original slide/);
 b.d.querySelector('[data-rc-back]').click();assert.equal(b.d.querySelector('.retained-carousel-reader'),null);assert.equal(b.d.querySelector('#project-library').open,true);assert.equal(JSON.stringify(b.original),b.before);assert.equal(JSON.stringify(f.value),original);assert.equal(b.calls.length,1);assert.match(b.calls[0][0],/expectedSourceHash=/);assert.equal(b.calls[0][1].method,undefined);b.close();
});
test('wrong identities, revisions, counts and digest reject the entire original before showing words',async()=>{
 const f=fixture();const changes=[v=>v.projectId='wrong',v=>v.documentId='wrong',v=>v.outputId='wrong',v=>v.sourceHash='b'.repeat(64),v=>v.outputHash='b'.repeat(64),v=>v.slideCount++,v=>v.outputRevision++,v=>v.output.id='wrong',v=>v.output.slides.pop(),v=>v.output.slides[0].text='Changed words',v=>v.readOnly=false];
 for(const change of changes){const v=structuredClone(f.value);change(v);const b=boot(()=>v);assert.equal(await b.w.retainedCarouselReader.open(f.item),false);assert.equal(b.d.querySelector('.rc-words'),null);assert.match(b.d.querySelector('.rc-message').textContent,/changed|verified|identity/);assert.ok(b.d.querySelector('[data-rc-back]'));b.close();}
});
test('late response after close or a different request never resurrects or replaces a reader',async()=>{
 const one=fixture('one'),two=fixture('two');let release;const held=new Promise(r=>release=r),b=boot(url=>url.includes('outputId=one')?held:structuredClone(two.value));
 const pending=b.w.retainedCarouselReader.open(one.item);await tick();b.w.retainedCarouselReader.close();release(structuredClone(one.value));assert.equal(await pending,false);assert.equal(b.d.querySelector('.retained-carousel-reader'),null);b.close();
 let releaseAgain;const heldAgain=new Promise(r=>releaseAgain=r),c=boot(url=>url.includes('outputId=one')?heldAgain:structuredClone(two.value));const old=c.w.retainedCarouselReader.open(one.item);await tick();assert.equal(await c.w.retainedCarouselReader.open(two.item),true);releaseAgain(structuredClone(one.value));assert.equal(await old,false);assert.equal(c.calls.length,2);assert.match(c.calls[1][0],/outputId=two/);assert.ok(c.d.querySelector('.rc-words'));c.close();
});
test('Pieces keeps distinct originals alongside current8 and preserves search and selection on return',async()=>{
 const one=fixture('one'),two=fixture('two'),b=boot(url=>url.includes('outputId=two')?structuredClone(two.value):structuredClone(one.value));
 b.w.existingWork={catalog:()=>({mode:'existing-work-read-only',stories:[],retainedCarousels:{readOnly:true,available:true,items:[one.item,two.item]}})};
 b.w.eval(read('workbench-pieces.js'));await b.w.workbenchPieces.open();assert.equal(b.d.querySelectorAll('.wbp-row').length,3);
 const search=b.d.querySelector('[data-wbp-search]');search.value='Earlier workspace';search.dispatchEvent(new b.w.Event('input',{bubbles:true}));assert.equal(b.d.querySelectorAll('.wbp-row').length,2);
 b.d.querySelector('[data-wbp-select]').click();b.d.querySelector('[data-wbp-open]').click();await until(()=>b.d.querySelector('.retained-carousel-reader')&&!b.d.querySelector('[data-wbp-open][disabled]'));assert.equal(b.d.querySelector('#project-library').open,true);b.d.querySelector('[data-rc-back]').click();assert.equal(b.d.querySelector('[data-wbp-search]').value,'Earlier workspace');assert.equal(b.d.querySelectorAll('.wbp-row').length,2);assert.equal(b.d.querySelector('[data-wbp-select]').checked,true);assert.equal(JSON.stringify(b.original),b.before);b.close();
});
test('only exact catalog identities become retained carousel rows; missing configuration adds nothing',async()=>{
 const f=fixture(),b=boot(()=>f.value);b.w.existingWork={catalog:()=>({mode:'existing-work-read-only',stories:[],retainedCarousels:{available:true,readOnly:true,items:[{...f.item,sourceHash:'bad'}]}})};b.w.eval(read('workbench-pieces.js'));await b.w.workbenchPieces.open();assert.equal(b.d.querySelectorAll('.wbp-row').length,1);assert.match(b.d.querySelector('.wbp-message').textContent,/invalid/);b.close();
});

test('failed original can retry its same exact reference without changing the workspace',async()=>{
 const f=fixture();let failed=true;const b=boot(()=>failed?{...f.value,sourceHash:'b'.repeat(64)}:structuredClone(f.value));assert.equal(await b.w.retainedCarouselReader.open(f.item),false);failed=false;b.d.querySelector('[data-rc-retry]').click();await until(()=>b.d.querySelector('.rc-words'));assert.equal(b.calls[0][0],b.calls[1][0]);assert.equal(JSON.stringify(b.original),b.before);b.close();
});

test('optional retained discovery failure remains visible while current pieces stay available',async()=>{
 const f=fixture(),b=boot(()=>f.value);b.w.existingWork={catalog:()=>({mode:'existing-work-read-only',stories:[],retainedCarousels:{readOnly:true,available:false,items:[],error:'Earlier originals changed. Refresh their listing.'}})};b.w.eval(read('workbench-pieces.js'));await b.w.workbenchPieces.open();assert.equal(b.d.querySelectorAll('.wbp-row').length,1);assert.match(b.d.querySelector('.wbp-message').textContent,/Earlier originals changed/);assert.ok(b.d.querySelector('[data-wbp-retry]'));assert.equal(JSON.stringify(b.original),b.before);b.close();
});

test('Words uses the accepted existing Lora reading role while controls and platform preview retain their roles',async()=>{
 const css=read('retained-carousel-reader.css'),shared=read('shared-prose-surfaces.css');
 assert.match(shared,/--shared-prose-font:'AR Atlas Lora'/);
 assert.match(css,/\.rc-words\{max-width:680px/);
 assert.match(css,/\.rc-words p\{font-family:var\(--shared-prose-font,'AR Atlas Lora',Georgia,'Times New Roman',serif\);font-size:18px;line-height:1\.8;letter-spacing:\.16px;/);
 assert.match(css,/\.rc-words h3\{font:500 12px\/1\.5 var\(--ar-ui,system-ui,sans-serif\)/);
 assert.doesNotMatch(css,/@font-face|https?:|\.rc-canvas[^}]*font/);
 assert.doesNotMatch(css,/\.rc-words p\{font-size:19px/);
});

test('same date, title and revision originals expose distinct creation times',async()=>{
 const one=fixture('one'),two=fixture('two');two.item.createdAt='2026-01-02T03:00:01Z';const b=boot(()=>one.value);b.w.existingWork={catalog:()=>({mode:'existing-work-read-only',stories:[],retainedCarousels:{readOnly:true,available:true,items:[one.item,two.item]}})};b.w.eval(read('workbench-pieces.js'));await b.w.workbenchPieces.open();const rows=[...b.d.querySelectorAll('[data-wbp-open]')].filter(el=>el.textContent.includes('Original ·'));assert.equal(rows.length,2);assert.notEqual(rows[0].textContent,rows[1].textContent);b.close();
});
test('preview fit preserves full portrait within available height and width on resize',async()=>{
 const f=fixture(),b=boot(()=>structuredClone(f.value));await b.w.retainedCarouselReader.open(f.item);b.d.querySelector('[data-rc-mode="preview"]').click();const content=b.d.querySelector('.rc-content'),preview=b.d.querySelector('.rc-preview'),nav=b.d.querySelector('.rc-preview-nav'),note=b.d.querySelector('.rc-photo-state'),frame=b.d.querySelector('.rc-frame');content.style.padding='20px';Object.defineProperty(content,'clientHeight',{value:500,configurable:true});Object.defineProperty(preview,'clientWidth',{value:540,configurable:true});nav.getBoundingClientRect=()=>({height:33});note.getBoundingClientRect=()=>({height:18});b.w.dispatchEvent(new b.w.Event('resize'));assert.equal(parseFloat(frame.style.height),500-40-33-18-22);assert.equal(parseFloat(frame.style.width)*1.25,parseFloat(frame.style.height));Object.defineProperty(preview,'clientWidth',{value:200});b.w.dispatchEvent(new b.w.Event('resize'));assert.equal(frame.style.width,'200px');assert.equal(frame.style.height,'250px');b.close();
});

test('optional copy surface keeps the exact verified original and one mount across reader modes, then disposes on close',async()=>{
 const f=fixture(),b=boot(()=>structuredClone(f.value)),mounts=[],disposed=[];
 b.w.retainedCarouselCopy={mount(host,options){mounts.push({host,options});host.textContent='Synthetic optional copy action';return {dispose(){disposed.push(options.source.outputId);}};}};
 assert.equal(await b.w.retainedCarouselReader.open(f.item),true);assert.equal(mounts.length,1);assert.equal(mounts[0].options.source.outputId,f.item.outputId);assert.equal(mounts[0].options.isCurrent(),true);assert.deepEqual(JSON.parse(JSON.stringify(mounts[0].options.output)),f.value.output);
 b.d.querySelector('[data-rc-mode="preview"]').click();assert.equal(mounts.length,1);assert.ok(mounts[0].host.isConnected);assert.equal(mounts[0].options.isCurrent(),true);
 b.d.querySelector('[data-rc-mode="words"]').click();assert.equal(mounts.length,1);b.w.retainedCarouselReader.close();assert.deepEqual(disposed,[f.item.outputId]);assert.equal(mounts[0].options.isCurrent(),false);assert.equal(JSON.stringify(b.original),b.before);b.close();
});

test('explicit Open working copy uses the exact maintained output owner and closes only after matching selection',async()=>{
 const f=fixture(),b=boot(()=>structuredClone(f.value));let options,selected=null;const calls=[];
 b.w.switchProject=async()=>{throw Error('Same project must not switch');};b.w.realOutputOverview={read:async args=>{calls.push(['read',args]);return {projectId:'current',outputs:[{id:'copy-output',rootBindingId:'chosen-root'}]};},onAction:async args=>{calls.push(['open',args]);selected={projectId:'current',rootBindingId:'chosen-root',output:{id:'copy-output'}};}};b.w.studyOutputConnection={selection:()=>selected};b.w.retainedCarouselCopy={mount(_host,input){options=input;return {dispose(){}};}};
 await b.w.retainedCarouselReader.open(f.item);await options.onOpen({parentStudyId:'current',rootBindingId:'chosen-root',outputId:'copy-output'});assert.deepEqual(JSON.parse(JSON.stringify(calls)),[['read',{projectId:'current'}],['open',{projectId:'current',outputId:'copy-output',kind:'words'}]]);assert.equal(b.d.querySelector('.retained-carousel-reader'),null);assert.equal(JSON.stringify(b.original),b.before);b.close();
});

test('wrong saved-copy root cannot open another output or dismiss its original reader',async()=>{
 const f=fixture(),b=boot(()=>structuredClone(f.value));let options,opened=0;b.w.switchProject=async()=>{};b.w.realOutputOverview={read:async()=>({projectId:'current',outputs:[{id:'copy-output',rootBindingId:'other-root'}]}),onAction:async()=>opened++};b.w.retainedCarouselCopy={mount(_host,input){options=input;return {dispose(){}};}};
 await b.w.retainedCarouselReader.open(f.item);await assert.rejects(options.onOpen({parentStudyId:'current',rootBindingId:'chosen-root',outputId:'copy-output'}),/exact saved copy/);assert.equal(opened,0);assert.ok(b.d.querySelector('.retained-carousel-reader').open);assert.equal(JSON.stringify(b.original),b.before);b.close();
});


test('read-only historical originals never mount copy controls and preserve the boundary on retry',async()=>{
 const f=fixture();f.item.copyAllowed=false;f.value.copyAllowed=false;const b=boot(()=>structuredClone(f.value));let mounts=0;b.w.retainedCarouselCopy={mount(){mounts++;throw Error('Read-only original must not offer a copy');}};
 assert.equal(await b.w.retainedCarouselReader.open(f.item),true);assert.equal(mounts,0);assert.ok(b.d.querySelector('.rc-copy-host').hidden);assert.match(b.d.querySelector('.rc-words').textContent,/Second original slide/);
 b.d.querySelector('[data-rc-mode="preview"]').click();assert.equal(mounts,0);assert.match(b.d.querySelector('.rc-photo-state').textContent,/not loaded or verified/);assert.equal(b.d.querySelector('img:not([src="/ig-assets/teajia-wordmark.png"])'),null);
 f.value.copyAllowed=true;assert.equal(await b.w.retainedCarouselReader.open(f.item),false);assert.equal(mounts,0);assert.equal(b.d.querySelector('.rc-words'),null);assert.equal(JSON.stringify(b.original),b.before);b.close();
});
test('originals without saved photos do not imply missing verified assets',async()=>{
 const f=fixture();f.value.output.slides.forEach(s=>s.photos=[]);f.item.outputHash=digest(f.value.output);f.value.outputHash=f.item.outputHash;const b=boot(()=>structuredClone(f.value));await b.w.retainedCarouselReader.open(f.item);b.d.querySelector('[data-rc-mode="preview"]').click();assert.equal(b.d.querySelector('.rc-photo-state').textContent,'No photographs are saved in this original.');b.close();
});
