import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStudyHumanDirection} from '../../runtime/services/study-human-direction.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from '../../runtime/store.mjs';
import {createStudyBindings} from '../../runtime/services/study-bindings.mjs';
import {createStudyDraftCopies} from '../../runtime/services/study-draft-copies.mjs';
import {createStudyOriginals} from '../../runtime/services/study-originals.mjs';
import {createStudyOwnedPhotoBindings} from '../../runtime/services/study-owned-photo-bindings.mjs';
import {createNativeOutputFactory} from '../../runtime/services/native-output-factory.mjs';
import {createLibrary} from '../../runtime/services/library.mjs';
import {digest} from '../../runtime/services/files.mjs';
const adapter=()=>import('./output-translation-brief.js');
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
async function fixture(t){
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'output-translation-brief-'))),vault=path.join(dataDir,'originals'),files=path.join(dataDir,'files');fs.mkdirSync(vault);fs.mkdirSync(files);const dev='DEV - Invented output (story).md',raw='---\ntype: DEV\ntitle: Invented output instructions\n---\n\nOriginal wording.\n';fs.writeFileSync(path.join(vault,dev),raw);
 const originals=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{invented:{title:'Invented',docs:[],relatedProjects:[]}},drafts:{part:{parentStudyKey:'invented',partKey:'1',title:'Invented',path:dev,contextScope:'Invented only',support:[]}}}});
 let store,bindings,native,ownedPhotos,factory,direction;const library=createLibrary({dataDir});
 async function restart(){if(store)await store.close();store=await createStore({dataDir,sharedArticles:true});bindings=createStudyBindings({dataDir,store});native=createStudyDraftCopies({dataDir,originals});ownedPhotos=createStudyOwnedPhotoBindings({dataDir,store,drafts:native,bindings});factory=createNativeOutputFactory({dataDir,store,native,originals,library,ownedPhotos});direction=createStudyHumanDirection({dataDir,store,bindings,drafts:native,readOutputDocument:q=>store.readArticle(q)});}
 await restart();t.after(async()=>{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});});
 const root=await native.openCopy({originalId:'part',originalHash:digest(raw),parentStudyId:'invented',operationId:randomUUID()});await bindings.select({projectKey:'invented',title:'Invented',operationId:randomUUID()});const physical=await ownedPhotos.select({bindingId:root.binding.id,parentStudyId:'invented',operationId:randomUUID()}),group={rootBindingId:root.binding.id,parentStudyId:'invented'};
 const create=async kind=>factory.owner.create({...group,kind,sourceBindingId:root.binding.id,expectedNative:(await native.read({bindingId:root.binding.id,parentStudyId:'invented'})).expected,expectedOutput:(await factory.owner.read(group)).expectedOutput,operationId:randomUUID()});const article=await create('article'),carousel=await create('carousel');
 const requests=[];const request=async(url,body)=>{const u=new URL(url,'http://fixture'),q=Object.fromEntries(u.searchParams);requests.push({url:u.pathname,input:body||q});if(u.pathname==='/api/study/outputs')return factory.owner.read(q);if(u.pathname==='/api/study/human-direction')return direction.read(q);if(u.pathname.endsWith('/write'))return direction.write(body);if(u.pathname.endsWith('/undo'))return direction.undo(body);throw Error(url)};
 const scope=id=>({parentStudyId:group.parentStudyId,rootBindingId:root.binding.id,outputId:id});return {dataDir,article,carousel,request,requests,scope,restart,physical,root,group,get direction(){return direction},get native(){return native}};
}

