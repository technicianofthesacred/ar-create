import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMagazineMediaUsage} from '../runtime/services/magazine-media-usage.mjs';

const H='a'.repeat(64), B='b'.repeat(64), C='c'.repeat(64);
const ownerRef={projectId:'story',pieceId:'story:article',editionId:'working',artifactId:'draft',hash:H};
const publication={kind:'publication',rootId:B,relativePath:'read/story/photo.png'};
const library={kind:'library',rootId:C,sourceId:'library-photo-1'};
const sourceRef=(originRef,hash=B)=>({rootId:originRef.rootId,sourceId:'inspected-'+originRef.rootId+'-'+(originRef.relativePath||originRef.sourceId),relativePath:originRef.kind==='library'?'library/photo.png':originRef.relativePath,hash});
const placement=(id,structuralPath,originRef=publication)=>({placementId:id,projectId:'story',pieceId:'story:article',outputId:'story:article',editionId:'working',hash:H,structuralPath,slot:id,sourceRef:sourceRef(originRef),nativeOrigin:{blockId:'block',groupIndex:id==='one'?0:1,offsetUnit:'utf16'}});
const catalog=(items,coverage={complete:true,truncated:false})=>({schema:'ar-create.magazine-library-photos.v1',revision:C,coverage,items});
const item=(sourceId,originRef,sourceHash=B)=>({rootId:originRef.rootId,sourceId,revision:C,sourceHash,name:sourceId,originRef});
const inspection=(sources,originTrace={status:'ready'})=>({schema:'ar-create.magazine-media-inspection.v1',revision:B,ownerRef,originTrace,sources});
const source=(id,originRef,placements,hash=B)=>({id,name:id,sourceRef:sourceRef(originRef,hash),originRef,ownerRef,placements});
const project=(cat,inspect,overrides={})=>projectMagazineMediaUsage({catalog:cat,inspection:inspect,expectedOwnerRef:ownerRef,expectedCatalogRevision:C,...overrides});

test('joins only owner-backed identities and preserves repeated structural/native occurrences',()=>{
 const pub=item('publication-photo',publication),copy=item('same-bytes-other-origin',{kind:'publication',rootId:C,relativePath:publication.relativePath}),retained=item('retained-photo',library);
 const rows=[placement('one','opening/0/photos/0'),placement('two','opening/0/photos/1')];
 const result=project(catalog([pub,copy,retained]),inspection([source('publication-inspection',publication,rows),source('retained-inspection',library,[placement('three','ending/shot',library)])]));
 assert.equal(result.status,'complete');assert.deepEqual(result.items.map(row=>row.usage.status),['used','not-used-in-article','used']);
 assert.equal(result.items[0].usage.count,2);assert.deepEqual(result.items[0].usage.placements.map(p=>p.structuralPath),['opening/0/photos/0','opening/0/photos/1']);
 assert.equal(result.items[0].usage.placements[1].nativeOrigin.groupIndex,1);
 assert.equal(result.items[1].usage.count,0);assert.equal(result.items[2].usage.count,1);
 assert.equal(Object.isFrozen(result.items[0].usage.placements[0].nativeOrigin),true);
 rows[0].structuralPath='changed';pub.name='changed';assert.equal(result.items[0].usage.placements[0].structuralPath,'opening/0/photos/0');assert.equal(result.items[0].name,'publication-photo');
});

test('same hash never joins different provenance or an unrecorded original Photos source',()=>{
 const original=item('original-photo',{kind:'originals',rootId:B,sourceId:'camera-1'});
 const noOrigin={...item('unknown-photo',publication)};delete noOrigin.originRef;
 const result=project(catalog([original,noOrigin]),inspection([source('used',publication,[placement('one','portrait')])]));
 assert.deepEqual(result.items.map(row=>row.usage.status),['unmapped','unmapped']);
 assert.equal(result.items[0].usage.count,null);assert.equal(result.items[1].usage.count,null);
 assert.equal(result.unlistedSources.length,1);assert.equal(result.status,'partial');
});

