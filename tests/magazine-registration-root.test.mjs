// Invented folders only. A registration from another root must never turn
// identical relative paths/bytes into authority over this root's working DEV.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {buildMagazineFixture, treeHashes} from './helpers/magazine-fixture.mjs';
import {apply as register} from '../tools/magazine/register.mjs';
import {createMagazineVault} from '../runtime/services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from '../runtime/services/magazine/working-draft-bridge.mjs';
import {withActor} from '../runtime/services/actor.mjs';

const selection = {storyId:'mag-clay-teacher',pieceId:'mag-clay-teacher:article',edition:'working'};
const DEV = 'Workflow/3-Develop/DEV - Clay Teacher (story).md';
const human = fn => withActor({actor:'human:adrian',client:'ui'},fn);
async function fixture(t) {
  const f=buildMagazineFixture();t.after(f.cleanup);
  const before=treeHashes(f.vault);
  const registration=await register({mag:f.vault,files:f.files,data:f.data,verification:path.join(f.dir,'verification')});
  assert.equal(registration.identical,true);assert.deepEqual(treeHashes(f.vault),before);
  const make=(vaultRoot=f.vault)=>createWorkingDraftBridge({magazine:createMagazineVault({vaultRoot,filesRoot:f.files,dataDir:f.data,writable:true,machine:'synthetic-root-proof'})});
  const index=path.join(f.data,'magazine/index.json');
  return {f,index,make};
}

test('the registrar and writer prove the same canonical folder without copying a manuscript',async t=>{
  const {f,make}=await fixture(t),bridge=make(),catalog=bridge.catalog(),view=await bridge.read(selection);
  assert.equal(catalog.registered,true);assert.equal(view.editable,true);assert.equal(view.authority.path,DEV);
  assert.equal(fs.existsSync(path.join(f.data,'study-draft-copies')),false);
});

test('another root with identical paths, IDs and bytes cannot inherit this registration',async t=>{
  const {f,make}=await fixture(t),other=buildMagazineFixture();t.after(other.cleanup);
  assert.equal(fs.readFileSync(path.join(f.vault,DEV),'utf8'),fs.readFileSync(path.join(other.vault,DEV),'utf8'));
  const before=treeHashes(other.vault),bridge=make(other.vault);
  assert.throws(()=>bridge.catalog(),error=>error.status===409&&/registration.*folder/i.test(error.message));
  await assert.rejects(bridge.read(selection),error=>error.status===409);
  await assert.rejects(human(()=>bridge.save({...selection,content:'Wrong root words.',expectedHash:'a'.repeat(64),operationId:randomUUID()})),error=>error.status===409);
  assert.deepEqual(treeHashes(other.vault),before);
});

test('missing, relative and unavailable registration roots refuse without repairing metadata',async t=>{
  for(const root of [undefined,'relative/root','/invented/not-a-real-registered-directory']){
    const {f,index,make}=await fixture(t),value=JSON.parse(fs.readFileSync(index));
    if(root===undefined)delete value.vaultRoot;else value.vaultRoot=root;
    fs.writeFileSync(index,JSON.stringify(value));const before=treeHashes(f.data),bridge=make();
    assert.throws(()=>bridge.catalog(),error=>error.status===409);
    await assert.rejects(bridge.read(selection),error=>error.status===409);
    assert.deepEqual(treeHashes(f.data),before);
  }
});

test('registration root drift after opening does not create an alternate writer or receipt',async t=>{
  const {f,index,make}=await fixture(t),bridge=make(),view=await bridge.read(selection),other=buildMagazineFixture();t.after(other.cleanup);
  const registration=JSON.parse(fs.readFileSync(index));registration.vaultRoot=other.vault;fs.writeFileSync(index,JSON.stringify(registration));
  const before=treeHashes(f.vault),dataBefore=treeHashes(f.data);
  await assert.rejects(human(()=>bridge.save({...selection,content:view.document.text+'\nMust not be saved.\n',expectedHash:view.document.hash,operationId:randomUUID()})),error=>error.status===409);
  assert.deepEqual(treeHashes(f.vault),before);assert.deepEqual(treeHashes(f.data),dataBefore);
});

test('canonical aliases are accepted, but retargeting their parent cannot redirect an already-open owner',async t=>{
  const {f,index}=await fixture(t),other=buildMagazineFixture();t.after(other.cleanup);
  const alias=path.join(f.dir,'registered-parent');fs.symlinkSync(path.dirname(f.vault),alias,'dir');
  const aliasRoot=path.join(alias,path.basename(f.vault)),registration=JSON.parse(fs.readFileSync(index));registration.vaultRoot=aliasRoot;fs.writeFileSync(index,JSON.stringify(registration));
  const bridge=createWorkingDraftBridge({magazine:createMagazineVault({vaultRoot:aliasRoot,filesRoot:f.files,dataDir:f.data,writable:true,machine:'synthetic-alias-proof'})});
  const view=await bridge.read(selection);assert.equal(view.editable,true,'one canonical directory is still one owner');
  fs.unlinkSync(alias);fs.symlinkSync(path.dirname(other.vault),alias,'dir');
  const beforeA=treeHashes(f.vault),beforeB=treeHashes(other.vault);
  assert.throws(()=>bridge.catalog(),error=>error.status===409);
  await assert.rejects(human(()=>bridge.save({...selection,content:view.document.text+'\nMust not follow an alias change.\n',expectedHash:view.document.hash,operationId:randomUUID()})),error=>error.status===409);
  assert.deepEqual(treeHashes(f.vault),beforeA);assert.deepEqual(treeHashes(other.vault),beforeB);
});
