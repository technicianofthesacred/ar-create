import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {systemAliasPath} from './files.mjs';
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function checked(root,rel){
 if(typeof rel!=='string'||!rel||path.isAbsolute(rel)||rel.includes('\\')||rel.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.')||p.includes('.sync-conflict-')))throw Error('Invalid retained transcript relative path.');
 let file=root;
 for(const part of rel.split('/')){file=path.join(file,part);const stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Retained transcript links are refused.');}
 const stat=fs.lstatSync(file);if(!stat.isFile()||stat.nlink!==1||stat.size>2*1024*1024)throw Error('Retained transcript must be a bounded regular text file.');return file;
}
const stamp=s=>`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
function json(file,cache){const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>64*1024*1024)throw Error('Transcript catalog must be bounded regular JSON.');const key=stamp(stat),saved=cache.get(file);if(saved?.stamp===key)return saved.value;const value=JSON.parse(fs.readFileSync(file,'utf8'));if(stamp(fs.lstatSync(file))!==key)throw Error('Transcript catalog changed during read.');cache.set(file,{stamp:key,value});return value;}
/** Read-only projection of the owner's kept sessions; no copied transcript authority. */
export function createRetainedTranscriptCatalog({registryFile,indexFile,libraryRoot}={}){
 for(const p of [registryFile,indexFile,libraryRoot])if(typeof p!=='string'||!path.isAbsolute(p))throw Error('Explicit transcript catalog paths are required.');
 const jsonCache=new Map();
 return {id:'kept-transcripts',name:'Kept conversations',path:libraryRoot,entries(){
 const root=fs.lstatSync(libraryRoot);if(!root.isDirectory()||root.isSymbolicLink()||fs.realpathSync(libraryRoot)!==systemAliasPath(libraryRoot))throw Error('Transcript library must be an explicit real folder.');
  const registry=json(registryFile,jsonCache),index=json(indexFile,jsonCache);
  if(registry.schema!=='ar-create.transcript-manager.v1'||!Array.isArray(registry.sessions)||registry.sessions.length>10000||!Array.isArray(index.sources)||index.sources.length>20000)throw Error('Unsupported transcript catalog.');
  const sources=new Map();for(const row of index.sources){if(sources.has(row.id))throw Error('Ambiguous transcript source identity.');sources.set(row.id,row);}
  const ids=new Set(),paths=new Set(),sessions=new Set(),entries=[];
  for(const session of registry.sessions.filter(s=>s.editorial==='keep')){
   const row=sources.get(session.sourceId);
   if(!row||!UUID.test(session.sourceId)||row.rootId!=='library'||row.missing||typeof session.id!=='string'||!Array.isArray(session.turns)||session.turns.length>20000||ids.has(row.id)||paths.has(row.rel_path)||sessions.has(session.id))throw Error('Kept transcript identity is missing or ambiguous.');
   if(!/\.(txt|md|markdown)$/i.test(row.rel_path||''))throw Error('Kept transcript must be readable text.');
   const file=checked(libraryRoot,row.rel_path);let start=0;const turns=[];
   const text=session.turns.map(turn=>{
    if(typeof turn.id!=='string'||typeof turn.speaker!=='string'||typeof turn.text!=='string')throw Error('Invalid transcript turn.');
    const line=turn.speaker+': '+turn.text;const boundary=typeof turn.originalText==='string'&&turn.originalText.startsWith('[Editorial session boundary, not spoken dialogue]');
    turns.push({turnId:turn.id,speaker:turn.speaker,speakerIdentity:boundary?'editorial-boundary':'unmapped',kind:boundary?'session-boundary':'speech',start,end:start+line.length,timestamp:turn.timestamp??null,language:turn.language??null,mediaReference:turn.mediaReference??null});start+=line.length+2;return line;
   }).join('\n\n')+'\n';
   const bytes=fs.readFileSync(file);if(bytes.toString('utf8')!==text)throw Error('Kept transcript file differs from its owner session; review before connecting.');
   ids.add(row.id);paths.add(row.rel_path);sessions.add(session.id);
   entries.push({id:row.id,rel_path:row.rel_path,title:typeof session.title==='string'?session.title:path.basename(row.rel_path),transcriptProvenance:{authority:'retained-transcript-manager',sessionId:session.id,externalId:session.externalId??null,importIdentity:session.importIdentity??null,registryRevision:registry.revision,workingSourceId:row.id,workingHash:hash(bytes),originalSourceId:session.originalSourceId??null,date:session.date??null,location:session.location??null,version:session.version??null,workingLanguage:'owner-working-text',originalLanguage:{available:session.turns.some(t=>typeof t.originalText==='string'&&t.originalText!==t.text),authority:'registry-turn-originalText',readableViaThisConnection:false},translationFile:null,audioLinked:turns.some(t=>t.mediaReference!==null),speakerAttribution:'Unmapped labels; do not assume a speaker is the author.',timestamps:'Provider/session labels; not verified audio alignment.',turns}});
  }
  return entries;
 }};
}
