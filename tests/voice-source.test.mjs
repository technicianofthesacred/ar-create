// Voice in one copy (Adrian, 3 November 2026). Agent drafting reads his voice and body of work from the
// i64os directions instead of AR Create's own copies, and AR Create never edits those files.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createGuidance} from '../runtime/services/guidance.mjs';import {acceptedGuidanceBody} from '../runtime/services/requests.mjs';
import {syntheticHome} from '../scripts/demo.mjs';import {createServer} from '../runtime/server.mjs';import {createWorkspaceExecution} from '../runtime/services/artifact-execution.mjs';import {digest} from '../runtime/services/files.mjs';import {createAdapter} from '../mcp/study/server.mjs';
// body of work from there, never from AR Create's own copies, and AR Create never writes those files.
function i64osFixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'guidance-i64os-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const ref=path.join(root,'refs'),data=path.join(root,'data'),directions=path.join(root,'i64os','substrate','directions');for(const dir of [ref,data,directions])fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(ref,'voice-profile.md'),'Stale AR Create copy of the voice.\n');fs.writeFileSync(path.join(ref,'body-of-work.md'),'Stale AR Create copy of the positions.\n');
 const voice='---\nname: voice-profile\n---\n# Voice\n\nPeer, never from above.\n\n## Strengthenings queue\n\n<!-- VOICE-QUEUE-START -->\n- [ ] (from chat, 2026-11-03) "a queued correction"\n<!-- VOICE-QUEUE-END -->\n';
 fs.writeFileSync(path.join(directions,'voice-profile.md'),voice);fs.writeFileSync(path.join(directions,'body-of-work.md'),'---\nname: body-of-work\n---\nThe work is wood and light, never bronze.\n');
 return {root,ref,data,directions,voice};}
test('with an i64os voice source, voice and positions come from the i64os directions and the local copies are not used',async t=>{const f=i64osFixture(t),owner=createGuidance({dataDir:f.data,referenceDir:f.ref,voiceSource:{kind:'i64os',directionsDir:f.directions}}),sheet=await owner.get();
 assert.equal(sheet.voice,f.voice);assert.match(sheet.positions,/never bronze/);assert.doesNotMatch(sheet.voice+sheet.positions,/Stale AR Create copy/);
 assert.equal(sheet.sources.voice.kind,'i64os');assert.equal(sheet.sources.voice.readOnly,true);assert.equal(sheet.sources.voice.path,path.join(f.directions,'voice-profile.md'));assert.equal(sheet.sources.positions.path,path.join(f.directions,'body-of-work.md'));assert.equal(sheet.sources.recipe.kind,'ar-create');
 // What an agent drafts from: the accepted body, without the queued corrections.
 assert.match(acceptedGuidanceBody(sheet.voice),/Peer, never from above/);assert.doesNotMatch(acceptedGuidanceBody(sheet.voice),/queued correction/);
 // The i64os file is the live copy: a routed change shows on the next read.
 fs.writeFileSync(path.join(f.directions,'voice-profile.md'),f.voice.replace('Peer, never from above.','Peer with earned depth.'));assert.match((await owner.get()).voice,/earned depth/);});
test('AR Create refuses to write the i64os voice files, while the recipe stays editable here',async t=>{const f=i64osFixture(t),owner=createGuidance({dataDir:f.data,referenceDir:f.ref,voiceSource:{kind:'i64os',directionsDir:f.directions}}),sheet=await owner.get();
 for(const key of ['voice','positions'])await assert.rejects(owner.put({key,body:'Overwritten.',expectedRevision:sheet.revision}),e=>e.status===409&&/read-only here/.test(e.message));
 assert.equal(fs.readFileSync(path.join(f.directions,'voice-profile.md'),'utf8'),f.voice);
 const saved=await owner.put({key:'recipe',body:'Open on the moment.\n',expectedRevision:sheet.revision});assert.equal(saved.recipe,'Open on the moment.\n');});
test('an unreadable i64os folder fails honestly instead of falling back to a stale copy',async t=>{const f=i64osFixture(t),owner=createGuidance({dataDir:f.data,referenceDir:f.ref,voiceSource:{kind:'i64os',directionsDir:path.join(f.root,'missing')}});
 await assert.rejects(owner.get(),e=>e.status===503&&/lives in i64os/.test(e.message));});
