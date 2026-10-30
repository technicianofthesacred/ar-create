// Reuse the configured original-to-subject relationship; titles confer no ownership.
import {StateError} from '../../store.mjs';
export function createSourcedSubjectGuard({originals,working}){
 return ({parentStudyId,authority,draftHash})=>{
  if(!originals?.catalog||!originals.checkInputs||!working?.catalog)throw new StateError('This piece’s subject sources are not connected.',503);
  const rows=originals.catalog().filter(row=>row.path===authority?.path);
  if(rows.length!==1||rows[0].parentStudyKey!==parentStudyId||rows[0].partKey!==authority.partKey||rows[0].originalHash!==draftHash)throw new StateError('The piece and subject source relationship changed.',409);
  const result=originals.checkInputs({parentStudyKey:parentStudyId,partKey:rows[0].partKey,draftPath:authority.path,expectedDraftHash:draftHash}),root=working.catalog().rootIdentity;
  if(!root||result.rootIdentity?.scheme!==root.scheme||result.rootIdentity.fingerprint!==root.fingerprint)throw new StateError('The piece and subject sources belong to different original folders.',409);
  return result;
 };
}
