import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {createStudyDraftCopies} from '../runtime/services/study-draft-copies.mjs';import {digest} from '../runtime/services/files.mjs';

test('synthetic native save, independent switch, service reload and exact Undo preserve sources',async t=>{
 const dataDir=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ar-package-save-')));t.after(()=>fs.rmSync(dataDir,{recursive:true,force:true}));
 const documents=new Map([['one','---\ntitle: Synthetic One\n---\n\nAlpha invented words.\n\nBeta invented words.\n'],['two','---\ntitle: Synthetic Two\n---\n\nA separate invented manuscript.\n']]);
 const originalDir=path.join(dataDir,'originals');fs.mkdirSync(originalDir);for(const [id,raw] of documents)fs.writeFileSync(path.join(originalDir,'DEV - Synthetic '+id+'.md'),raw);
 const originals={catalog:()=>({drafts:[...documents].map(([id,raw])=>({originalId:id,parentStudyKey:id,partKey:'article',title:'Synthetic '+id,originalHash:digest(raw)}))}),read:id=>({id,parentStudyKey:id,partKey:'article',title:'Synthetic '+id,records:[{id:'draft',role:'draft',path:path.join(originalDir,'DEV - Synthetic '+id+'.md'),raw:documents.get(id),hash:digest(documents.get(id))}]})};
 const service=createStudyDraftCopies({dataDir,originals});const opened=await service.openCopy({originalId:'one',originalHash:digest(documents.get('one')),parentStudyId:'one',operationId:randomUUID()});
 const paragraph=opened.projection.find(p=>p.words==='Beta invented words.');const operationId=randomUUID();
 const saved=await service.save({bindingId:opened.binding.id,parentStudyId:'one',operationId,expected:opened.expected,operations:[{kind:'text',id:paragraph.id,from:0,to:4,insert:'Saved',seenBlockHash:paragraph.blockHash}]});
 assert.match(fs.readFileSync(saved.paths.draft,'utf8'),/Saved invented words/);
 const second=await service.openCopy({originalId:'two',originalHash:digest(documents.get('two')),parentStudyId:'two',operationId:randomUUID()});assert.notEqual(second.binding.id,saved.binding.id);assert.equal(second.raw,documents.get('two'));
 const reloaded=createStudyDraftCopies({dataDir,originals});assert.equal((await reloaded.read({bindingId:saved.binding.id,parentStudyId:'one'})).raw,saved.raw);
 const restored=await reloaded.undo({bindingId:saved.binding.id,parentStudyId:'one',operationId:randomUUID(),undoOperationId:operationId,expected:saved.expected});assert.equal(restored.raw,documents.get('one'));
 for(const [id,raw] of documents)assert.equal(fs.readFileSync(path.join(originalDir,'DEV - Synthetic '+id+'.md'),'utf8'),raw);
});