test('the voice source is a server option or data/i64os-directions.json, and absent means the local copies',async t=>{const {resolveVoiceSource}=await import('../runtime/services/guidance.mjs'),f=i64osFixture(t);
 assert.equal(resolveVoiceSource({dataDir:f.data,option:undefined}),null);assert.equal(resolveVoiceSource({dataDir:f.data,option:null}),null);
 assert.deepEqual(resolveVoiceSource({dataDir:f.data,option:f.directions}),{kind:'i64os',directionsDir:f.directions});
 fs.writeFileSync(path.join(f.data,'i64os-directions.json'),JSON.stringify({directionsDir:f.directions}));assert.deepEqual(resolveVoiceSource({dataDir:f.data,option:undefined}),{kind:'i64os',directionsDir:f.directions});
 assert.throws(()=>resolveVoiceSource({dataDir:f.data,option:'relative/path'}),/absolute/);
 const local=createGuidance({dataDir:path.join(f.root,'other'),referenceDir:f.ref});assert.equal((await local.get()).sources.voice.kind,'ar-create-copy');});
test('an agent\'s draft request carries the i64os voice, not AR Create\'s copy',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8')),directions=path.join(fixture.dir,'i64os','substrate','directions');fs.mkdirSync(directions,{recursive:true});
 fs.writeFileSync(path.join(directions,'voice-profile.md'),'---\nname: voice-profile\n---\nInvented i64os voice: a peer, never from above.\n');fs.writeFileSync(path.join(directions,'body-of-work.md'),'Invented i64os positions.\n');
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,i64osDirections:directions,execution:createWorkspaceExecution({codexPath:null,boundedEditorial:true})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port,api=async(route,body)=>{const response=await fetch(url+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'human:adrian'},body:JSON.stringify(body)});return {status:response.status,result:await response.json()};};
 const raw=fs.readFileSync(path.join(fixture.vault,'Workflow/3-Develop/DEV - Synthetic One.md'),'utf8'),opened=(await api('/api/study-draft/open',{parentStudyId:'hk',originalId:'hk-article',originalHash:digest(raw),operationId:randomUUID()})).result,binding={bindingId:opened.binding.id,parentStudyId:'hk'};
 assert.equal((await api('/api/study/human-direction/select',{...binding,scope:'part',operationId:randomUUID(),title:'Synthetic part'})).status,200);
 const direction=(await api('/api/study/human-direction?'+new URLSearchParams({...binding,scope:'part'}))).result;assert.equal((await api('/api/study/human-direction/write',{...binding,scope:'part',operationId:randomUUID(),expectedRevision:direction.revision,expectedHash:direction.hash,body:'Keep the invented source uncertain.'})).status,200);
 const sheet=(await api('/api/guidance')).result;assert.equal(sheet.sources.voice.kind,'i64os');assert.match(sheet.voice,/Invented i64os voice/);
 assert.equal((await api('/api/guidance',{key:'voice',body:'An edit from AR Create.',expectedRevision:sheet.revision})).status,409);
 const file=path.join(fixture.dir,'adapter.json');fs.writeFileSync(file,JSON.stringify({schema:'ar-create.study-mcp-config.v1',url,...binding,apiPrefix:'/api/study-ai',actor:'agent:claude-code'}));const adapter=createAdapter(file);
 const read=await adapter.callTool('study_draft_read',{}),request=await adapter.callTool('study_draft_prepare',{sourceIds:read.sourceCatalog.filter(s=>s.canPrepare).map(s=>s.id)}),context=await adapter.callTool('study_draft_context',{requestId:request.id});
 const layers=context.guidance?.layers||context.request?.guidance?.layers;assert.ok(layers,'the draft context carries shared guidance: '+Object.keys(context).join(','));
 assert.match(layers.voice.body,/Invented i64os voice: a peer, never from above\./);assert.doesNotMatch(layers.voice.body,/name: voice-profile/);assert.equal(layers.positions.body,'Invented i64os positions.');
});
test('the Voice sheet from i64os is shown read-only, with no save, and says how to change it',async t=>{
 const {createRequire}=await import('node:module'),{JSDOM}=createRequire(new URL('../runtime/package.json',import.meta.url))('jsdom'),code=fs.readFileSync(new URL('../public/document-study/direction-writing-tools.js',import.meta.url),'utf8');
 const dom=new JSDOM('<div id="app"><div class="workspace"><div class="desk"><article id="manuscript" contenteditable="true">My exact words</article></div></div></div>',{runScripts:'outside-only',url:'http://localhost'}),w=dom.window;t.after(()=>w.close());
 w.p={id:'invented-project',name:'Invented story',title:'Quiet table',viewedStage:5,view:'article'};w.current=()=>w.p;w.binding={id:'part-one',parentStudyId:'invented-project',title:'Quiet table'};w.studyDraft={currentBinding:()=>w.binding};w.studySourceContinuation={selection:()=>({parentStudyId:w.p.id,bindingId:w.binding.id})};
 const posts=[],sheet={revision:'one',voice:'Invented i64os voice.',positions:'Invented positions.',recipe:'',sources:{voice:{kind:'i64os',path:'/invented/i64os/substrate/directions/voice-profile.md',readOnly:true},positions:{kind:'i64os',path:'/invented/body-of-work.md',readOnly:true},recipe:{kind:'ar-create',readOnly:false}},refs:{voice:{hash:'v'},positions:{hash:'p'},recipe:{hash:'r'}},editable:{voice:{regions:[{raw:'Invented i64os voice.',pending:false}]},positions:{regions:[{raw:'Invented positions.',pending:false}]},recipe:{regions:[{raw:'',pending:false}]}}};
 w.fetch=async(url,options)=>{if(options?.method==='POST')posts.push(options);return {ok:true,json:async()=>sheet};};w.eval(code);
 w.document.querySelector('[data-dwt-action="voice"]').click();await new Promise(r=>setTimeout(r,0));
 const panel=w.document.querySelector('#direction-writing-tools');assert.match(panel.textContent,/Your voice lives in i64os · read only here/);assert.match(panel.textContent,/Invented i64os voice\./);assert.match(panel.textContent,/voice correction for you to approve/);
 assert.equal(panel.querySelector('[data-dwt-guidance]'),null);assert.equal(panel.querySelector('[data-dwt-action="save-guidance"]'),null);assert.equal(posts.length,0);assert.doesNotMatch(panel.textContent,/—/);
});
// No hand-made config (4 November 2026): the installed home cannot be written by agents, so the voice is found
// where the i64os checkout lives. The config file stays as an override. Tested against a fixture HOME, never the real one.
function fixtureHome(t,{where=['Documents','Files','4 Coding'],files=['voice-profile.md','body-of-work.md']}={}){const home=fs.mkdtempSync(path.join(os.tmpdir(),'voice-home-'));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));const directions=path.join(home,...where,'i64os','substrate','directions');fs.mkdirSync(directions,{recursive:true});for(const name of files)fs.writeFileSync(path.join(directions,name),'Fixture '+name+'\n');const data=path.join(home,'data');fs.mkdirSync(data);return {home,directions,data};}
test('with no config, the voice is found in the i64os checkout under HOME (first known location)',async t=>{const {resolveVoiceSource}=await import('../runtime/services/guidance.mjs'),f=fixtureHome(t);
 assert.deepEqual(resolveVoiceSource({dataDir:f.data,option:undefined,home:f.home}),{kind:'i64os',directionsDir:f.directions});
 // The same through the real process home: HOME is what os.homedir() reads.
 const saved=process.env.HOME;process.env.HOME=f.home;try{assert.deepEqual(resolveVoiceSource({dataDir:f.data,option:undefined,home:os.homedir()}),{kind:'i64os',directionsDir:f.directions});}finally{process.env.HOME=saved;}});
