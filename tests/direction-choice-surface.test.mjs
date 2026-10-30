import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createPreparedDirectionReader,createDirectionPieceGrid,showDirectionRecords} from '../public/document-study/direction-choice-surface.js';
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const raw='## Pick a direction\n\n**1. Invented garden.** Exact invented explanation.\n\n## Pick a title\n1. **Invented garden title**\n';
const artifact=(extra={})=>({kind:'MAP',archived:false,artifactId:'synthetic-map-one',hash:sha(raw),...extra});
const story=(extra={})=>({id:'synthetic-story-one',nativeProjectId:'synthetic-subject-one',artifacts:[artifact()],...extra});
function fixture({stories=[story()],body=raw,responseOk=true,refresh=()=>{},requestHook=()=>{},hash=sha}={}){
 let value={stories},selected='synthetic-subject-one';const calls=[];
 const load=createPreparedDirectionReader({catalog:()=>value,refresh:async()=>{calls.push('refresh');await refresh(api);},request:async url=>{calls.push(url);await requestHook(api);return {ok:responseOk,json:async()=>({raw:body,error:'Synthetic read failure.'})};},hash:async text=>hash(text),isCurrent:id=>id===selected});
 const api={load,calls,setCatalog:stories=>{value={stories};},select:id=>{selected=id;}};return api;
}
test('prepared reader binds exact raw SHA and request identity to the sole current map',async()=>{
 const f=fixture({stories:[story({artifacts:[artifact(),artifact({artifactId:'archived-map',archived:true}),{kind:'DRAFT',artifactId:'independent-draft',hash:'f'.repeat(64)}]})]}),options=await f.load({parentStudyId:'synthetic-subject-one'});
 assert.deepEqual(options.source,{artifactId:'synthetic-map-one',hash:sha(raw)});assert.deepEqual(options.angles,[{id:'angle:1',text:'Invented garden.',description:'Exact invented explanation.'}]);assert.deepEqual(options.titles,[{id:'title:1',text:'Invented garden title'}]);assert.equal(f.calls.length,1);const url=new URL(f.calls[0],'http://synthetic.invalid');assert.equal(url.pathname,'/api/review/artifact');assert.deepEqual(Object.fromEntries(url.searchParams),{id:'synthetic-map-one',hash:sha(raw)});
});
test('fresh reads await refreshed catalog and bind the replacement source',async()=>{
 const replacement=artifact({artifactId:'synthetic-refreshed-map'}),f=fixture({refresh:api=>api.setCatalog([story({artifacts:[replacement]})])}),result=await f.load({parentStudyId:'synthetic-subject-one',fresh:true});assert.equal(f.calls[0],'refresh');assert.equal(result.source.artifactId,replacement.artifactId);assert.equal(new URL(f.calls[1],'http://synthetic.invalid').searchParams.get('id'),replacement.artifactId);
});
test('reader refuses wrong raw bytes, missing raw, invalid hash and failed source reads',async()=>{
 for(const setup of [{body:raw+'Changed.'},{body:null},{stories:[story({artifacts:[artifact({hash:'bad-hash'})]})]},{responseOk:false}]){const f=fixture(setup);await assert.rejects(f.load({parentStudyId:'synthetic-subject-one'}));}
 const noLists='An invented note without option lists.',f=fixture({body:noLists,stories:[story({artifacts:[artifact({hash:sha(noLists)})]})]});await assert.rejects(f.load({parentStudyId:'synthetic-subject-one'}),/no supported angle and title/);
});
test('reader refuses duplicate maps or matching stories before requesting source text',async()=>{
 for(const stories of [[story({artifacts:[artifact(),artifact({artifactId:'second-current-map'})]})],[story(),story({id:'second-same-subject-story'})],[],[story({nativeProjectId:'other-subject'})]]){const f=fixture({stories});await assert.rejects(f.load({parentStudyId:'synthetic-subject-one'}));assert.deepEqual(f.calls,stories.length?[]:['refresh']);}
});
test('reader refuses subject, map hash, artifact identity or story changes while awaiting the source',async()=>{
 const mutations=[api=>api.select('other-subject'),api=>api.setCatalog([story({artifacts:[artifact({hash:'b'.repeat(64)})]})]),api=>api.setCatalog([story({artifacts:[artifact({artifactId:'replacement-map'})]})]),api=>api.setCatalog([story(),story()]),api=>api.setCatalog([story({artifacts:[artifact(),artifact()]})]),api=>api.setCatalog([story({artifacts:[artifact(),artifact({artifactId:'second-active-map'})]})]),api=>api.setCatalog([story({artifacts:[artifact({archived:true})]})]),api=>api.setCatalog([story({nativeProjectId:'other-subject'})]),api=>api.setCatalog([story({artifacts:[artifact({kind:'DRAFT'})]})])];
 for(const requestHook of mutations){const f=fixture({requestHook});await assert.rejects(f.load({parentStudyId:'synthetic-subject-one'}),/map or selected subject changed/);}
 const f=fixture({refresh:api=>api.select('other-subject')});await assert.rejects(f.load({parentStudyId:'synthetic-subject-one',fresh:true}),/selected subject changed/);assert.deepEqual(f.calls,['refresh']);
});