test('selected Article and Carousel use exact existing output Direction through save/restart/reopen/Undo',async t=>{
 const {createOutputTranslationBrief}=await adapter(),f=await fixture(t),storage=memory();
 const scopes=[f.scope(f.article.view.output.id),f.scope(f.carousel.view.output.id)],texts=['Language: Chinese\nDestination: WeChat\nKeep “An Cha” exactly.\n','Language: English\nDestination: carousel\nPreserve the speaker quote.\n'];
 for(let i=0;i<2;i++){const c=createOutputTranslationBrief({scope:scopes[i],request:f.request,storage,operationId:randomUUID});await c.open();assert.equal(c.state.record.scope.kind,'output');c.edit(texts[i]);await c.save();assert.equal(c.state.dirty,false);}
 await f.restart();for(let i=0;i<2;i++){const c=createOutputTranslationBrief({scope:scopes[i],request:f.request,storage,operationId:randomUUID});await c.open();assert.equal(c.state.body,texts[i]);const api=await f.direction.read({parentStudyId:scopes[i].parentStudyId,scope:'output',bindingId:scopes[i].rootBindingId,outputId:scopes[i].outputId});assert.equal(api.body,texts[i]);assert.equal(api.scope.projectId,f.physical.projectId);assert.equal(api.scope.documentId,f.physical.documentId);}
 const c=createOutputTranslationBrief({scope:scopes[0],request:f.request,storage,operationId:randomUUID});await c.open();await c.undo();assert.equal(c.state.body,'');assert.equal((await f.direction.read({scope:'output',parentStudyId:scopes[1].parentStudyId,bindingId:scopes[1].rootBindingId,outputId:scopes[1].outputId})).body,texts[1]);assert.ok(f.requests.filter(r=>r.url.endsWith('/write')).every(r=>r.input.scope==='output'));
});
test('outside Direction notes survive comparison; local pending wording survives adapter restart',async t=>{
 const {createOutputTranslationBrief}=await adapter(),f=await fixture(t),storage=memory(),scope=f.scope(f.article.view.output.id),args={scope,request:f.request,storage,operationId:randomUUID};
 let c=createOutputTranslationBrief(args);await c.open();c.edit('My entered translation instructions.');c=createOutputTranslationBrief(args);await c.open();assert.equal(c.state.body,'My entered translation instructions.');
 const selector={parentStudyId:scope.parentStudyId,scope:'output',bindingId:scope.rootBindingId,outputId:scope.outputId},before=await f.direction.read(selector);await f.direction.write({...selector,expectedRevision:before.revision,expectedHash:before.hash,operationId:randomUUID(),body:'Outside exact notes.\n'});
 await assert.rejects(c.save(),/changed|compare/i);assert.equal(c.state.body,'My entered translation instructions.');assert.equal(c.state.conflict.body,'Outside exact notes.\n');assert.equal((await f.direction.read(selector)).body,'Outside exact notes.\n');
 c.compare('Outside exact notes.\n\nMy entered translation instructions.');await c.save();assert.equal(c.state.body,'Outside exact notes.\n\nMy entered translation instructions.');await c.undo();assert.equal(c.state.body,'Outside exact notes.\n');
});
test('changed navigation, missing output or mismatched output binding never write Direction',async t=>{
 const {createOutputTranslationBrief}=await adapter(),f=await fixture(t),scope=f.scope(f.article.view.output.id);let current=true;const c=createOutputTranslationBrief({scope,request:f.request,storage:memory(),operationId:randomUUID,assertCurrent:()=>{if(!current)throw Error('Navigation changed');}});await c.open();c.edit('Unsaved');current=false;await assert.rejects(c.save(),/Navigation changed/);assert.equal(f.requests.filter(r=>r.url.endsWith('/write')).length,0);
 for(const bad of [{...scope,outputId:'publication-reference:old'},{...scope,rootBindingId:randomUUID()}])await assert.rejects(async()=>createOutputTranslationBrief({scope:bad,request:f.request,storage:memory(),operationId:randomUUID}).open());
 const wrong=async(url,body)=>{const r=await f.request(url,body);return url.startsWith('/api/study/human-direction?')?{...r,scope:{...r.scope,kind:'part'}}:r};await assert.rejects(createOutputTranslationBrief({scope,request:wrong,storage:memory(),operationId:randomUUID}).open(),/identity|scope/i);
});

