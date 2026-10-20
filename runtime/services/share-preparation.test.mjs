import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createSharePreparation} from './share-preparation.mjs';
const BASE=path.resolve(import.meta.dirname,'..');
const load=p=>import(pathToFileURL(path.join(BASE,p)).href);
const [{createStore,createInitialState},{createStudyDraftCopies},{createNativeOutputOwner},{helpers,mapper},files,{outputPrivatePrefix}]=await Promise.all(['store.mjs','services/study-draft-copies.mjs','services/native-output-owner.mjs','services/native-output-helpers.mjs','services/files.mjs','output-records.mjs'].map(load));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
 const dataDir=fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR||'/tmp'),'ar-create-share-fixture-'));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const original=path.join(dataDir,'DEV - Invented.md');fs.writeFileSync(original,'---\ntype: DEV\ntitle: Invented\n---\n\nOriginal native words.\n');
 const originals={catalog:()=>({drafts:[{originalId:'invented',parentStudyKey:'parent',partKey:'article',title:'Invented',originalHash:hash(fs.readFileSync(original))}]}),readDraft:()=>({id:'invented',parentStudyKey:'parent',partKey:'article',title:'Invented',records:[{id:'draft',role:'draft',path:original,raw:fs.readFileSync(original,'utf8'),hash:hash(fs.readFileSync(original))}]})};
 const native=createStudyDraftCopies({dataDir,originals});const root=await native.openCopy({parentStudyId:'parent',originalId:'invented',originalHash:hash(fs.readFileSync(original)),operationId:randomUUID()});
 const project=createInitialState().project;project.id='invented-project';project.document={schema:'ar-create.document.v1',id:'invented-document',title:'Invented',revision:0,paragraphs:[],outputs:[]};fs.writeFileSync(path.join(dataDir,'state.json'),JSON.stringify({revision:0,project}));
 const store=await createStore({dataDir,sharedArticles:true});t.after(()=>store.close().catch(()=>{}));const group={rootBindingId:root.binding.id,parentStudyId:'parent'};
 const owner=createNativeOutputOwner({dataDir,store,native,mapper,helpers,scope:{resolve:i=>{assert.deepEqual(i,group);return {projectId:project.id,documentId:project.document.id};}},proof:{read:async()=>({sources:[],assets:[],photos:[],decisionsHash:hash('invented decisions')})}});
 const create=async()=>owner.create({...group,kind:'article',sourceBindingId:root.binding.id,expectedNative:root.expected,expectedOutput:(await owner.read(group)).expectedOutput,operationId:randomUUID()});
 const a=await create(), b=await create();const selector={...group,selectedOutputId:a.view.output.id,recipientId:randomUUID()};
 const fresh=()=>createSharePreparation({dataDir,outputs:owner,files,outputPrivatePrefix});const service=fresh();
 const read=()=>service.read(selector);const save=async(changes,view,extra={})=>{view??=await read();return service.save({...selector,expected:view.expected,expectedEdition:view.currentEdition,operationId:randomUUID(),changes,...extra});};
 return {dataDir,original,native,root,store,owner,a,b,selector,fresh,service,read,save};
}
test('durable invitation and reviewed translation resume; recipients and own outputs remain independent',async t=>{
 const f=await fixture(t);const before=JSON.stringify(f.store.get());const v=await f.save({recipient:'Invented friend',message:'Our original invitation',translatedMessage:'Reviewed translation',language:'en → zh',link:'https://example.invalid/invented'});
 assert.equal(v.preparation.message,'Our original invitation');assert.equal((await f.fresh().read(f.selector)).preparation.translatedMessage,'Reviewed translation');
 assert.equal((await f.service.read({...f.selector,recipientId:randomUUID()})).preparation,null);assert.equal((await f.service.read({...f.selector,selectedOutputId:f.b.view.output.id})).preparation,null);
 assert.equal(JSON.stringify(f.store.get()),before);assert.equal(v.facts.length,0);assert.equal(v.review.outdated,false);
});
test('stale writes, same operation retry and simultaneous instances preserve the winning contribution',async t=>{
 const f=await fixture(t),v=await f.read(),operationId=randomUUID();const input={...f.selector,expected:v.expected,expectedEdition:v.currentEdition,operationId,changes:{message:'First'}};
 const saved=await f.service.save(input);assert.equal((await f.fresh().save(input)).receipt.operationId,operationId);await assert.rejects(f.service.save({...input,changes:{message:'Different'}}),/operation/i);
 await assert.rejects(f.save({message:'stale'},v),/changed|stale/i);assert.equal((await f.read()).preparation.message,'First');
 const current=await f.read();const results=await Promise.allSettled([f.save({message:'one'},current),f.fresh().save({...f.selector,expected:current.expected,expectedEdition:current.currentEdition,operationId:randomUUID(),changes:{message:'two'}})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(saved.expected.revision,1);
});
test('exact saved Undo restores preparation only; human reply, sent and N/A facts require explicit provenance',async t=>{
 const f=await fixture(t);const a=await f.save({message:'Original',checks:'Check name'});const b=await f.save({message:'Edited',checks:''});
 const fact=await f.service.appendFact({...f.selector,expected:b.expected,expectedEdition:b.currentEdition,operationId:randomUUID(),fact:{kind:'reply',original:'Please correct my invented name.',recordedBy:'human',receivedAt:null,proposedCorrection:'Use Example',affectedReference:'Opening paragraph',translation:'Reviewed reply translation'}});
 const undone=await f.fresh().undo({...f.selector,expected:fact.expected,expectedEdition:fact.currentEdition,operationId:randomUUID(),undoOperationId:b.receipt.operationId});assert.deepEqual(undone.preparation,a.preparation);assert.equal(undone.facts[0].original,'Please correct my invented name.');
 await assert.rejects(f.service.appendFact({...f.selector,expected:undone.expected,expectedEdition:undone.currentEdition,operationId:randomUUID(),fact:{kind:'sent',recordedBy:'copy'}}),/human|fact/i);
 const sent=await f.service.appendFact({...f.selector,expected:undone.expected,expectedEdition:undone.currentEdition,operationId:randomUUID(),fact:{kind:'sent',recordedBy:'human',sentAt:'2026-10-20',channel:'WeChat'}});assert.equal(sent.facts.at(-1).sentAt,'2026-10-20');
 const none={...f.selector,recipientId:'none'},empty=await f.service.read(none);const na=await f.service.appendFact({...none,expected:empty.expected,expectedEdition:empty.currentEdition,operationId:randomUUID(),fact:{kind:'not-applicable',recordedBy:'human',reason:'No recipient for this invented piece'}});assert.equal(na.facts[0].kind,'not-applicable');
});
test('native own-word change flags old preparation, keeps drafts and independent output current',async t=>{
 const f=await fixture(t),a=await f.save({message:'Earlier invitation',link:'https://example.invalid/earlier'});const sibling=await f.service.read({...f.selector,selectedOutputId:f.b.view.output.id});
 const binding=f.a.view.wordOwner.bindingId,s=await f.native.read({bindingId:binding,parentStudyId:'parent'}),p=s.projection.find(p=>p.words.includes('native words.'));await f.native.save({bindingId:binding,parentStudyId:'parent',expected:s.expected,operationId:randomUUID(),operations:[{kind:'text',id:p.id,from:0,to:8,insert:'Changed',seenBlockHash:p.blockHash}]});
 const stale=await f.read();assert.equal(stale.review.outdated,true);assert.equal(stale.preparation.message,'Earlier invitation');assert.equal(stale.review.linkNeedsReview,true);assert.equal(stale.editions.length,1);
 assert.equal((await f.service.read({...f.selector,selectedOutputId:f.b.view.output.id})).currentEdition,sibling.currentEdition);await assert.rejects(f.save({message:'racing'},a),/edition|changed/i);
 const next=await f.save({message:'New edition'});assert.equal(next.editions.length,2);assert.equal((await f.service.read({...f.selector,targetEdition:a.currentEdition})).preparation.message,'Earlier invitation');
});
test('unknown saved fields survive, caller paths/output snapshots and symlink/hardlink sidecars refuse',async t=>{
 const f=await fixture(t);await f.save({message:'Exact'});const dir=path.join(f.dataDir,outputPrivatePrefix('invented-project','invented-document'),'share',f.selector.selectedOutputId);const file=path.join(dir,hash(f.selector.recipientId)+'.json');
 const record=JSON.parse(fs.readFileSync(file));record.future={keep:['original']};record.editions[0].preparation.futureManual='Preserve this';fs.writeFileSync(file,JSON.stringify(record));await f.save({tone:'Warm'});assert.deepEqual(JSON.parse(fs.readFileSync(file)).future,{keep:['original']});assert.equal((await f.read()).preparation.futureManual,'Preserve this');
 for(const extra of [{path:'/synthetic/refused-path'},{output:{id:f.selector.selectedOutputId}},{projectId:'other'}])await assert.rejects(f.service.read({...f.selector,...extra}),/fields|paths|identity/i);
 const bytes=fs.readFileSync(file),outside=path.join(f.dataDir,'outside.json');fs.writeFileSync(outside,bytes);fs.unlinkSync(file);fs.symlinkSync(outside,file);await assert.rejects(f.read(),/symlink|regular|owned/i);fs.unlinkSync(file);fs.linkSync(outside,file);await assert.rejects(f.read(),/linked|regular|owned/i);assert.deepEqual(fs.readFileSync(outside),bytes);
});
test('recipient discovery survives a fresh instance and cannot cross output ownership',async t=>{
 const f=await fixture(t);await f.save({recipient:'Invented friend',message:'Discoverable invitation'});
 const scope={rootBindingId:f.selector.rootBindingId,parentStudyId:f.selector.parentStudyId,selectedOutputId:f.selector.selectedOutputId};
 const listed=await f.fresh().list(scope);assert.equal(listed.records.length,1);assert.equal(listed.records[0].identity.recipientId,f.selector.recipientId);assert.equal(listed.records[0].preparation.message,'Discoverable invitation');
 assert.equal((await f.service.list({...scope,selectedOutputId:f.b.view.output.id})).records.length,0);
});
test('unknown recipient record ownership, symlink parents and held locks refuse without byte changes',async t=>{
 const f=await fixture(t);const saved=await f.save({message:'Keep'});const dir=path.join(f.dataDir,outputPrivatePrefix('invented-project','invented-document'),'share',f.selector.selectedOutputId),file=path.join(dir,hash(f.selector.recipientId)+'.json'),bytes=fs.readFileSync(file);
 fs.writeFileSync(file+'.lock','a writer');await assert.rejects(f.save({message:'Blocked'}),/busy/i);assert.deepEqual(fs.readFileSync(file),bytes);fs.unlinkSync(file+'.lock');
 const record=JSON.parse(bytes);record.identity.outputId=f.b.view.output.id;fs.writeFileSync(file,JSON.stringify(record));await assert.rejects(f.read(),/ownership/i);fs.writeFileSync(file,bytes);
 const moved=dir+'-moved';fs.renameSync(dir,moved);fs.symlinkSync(moved,dir);await assert.rejects(f.read(),/owned|symlink/i);assert.deepEqual(fs.readFileSync(path.join(moved,path.basename(file))),bytes);
 fs.unlinkSync(dir);fs.renameSync(moved,dir);assert.equal((await f.read()).expected.hash,saved.expected.hash);
});

test('caller invented earlier editions and extra preparation/fact fields refuse without mutations',async t=>{
 const f=await fixture(t),v=await f.save({message:'Keep original'});
 await assert.rejects(f.service.read({...f.selector,targetEdition:'a'.repeat(64)}),/not retained/);
 await assert.rejects(f.save({message:'bad',manuscript:'forbidden'}),/fields/);
 await assert.rejects(f.service.appendFact({...f.selector,expected:v.expected,expectedEdition:v.currentEdition,operationId:randomUUID(),fact:{kind:'reply',recordedBy:'human',original:'Original reply',proposedCorrection:'Replace name'}}),/affected/);
 assert.deepEqual((await f.read()).expected,v.expected);assert.equal((await f.read()).facts.length,0);
});
test('lock replacement across awaited native authority refuses publication and preserves the foreign lock',async t=>{
 for(const variant of ['token','inode','parent'])await t.test(variant,async t=>{
  const f=await fixture(t),view=await f.read(),operationId=randomUUID();
  const dir=path.join(f.dataDir,outputPrivatePrefix('invented-project','invented-document'),'share',f.selector.selectedOutputId),file=path.join(dir,hash(f.selector.recipientId)+'.json'),lock=file+'.lock';
  let calls=0,release,entered;const gate=new Promise(resolve=>release=resolve),waiting=new Promise(resolve=>entered=resolve);
  const outputs={...f.owner,read:async input=>{calls++;if(calls===2){entered();await gate;}return f.owner.read(input);}};
  const service=createSharePreparation({dataDir:f.dataDir,outputs,files,outputPrivatePrefix});
  const saving=service.save({...f.selector,expected:view.expected,expectedEdition:view.currentEdition,operationId,changes:{message:'Must not publish'}});
  await waiting;
  let foreign='FOREIGN WRITER TOKEN';
  if(variant==='token')fs.writeFileSync(lock,foreign);
  else if(variant==='inode'){fs.renameSync(lock,lock+'.former');foreign=operationId;fs.writeFileSync(lock,foreign);}
  else{fs.renameSync(dir,dir+'-former');fs.mkdirSync(dir);foreign=operationId;fs.writeFileSync(lock,foreign);}
  release();await assert.rejects(saving,/lock|ownership/i);
  assert.equal(fs.existsSync(file),false);assert.equal(fs.readFileSync(lock,'utf8'),foreign);
 });
});