test('the second known location is used when the first is absent, and the first wins when both are whole',async t=>{const {resolveVoiceSource}=await import('../runtime/services/guidance.mjs'),second=fixtureHome(t,{where:['Documents','Files','2 Areas','Coding']});
 assert.deepEqual(resolveVoiceSource({dataDir:second.data,option:undefined,home:second.home}),{kind:'i64os',directionsDir:second.directions});
 const first=path.join(second.home,'Documents','Files','4 Coding','i64os','substrate','directions');fs.mkdirSync(first,{recursive:true});for(const name of ['voice-profile.md','body-of-work.md'])fs.writeFileSync(path.join(first,name),'First\n');
 assert.equal(resolveVoiceSource({dataDir:second.data,option:undefined,home:second.home}).directionsDir,first);
 // An empty first folder does not hide a whole second one.
 for(const name of ['voice-profile.md','body-of-work.md'])fs.rmSync(path.join(first,name));
 assert.equal(resolveVoiceSource({dataDir:second.data,option:undefined,home:second.home}).directionsDir,second.directions);});
test('the config file overrides the default location, and an explicit null still means the local copies',async t=>{const {resolveVoiceSource}=await import('../runtime/services/guidance.mjs'),f=fixtureHome(t),elsewhere=path.join(f.home,'elsewhere');fs.mkdirSync(elsewhere);
 fs.writeFileSync(path.join(f.data,'i64os-directions.json'),JSON.stringify({directionsDir:elsewhere}));assert.equal(resolveVoiceSource({dataDir:f.data,option:undefined,home:f.home}).directionsDir,elsewhere);
 assert.equal(resolveVoiceSource({dataDir:f.data,option:null,home:f.home}),null);
 fs.writeFileSync(path.join(f.data,'i64os-directions.json'),JSON.stringify({directionsDir:null}));assert.equal(resolveVoiceSource({dataDir:f.data,option:undefined,home:f.home}),null);});
