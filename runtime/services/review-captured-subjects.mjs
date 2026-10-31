// Metadata projection only. The captured source files remain with their native
// owner; a board row never imports words or confers editorial approval.
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i,HASH=/^[a-f0-9]{64}$/i;
export function projectCapturedSubjects({catalog={},workspaceLinks}={}){
 const excluded=new Set(catalog.excludedProjectIds||[]),out=[];
 for(const root of catalog.collections||[]){
  if(root.kind!=='collection-root'||root.bindingStatus!=='ready'||!UUID.test(root.bindingId||'')||typeof root.parentStudyId!=='string'||excluded.has(root.parentStudyId)||!Array.isArray(root.capturedRecords))continue;
  const records=root.capturedRecords.map(r=>{
   if(typeof r.id!=='string'||!r.id||typeof r.role!=='string'||typeof r.fileName!=='string'||typeof r.title!=='string'||typeof r.kind!=='string'||!r.missing&&!HASH.test(r.hash||''))throw Error('Native captured record metadata is incomplete.');
   return {id:r.id,role:r.role,kind:r.kind,title:r.title,fileName:r.fileName,hash:r.hash??null,missing:!!r.missing,authority:'native-owned-capture',readOnly:true};
  }).filter(r=>r.role!=='draft');
  const projects=new Set([root.parentStudyId]);for(const piece of workspaceLinks?.pieces||[])for(const target of piece.targets||[])if(target.rootBindingId===root.bindingId&&target.parentStudyId===root.parentStudyId&&target.workspaceId===piece.workspaceId)projects.add(piece.workspaceId);
  out.push({rootBindingId:root.bindingId,parentStudyId:root.parentStudyId,projectIds:[...projects],title:root.title,origin:root.origin||null,records});
 }
 return out;
}
