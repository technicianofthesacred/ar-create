import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration, INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const FEEDBACK = 'Workflow/6-Feedback/FEEDBACK - Clay Teacher.md';
const CONTEXT = 'Workflow/1-Source/CONTEXT - Clay Teacher.md';
const RESEARCH = 'Workflow/3-Develop/RESEARCH - Clay Teacher.md';
function fixture(t) {
  const f = buildMagazineFixture({extra: {[FEEDBACK]: '# Invented invitation\n', [RESEARCH]: '# Invented learning\n'}}); t.after(f.cleanup);
  const plan = planRegistration({vault:f.vault, files:f.files});
  fs.mkdirSync(path.join(f.data, 'magazine/projects'), {recursive:true});
  fs.writeFileSync(path.join(f.data, 'magazine/index.json'), JSON.stringify({schema:INDEX_SCHEMA, vaultRoot:f.vault, filesRoot:f.files, stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));
  for (const p of plan.stories) fs.writeFileSync(path.join(f.data, 'magazine/projects', p.storyId+'.json'), JSON.stringify(p));
  const magazine = createMagazineVault({vaultRoot:f.vault, filesRoot:f.files, dataDir:f.data, writable:false});
  const input = {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working',expectedHash:magazine.read({path:DEV}).hash};
  return {f, magazine, input, bridge:createWorkingDraftBridge({magazine}), projectFile:path.join(f.data,'magazine/projects/mag-clay-teacher.json')};
}
test('exact registered working owner and reference hashes are read without copying words or writing', async t => {
  const s=fixture(t), before=treeHashes(s.f.dir), result=await s.bridge.shareContext(s.input);
  assert.equal(result.schema,'ar-create.magazine-share-context.v1');
  assert.equal(result.authority.storyId,s.input.storyId); assert.equal(result.authority.pieceId,s.input.pieceId); assert.equal(result.authority.path,DEV);
  assert.deepEqual(result.draft,{path:DEV,hash:s.input.expectedHash});
  for(const [key,rel] of Object.entries({feedback:FEEDBACK,context:CONTEXT,research:RESEARCH})) {
    assert.equal(result.references[key].length,1); const r=result.references[key][0];
    assert.equal(r.path,rel); assert.equal(r.state,'current'); assert.equal(r.readable,true); assert.equal(r.registeredHash,r.currentHash); assert.equal(r.changedSinceRegistration,false);
  }
  assert.equal(result.rootIdentity.fingerprint.length,64);
  assert.ok(!JSON.stringify(result).includes(s.f.vault)); assert.ok(!JSON.stringify(result).includes('Invented invitation')); assert.ok(!JSON.stringify(result).includes('I met Mira'));
  assert.deepEqual(treeHashes(s.f.dir),before);
});
test('registered references distinguish missing, changed and unreadable bytes; unregistered files stay absent', async t => {
  const s=fixture(t);
  fs.rmSync(path.join(s.f.vault,FEEDBACK));
  fs.appendFileSync(path.join(s.f.vault,CONTEXT),'\nInvented new context.\n');
  fs.writeFileSync(path.join(s.f.vault,RESEARCH),Buffer.from([0xff,0xfe]));
  fs.writeFileSync(path.join(s.f.vault,'Workflow/6-Feedback/FEEDBACK - Clay Teacher extra.md'),'Unregistered message.');
  const before=treeHashes(s.f.dir), result=await s.bridge.shareContext(s.input);
  assert.equal(result.references.feedback.length,1); assert.equal(result.references.feedback[0].state,'missing'); assert.equal(result.references.feedback[0].currentHash,null);
  assert.equal(result.references.context[0].state,'changed-since-registration'); assert.equal(result.references.context[0].readable,true);
  assert.equal(result.references.research[0].state,'unreadable'); assert.equal(result.references.research[0].readable,false);
  assert.ok(Object.values(result.references).flat().every(r=>r.changedSinceRegistration));
  assert.deepEqual(treeHashes(s.f.dir),before);
});
test('missing registered categories remain empty without guessing filenames or creating records', async t => {
  const s=fixture(t), project=JSON.parse(fs.readFileSync(s.projectFile)); delete project.vaultRecords.feedback; delete project.vaultRecords.research;
  fs.writeFileSync(s.projectFile,JSON.stringify(project)); const before=treeHashes(s.f.dir);
  const result=await s.bridge.shareContext(s.input); assert.deepEqual(result.references.feedback,[]); assert.deepEqual(result.references.research,[]); assert.deepEqual(treeHashes(s.f.dir),before);
});
test('only exact working identity and current DEV hash are accepted', async t => {
  const s=fixture(t);
  for (const input of [{...s.input,expectedHash:null},{...s.input,expectedHash:'invalid'},{...s.input,path:DEV},{...s.input,edition:'published',editionId:'invented'},{...s.input,storyId:'Clay Teacher'},{...s.input,pieceId:'other'},{...s.input,expectedHash:'a'.repeat(64)}]) await assert.rejects(s.bridge.shareContext(input));
  const before=s.input.expectedHash; fs.appendFileSync(path.join(s.f.vault,DEV),'\nNew invented manuscript.\n');
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
  s.input.expectedHash=s.magazine.read({path:DEV}).hash; assert.notEqual(s.input.expectedHash,before);
  assert.equal((await s.bridge.shareContext(s.input)).draft.hash,s.input.expectedHash);
  fs.rmSync(path.join(s.f.vault,DEV)); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
test('draft and reference conflicts and symlinks refuse without substituting another file', async t => {
  for (const rel of [DEV,FEEDBACK,CONTEXT,RESEARCH]) {
    const s=fixture(t), file=path.join(s.f.vault,rel), conflict=file.replace(/\.md$/,'.sync-conflict-20261026-test.md');
    fs.writeFileSync(conflict,'Invented conflict.'); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409); fs.rmSync(conflict);
    const target=file+'.invented-target'; fs.renameSync(file,target); fs.symlinkSync(target,file);
    await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===403);
  }
});
test('captured canonical root, archive and duplicate identity/ref registrations are guarded', async t => {
  const s=fixture(t), original=JSON.parse(fs.readFileSync(s.projectFile));
  for (const change of [p=>p.archived=true,p=>p.pieces.push(p.pieces[0]),p=>p.vaultRecords.feedback=[p.vaultRecords.feedback,p.vaultRecords.feedback],p=>p.vaultRecords.feedback={rel:CONTEXT,sha256:'a'.repeat(64)}]) {
    const p=structuredClone(original); change(p); fs.writeFileSync(s.projectFile,JSON.stringify(p)); await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
  }
  fs.writeFileSync(s.projectFile,JSON.stringify(original));
  const indexFile=path.join(s.f.data,'magazine/index.json'), index=JSON.parse(fs.readFileSync(indexFile)); index.vaultRoot=s.f.files; fs.writeFileSync(indexFile,JSON.stringify(index));
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
test('files or registration changed during collection refuse a mixed Share context', async t => {
  for (const target of [DEV,CONTEXT,FEEDBACK,'registration']) {
    const s=fixture(t); let changed=false;
    const owner={...s.magazine,read(input){const result=s.magazine.read(input); if(input.path===RESEARCH&&!changed){changed=true;if(target==='registration'){const p=JSON.parse(fs.readFileSync(s.projectFile));delete p.vaultRecords.feedback;fs.writeFileSync(s.projectFile,JSON.stringify(p));}else fs.appendFileSync(path.join(s.f.vault,target),'\nConcurrent invented change.\n');}return result;}};
    await assert.rejects(createWorkingDraftBridge({magazine:owner}).shareContext(s.input),e=>e.status===409);
  }
});
test('a missing registered reference with a surviving sync-conflict still refuses', async t => {
  const s=fixture(t), file=path.join(s.f.vault,FEEDBACK);
  fs.rmSync(file); fs.writeFileSync(file.replace(/\.md$/,'.sync-conflict-20261026-test.md'),'Invented surviving conflicting message.');
  await assert.rejects(s.bridge.shareContext(s.input),e=>e.status===409);
});
