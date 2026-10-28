import test from 'node:test';
import assert from 'node:assert/strict';
import {capture,projection,apply} from '../runtime/services/draft-correspondence.mjs';
import {openingProposalTarget} from '../runtime/services/native-proposal-capability.mjs';
const baseline=raw=>{const model=capture(raw,'invented-opening');return{raw,projection:projection(model).map((row,i)=>({...row,raw:model.blocks[i].raw})),model};};
test('donor empty body insertion stays between metadata and retained footer at its stable boundary',()=>{
 const raw='---\nkind: draft\n---\n\nTitle: Invented\n\n---\n\n\n---\n\nRetained notes.',b=baseline(raw),target=openingProposalTarget(b);assert.equal(target.kind,'insert');assert.ok(target.beforeId);const result=apply(b.model,raw,[{kind:'insert',id:'fresh-invented-opening',beforeId:target.beforeId,raw:'I observe the cup.'}]);assert.ok(result.raw.indexOf('Title: Invented')<result.raw.indexOf('I observe the cup.'));assert.ok(result.raw.indexOf('I observe the cup.')<result.raw.indexOf('Retained notes.'));assert.ok(result.raw.endsWith('---\n\nRetained notes.'));assert.equal(result.raw.replace('I observe the cup.\n\n',''),raw);
});
test('normal first prose remains exact replacement while protected and nested structures are held',()=>{
 const plain=baseline('---\nkind: draft\n---\nI observe a cup.');assert.equal(openingProposalTarget(plain).id,plain.projection[0].id);for(const content of ['# Heading','> Quoted words.','%%protected%%','- Nested list','==Pending words==','%%photo: cup.jpg · Cup%%'])assert.throws(()=>openingProposalTarget(baseline('---\nkind: draft\n---\n'+content)),/protected|unsupported/);
});
test('altered projection bytes and ambiguous native separators refuse before a target is offered',()=>{
 const b=baseline('---\nkind: draft\n---\nI observe a cup.');b.projection[0].raw='Other words.';assert.throws(()=>openingProposalTarget(b),/bytes changed/);assert.throws(()=>openingProposalTarget(baseline('---\nkind: draft\n---\n---\nAmbiguous prose.')),/boundary|separator/);
});
