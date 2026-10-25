import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {createHash} from 'node:crypto';
import {createLibrary} from './library.mjs';
import {createTranscriptManager} from './imported-transcript-manager.mjs';
import * as files from './files.mjs';
import {StateError} from '../store.mjs';
import {createKeptSourceTranslationReview} from './kept-source-translation-review.mjs';
import {createKeptSourceTranslationRequests} from './kept-source-translation-requests.mjs';
const fail=(message,status=409)=>{throw new StateError(message,status);};
const sha=value=>createHash('sha256').update(value).digest('hex');
function readJson(file,max=4*1024*1024){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>max)fail('The source connection record is unavailable. Existing files were preserved.');return JSON.parse(fs.readFileSync(file,'utf8'));}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
function same(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function stripped(session){const {sourceHash,originalUrl,staleSelections,...saved}=session;return saved;}
/** A bounded projection of the maintained owner; never expose import/delete/group. */
export function createSourceSessions({manager,notesFile=null,translationConfig=null,translationAdmissionDataDir=null,translationReviewConfig=null}){
 let queue=Promise.resolve();
 const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 function notesFor(sessions){
  if(!notesFile)return {notes:{},notesState:'unavailable'};
  try{const raw=readJson(notesFile),records=raw.records&&typeof raw.records==='object'?raw.records:raw;const notes={};for(const session of sessions)if(Object.hasOwn(records,session.id))notes[session.id]=structuredClone(records[session.id]);return {notes,notesState:'available'};}
  catch{return {notes:{},notesState:'unavailable'};}
 }
 async function projection(){
  const state=await manager.api.list(),kept=state.sessions.filter(s=>s.editorial==='keep');
  const sessions=kept.map(session=>{const undo=[...state.history].reverse().find(h=>h.sessionId===session.id&&h.reason==='human-correction'&&h.operationId&&!h.undoneBy&&h.afterHash===session.sourceHash&&same(h.after,stripped(session)));return {id:session.id,title:session.title,date:session.date,location:session.location,sourceId:session.sourceId,sourceHash:session.sourceHash,version:session.version,turns:session.turns.map(turn=>structuredClone(turn)),...(undo?{undoOperationId:undo.operationId}:{})};});
  return {revision:state.revision,sessions,...notesFor(sessions)};
 }
 function inputFor(action,input){
  const keys=action==='edit'?['operationId','expectedRevision','expectedSourceHash','sessionId','turnId','speaker','text']:['operationId','undoOperationId','expectedRevision','expectedSourceHash','sessionId'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))fail('Use the current source, revision and complete correction request.',400);
 }
 async function mutate(action,input){
  inputFor(action,input);const state=await manager.api.list(),session=state.sessions.find(s=>s.id===input.sessionId&&s.editorial==='keep');
  if(!session)fail('This conversation is not in the kept Source collection.',404);
  // The owner validates current disk revision/hash and idempotent operation
  // identity again under its own exclusive lock. Never refresh caller guards.
  return manager.api[action](input);
 }
 const list=()=>serial(projection),translation=createKeptSourceTranslationRequests({read:list,config:translationConfig,admissionDataDir:translationAdmissionDataDir});
 const review=createKeptSourceTranslationReview({read:list,config:translationReviewConfig});
 return {list,readTranslationReview:input=>review.read(input),proposeTranslation:input=>translation.propose(input),edit:input=>serial(()=>mutate('edit',input)),undo:input=>serial(()=>mutate('undo',input))};
}
async function listening(port){return new Promise(resolve=>{const socket=net.createConnection({host:'127.0.0.1',port});socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>{socket.destroy();resolve(false);});socket.once('timeout',()=>{socket.destroy();resolve(false);});});}
/** Explicit private startup authority. Data stays in the maintained owner's home. */
export async function createImportedSourceOwner(config){
 if(!config||!['dataDir','notesFile','handoverFile'].every(k=>typeof config[k]==='string'&&path.isAbsolute(config[k]))||!Array.isArray(config.connections))fail('Explicit imported Source ownership configuration is required.');
 const handover=readJson(config.handoverFile);
 if(handover.schema!=='ar-create.source-owner-handover.v1'||handover.state!=='legacy-disabled'||handover.dataDir!==config.dataDir||typeof handover.disabledStartFile!=='string'||!path.isAbsolute(handover.disabledStartFile)||typeof handover.disabledStartSha256!=='string'||handover.legacyPort!==8927)fail('The imported Source owner handover is not verified.');
 const entrypoints=[{file:handover.disabledStartFile,sha256:handover.disabledStartSha256},...(handover.disabledEntrypoints||[])];
 if(!Array.isArray(handover.disabledEntrypoints)||handover.disabledEntrypoints.length<2||handover.disabledEntrypoints.length>8)fail('The prior Source entrypoints are not fenced.');
 for(const entry of entrypoints){if(typeof entry.file!=='string'||!path.isAbsolute(entry.file)||typeof entry.sha256!=='string')fail('A prior Source entrypoint identity is invalid.');const stat=fs.lstatSync(entry.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||sha(fs.readFileSync(entry.file))!==entry.sha256)fail('The previous transcript writer has not handed over. Source editing remains unavailable.');}
 if(await listening(handover.legacyPort))fail('The previous transcript writer is still running. Source editing remains unavailable.');
 const library=createLibrary({dataDir:config.dataDir,connections:config.connections});
 const manager=createTranscriptManager({dataDir:config.dataDir,library,files,StateError,requests:{preview:()=>fail('Source selection uses the existing project connection.')},store:{get:()=>({project:{id:'source-owner'}})}});
 return createSourceSessions({manager,notesFile:config.notesFile,translationConfig:config.translation?{translation:config.translation}:null,translationAdmissionDataDir:config.dataDir,translationReviewConfig:config.translationReview});
}
