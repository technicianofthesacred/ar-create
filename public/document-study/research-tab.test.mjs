import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('./research-tab.js',import.meta.url),'utf8');
const point=(id,kind,extra={})=>({id,title:'Finding '+id,kind,clarity:{supported:'Said twice.',uncertain:''},spoken:[{quote:'Words '+id,speaker:'Invented speaker',location:'00:01'}],sources:[{name:'Invented transcript.md',lineStart:1,lineEnd:3}],originalText:'Invented passage.',...extra});
function fixture({findings={},status=200}={}){
 const dom=new JSDOM('<header id="c3-tabstrip"><button data-ht-research>R</button><button data-ht-home>H</button></header><div id="app"><main class="workspace"><div id="manuscript" contenteditable="true">Unsaved human writing</div></main></div>',{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.state={project:'hk',projects:[{id:'hk',name:'Invented piece one'},{id:'ref-an-cha',name:'Invented piece two'},{id:'other',name:'Not connected piece'}]};
 const calls=[],posts=[];let fail=false;
 w.current=()=>w.state.projects.find(p=>p.id===w.state.project);
 w.viewPhase=async n=>{calls.push(['viewPhase',n]);};
 w.switchProject=async id=>{if(fail)return;calls.push(['switchProject',id]);w.state.project=id;};
 w.fetch=async(u,o)=>{if(o&&o.method&&o.method!=='GET')posts.push(u);const url=new URL(u,'http://localhost');const pid=url.searchParams.get('parentStudyId');calls.push(['read',url.pathname,pid]);return {ok:status===200,json:async()=>findings[pid]||{available:false,reason:'No saved research findings for this piece yet.'}};};
 w.eval(code);
 const settle=async()=>{for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,0));await w.c3Research.whenIdle();}};
 return {w,d:w.document,calls,posts,settle,set fail(v){fail=v;}};
}
const json=v=>JSON.parse(JSON.stringify(v));

test('Research reads saved findings only for connected pieces, through the read-only route',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact'),point('b','wisdom')]},'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 assert.deepEqual(json(f.calls.filter(c=>c[0]==='read').map(c=>[c[1],c[2]])),[['/api/study-research/findings','hk'],['/api/study-research/findings','ref-an-cha']]);
 assert.deepEqual(json([...f.d.querySelectorAll('.rt-col .rt-colt')].map(n=>n.textContent)),['Fact','Wisdom']);
 assert.equal(f.d.querySelectorAll('.rt-card').length,3);
 assert.equal(f.posts.length,0,'nothing is written');
 assert.equal(f.d.querySelector('#manuscript').textContent,'Unsaved human writing');
});

test('no saved findings is said plainly with each piece’s reason; never filled with examples',async()=>{
 const f=fixture();
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 assert.match(f.d.querySelector('.rt-c3-empty h3').textContent,/No saved findings yet/);
 assert.ok(f.d.querySelector('.rt-c3-empty [data-rt-decide]'),'a real next step: research a piece');
 assert.match(f.d.querySelector('.rt-note').textContent,/Invented piece one: No saved research findings/);
 assert.equal(f.d.querySelectorAll('.rt-card').length,0);
});

test('reader shows the finding; outside search, Atlas and model discussion are marked not connected',async()=>{
 const f=fixture({findings:{hk:{available:true,verification:'Source text checked; no independent fact check.',points:[point('a','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-open="0"]').click();
 const drawer=f.d.querySelector('.rt-drawer');
 assert.match(drawer.textContent,/Words a/);
 assert.match(drawer.textContent,/no independent fact check/);
 f.d.querySelector('[data-rt-more]').click();
 const more=[...f.d.querySelectorAll('.rt-menu button')];
 assert.equal(more.length,3);
 assert.ok(more.every(b=>b.disabled&&/not connected/.test(b.textContent)));
});

test('deciding goes to the piece’s own Research through switchProject; a refused switch stays put',async()=>{
 const f=fixture({findings:{'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-open="0"]').click();
 f.d.querySelector('[data-rt-decide]').click();await f.settle();
 assert.deepEqual(json(f.calls.filter(c=>c[0]!=='read')),[['switchProject','ref-an-cha'],['viewPhase',3]]);
 assert.equal(f.w.c3Research.isOpen(),false);
 const g=fixture({findings:{'ref-an-cha':{available:true,points:[point('c','fact')]}}});
 g.fail=true;
 g.d.querySelector('[data-ht-research]').click();await g.settle();
 g.d.querySelector('[data-rt-open="0"]').click();
 g.d.querySelector('[data-rt-decide]').click();await g.settle();
 assert.equal(g.w.current().id,'hk');
 assert.equal(g.calls.some(c=>c[0]==='viewPhase'),false);
});

test('search, evidence and source filters narrow without hiding the way back',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact'),point('b','wisdom',{clarity:{supported:'',uncertain:'Only one source.'}})]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-ev="uncertain"]').click();
 assert.equal(f.d.querySelectorAll('.rt-card').length,1);
 assert.ok(f.d.querySelector('[data-rt-clear]'));
 f.d.querySelector('[data-rt-clear]').click();
 assert.equal(f.d.querySelectorAll('.rt-card').length,2);
 const q=f.d.querySelector('[data-rt-q]');q.value='zzz';q.dispatchEvent(new f.w.Event('input',{bubbles:true}));
 assert.match(f.d.querySelector('.rt-empty h2').textContent,/No findings match/);
});

test('each card has a ⋯ menu: reader, source, decide; outside tools stay not connected',async()=>{
 const f=fixture({findings:{hk:{available:true,points:[point('a','fact')]}}});
 f.d.querySelector('[data-ht-research]').click();await f.settle();
 f.d.querySelector('[data-rt-cmore="0"]').click();
 const items=[...f.d.querySelectorAll('.rt-cmenu button')].map(b=>[b.textContent,b.disabled]);
 assert.deepEqual(json(items),[['Open in the reader',false],['Show only Invented transcript.md',false],['Decide in Invented piece one',false],['Search outside sources · not connected',true],['Ask about this point · not connected',true]]);
 f.d.querySelector('.rt-cmenu [data-rt-open]').click();
 assert.ok(f.d.querySelector('.rt-drawer'));
 assert.equal(f.d.querySelector('.rt-cmenu'),null);
});
