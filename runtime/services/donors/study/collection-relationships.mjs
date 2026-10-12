// Adapted from i64os apps/core/lib/continuity/relationships.ts createRelationship
// (different endpoints, available endpoints, duplicate live edge) and
// listRelationshipsPage (both endpoints and opposite-artifact resolution).
// Collection-only references and owned storage replace donor DB/tenant/runtime.
import {StateError} from '../../../store.mjs';
export function collectionEndpoint(collections,id){
 if(typeof id!=='string'||!id.trim())throw new StateError('Collection ID is required.');
 const collection=collections.find(item=>item.id===id);
 if(!collection)throw new StateError('Collection was not found. Refresh before linking.',404);
 return collection;
}
export function collectionPair(collections,sourceId,destinationId){
 const source=collectionEndpoint(collections,sourceId),destination=collectionEndpoint(collections,destinationId);
 if(source.id===destination.id)throw new StateError('A relationship must connect two different collections.');
 return{source,destination};
}
// relates-to has no directional meaning: reverse linking must be idempotent too.
export function liveCollectionLink(relationships,sourceId,destinationId){return relationships.find(item=>item.status==='accepted'&&((item.sourceId===sourceId&&item.destinationId===destinationId)||(item.sourceId===destinationId&&item.destinationId===sourceId)));}
export function resolvedCollectionLinks(relationships,collections,collectionId){
 collectionEndpoint(collections,collectionId);
 return relationships.filter(item=>item.status==='accepted'&&(item.sourceId===collectionId||item.destinationId===collectionId)).map(item=>{
  const role=item.sourceId===collectionId?'source':'destination',otherId=role==='source'?item.destinationId:item.sourceId,other=collections.find(c=>c.id===otherId);
  return{...item,role,other:other?{id:other.id,name:other.name}:{id:otherId,name:role==='source'?item.destinationLabel:item.sourceLabel},availability:other?'available':'missing'};
 });
}
