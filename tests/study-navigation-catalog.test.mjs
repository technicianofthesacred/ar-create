// Navigation names existing owners; it must not load or validate their captured source bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';
import {createStudyOriginals} from '../runtime/services/study-originals.mjs';
import {createSubjectStanding} from '../runtime/services/subject-standing.mjs';
import {createRouteMap} from '../runtime/commands.mjs';
import {withActor} from '../runtime/services/actor.mjs';

function temp(t){const dir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'navigation-catalog-')));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}

test('navigation preserves subject identities and fixture exclusions without opening captures; exact reads and full catalog still refuse changed captures',async t=>{
 const dataDir=temp(t),original={id:'original',parentStudyKey:'original-subject',partKey:'article',title:'Original title',path:'Workflow/3-Develop/DEV - Original.md',originalHash:'a'.repeat(64)};
 const drafts=createStudyDraftCopies({dataDir,originals:{catalog:()=>[original],readDraft:()=>{throw Error('No source read for navigation.');}}});
 const made=await withActor({actor:'human:adrian',client:'ui'},()=>drafts.createCollection({parentStudyId:'invented-subject',title:'Invented title',operationId:randomUUID()}));
 const full=await drafts.catalog(),nav=await drafts.catalog({purpose:'navigation'});
 const fullRow=full.collections.find(c=>c.bindingId===made.binding.id),navRow=nav.collections.find(c=>c.bindingId===made.binding.id);
 const {capturedRecords,...identity}=fullRow;
 assert.deepEqual(navRow,identity);assert.equal(Object.hasOwn(navRow,'capturedRecords'),false);
 assert.deepEqual(nav.drafts,full.drafts);assert.deepEqual(nav.outputBindings,full.outputBindings);
 const bindings=path.join(dataDir,'study-draft-copies/bindings'),bindingFile=path.join(bindings,fs.readdirSync(bindings)[0]);
 const saved=JSON.parse(fs.readFileSync(bindingFile,'utf8'));
 fs.writeFileSync(path.join(bindings,'f'.repeat(64)+'.json'),JSON.stringify({...saved,id:randomUUID(),parentStudyId:'hidden-fixture',parentStudyKey:'hidden-fixture',fixture:true}));
 const manifest=path.join(dataDir,'study-draft-copies/copies',made.binding.id,'capture-manifest.json');fs.chmodSync(manifest,0o600);fs.writeFileSync(manifest,'changed capture');
 const after=await drafts.catalog({purpose:'navigation'});
 assert.deepEqual(after.collections,[navRow]);assert.deepEqual(after.excludedProjectIds,['hidden-fixture']);assert.deepEqual(after.drafts,[{...original,originalId:original.id}]);
 await assert.rejects(drafts.catalog(),/Captured original provenance changed/);
 await assert.rejects(drafts.read({bindingId:made.binding.id,parentStudyId:'invented-subject'}),/Captured original provenance changed/);
 await assert.rejects(drafts.read({bindingId:made.binding.id,parentStudyId:'foreign-subject'}),/different parent/);
 for(const input of [{purpose:'other'},{purpose:'navigation',path:'elsewhere'},null])await assert.rejects(drafts.catalog(input),e=>e.status===400);
});

test('original discovery returns identical draft metadata without reading support documents; exact reads still reject unsafe support',t=>{
 const root=temp(t),vault=path.join(root,'vault'),files=path.join(root,'files');fs.mkdirSync(vault);fs.mkdirSync(files);
 const draft='DEV - Invented.md',support='SRC - Invented.md';fs.writeFileSync(path.join(vault,draft),'---\ntitle: Invented title\n---\nInvented words.');fs.writeFileSync(path.join(vault,support),'Invented source.');
 const owner=createStudyOriginals({vaultRoot:vault,filesRoot:files,catalog:{projects:{},drafts:{invented:{parentStudyKey:'invented',partKey:'article',title:'Fallback',path:draft,support:[[support,'source']]}}}});
 const before=owner.catalog();assert.equal(owner.readDraft('invented').records.length,2);
 const outside=path.join(root,'outside.md');fs.writeFileSync(outside,'Other invented source.');fs.unlinkSync(path.join(vault,support));fs.symlinkSync(outside,path.join(vault,support));
 assert.deepEqual(owner.catalog(),before);assert.throws(()=>owner.readDraft('invented'),e=>e.status===403);
});

test('existing catalog route passes the optional navigation purpose and refuses duplicate selectors',async()=>{
 const seen=[],bind=createRouteMap({researchAction:()=>()=>{},draftCall:fn=>fn(),studyDrafts:{catalog:input=>{seen.push(input);return {collections:[]};}}});
 for(const query of ['', '?purpose=navigation'])await bind({url:new URL('http://local/api/study-draft/catalog'+query)})['/api/study-draft/catalog'].GET();
 assert.deepEqual(seen,[{}, {purpose:'navigation'}]);
 assert.throws(()=>bind({url:new URL('http://local/api/study-draft/catalog?purpose=navigation&purpose=navigation')})['/api/study-draft/catalog'].GET(),e=>e.status===400);
});

test('standing discovery asks for navigation metadata while preserving original-owned Magazine exclusion',async t=>{
 const dataDir=temp(t),seen=[];
 const standing=createSubjectStanding({dataDir,drafts:{catalog:input=>{seen.push(input);return {drafts:[{id:'original',parentStudyKey:'native-original',title:'Original title',path:'DEV - Invented (story).md'}],collections:[]};}},magazine:{configured:true,status:()=>({vaultRoot:dataDir}),projects:{list:()=>({registered:true,stories:[{storyId:'mag-invented',name:'Invented',pieces:[{pieceId:'mag-invented:article',kind:'article',rel:'DEV - Invented (story).md'}]}]})}},originalsRoot:dataDir});
 t.after(()=>standing.stop());
 await assert.rejects(standing.one({parentStudyId:'mag-invented'}),e=>e.status===404);
 assert.deepEqual(seen,[{purpose:'navigation'}]);
});
