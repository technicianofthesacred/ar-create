// HTTP front of the phone pickup. One instance per data folder, shared with the server's start-up check. Mount: one
// registration line in runtime/server.mjs hands requests here and returns false for any other path.
import {StateError} from '../store.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {createKeyReader,createPhonePickup} from './phone-pickup.mjs';
import {wordsFor} from './words-http.mjs';

const PREFIX='/api/phone-pickup';
const instances=new Map();
const fail=(message,status=400)=>{throw new StateError(message,status);};

/** The pickup's view of this AR Create: the Library, the recording owner and its own address for starting a saved job. */
export function localEngine({library,recordings,origin}){
 return {
  async ready(){const {capability}=await recordings.list();return {ready:capability?.ready===true,problem:capability?.problem||null};},
  async importAudio({name,bytes}){
   const result=await library.import({rootId:'library',folder:'Phone recordings',files:[{name,base64:bytes.toString('base64')}],urls:[]});
   const receipt=result.receipts?.[0];
   if(!receipt?.ok||!receipt.source)throw new Error(receipt?.error||'The recording could not be added to the Library.');
   await recordings.retain(receipt.source);
   return {sourceId:receipt.source.id};
  },
  async jobForSource(sourceId){const {jobs}=await recordings.list();return (jobs||[]).find(job=>job.sourceId===sourceId)||null;},
  async startJob(jobId){
   const base=origin();if(!base)throw new Error('AR Create is not listening yet.');
   const response=await fetch(base+'/transcription/'+encodeURIComponent(jobId)+'/start',{method:'POST',headers:{'Content-Type':'application/json','X-AR-Actor':'import:phone-pickup','X-AR-Client':'http'},body:'{}',signal:AbortSignal.timeout(20_000)});
   if(!response.ok&&response.status!==409)throw new Error('The transcription could not be started.');
  },
  async readResult(jobId){return {result:recordings.transcriptCorrections.read(jobId).result};},
 };
}

/** `options` (tests only): readKey, fetcher, local, baseUrl, now, watchMs. */
export function pickupFor({dataDir,events,recordings,library,origin=()=>null,options={}}){
 let found=instances.get(dataDir);
 if(found)return found;
 const emit=(kind,detail={})=>{const who=currentActor();events?.emit({kind:'phone-pickup.'+kind,scope:{kind:'phone-pickup',id:detail.state||'pickup'},revision:null,actor:who?.actor||'import:phone-pickup',client:who?.client||null,operationId:null});};
 found=createPhonePickup({
  dataDir,emit,
  readKey:options.readKey||createKeyReader(),
  fetcher:options.fetcher,
  baseUrl:options.baseUrl,
  now:options.now,
  watchMs:options.watchMs,
  local:options.local||localEngine({library,recordings,origin}),
  words:options.words===undefined?wordsFor({dataDir,events,recordings}).shared:options.words,
 });
 instances.set(dataDir,found);
 return found;
}
export function stopPickup(dataDir){const found=instances.get(dataDir);if(found){found.stop();instances.delete(dataDir);}}

export async function handlePhonePickup(request,response,{dataDir,events,recordings,library,origin,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const pickup=pickupFor({dataDir,events,recordings,library,origin});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  const route=url.pathname.slice(PREFIX.length);
  if(request.method==='GET'||request.method==='HEAD'){
   if([...url.searchParams.keys()].length)fail('This read takes no parameters.');
   if(route===''){send(200,await pickup.status());return true;}
   if(route==='/setup'){send(200,pickup.setup());return true;}
   if(route==='/check'){response.setHeader('Allow','POST');fail('Use POST.',405);}
   fail('Unknown phone pickup action.',404);
  }
  if(route!=='/check')fail(['','/setup'].includes(route)?'Use GET.':'Unknown phone pickup action.',['','/setup'].includes(route)?405:404);
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();requireWriteActor();
  const who=currentActor();
  request.arInput={};
  send(200,await pickup.check({reason:who?.client==='ui'?'button':'command'}));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The phone pickup could not run. Nothing was changed.'});}
 return true;
}
