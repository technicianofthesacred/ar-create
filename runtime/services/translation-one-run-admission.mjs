// Metadata-only, durable one-attempt admission. A failed attempt remains consumed.
import fs from 'node:fs';
import path from 'node:path';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const fail=(message,status=503)=>{throw Object.assign(Error(message),{status});};
function realDirectories(directory){
 const resolved=path.resolve(directory),parts=resolved.split(path.sep).filter(Boolean);let at=path.parse(resolved).root;
 for(const part of parts){at=path.join(at,part);const stat=fs.lstatSync(at);if(!stat.isDirectory()||stat.isSymbolicLink())fail('One-use translation admission requires trusted real directories.');}
 return resolved;
}
export function createTranslationOneRunAdmission({oneRunId,dataDir,scope}={}){
 if(oneRunId===undefined)return ()=>{};
 if(!uuid(oneRunId)||!['owner','proxy'].includes(scope))fail('One-use translation admission requires its explicit UUID and scope.');
 const id=oneRunId.toLowerCase();
 return ()=>{
  if(typeof dataDir!=='string'||!path.isAbsolute(dataDir))fail('One-use translation admission requires the trusted imported owner data directory.');
  let directory;
  try{
   const root=realDirectories(dataDir);directory=path.join(root,'.translation-one-run-admissions');
   try{fs.mkdirSync(directory,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
   realDirectories(directory);
   const file=path.join(directory,scope+'-'+id+'.json');let fd;
   try{fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);}catch(error){if(error.code==='EEXIST')fail('This one-use translation attempt has already been consumed. A new explicit grant is required.',409);throw error;}
   // Never remove or retry a partial receipt: any attempted admission is spent.
   try{fs.writeFileSync(fd,JSON.stringify({schema:'ar-create.translation-one-run.v1',oneRunId:id,scope,consumedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   const parent=fs.openSync(directory,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}
   realDirectories(directory);
  }catch(error){if(error.status)throw error;fail('One-use translation admission could not be recorded safely. No automatic retry is permitted.');}
 };
}