test('lost save and Undo acknowledgements reopen without replaying a second operation',async t=>{
 const {createOutputTranslationBrief}=await adapter(),f=await fixture(t),storage=memory(),scope=f.scope(f.article.view.output.id);let offline=false,drop='write';
 const request=async(url,body)=>{if(offline)throw Error('Owner offline');const result=await f.request(url,body);if(body&&url.endsWith('/'+drop)){offline=true;throw Error('Acknowledgement lost');}return result;};
 const args={scope,request,storage,operationId:randomUUID};let c=createOutputTranslationBrief(args);await c.open();c.edit('Exact retained instructions.');await assert.rejects(c.save(),/lost/);assert.ok(c.state.pending);offline=false;drop='none';c=createOutputTranslationBrief(args);await c.open();assert.equal(c.state.pending,null);assert.equal(c.state.conflict,null);assert.equal(c.state.body,'Exact retained instructions.');
 drop='undo';await assert.rejects(c.undo(),/lost/);assert.ok(c.state.pending);offline=false;drop='none';c=createOutputTranslationBrief(args);await c.open();assert.equal(c.state.body,'');assert.equal(c.state.pending,null);assert.equal(f.requests.filter(r=>r.url.endsWith('/undo')).length,1);
});

test('ordinary editor preserves existing notes/planning bytes and saves the same output record',async t=>{
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../../runtime/package.json',import.meta.url)),{JSDOM}=require('jsdom'),{mountOutputTranslationBrief}=await adapter(),f=await fixture(t),scope=f.scope(f.article.view.output.id),selector={scope:'output',parentStudyId:scope.parentStudyId,bindingId:scope.rootBindingId,outputId:scope.outputId},initial=await f.direction.read(selector);
 const original='# Existing output direction\n\nExact notes — keep these.\n\n<!-- ar-create:direction-plan:v1 -->\n## Planning intent — not approval of wording or publication\n\n```json\n{"title":"Original title","language":"English","opening":"My own opening"}\n```\n<!-- /ar-create:direction-plan:v1 -->';await f.direction.write({...selector,operationId:randomUUID(),expectedRevision:initial.revision,expectedHash:initial.hash,body:original});
 const dom=new JSDOM('<main id="brief"></main>',{url:'http://localhost/'});t.after(()=>dom.window.close());const container=dom.window.document.querySelector('main');await mountOutputTranslationBrief(container,{scope,request:f.request,storage:memory(),operationId:randomUUID,assertCurrent:()=>assert.ok(container.isConnected)});
 const editor=container.querySelector('textarea');assert.equal(editor.value,original);const merged=original+'\n\nTranslate into Chinese for WeChat. Preserve “An Cha” exactly.';editor.value=merged;editor.dispatchEvent(new dom.window.Event('input'));container.querySelector('[data-translation-save]').click();for(let i=0;i<50&&container.querySelector('[data-translation-save]').textContent!=='Save translation brief';i++)await new Promise(r=>setTimeout(r,10));for(let i=0;i<50&&!container.textContent.includes('Translation brief saved in output Direction.');i++)await new Promise(r=>setTimeout(r,10));
 assert.match(container.textContent,/Translation brief saved in output Direction/);assert.equal((await f.direction.read(selector)).body,merged);assert.match(container.textContent,/does not translate wording or create an edition/);assert.equal(container.querySelector('[data-translation-saved]'),null);
});
test('changed output revision and unavailable recovery refuse transport writes',async t=>{
 const {createOutputTranslationBrief}=await adapter(),f=await fixture(t),scope=f.scope(f.article.view.output.id),storage=memory();let changed=false;
 const request=async(url,body)=>{const result=await f.request(url,body);if(changed&&url.startsWith('/api/study/outputs?'))result.expectedOutput={changed:true};return result};const c=createOutputTranslationBrief({scope,request,storage,operationId:randomUUID});await c.open();c.edit('Retain me.');changed=true;await assert.rejects(c.save(),/output changed/);assert.equal(c.state.body,'Retain me.');assert.equal(f.requests.filter(r=>r.url.endsWith('/write')).length,0);
 const badStorage={...memory(),setItem(){throw Error('Recovery unavailable')}};const other=createOutputTranslationBrief({scope,request:f.request,storage:badStorage,operationId:randomUUID});await other.open();assert.throws(()=>other.edit('Keep this tab open.'),/Recovery unavailable/);await assert.rejects(other.save(),/Recovery unavailable/);assert.equal(f.requests.filter(r=>r.url.endsWith('/write')).length,0);
});
