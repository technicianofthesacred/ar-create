// HTTP front of the transcript check (transcript-check.mjs). Mount: one registration line in runtime/server.mjs hands
// requests here and returns false for any other path. The page itself is public/transcript-check/.
import {StateError} from '../store.mjs';
import {requireWriteActor} from './actor.mjs';
import {createTranscriptCheck} from './transcript-check.mjs';
import {sharedWordLibrary} from './word-library.mjs';

const PREFIX='/api/transcript-check',MAX_BODY=256*1024;
const instances=new Map();
const fail=(message,status=400)=>{throw new StateError(message,status);};

export function transcriptCheckFor({dataDir,recordings,options={}}){
 let found=instances.get(dataDir);if(found)return found;
 const library=sharedWordLibrary({dataDir});
 const vocabulary=async()=>{const snapshot=await library.exportSnapshot();return snapshot?.prompts?.en?String(snapshot.prompts.en).replace(/^[^:]*:\s*/,''):'';};
 found=createTranscriptCheck({dataDir,corrections:recordings.transcriptCorrections,vocabulary,...options});
 instances.set(dataDir,found);return found;
}
export function stopTranscriptCheck(dataDir){instances.delete(dataDir);}

export async function handleTranscriptCheck(request,response,{dataDir,recordings,checkWrite}){
 const url=new URL(request.url||'/','http://local.invalid');
 if(url.pathname!==PREFIX&&!url.pathname.startsWith(PREFIX+'/'))return false;
 const send=(status,body)=>{response.arResult=body;response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(body));};
 try{
  const match=url.pathname.slice(PREFIX.length).match(/^\/([a-f0-9-]{36})(?:\/(suggest|decide|decide-group))?$/);
  if(!match)fail('Unknown transcript check action.',404);
  const [,id,action]=match,check=transcriptCheckFor({dataDir,recordings});
  if([...url.searchParams.keys()].length)fail('This request takes no query fields.');
  if(!action){if(request.method!=='GET'&&request.method!=='HEAD'){response.setHeader('Allow','GET');fail('Use GET.',405);}send(200,check.view(id));return true;}
  if(request.method!=='POST'){response.setHeader('Allow','POST');fail('Use POST.',405);}
  checkWrite?.();requireWriteActor();
  if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))fail('Use Content-Type: application/json.',415);
  const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY)fail('That is too large for one request.',413);chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{fail('Send the request as JSON.');}
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Send the request as a JSON object.');
  request.arInput=input;
  if(action==='suggest')send(202,await check.suggest(id,{again:input.again===true}));
  else if(action==='decide')send(200,await check.decide(id,input));
  else send(200,await check.decideGroup(id,input));
 }catch(error){send(Number.isInteger(error.status)&&error.status>=400&&error.status<600?error.status:500,{error:error.status?error.message:'The transcript check could not be read or saved. Nothing was changed.'});}
 return true;
}