test('with no config and no checkout under HOME, the local copies are used as before; a half-present checkout still fails openly',async t=>{const {resolveVoiceSource}=await import('../runtime/services/guidance.mjs'),empty=fs.mkdtempSync(path.join(os.tmpdir(),'voice-empty-'));t.after(()=>fs.rmSync(empty,{recursive:true,force:true}));fs.mkdirSync(path.join(empty,'data'));
 assert.equal(resolveVoiceSource({dataDir:path.join(empty,'data'),option:undefined,home:empty}),null);assert.equal(resolveVoiceSource({dataDir:path.join(empty,'data'),option:undefined,home:undefined}),null);
 const half=fixtureHome(t,{files:['body-of-work.md']}),source=resolveVoiceSource({dataDir:half.data,option:undefined,home:half.home});assert.equal(source.directionsDir,half.directions);
 const owner=createGuidance({dataDir:half.data,referenceDir:path.join(half.home,'refs'),voiceSource:source});await assert.rejects(owner.get(),e=>e.status===503&&/lives in i64os/.test(e.message));});
test('a server started with a fixture HOME reads the voice from the checkout there, with no config file',async t=>{
 const fixture=syntheticHome(),config=JSON.parse(fs.readFileSync(fixture.config,'utf8')),home=path.join(fixture.dir,'home'),directions=path.join(home,'Documents','Files','4 Coding','i64os','substrate','directions');fs.mkdirSync(directions,{recursive:true});
 fs.writeFileSync(path.join(directions,'voice-profile.md'),'Found by default: a peer.\n');fs.writeFileSync(path.join(directions,'body-of-work.md'),'Found positions.\n');
 const server=await createServer({dataDir:config.dataDir,publicDir:path.resolve(import.meta.dirname,'../public'),studyOriginalRoots:config.studyOriginalRoots,sharedArticles:true,researchEnabled:false,voiceHome:home,execution:createWorkspaceExecution({codexPath:null,boundedEditorial:true})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(fixture.dir,{recursive:true,force:true});});
 assert.equal(fs.existsSync(path.join(config.dataDir,'i64os-directions.json')),false);
 const sheet=await (await fetch('http://127.0.0.1:'+server.address().port+'/api/guidance')).json();assert.equal(sheet.sources.voice.kind,'i64os');assert.equal(sheet.sources.voice.path,path.join(directions,'voice-profile.md'));assert.match(sheet.voice,/Found by default/);});
