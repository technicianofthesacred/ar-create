import test from 'node:test';
import assert from 'node:assert/strict';
import {capture,projection,apply} from '../runtime/services/draft-correspondence.mjs';
import {openingProposalTarget,proposalEditable,continuationProposalTarget} from '../runtime/services/native-proposal-capability.mjs';
const baseline=raw=>{const model=capture(raw,'invented-opening');return{raw,projection:projection(model).map((row,i)=>({...row,raw:model.blocks[i].raw})),model};};
test('opening replacement preserves donor-proven edge separators without admitting interior newlines or formatting',()=>{
 for(const edges of [['\n','\n'],['\r\n','\r\n'],[' ',' ']]){
  const raw='---\nkind: draft\n---\n'+edges[0]+'Invented opening words.'+edges[1],b=baseline(raw),row=b.projection[0];
  assert.equal(proposalEditable(row),true);
  const target=openingProposalTarget(b),result=apply(b.model,raw,[{kind:'text',id:target.id,from:0,to:row.words.length,insert:'Different invented words.',seenBlockHash:target.seenBlockHash}]);
  assert.equal(result.raw,raw.replace('Invented opening words.','Different invented words.'));
 }
 for(const text of ['First line.\nSecond line.','**Bold opening.**','First %%retained note%% second.','    Indented prose.']){
  const b=baseline('---\nkind: draft\n---\n'+text);assert.equal(proposalEditable(b.projection[0]),false);
 }
});
test('donor empty body insertion stays between metadata and retained footer at its stable boundary',()=>{
 const raw='---\nkind: draft\n---\n\nTitle: Invented\n\n---\n\n\n---\n\nRetained notes.',b=baseline(raw),target=openingProposalTarget(b);assert.equal(target.kind,'insert');assert.ok(target.beforeId);const result=apply(b.model,raw,[{kind:'insert',id:'fresh-invented-opening',beforeId:target.beforeId,raw:'I observe the cup.'}]);assert.ok(result.raw.indexOf('Title: Invented')<result.raw.indexOf('I observe the cup.'));assert.ok(result.raw.indexOf('I observe the cup.')<result.raw.indexOf('Retained notes.'));assert.ok(result.raw.endsWith('---\n\nRetained notes.'));assert.equal(result.raw.replace('I observe the cup.\n\n',''),raw);
});
test('normal first prose remains exact replacement while protected and nested structures are held',()=>{
 const plain=baseline('---\nkind: draft\n---\nI observe a cup.');assert.equal(openingProposalTarget(plain).id,plain.projection[0].id);for(const content of ['# Heading','> Quoted words.','%%protected%%','- Nested list','==Pending words==','%%photo: cup.jpg · Cup%%'])assert.throws(()=>openingProposalTarget(baseline('---\nkind: draft\n---\n'+content)),/protected|unsupported/);
});
test('altered projection bytes and ambiguous native separators refuse before a target is offered',()=>{
 const b=baseline('---\nkind: draft\n---\nI observe a cup.');b.projection[0].raw='Other words.';assert.throws(()=>openingProposalTarget(b),/bytes changed/);assert.throws(()=>openingProposalTarget(baseline('---\nkind: draft\n---\n---\nAmbiguous prose.')),/boundary|separator/);
});

test('continuation uses the accepted donor snapshot and holds extra scaffolds or altered stable identities',()=>{
 const b=baseline('---\nkind: draft\n---\n\nTitle: Invented\n\n---\n\n\n---\n\nRetained footer.'),openingTarget=openingProposalTarget(b),inserted=apply(b.model,b.raw,[{kind:'insert',id:'chosen-opening',beforeId:openingTarget.beforeId,raw:'I begin with the cup.'}]),current={raw:inserted.raw,projection:projection(inserted.snapshot).map((r,i)=>({...r,raw:inserted.snapshot.blocks[i].raw}))},row=current.projection.find(r=>r.id==='chosen-opening'),opening={id:row.id,words:row.words,blockHash:row.blockHash},target=continuationProposalTarget(current,opening,inserted.snapshot),continued=apply(inserted.snapshot,inserted.raw,[{kind:'insert',id:'new-1',beforeId:target.beforeId,raw:'I notice the quiet room.'},{kind:'insert',id:'new-2',beforeId:target.beforeId,raw:'I leave the reason uncertain.'}]);assert.ok(continued.raw.indexOf('quiet room')<continued.raw.indexOf('reason uncertain'));assert.equal(continued.raw.replace('I notice the quiet room.\n\n','').replace('I leave the reason uncertain.\n\n',''),inserted.raw);assert.throws(()=>continuationProposalTarget(current,{...opening,words:'Other opening.'},inserted.snapshot),/opening words changed/);const changed=structuredClone(inserted.snapshot);changed.blocks[0].id='foreign';assert.throws(()=>continuationProposalTarget(current,opening,changed),/stable block/);const expanded={raw:continued.raw,projection:projection(continued.snapshot).map((r,i)=>({...r,raw:continued.snapshot.blocks[i].raw}))};assert.throws(()=>continuationProposalTarget(expanded,opening,continued.snapshot),/additional|ambiguous/);
});
