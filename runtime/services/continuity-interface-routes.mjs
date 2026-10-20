const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const fields=(value,required,optional=[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||required.some(k=>!Object.hasOwn(value,k))||Object.keys(value).some(k=>![...required,...optional].includes(k)))fail('Use only the explicit continuity fields.');};
const methods={read:['scope'],seen:['scope','operationId','expected','expectedWork','actor','viewerId'],assign:['scope','operationId','expected','expectedWork','actor','assignment'],result:['scope','operationId','expected','expectedWork','actor','assignmentId','outcome','reportedChanges'],complete:['scope','operationId','expected','expectedWork','actor','completion'],undo:['scope','operationId','expected','expectedWork','actor','undoOperationId'],recover:['scope'],context:['scope','assignmentId','preparedText','humanText']};
/** Finite local metadata routes. The host retains authentication/Host policy. */
export function createContinuityInterfaceRoutes({continuity,understanding,outputExports,origin,prefix='/api/work-continuity'}={}){
 if(!continuity?.read||!understanding?.resolve)throw Error('Supply actual maintained continuity and understanding owners.');
 const calls={read:input=>continuity.read(input),seen:input=>continuity.recordSeen(input),assign:input=>continuity.assign(input),result:input=>continuity.result(input),complete:input=>continuity.complete(input),undo:input=>continuity.undo(input),recover:input=>continuity.recover(input),context:input=>continuity.validateAssignmentContext(input)};
 async function dispatch(operation,input){
  input=structuredClone(input);
  if(operation==='understanding'){fields(input,['request']);return understanding.resolve(input.request);}
  if(operation==='artifacts'){
   fields(input,['scope']);const current=await continuity.read(input),s=current.scope;if(s.kind!=='piece')return {artifacts:[]};
   if(!outputExports?.list)fail('Existing scoped exports are unavailable.',503);
   const list=await outputExports.list({rootBindingId:s.rootBindingId,parentStudyId:s.parentStudyId,selectedOutputId:s.outputId});
   const artifacts=[...(list.artifacts||[]).map(a=>({...a,format:'article'})),...(list.exports||[]).filter(a=>a.status==='complete').map(a=>({...a,format:'carousel'}))].filter(a=>a.outputId===s.outputId&&UUID.test(a.id||''));
   return {artifacts:artifacts.map(a=>({id:a.id,format:a.format,createdAt:a.createdAt,outputRevision:a.outputRevision,manuscriptRevision:a.manuscriptRevision,fileCount:a.format==='carousel'?a.files?.length:1,contentVerification:a.contentVerification||'not-declared',publicationVerified:false}))};
  }
  if(!Object.hasOwn(calls,operation))fail('Unknown continuity action.',404);
  fields(input,methods[operation],operation==='read'?['viewerId']:operation==='seen'?['position']:[]);
  return calls[operation](input);
 }
 async function handle(req,res){
  const pathname=new URL(req.url,'http://local.invalid').pathname;if(!pathname.startsWith(prefix+'/'))return false;
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  try{
   if(req.method!=='POST')fail('Use an explicit local POST for this action.',405);
   if(req.headers.origin&&req.headers.origin!==(origin||new URL(req.url,'http://'+req.headers.host).origin))fail('Foreign-origin continuity request refused.',403);
   const operation=pathname.slice(prefix.length+1);if(![...Object.keys(calls),'understanding','artifacts'].includes(operation))fail('Unknown continuity action.',404);
   const chunks=[];let size=0;for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>256*1024)fail('Continuity request is too large.',413);chunks.push(bytes);}
   let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('A bounded JSON request is required.');}
   send(200,await dispatch(operation,input));
  }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<=599?error.status:409,{error:error.message||'Continuity action was held.',outcome:'not-applied'});}
  return true;
 }
 return {dispatch,handle};
}
