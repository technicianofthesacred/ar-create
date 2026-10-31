import {StateError} from '../store.mjs';import {digest} from './files.mjs';import {parsePreparedDirections} from '../../public/lib/direction-choice.js';
const fail=(message,status=409)=>{throw new StateError(message,status);};
/** Read proposals from existing verified analysis or exact captured maps. No generation or choice. */
export function createStudyDirectionOptions({drafts,bindings,firstFlow}){
 return async input=>{
  if(!input||Object.keys(input).sort().join(',')!=='bindingId,parentStudyId')fail('Choose an exact native subject and part.',400);
  const document=await drafts.read(input);if(document.binding?.id!==input.bindingId||document.binding.parentStudyId!==input.parentStudyId||document.readiness?.ready!==true)fail('Direction belongs to another native subject.');
  const parent=await bindings.lookup({projectKey:input.parentStudyId});let analysis;
  try{analysis=await firstFlow.context({projectId:parent.projectId});}catch(error){if(error.status!==404&&!(error.status===409&&error.message==='Research artifacts are unverified or incomplete; held until the existing owner finalizes them.'))throw error;}
  if(analysis?.available){
   if(analysis.projectId!==parent.projectId||analysis.documentId!==parent.documentId||!Array.isArray(analysis.directions)||analysis.directions.length<2||analysis.directions.length>3)fail('The saved direction proposals belong to another parent.');
   const source={artifactId:'first-flow:'+analysis.requestId,hash:analysis.resultHash},rows=analysis.directions;
   if(rows.some(row=>typeof row.angle!=='string'||!row.angle.trim()||row.angle.length>2048||typeof row.title!=='string'||!row.title.trim()||row.title.length>2048))fail('Saved proposals need a bounded editable angle and title.');
   return {...input,source,angles:rows.map((row,i)=>({id:'angle:'+(i+1),text:row.angle,description:row.reason||''})),titles:rows.map((row,i)=>({id:'title:'+(i+1),text:row.title})),role:'source-linked-proposals-not-adopted'};
  }
  const maps=(document.context?.records||[]).filter(r=>['map','plan'].includes(r.role)&&!r.missing&&typeof r.raw==='string'&&r.copiedHash===digest(r.raw));if(maps.length!==1)fail('Prepare a shared research brief for this subject first.',404);
  const row=maps[0],options=parsePreparedDirections(row.raw,{artifactId:row.id,hash:row.copiedHash});if(!options.angles.length||!options.titles.length)fail('The captured map has no prepared angle and title choices.',404);return {...input,...options,role:'captured-proposals-not-adopted'};
 };
}
