// HTTP front of the shared word library and its recording check. One instance per data folder, shared with the server's
// background watcher. Mount: one registration line in runtime/server.mjs hands requests here and returns false for any
// other path.
import {StateError} from '../store.mjs';
import {currentActor,requireWriteActor} from './actor.mjs';
import {sharedWordLibrary} from './word-library.mjs';
import {createSharedWords} from './shared-words.mjs';
import {sharedNeedsYou} from './needs-you.mjs';

const PREFIX='/api/words',MAX_BODY=256*1024;
const POST_ROUTES=['/add','/import','/decide','/recognise','/answer'];
const instances=new Map();
const fail=(message,status=400)=>{throw new StateError(message,status);};

/** The library and the recording check for one data folder. `recordings` is the recording owner (createRecordings). */
export function wordsFor({dataDir,events,recordings}){
 let found=instances.get(dataDir);
 if(found)return found;
 const emit=(kind,detail={})=>{const who=currentActor();events?.emit({kind:'words.'+kind,scope:{kind:'words',id:detail.jobId||'library'},revision:null,actor:who?.actor||'cron:shared-words',client:who?.client||null,operationId:null});};
 const library=sharedWordLibrary({dataDir});
 library.subscribe(emit);
 const shared=createSharedWords({dataDir,library,corrections:recordings.transcriptCorrections,needsYou:sharedNeedsYou({dataDir,events}),onChange:emit});
 found={library,shared};instances.set(dataDir,found);
 return found;
}
export function stopWords(dataDir){const found=instances.get(dataDir);if(found){found.shared.stop();instances.delete(dataDir);}}

export async function handleWords(request,response,{dataDir,events,recordings,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const {library,shared}=wordsFor({dataDir,events,recordings});
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 const only=(keys)=>{const extra=[...url.searchParams.keys()].find(k=>!keys.includes(k));if(extra)fail('Unknown query field: '+extra+'.');};
 try{
  const route=url.pathname.slice(PREFIX.length);
  if(request.method==='GET'||request.method==='HEAD'){
   const q=Object.fromEntries(url.searchParams);
   if(route===''){only(['q','category','status','limit']);send(200,await library.list(q));return true;}
   if(route==='/export'){only([]);send(200,await library.exportSnapshot());return true;}
   if(route==='/checks'){only(['all']);send(200,await shared.checks({all:q.all==='true'}));return true;}
   if(route==='/check'){only(['jobId']);send(200,await shared.check({jobId:q.jobId}));return true;}
   if(POST_ROUTES.includes(route)){response.setHeader('Allow','POST');fail('Use POST.',405);}
   fail('Unknown words action.',404);
  }
  const post={'/add':library.add,'/import':library.importFrom,'/decide':library.decide,'/recognise':shared.recognise,'/answer':shared.answer}[route];
  if(!post){if(['','/export','/checks','/check'].includes(route)){response.setHeader('Allow','GET');fail('Use GET.',405);}fail('Unknown words action.',404);}
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();requireWriteActor();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That is too large for one request.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('Send the request as JSON.');}
  request.arInput=input;
  send(200,await post(input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The word library could not be read or saved. Nothing was changed.'});}
 return true;
}