test('partial catalog and unsupported inspection never claim a global or article unused state',()=>{
 const pub=item('unused',publication);
 const partial=project(catalog([pub],{complete:false,truncated:true,issues:[{source:'publication',reason:'scan-limit'}]}),inspection([]));
 assert.equal(partial.status,'partial');assert.equal(partial.items[0].usage.status,'unavailable');assert.equal(partial.items[0].usage.count,null);
 const unsupported=project(catalog([pub]),{schema:'ar-create.magazine-media-inspection.v1',ownerRef,revision:B,sources:null});
 assert.equal(unsupported.status,'unsupported');assert.equal(unsupported.items[0].usage.status,'unavailable');
});

test('stale draft owner, catalog revision and changed source hash refuse counts',()=>{
 const cat=catalog([item('photo',publication)]),ins=inspection([source('photo',publication,[placement('one','portrait')])]);
 for(const overrides of [{expectedOwnerRef:{...ownerRef,hash:B}},{expectedCatalogRevision:B}]){
  const result=project(cat,ins,overrides);assert.equal(result.status,'stale');assert.equal(result.items[0].usage.status,'unavailable');assert.equal(result.items[0].usage.count,null);
 }
 const changed=project(cat,inspection([source('photo',publication,[placement('one','portrait')],C)]));
 assert.equal(changed.status,'partial');assert.equal(changed.items[0].usage.status,'unavailable');assert.equal(changed.items[0].usage.count,null);
});

test('wrong placement owner and missing catalog source remain visible but cannot be joined',()=>{
 const wrong={...placement('one','portrait'),hash:C};
 const result=project(catalog([item('photo',publication)]),inspection([source('photo',publication,[wrong]),source('missing',{kind:'publication',rootId:B,relativePath:'read/story/missing.png'},[placement('two','ending/shot')])]));
 assert.equal(result.status,'partial');assert.equal(result.items[0].usage.status,'unavailable');assert.equal(result.unlistedSources.length,1);
});

test('a placement cannot borrow another origin or repeat an occurrence identity',()=>{
 const other={kind:'publication',rootId:C,relativePath:publication.relativePath};
 for(const placements of [[placement('one','portrait',other)],[placement('one','portrait'),placement('one','ending/shot')]]){
  const result=project(catalog([item('photo',publication)]),inspection([source('photo',publication,placements)]));
  assert.equal(result.status,'partial');assert.equal(result.items[0].usage.status,'unavailable');assert.equal(result.items[0].usage.count,null);
 }
});

test('an unidentified inspection source prevents false zero for otherwise unmatched photos',()=>{
 const known=item('known',publication),other=item('other',{kind:'publication',rootId:B,relativePath:'read/story/other.png'});
 const unidentified=source('unidentified',publication,[placement('one','portrait')]);delete unidentified.originRef;
 const result=project(catalog([known,other]),inspection([unidentified]));
 assert.equal(result.status,'partial');assert.deepEqual(result.items.map(row=>row.usage.status),['unavailable','unavailable']);
 assert.deepEqual(result.items.map(row=>row.usage.count),[null,null]);
});

test('incomplete captured owner and malformed revision are rejected',()=>{
 const cat=catalog([item('photo',publication)]),ins=inspection([]);
 for(const bad of [{...ownerRef,projectId:''},{...ownerRef,pieceId:''},{...ownerRef,artifactId:''},{...ownerRef,hash:'short'}])assert.throws(()=>project(cat,ins,{expectedOwnerRef:bad}),TypeError);
 assert.throws(()=>project({...cat,revision:'short'},ins),TypeError);
 assert.throws(()=>project(cat,{...ins,revision:'short'}),TypeError);
});


test('pending publication discovery joins usage only with the exact current metadata revision and origin',()=>{const pending={...item('photo',publication,null),metadataRevision:C,byteVerification:'pending',selectable:false},inspected={...source('photo',publication,[placement('one','portrait')]),metadataRevision:C};const valid=project(catalog([pending]),inspection([inspected]));assert.equal(valid.items[0].usage.status,'used');assert.equal(valid.items[0].usage.count,1);assert.equal(valid.items[0].sourceHash,null);assert.equal(valid.items[0].selectable,false);for(const change of [{metadataRevision:B},{metadataRevision:null},{originRef:{...publication,rootId:C}}]){const result=project(catalog([pending]),inspection([{...inspected,...change}]));assert.notEqual(result.items[0].usage.status,'used');}const untyped=project(catalog([{...pending,byteVerification:'verified'}]),inspection([inspected]));assert.notEqual(untyped.items[0].usage.status,'used');});
