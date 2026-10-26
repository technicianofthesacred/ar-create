import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom');
const code=fs.readFileSync(new URL('../public/document-study/existing-work.js',import.meta.url),'utf8');
async function setup(enabled){const dom=new JSDOM('<div id="app"><div id="workspace"></div></div>',{url:'http://127.0.0.1:59879/document-study/index.html',runScripts:'outside-only'}),w=dom.window,calls=[];let hooks;
 w.AR_CREATE_REVIEW_MODE={actualWork:true,magazineCheckReceipts:enabled};w.current=()=>({id:'native-parent',view:'record',viewedStage:7,blocks:[]});w.state={projects:[]};w.phaseReader=()=>'';w.render=()=>{};w.createMagazineCheckAdapter=value=>{hooks=value;return value;};w.resolveMagazineCheckRegistration=()=>{};w.studyDraftCheck={setMagazineAdapter:()=>{}};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url==='/api/review/catalog'?{mode:'existing-work-read-only',stories:[],sources:[],diagnostics:[],exclusions:[]}:{schema:'ar-create.magazine-mechanical-check-response.v1',available:true,record:null}};};w.eval(code);await w.existingWork.load();return {w,hooks,calls,close:()=>w.close()};}
test('receipt pickup is wired as GET while saved execution is omitted unless the narrow review capability is enabled',async()=>{
 for(const enabled of [false,true]){const x=await setup(enabled);try{assert.equal(typeof x.hooks.readSaved,'function');assert.equal(typeof x.hooks.runSaved,enabled?'function':'undefined');const selectors={parentStudyId:'native-parent',storyId:'invented-story',pieceId:'invented-piece'};await x.hooks.readSaved(selectors);const read=x.calls.find(call=>call.url.startsWith('/api/magazine/mechanical-check?'));assert.ok(read);assert.equal(read.options.method,'GET');assert.deepEqual(Object.fromEntries(new URL(read.url,'http://localhost').searchParams),selectors);assert.equal(x.calls.some(call=>call.options?.method==='POST'),false);
 if(enabled){const body={...selectors,expectedDraftHash:'a'.repeat(64),expectedInputRevision:'b'.repeat(64),operationId:'234711aa-b93e-4699-b1f7-46c4ce206328'};await x.hooks.runSaved(body);const post=x.calls.find(call=>call.url==='/api/magazine/mechanical-check');assert.equal(post.options.method,'POST');assert.deepEqual(JSON.parse(post.options.body),body);}
 }finally{x.close();}}
});