test('cold empty catalog refreshes before connecting the exact prepared map',async()=>{
 const f=fixture({stories:[],refresh:api=>api.setCatalog([story()])}),result=await f.load({parentStudyId:'synthetic-subject-one'});assert.equal(f.calls[0],'refresh');assert.equal(f.calls.length,2);assert.deepEqual(result.source,{artifactId:'synthetic-map-one',hash:sha(raw)});
 const failed=fixture({stories:[],refresh:()=>{throw Error('Synthetic refresh unavailable.');}});await assert.rejects(failed.load({parentStudyId:'synthetic-subject-one'}),/refresh unavailable/);assert.deepEqual(failed.calls,['refresh']);
});

test('Direction piece grid uses only exact supplied references and never claims wording adoption',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),dom=new JSDOM('<main></main>');try{const calls=[],grid=createDirectionPieceGrid({document:dom.window.document,pieces:[{format:'Manuscript',title:'Same invented title',reference:'exact-article'},{format:'Carousel',title:'Same invented title',reference:'exact-carousel'}],open:reference=>calls.push(reference)});dom.window.document.querySelector('main').append(grid);const buttons=grid.querySelectorAll('button');assert.equal(buttons[0].textContent,'Article · Same invented title');buttons[1].click();assert.deepEqual(calls,['exact-carousel']);assert.match(grid.textContent,/application has not been checked/);assert.doesNotMatch(grid.textContent,/✓|Approved|Chosen by you/);assert.equal(grid.querySelectorAll('details,summary').length,0);const empty=createDirectionPieceGrid({document:dom.window.document});assert.match(empty.textContent,/No current connected pieces/);assert.equal(empty.querySelectorAll('button').length,0);}finally{dom.window.close();}
});

test('Direction historical context and original records stay in place with exact links and controls',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),dom=new JSDOM('<main><details class="flow-retained"><summary>Earlier records</summary><article>Exact retained words<details class="recordDetails"><summary>Details</summary><a href="/exact-original">Original</a><button>Read</button></details></article></details></main>');try{const main=dom.window.document.querySelector('main'),link=main.querySelector('a'),button=main.querySelector('button');let clicks=0;button.onclick=()=>clicks++;showDirectionRecords(main);assert.equal(main.querySelectorAll('details,summary').length,0);assert.equal(main.querySelector('a'),link);assert.equal(main.querySelector('button'),button);button.click();assert.equal(clicks,1);assert.match(main.textContent,/Exact retained words/);assert.match(main.querySelector('.recordDetails h4').textContent,/Original record/);showDirectionRecords(main);assert.equal(main.querySelectorAll('.flow-retained').length,1);}finally{dom.window.close();}
});
