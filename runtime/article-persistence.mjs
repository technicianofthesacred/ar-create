import {mkdir,lstat,readFile,open,unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {structuredMarkdown} from './src/workspaces/structured-markdown.mjs';
import {renderCarouselWords} from './src/workspaces/shared-carousel-words.mjs';

export const articleHash=value=>createHash('sha256').update(value).digest('hex');
const json=value=>JSON.stringify(value);
export const encodedArticleIdentity=value=>encodeURIComponent(value);
const identity=encodedArticleIdentity;
/** Readable words with stable anchors. Full editorial identity stays in article.json. */
export function renderProjectArticle(project){
 const document=project.document;
 if(!document)return `<!-- ar-create:article v1 project=${identity(project.id)} document=legacy -->\n# ${project.title}\n\n${project.draft}\n\n<!-- ar-create:end -->\n`;
 return renderArticle(document,project.id);
}
export function renderArticle(document,projectId){
 return `<!-- ar-create:article v1 project=${identity(projectId)} document=${identity(document.id)} -->\n# ${document.title}\n\n`+document.paragraphs.map(paragraph=>`<!-- ar-create:passage ${identity(paragraph.id)} -->\n${structuredMarkdown(paragraph.doc)}\n\n`).join('')+'<!-- ar-create:end -->\n';
}
export function articlePaths(dataDir,project){
 const directory=path.join(dataDir,'articles',articleHash(project.id),articleHash(project.document?.id||'legacy'));
 return {directory,markdown:path.join(directory,'article.md'),companion:path.join(directory,'article.json')};
}
export function carouselWordsPaths(dataDir,project,output){
 const directory=path.join(articlePaths(dataDir,project).directory,'carousels',articleHash(output.id));
 return {directory,markdown:path.join(directory,'words.md'),companion:articlePaths(dataDir,project).companion};
}

export function articleBytes(project){
 const raw=renderProjectArticle(project);
 return {raw,companion:json({schema:'ar-create.article-bundle.v1',carouselWordsVersion:1,projectId:project.id,documentId:project.document?.id||null,projectHash:articleHash(json(project)),markdownHash:articleHash(raw),project})};
}

/** A cooperating store owner, not an arbitrary editor/process synchronizer. */
export async function createArticlePersistence({dataDir,atomicWrite,StateError,fault}){
 dataDir=path.resolve(dataDir);
 const journal=path.join(dataDir,'article-publication.pending.json'),ownerFile=path.join(dataDir,'article-owner.json');
 const owner={schema:'ar-create.article-owner.v1',pid:process.pid,id:randomUUID()};
 const fail=message=>{throw new StateError(message,409);};
 async function safeDirectory(directory){
  const relative=path.relative(dataDir,directory);if(relative.startsWith('..')||path.isAbsolute(relative))fail('Article path is outside owned storage.');
  let current=dataDir;for(const part of ['.',...relative.split(path.sep).filter(Boolean)]){
   current=path.resolve(current,part);try{await mkdir(current,{mode:0o700});}catch(error){if(error.code!=='EEXIST')throw error;}
   const stat=await lstat(current);if(!stat.isDirectory()||stat.isSymbolicLink())fail('Article directories must be real private directories.');
  }
 }
 async function bytes(file){
  await safeDirectory(path.dirname(file));try{const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('Article publication requires ordinary private files.');return await readFile(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 async function acquire(){
  try{await atomicWrite(ownerFile,json(owner),{exclusive:true});}
  catch(error){if(error.code!=='EEXIST')throw error;
   const current=JSON.parse((await bytes(ownerFile)).toString());if(current.schema!==owner.schema||!Number.isSafeInteger(current.pid))fail('Article owner record needs inspection.');
   let alive=true;try{process.kill(current.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
   if(alive)fail('Shared articles already have a cooperating store owner. Close that owner before starting another writer.');
   await unlink(ownerFile);await atomicWrite(ownerFile,json(owner),{exclusive:true});
  }
 }
 async function assertOwner(){const current=await bytes(ownerFile);if(!current||current.toString()!==json(owner))fail('Shared article owner changed; publication stopped.');}
 const packed=raw=>raw===null?null:{base64:raw.toString('base64'),hash:articleHash(raw)};
 function unpack(value){if(value===null)return null;if(!value||typeof value.base64!=='string'||!/^[a-f0-9]{64}$/.test(value.hash))fail('Article journal bytes are damaged.');const raw=Buffer.from(value.base64,'base64');if(raw.toString('base64')!==value.base64||articleHash(raw)!==value.hash)fail('Article journal bytes are damaged.');return raw;}
 const same=(a,b)=>a===null?b===null:b!==null&&a.equals(b);
 function allowed(relative){return /^native-outputs\/operations\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/receipt\.json$/.test(relative)||/^native-outputs\/[a-f0-9]{64}\/[a-f0-9]{64}\/(captures|history)\/[A-Za-z0-9_-]{1,128}\.json$/.test(relative)||/^article-make\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative)||/^shared-carousel-requests\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative)||/^shared-article-requests\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/decision\.json$/.test(relative)||['state.json','state.backup.json','state.pieces-migration.backup.json'].includes(relative)||/^pieces\/[a-f0-9]{64}\.json$/.test(relative)||/^articles\/[a-f0-9]{64}\/[a-f0-9]{64}\/article\.(md|json)$/.test(relative)||/^articles\/[a-f0-9]{64}\/[a-f0-9]{64}\/carousels\/[a-f0-9]{64}\/words\.md$/.test(relative);}
 async function syncDirectory(){const handle=await open(dataDir,'r');try{await handle.sync();}finally{await handle.close();}}
 async function recover(){
  await assertOwner();const raw=await bytes(journal);if(raw===null)return false;let intent;
  try{intent=JSON.parse(raw.toString());}catch{fail('Article journal is damaged; all files were preserved.');}
  if(intent.schema!=='ar-create.article-publication.v1'||!Array.isArray(intent.files)||!intent.files.length||new Set(intent.files.map(entry=>entry.path)).size!==intent.files.length)fail('Article journal is damaged; all files were preserved.');
  const entries=intent.files.map(entry=>{if(!allowed(entry.path))fail('Article journal path is invalid.');return {...entry,old:unpack(entry.old),next:unpack(entry.next),file:path.join(dataDir,entry.path)};});
  // Check the entire set before writing any recovery byte. External divergence is preserved.
  for(const entry of entries){const current=await bytes(entry.file);if(!same(current,entry.old)&&!same(current,entry.next))fail('Interrupted article publication found external edits; all files were preserved.');}
  for(const entry of entries){const current=await bytes(entry.file);if(same(current,entry.next))continue;if(entry.next===null){await unlink(entry.file);}else await atomicWrite(entry.file,entry.next);}
  await unlink(journal);await syncDirectory();return {files:entries.map(entry=>[entry.file,entry.next])};
 }
 async function publish(files,{expectedFiles=new Map()}={}){
  await assertOwner();if(existsSync(journal))fail('An interrupted article publication must recover before saving.');
  const prepared=[];
  for(const [file,value] of files){const relative=path.relative(dataDir,file).split(path.sep).join('/');if(!allowed(relative))fail('Publication path is outside the allowed bundle files.');const old=await bytes(file),next=value===null?null:Buffer.from(value);if(expectedFiles.has(file)){const expected=expectedFiles.get(file);if((old===null?null:articleHash(old))!==expected)fail('A bundle changed after inspection; existing files were preserved.');}prepared.push({path:relative,old:packed(old),next:packed(next)});}
  const intent={schema:'ar-create.article-publication.v1',id:randomUUID(),files:prepared};
  await atomicWrite(journal,json(intent),{exclusive:true});await fault?.('after-intent',intent);
  for(const [index,entry] of prepared.entries()){
   const file=path.join(dataDir,entry.path);if(!same(await bytes(file),unpack(entry.old)))fail('A file changed during article publication; recovery requires inspection.');
   const next=unpack(entry.next);if(!same(unpack(entry.old),next)){if(next===null){if(entry.old!==null)await unlink(file);}else await atomicWrite(file,next);}
   await fault?.(`after-file:${index}`,intent);
  }
  await fault?.('before-complete',intent);await unlink(journal);await syncDirectory();await fault?.('after-complete',intent);
 }
 async function checkPublished(files){
  await assertOwner();
  for(const [file,value] of files)if(!same(await bytes(file),value===null?null:Buffer.from(value)))fail('A completed article publication found external edits; all files were preserved.');
 }
 async function readArticle(project,{allowEditedMarkdown=false}={}){
  await assertOwner();const paths=articlePaths(dataDir,project),raw=await bytes(paths.markdown),metadata=await bytes(paths.companion);
  if(raw===null||metadata===null)fail('Article bundle is partial or missing; existing files were preserved.');
  const canonical=articleBytes(project);const legacy=JSON.parse(canonical.companion);delete legacy.carouselWordsVersion;
  if(metadata.toString()!==canonical.companion&&metadata.toString()!==json(legacy))fail('Article metadata diverged from its saved piece; existing files were preserved.');
  const externalEdit=!raw.equals(Buffer.from(canonical.raw));if(externalEdit&&!allowEditedMarkdown)fail('Article Markdown has external edits. Prepare an explicit reviewed proposal before saving.');
  return {project:structuredClone(project),document:structuredClone(project.document||null),raw:raw.toString('utf8'),paths,externalEdit,expected:{projectId:project.id,documentId:project.document?.id||null,projectHash:articleHash(json(project)),markdownHash:articleHash(raw),companionHash:articleHash(metadata)}};
 }
 async function checkArticle(project,expected){const current=await readArticle(project,{allowEditedMarkdown:!!expected});if(expected&&json(expected)!==json(current.expected))fail('Article bundle changed since it was read. Refresh before saving.');return current;}
 function carouselOutputs(project){
  const outputs=(project.document?.outputs||[]).filter(output=>output.kind==='carousel'),ids=new Set();
  for(const output of outputs){if(typeof output.id!=='string'||!output.id.trim()||ids.has(output.id))fail('Carousel wording files require unique output IDs.');ids.add(output.id);}
  return outputs;
 }
 function carouselFiles(project){return carouselOutputs(project).map(output=>[carouselWordsPaths(dataDir,project,output).markdown,renderCarouselWords(project.id,project.document.id,output)]);}
 async function retainedCarouselWordsHash(project,file){
  const entry=carouselFiles(project).find(([destination])=>destination===file);if(!entry)return null;
  const current=await bytes(file);if(current===null)return null;
  // Version restoration may reuse an orphan only when its physical words are
  // already exactly the requested rendering. Divergent history is preserved.
  if(!current.equals(Buffer.from(entry[1])))fail('A bundle changed after inspection; retained carousel words were preserved.');
  return articleHash(current);
 }
 async function readCarouselWords(project,{documentId,outputId,allowEditedMarkdown=false}={}){
  await assertOwner();if(!project.document||project.document.id!==documentId)fail('Carousel document identity changed. Refresh before reading.');
  const output=carouselOutputs(project).find(output=>output.id===outputId);if(!output)throw new StateError('Carousel output was not found.',404);
  const article=await readArticle(project,{allowEditedMarkdown:true}),paths=carouselWordsPaths(dataDir,project,output),raw=await bytes(paths.markdown);
  const canonical=renderCarouselWords(project.id,project.document.id,output),externalEdit=raw===null||!raw.equals(Buffer.from(canonical));
  if(externalEdit&&!allowEditedMarkdown)fail('Carousel Markdown has external edits. Prepare an explicit reviewed proposal before saving.');
  return {project:structuredClone(project),document:structuredClone(project.document),output:structuredClone(output),raw:raw?.toString('utf8')??null,bytes:raw,missing:raw===null,paths,externalEdit,expected:{projectId:project.id,documentId:project.document.id,outputId:output.id,projectHash:article.expected.projectHash,outputHash:articleHash(json(output)),markdownHash:raw===null?null:articleHash(raw),companionHash:article.expected.companionHash}};
 }
 async function checkCarouselWords(project,expectedCarousel){
  const outputs=carouselOutputs(project),selected=expectedCarousel&&expectedCarousel.projectId===project.id&&expectedCarousel.documentId===project.document?.id&&outputs.some(output=>output.id===expectedCarousel.outputId);
  if(expectedCarousel&&!selected)fail('Carousel reconciliation must bind an exact existing output.');
  const results=[];for(const output of outputs){
   const bound=expectedCarousel?.projectId===project.id&&expectedCarousel?.documentId===project.document.id&&expectedCarousel?.outputId===output.id;
   const current=await readCarouselWords(project,{documentId:project.document.id,outputId:output.id,allowEditedMarkdown:!!selected});
   if(bound&&json(current.expected)!==json(expectedCarousel))fail('Carousel bytes changed since review; capture the latest bytes before deciding.');results.push(current);
  }return results;
 }
 function articleFiles(project){const paths=articlePaths(dataDir,project),value=articleBytes(project);return [[paths.markdown,value.raw],[paths.companion,value.companion]];}
 function bundleFiles(project){return [...articleFiles(project),...carouselFiles(project)];}
 async function bootstrap(projects,files=[],{expectedFiles=new Map()}={}){
  const additions=[...files];
  for(const project of projects){
   const paths=articlePaths(dataDir,project),raw=await bytes(paths.markdown),metadata=await bytes(paths.companion);
   if(raw===null&&metadata===null)additions.push(...articleFiles(project));else await readArticle(project,{allowEditedMarkdown:true});
   // The companion is the existing authoritative evidence of migration. A
   // marked bundle missing words means later deletion, not a fresh migration.
   const migrated=metadata!==null&&JSON.parse(metadata.toString()).carouselWordsVersion===1;
   if(!migrated){
    for(const [file,value] of carouselFiles(project)){if(await bytes(file)===null)additions.push([file,value]);}
    if(metadata!==null){additions.push([paths.companion,articleBytes(project).companion]);expectedFiles.set(paths.companion,articleHash(metadata));}
   }

  }
  if(additions.length)await publish(additions,{expectedFiles:new Map(additions.map(([file])=>[file,expectedFiles.has(file)?expectedFiles.get(file):null]))});
 }

 await acquire();try{await recover();}catch(error){await unlink(ownerFile);throw error;}
 return {journal,publish,recover,checkPublished,readArticle,checkArticle,readCarouselWords,checkCarouselWords,retainedCarouselWordsHash,bundleFiles,bootstrap,async close(){await assertOwner();await unlink(ownerFile);await syncDirectory();}};
}
