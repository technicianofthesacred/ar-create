import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createExistingWorkReader} from '../runtime/services/review-existing-work.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
 const home=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-review-discovery-'))),vault=path.join(home,'existing-vault');fs.mkdirSync(vault);t.after(()=>fs.rmSync(home,{recursive:true,force:true}));
 function put(relative,body){const file=path.join(vault,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);return file;}
 const source='Workflow/1-Source/SRC - River Conversation.md',draft='Workflow/3-Develop/DEV - River Conversation (story).md';
 put(source,'---\ntype: SRC\nstory: River Conversation\n---\n\nInvented speaker: the water reflects the sky.\n');
 put(draft,'---\ntype: DEV\nstory: River Conversation\ntitle: Invented River Story\n---\n\nInvented current draft words.\n');
 put('Workflow/3-Develop/RESEARCH - River Conversation.md','---\ntype: RESEARCH\nstory: River Conversation\n---\n\nInvented retained research.\n');
 function bytes(){const result={};function walk(rel=''){for(const name of fs.readdirSync(path.join(vault,rel)).sort()){const relative=path.posix.join(rel,name),file=path.join(vault,relative),st=fs.statSync(file);if(st.isDirectory())walk(relative);else result[relative]=sha(fs.readFileSync(file));}}walk();return result;}
 const calls=[],readAuthority=async route=>{calls.push(route);if(route==='/api/sources/tree')return {sources:[]};if(route==='/api/source-sessions')return {sessions:[]};if(route==='/api/pieces')return {pieces:[]};if(route==='/api/study-draft/catalog')return {drafts:[],collections:[],outputBindings:[]};if(route==='/api/magazine/working-draft/catalog')return {registered:false,stories:[]};throw Error('Unexpected authority route '+route);};
 const options={roots:[{id:'invented-current-vault',label:'Existing invented work',path:vault}],readAuthority,seedProjects:[{id:'unrelated-same-title',name:'River Conversation',slideCount:3}],excludedStoryNames:[]};
 return {home,vault,source,draft,put,bytes,calls,open:extra=>createExistingWorkReader({...options,...extra})};
}
const artifacts=c=>c.stories.flatMap(s=>s.artifacts);
test('actual configured reader cold-discovers, refreshes new files, survives restart and refuses stale external-edit hashes without copying bodies',async t=>{
 const f=fixture(t),before=f.bytes(),reader=f.open(),cold=await reader.catalog();
 assert.equal(cold.stories.length,1);assert.equal(cold.stories[0].name,'River Conversation');assert.equal(cold.stories[0].nativeProjectId,null,'a same-title seed cannot confer native authority');assert.deepEqual(cold.stories[0].retainedOutputs,[]);
 const original=artifacts(cold).find(a=>a.relativePath===f.source),read=await reader.readArtifact({artifactId:original.artifactId,expectedHash:original.hash});
 assert.equal(read.raw,fs.readFileSync(path.join(f.vault,f.source),'utf8'));assert.equal(read.provenance.sha256,original.hash);assert.deepEqual(f.bytes(),before);
 f.put('Workflow/1-Source/SRC - Mountain Visit.md','---\ntype: SRC\nstory: Mountain Visit\n---\n\nInvented later conversation.\n');
 f.put('Workflow/3-Develop/DEV - Mountain Visit (story).md','---\ntype: DEV\nstory: Mountain Visit\ntitle: Invented mountain story\n---\n\nInvented later draft.\n');
 const added=f.bytes(),refreshed=await reader.catalog(),mountain=refreshed.stories.find(s=>s.name==='Mountain Visit');
 assert.ok(mountain,'a new original story appears on the next catalog read, without registration/import');assert.ok(mountain.artifacts.some(a=>a.kind==='SRC'));assert.ok(mountain.artifacts.some(a=>a.kind==='DEV'));assert.equal(refreshed.sources.filter(s=>s.authority==='magazine-original').length,3);assert.deepEqual(f.bytes(),added);
 const reopened=await f.open().catalog(),ids=c=>artifacts(c).map(a=>[a.relativePath,a.artifactId,a.hash]).sort((a,b)=>a[0].localeCompare(b[0]));
 assert.deepEqual(ids(reopened),ids(refreshed));assert.deepEqual(reopened.stories.map(s=>s.id).sort(),refreshed.stories.map(s=>s.id).sort());assert.deepEqual(f.bytes(),added);
 const amended=fs.readFileSync(path.join(f.vault,f.source),'utf8')+'\nInvented amendment by an external editor.\n';fs.writeFileSync(path.join(f.vault,f.source),amended);const afterExternal=f.bytes();
 await assert.rejects(reader.readArtifact({artifactId:original.artifactId,expectedHash:original.hash}),e=>e.status===409);
 const current=await reader.catalog(),updated=artifacts(current).find(a=>a.relativePath===f.source);assert.equal(updated.artifactId,original.artifactId);assert.notEqual(updated.hash,original.hash);
 const exact=await reader.readArtifact({artifactId:updated.artifactId,expectedHash:updated.hash});assert.equal(exact.raw,amended);assert.equal(exact.provenance.sha256,sha(Buffer.from(amended)));assert.deepEqual(f.bytes(),afterExternal);
 assert.deepEqual(fs.readdirSync(f.home),['existing-vault'],'readers create no new Library/index/content home');assert.ok(!JSON.stringify(current).includes('Invented amendment by an external editor.'),'discovery catalog carries metadata, not bodies');assert.ok(f.calls.every(route=>['/api/sources/tree','/api/source-sessions','/api/pieces','/api/study-draft/catalog','/api/magazine/working-draft/catalog'].includes(route)));
});
test('only explicit stable story-ID mapping attaches an existing native owner, independent of seed display title',async t=>{
 const f=fixture(t),cold=await f.open().catalog(),storyId=cold.stories[0].id,before=f.bytes();
 const explicit=f.open({projectLinks:{[storyId]:{nativeProjectId:'actual-native-owner',originalProjectKey:'invented-original-key'}},seedProjects:[{id:'actual-native-owner',name:'Entirely different display label',slideCount:2}]});
 const catalog=await explicit.catalog();assert.equal(catalog.stories[0].id,storyId);assert.equal(catalog.stories[0].nativeProjectId,'actual-native-owner');assert.equal(catalog.stories[0].originalProjectKey,'invented-original-key');assert.equal(catalog.stories[0].retainedOutputs[0].slideCount,2);assert.deepEqual(f.bytes(),before);
});
test('portfolio artifact IDs are path-bound reader identities; rename is rediscovered rather than claimed as stable Library identity',async t=>{
 const f=fixture(t),reader=f.open(),cold=await reader.catalog(),original=artifacts(cold).find(a=>a.relativePath===f.source),renamed='Workflow/1-Source/SRC - River Conversation renamed.md';
 fs.renameSync(path.join(f.vault,f.source),path.join(f.vault,renamed));const afterRename=f.bytes(),fresh=await reader.catalog(),moved=artifacts(fresh).find(a=>a.relativePath===renamed);
 assert.ok(moved);assert.notEqual(moved.artifactId,original.artifactId);assert.equal(moved.hash,original.hash);await assert.rejects(reader.readArtifact({artifactId:original.artifactId,expectedHash:original.hash}),e=>e.status===404);
 assert.equal((await reader.readArtifact({artifactId:moved.artifactId,expectedHash:moved.hash})).raw,fs.readFileSync(path.join(f.vault,renamed),'utf8'));assert.deepEqual(f.bytes(),afterRename);
});
