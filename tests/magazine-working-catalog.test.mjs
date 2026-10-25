import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from '../runtime/server.mjs';
import {buildMagazineFixture,treeHashes} from './helpers/magazine-fixture.mjs';
import {planRegistration,INDEX_SCHEMA} from '../runtime/services/magazine-vault/projects.mjs';
const digest=v=>createHash('sha256').update(v).digest('hex');
const draft='Workflow/3-Develop/DEV - Clay Teacher (story).md';
async function fixture(t,{registered=true,writable=true}={}){
 const f=buildMagazineFixture();t.after(f.cleanup);
 if(registered){const plan=planRegistration({vault:f.vault,files:f.files});fs.mkdirSync(path.join(f.data,'magazine/projects'),{recursive:true});fs.writeFileSync(path.join(f.data,'magazine/index.json'),JSON.stringify({schema:INDEX_SCHEMA,vaultRoot:f.vault,filesRoot:f.files,stories:plan.stories.map(p=>({storyId:p.storyId,name:p.name}))}));for(const p of plan.stories)fs.writeFileSync(path.join(f.data,'magazine/projects',p.storyId+'.json'),JSON.stringify(p));}
 const server=await createServer({dataDir:f.data,publicDir:path.resolve('public'),connections:[],magazineRoots:[],researchEnabled:false,magazineVault:{vaultRoot:f.vault,filesRoot:f.files,writable,machine:'synthetic-catalog-only'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const origin='http://127.0.0.1:'+server.address().port;
 return {f,origin,read:async()=>{const response=await fetch(origin+'/api/magazine/working-draft/catalog');assert.equal(response.status,200);return response.json();}};
}
test('native HTTP discovery proves the maintained root and current DEV hash without returning prose or absolute paths',async t=>{
 const {f,origin,read}=await fixture(t),before=treeHashes(f.vault),value=await read();
 assert.equal(value.schema,'ar-create.magazine-working-catalog.v1');assert.equal(value.registered,true);assert.equal(value.writable,true);
 assert.deepEqual(value.rootIdentity,{scheme:'canonical-directory-sha256-v1',fingerprint:digest(fs.realpathSync(f.vault))});
 const piece=value.stories.flatMap(s=>s.pieces).find(p=>p.relativePath===draft);assert.equal(piece.pieceId,'mag-clay-teacher:article');assert.equal(piece.hash,digest(fs.readFileSync(path.join(f.vault,draft))));assert.equal(piece.editable,true);
 const serialized=JSON.stringify(value);assert.ok(!serialized.includes(f.vault));assert.ok(!serialized.includes('I met Mira'));assert.ok(!serialized.includes('text'));assert.ok(!serialized.includes('draft:'));
 assert.deepEqual(treeHashes(f.vault),before);const capabilities=await(await fetch(origin+'/api/capabilities')).json();assert.ok(capabilities.commands.some(c=>c.path==='/api/magazine/working-draft/catalog'||c.route==='/api/magazine/working-draft/catalog'));
 assert.equal((await fetch(origin+'/api/magazine/working-draft/catalog?path=caller-choice')).status,400);
});
test('same relative path and bytes in a different root do not claim the same owner; external changes refresh exact hashes',async t=>{
 const a=await fixture(t),b=await fixture(t),av=await a.read(),bv=await b.read();assert.notEqual(av.rootIdentity.fingerprint,bv.rootIdentity.fingerprint);
 const ap=av.stories.flatMap(s=>s.pieces).find(p=>p.relativePath===draft),bp=bv.stories.flatMap(s=>s.pieces).find(p=>p.relativePath===draft);assert.equal(ap.hash,bp.hash);
 fs.appendFileSync(path.join(a.f.vault,draft),'\nInvented external revision.\n');const changed=(await a.read()).stories.flatMap(s=>s.pieces).find(p=>p.relativePath===draft);assert.notEqual(changed.hash,ap.hash);assert.equal(changed.hash,digest(fs.readFileSync(path.join(a.f.vault,draft))));
});
test('unregistered and read-only maintained owners remain explicit without registration or activation',async t=>{
 const unregistered=await fixture(t,{registered:false,writable:false}),before=treeHashes(unregistered.f.data),value=await unregistered.read();assert.equal(value.registered,false);assert.equal(value.writable,false);assert.deepEqual(value.stories,[]);assert.deepEqual(treeHashes(unregistered.f.data),before);
 const readonly=await fixture(t,{writable:false}),catalog=await readonly.read();assert.equal(catalog.registered,true);assert.equal(catalog.writable,false);assert.ok(catalog.stories.flatMap(s=>s.pieces).every(p=>p.editable===false));
});

test('real native owner discovery joins the exact portfolio DEV to a different browser project namespace',async t=>{
 const {f,origin}=await fixture(t),roots=[{id:'invented-magazine-root',path:f.vault}];
 const {createMagazinePortfolio}=await import('../runtime/services/magazine-portfolio.mjs');const portfolio=createMagazinePortfolio({roots}),original=await portfolio.list(),story=original.stories.find(s=>s.artifacts.some(a=>a.relativePath===draft));assert.ok(story);
 const {createExistingWorkReader}=await import('../runtime/services/review-existing-work.mjs');const reader=createExistingWorkReader({roots,portfolio,projectLinks:{[story.id]:{nativeProjectId:'browser-clay'}},readAuthority:async endpoint=>{const response=await fetch(origin+endpoint),value=await response.json();if(!response.ok)throw Error(value.error);return value;}});
 const catalog=await reader.catalog(),selected=catalog.stories.find(s=>s.id===story.id).artifacts.find(a=>a.relativePath===draft),target=selected.magazineWorkingTarget;
 assert.ok(target,'the real endpoint and real portfolio establish a writer target');assert.equal(target.nativeProjectId,'browser-clay');assert.equal(target.storyId,'mag-clay-teacher');assert.equal(target.pieceId,'mag-clay-teacher:article');assert.equal(target.hash,digest(fs.readFileSync(path.join(f.vault,draft))));assert.equal(target.editable,true);assert.ok(!JSON.stringify(target).includes(f.vault));assert.ok(!JSON.stringify(target).includes('I met Mira'));
});
