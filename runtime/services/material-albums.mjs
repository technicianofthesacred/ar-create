import {randomUUID,createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {StateError} from '../store.mjs';
import {albumToken} from './icloud-albums.mjs';
const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const marker='ar-create.material-album.v1';
const fail=(message,status=409)=>{throw new StateError(message,status);};
function canonical(raw){
 if(typeof raw!=='string'||!raw.trim()||raw.length>4096||/[\x00-\x20\x7f]/.test(raw))fail('Use a public HTTP or HTTPS album URL under 4096 characters.',400);
 let url;try{url=new URL(raw);}catch{fail('Use a complete public album URL.',400);}
 const authority=raw.match(/^https?:\/\/([^/\?#]+)/i)?.[1]||'';
 const host=url.hostname.replace(/\.$/,'').toLowerCase();
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||authority.includes(':')||isIP(host)||!host.includes('.')||/^[\d.]+$/.test(host)||/(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host)||!host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))fail('Use a public album hostname without credentials or a port.',400);
 url.hostname=host;
 let supported=false;try{albumToken(url.href);supported=true;}catch{}
 if(supported){url.hostname='icloud.com';url.pathname='/sharedalbum';url.search='';}
 return {url:url.href,supported,host:url.hostname};
}
function receiptIds(receipts){
 return [...new Set((Array.isArray(receipts)?receipts:[]).filter(r=>r?.ok&&r.source).map(r=>{if(!uuid.test(r.source.id||''))fail('Album importer returned an invalid source identity.');return r.source.id;}))];
}
function savedOutcome(raw){
 const match=String(raw||'').match(/<!-- ar-create\.material-album\.v1 (\{[^\n]*\}) -->/);
 try{return match?JSON.parse(match[1]):null;}catch{return null;}
}
export function createMaterialAlbums({library,albums,bindings,firstFlow,store}){
 let queue=Promise.resolve();
 function current(input){const state=store.get();if(state.project.id!==input.projectId||state.project.document.id!==input.documentId)fail('The current project changed. Album files already saved remain intact.');}
 async function ready(input){current(input);const bound=await bindings.lookup({projectKey:input.projectKey});current(input);if(bound.projectKey!==input.projectKey||bound.projectId!==input.projectId||bound.documentId!==input.documentId)fail('Album connection does not match this exact project and document.');}
 async function attach(input,sourceIds){
  // First Flow accepts at most 100 IDs per request; an album also has its link note.
  let result;for(let offset=0;offset<sourceIds.length;offset+=100){current(input);result=await firstFlow.attach({projectId:input.projectId,operationId:randomUUID(),sourceIds:sourceIds.slice(offset,offset+100)});current(input);}return result;
 }
 async function add(input){
  const keys=['projectKey','projectId','documentId','url'];
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(key=>!Object.hasOwn(input,key))||typeof input.projectKey!=='string'||!input.projectKey.trim()||input.projectKey.length>256||/[\x00-\x1f\x7f]/.test(input.projectKey)||!uuid.test(input.projectId||'')||!uuid.test(input.documentId||''))fail('Choose the exact project, document and album URL.',400);
  const link=canonical(input.url);await ready(input);
  const folder='Projects/'+input.projectId,name='album-'+createHash('sha256').update(link.url).digest('hex')+'.md',relative=folder+'/'+name;
  const tree=await library.tree();current(input);const existing=(tree.sources||[]).filter(source=>source.rootId==='library'&&source.rel_path===relative);
  if(existing.length>1)fail('The saved album note has conflicting identities; existing files were preserved.');
  if(existing.length){
   const note=await library.read(existing[0].id);current(input);const outcome=savedOutcome(note.raw),ids=[note.id];
   // A saved marker is not authority to attach arbitrary files. Recover only
   // real importer-owned photos with this exact album provenance.
   if(outcome?.url===link.url&&Array.isArray(outcome.sourceIds))for(const id of outcome.sourceIds){if(!uuid.test(id||''))continue;try{const source=await library.read(id);current(input);if(source.provenance?.kind==='icloud-album'&&canonical(source.provenance.originalUrl).url===link.url)ids.push(id);}catch(error){current(input);}}
   await ready(input);const flow=await attach(input,[...new Set(ids)]);
   return {state:'already-saved',message:'Album link already saved; no images were fetched again.',importedCount:0,savedLinkSourceId:note.id,saved:true,deduplicated:true,url:link.url,note,sourceIds:[...new Set(ids)],imageImport:{state:'previous-attempt',message:'This link was already saved; no images were fetched again.'},flow};
  }
  const initial={url:link.url,state:link.supported?'pending':'requires-access',sourceIds:[]};
  const intro=`---\ntitle: ${JSON.stringify('Album link: '+link.host)}\nalbum_url: ${JSON.stringify(link.url)}\nproject_id: ${JSON.stringify(input.projectId)}\ndocument_id: ${JSON.stringify(input.documentId)}\n---\n\n# Album link\n\n${link.url}\n\nSaved for this project. ${link.supported?'No photos have been imported yet.':'Link only. This album provider is not connected; images may require access. No images were fetched.'}\n\n<!-- ${marker} ${JSON.stringify(initial)} -->\n`;
  current(input);const saved=await library.import({rootId:'library',folder,files:[{name,content:intro}],urls:[]});current(input);
  const noteIds=receiptIds(saved.receipts);if(noteIds.length!==1)fail('The album link could not be saved. No album was fetched.');
  let note=await library.read(noteIds[0]);current(input);if(note.rootId!=='library'||note.rel_path!==relative)fail('The album note was not saved in this project folder.');
  await attach(input,noteIds);
  if(!link.supported)return {state:'saved-link',message:'Album link saved only. This URL is unsupported or requires access; no images were fetched.',importedCount:0,savedLinkSourceId:note.id,saved:true,deduplicated:false,url:link.url,note,sourceIds:noteIds,imageImport:{state:'requires-access',supported:false,imported:0,message:'Link saved only. No images were fetched.'}};
  let result,error=null;await ready(input);try{result=await albums.import(link.url);}catch(caught){error=caught.message;}current(input);
  const ids=receiptIds(result?.receipts),receipts=Array.isArray(result?.receipts)?result.receipts:[];
  const failed=receipts.filter(r=>r?.ok===false&&!r.albumImport),skipped=receipts.filter(r=>r?.state==='skipped'&&!r.source).length;
  const hasError=error||result?.album?.error||result?.album?.state==='error';
  const importState=hasError?(ids.length?'partial':'error'):failed.length?'partial':ids.length?'imported':'no-images';
  const imageImport={state:importState,supported:true,imported:ids.length,skipped,error:error||result?.album?.error||null,failed:failed.length};
  await ready(input);const sourceIds=[...new Set([...noteIds,...ids])],flow=await attach(input,sourceIds);
  const outcome={url:link.url,state:importState,sourceIds:ids};
  const summary=`\n## Image import result\n\n${ids.length} image source${ids.length===1?'':'s'} retained and attached to this project. ${skipped?skipped+' item(s) skipped. ':''}${importState==='error'?'The album import failed. The saved link is retained.':importState==='partial'?'Some items could not be imported.':importState==='no-images'?'No image sources were imported.':'Original album files remain unchanged.'}\n${imageImport.error?'\nImport message: '+String(imageImport.error).replace(/[\r\n]/g,' ')+'\n':''}`;
  let noteUpdateError=null;current(input);try{note=await library.write({id:note.id,expectedHash:note.hash,content:intro.replace('No photos have been imported yet.','The link was saved before the image import. See the recorded result below.').replace(`<!-- ${marker} ${JSON.stringify(initial)} -->`,`<!-- ${marker} ${JSON.stringify(outcome)} -->`)+summary,raw:true});}catch(caught){noteUpdateError='Import results could not be added to the saved note. Existing note text was preserved.';}current(input);
  return {state:importState,message:ids.length?`${ids.length} image source${ids.length===1?'':'s'} attached. ${importState==='partial'?'Some items could not be imported.':'Album link saved.'}`:importState==='error'?'Album link saved, but photo import failed. No images were imported.':'Album link saved. No image sources were imported.' ,importedCount:ids.length,savedLinkSourceId:note.id,saved:true,deduplicated:false,url:link.url,note,sourceIds,imageImport,receipts,...(noteUpdateError?{noteUpdateError}:{}),flow};
 }
 return {add(input){const captured=structuredClone(input);const operation=queue.then(()=>add(captured));queue=operation.catch(()=>{});return operation;}};
}
