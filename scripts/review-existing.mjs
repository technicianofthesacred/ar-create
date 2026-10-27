// Candidate UI + maintained local readers; explicit human source/manuscript corrections use
// only the existing guarded authority. No private writer/store is created here.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createLibraryReviewInspection} from './library-review-inspection.mjs';
import {createMagazineMediaInspection} from './magazine-media-inspection.mjs';
import {projectMagazineMediaUsage} from '../runtime/services/magazine-media-usage.mjs';
import {fileURLToPath} from 'node:url';
import {validateImportedTranscriptTranslation} from '../config.mjs';
import {createReviewConnection} from './review-connection.mjs';
import {createReviewMedia} from '../runtime/services/review-media.mjs';
import {createExistingWorkReader} from '../runtime/services/review-existing-work.mjs';
import {createRetainedCarouselReader} from '../runtime/services/review-retained-carousels.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Reuse the explicitly selected host file; review JSON cannot grant generation.
async function readReviewTranslationHost(configFile,inspection){
 if(configFile===null||configFile===undefined)return {translation:null,dataDir:null};
 if(!inspection||typeof inspection.assertCurrent!=='function'||typeof configFile!=='string'||!path.isAbsolute(configFile))throw Error('Translation review requires the same explicit host Library inspection.');
 inspection.assertCurrent();
 const before=await fs.lstat(configFile),stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>1024*1024)throw Error('Host translation configuration must be bounded regular JSON.');
 const handle=await fs.open(configFile,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);let bytes;
 try{if(stamp(await handle.stat())!==stamp(before))throw Error('Host translation configuration changed.');bytes=await handle.readFile();if(bytes.length!==before.size||stamp(await handle.stat())!==stamp(before))throw Error('Host translation configuration changed.');}finally{await handle.close();}
 if(stamp(await fs.lstat(configFile))!==stamp(before))throw Error('Host translation configuration changed.');
 const host=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 const translation=validateImportedTranscriptTranslation(host?.importedTranscriptOwner?.translation);
 const dataDir=host?.importedTranscriptOwner?.dataDir??null;
 if(translation?.keptConversations?.oneRunId&&(typeof dataDir!=='string'||!path.isAbsolute(dataDir)))throw Error('One-use translation requires the same trusted imported owner data directory.');
 inspection.assertCurrent();return {translation,dataDir};
}
export async function readReviewTranslationPermission(configFile,inspection){return (await readReviewTranslationHost(configFile,inspection)).translation;}
export async function createExistingWorkReview({config,fetchImpl=fetch,libraryInspection=null,libraryInspectionConfigFile=null}={}){
 if(!config||typeof config!=='object'||!Array.isArray(config.magazineRoots))throw Error('Explicit read-only review configuration required.');
 const {translation:translationProposals,dataDir:translationAdmissionDataDir}=await readReviewTranslationHost(libraryInspectionConfigFile,libraryInspection);
 const upstream=new URL(config.authorityURL);if(upstream.origin!==config.authorityURL.replace(/\/$/,'')||upstream.protocol!=='http:'||!['127.0.0.1','localhost'].includes(upstream.hostname)||upstream.port!==String(config.allowedAuthorityPort))throw Error('Fixed explicit loopback authority required.');
 const catalogCacheScope=createHash('sha256').update(JSON.stringify({config,libraryInspection:libraryInspection?.scope||!!libraryInspection})).digest('hex');
 const inspectPaths=new Map(libraryInspection?[
  ['/api/sources/tree',url=>{exactQuery(url,[]);return libraryInspection.tree();}],
  ['/api/library/folders',url=>{exactQuery(url,['domain'],['domain']);return libraryInspection.folders({domain:url.searchParams.get('domain')});}],
  ['/api/sources/file',url=>{exactQuery(url,['id'],['id']);return libraryInspection.sourceText({id:url.searchParams.get('id')});}],
  ['/api/collections',url=>{exactQuery(url,[]);return libraryInspection.collectionsSnapshot();}],
  ['/api/collection-relationships',url=>{exactQuery(url,['collectionId'],['collectionId']);return libraryInspection.collectionRelationships(url.searchParams.get('collectionId'));}],
  ['/api/evidence',url=>{exactQuery(url,[]);return libraryInspection.evidence();}],
 ]:[]);
 function exactQuery(url,allowed,required=[]){if([...url.searchParams.keys()].some(key=>!allowed.includes(key)||url.searchParams.getAll(key).length!==1)||required.some(key=>!url.searchParams.get(key)))throw Object.assign(Error('Use the exact existing reader reference.'),{status:400});}
 if(libraryInspection&&['tree','folders','sourceText','collectionsSnapshot','collectionRelationships','evidence'].some(key=>typeof libraryInspection[key]!=='function'))throw Error('The maintained Library inspection capability is incomplete.');
 const readAuthority=async p=>{if(!p.startsWith('/api/'))throw Error('Only known reader paths are accepted.');const url=new URL(p,upstream),inspect=inspectPaths.get(url.pathname);if(inspect)return inspect(url);const response=await fetchImpl(new URL(p,upstream),{redirect:'error'});const value=await response.json();if(!response.ok)throw Error(value.error||'Owner unavailable.');return value;};
 const retainedCarousels=createRetainedCarouselReader({retainedCarouselState:config.retainedCarouselState});
 const existingReader=createExistingWorkReader({...config,roots:config.magazineRoots,readAuthority});
 const reader={...existingReader,catalog:async()=>{let retained;try{retained=await retainedCarousels.list();}catch(error){retained={readOnly:true,available:false,items:[],error:error.message||'The retained original could not be read.'};}const catalog=await existingReader.catalog();return config.retainedCarouselState===undefined?catalog:{...catalog,retainedCarousels:retained};}};
 const media=config.filesRoot?createReviewMedia({filesRoot:config.filesRoot,limits:config.mediaLimits}):null;
 const libraryPhotos={
  preview:input=>readLibraryPhoto('/api/magazine/library-photos/preview',input),
  resolve:input=>readLibraryPhoto('/api/magazine/library-photos/asset',input),
 };
 async function readLibraryPhoto(route,input){
  const response=await fetchImpl(new URL(route+'?'+new URLSearchParams(input),upstream),{redirect:'error'});
  if(!response.ok)throw Object.assign(Error('This library photograph changed or is unavailable. Reopen the photo library.'),{status:response.status});
  const length=Number(response.headers.get('content-length'));if(!Number.isSafeInteger(length)||length<=0||length>20*1024*1024)throw Error('This photograph exceeds the supported preview limit.');
  const body=Buffer.from(await response.arrayBuffer()),hash=response.headers.get('x-content-sha256'),contentType=response.headers.get('content-type'),rootId=response.headers.get('x-ar-photo-root-id'),sourceId=response.headers.get('x-ar-photo-source-id');
  if(body.length!==length||!/^[a-f0-9]{64}$/.test(hash||'')||createHash('sha256').update(body).digest('hex')!==hash||!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(contentType))throw Error('This photograph’s exact bytes could not be confirmed.');
  if(route.endsWith('/asset')&&(!/^[a-f0-9]{64}$/.test(rootId||'')||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(sourceId||'')))throw Error('The saved library photograph identity could not be confirmed.');
  return {body,hash,contentType,rootId,sourceId};
 }
 const publicationTargets=new Map();
 const publicationMedia=libraryInspection?.publicationRepoRoot?createMagazineMediaInspection({libraryPhotos,repoRoot:libraryInspection.publicationRepoRoot,resolveWorking:async({storyId,pieceId,expectedHash})=>{
  libraryInspection.assertCurrent?.();
  const key=JSON.stringify([storyId,pieceId,expectedHash]);let proof=publicationTargets.get(key);
  if(!proof){
   const fresh=await reader.catalog(),claims=fresh.stories.flatMap(story=>story.artifacts.filter(a=>a.magazineWorkingTarget?.storyId===storyId&&a.magazineWorkingTarget?.pieceId===pieceId).map(artifact=>({artifact,target:artifact.magazineWorkingTarget})));
   if(claims.length!==1||claims[0].target.hash!==expectedHash||claims[0].artifact.hash!==expectedHash)throw Object.assign(Error('The exact registered photo manuscript is unavailable.'),{status:409});
   proof={...claims[0],rootIdentity:fresh.magazineWorkingLinks?.rootIdentity};
   if(publicationTargets.size>=64)publicationTargets.clear();publicationTargets.set(key,proof);
  }
  const [owner,value]=await Promise.all([readAuthority('/api/magazine/working-draft/catalog'),readAuthority('/api/magazine/working-draft/read?'+new URLSearchParams({storyId,pieceId,edition:'working'}))]);
  const {artifact,target,rootIdentity}=proof,pathClaims=(owner.stories||[]).flatMap(s=>s.pieces||[]).filter(p=>p.relativePath===artifact.relativePath),registered=owner.stories?.filter(s=>s.storyId===storyId),pieces=registered?.length===1?registered[0].pieces?.filter(p=>p.pieceId===pieceId):[];
  if(owner.rootIdentity?.fingerprint!==rootIdentity?.fingerprint||owner.rootIdentity?.scheme!==rootIdentity?.scheme||owner.registered!==true||pathClaims.length!==1||registered?.length!==1||registered[0].archived!==false||pieces?.length!==1||!['article','article-part'].includes(pieces[0].kind)||(pieces[0].part||'article')!==target.partKey||pieces[0].relativePath!==artifact.relativePath||pieces[0].hash!==expectedHash||value.document?.hash!==expectedHash||value.document?.path!==artifact.relativePath||value.authority?.kind!=='magazine'||value.authority.storyId!==storyId||value.authority.pieceId!==pieceId||value.authority.path!==artifact.relativePath||value.selection?.edition!=='working'||value.selection.storyId!==storyId||value.selection.pieceId!==pieceId)throw Object.assign(Error('The manuscript changed before its photographs could be read.'),{status:409});
  libraryInspection.assertCurrent?.();return {document:value.document,authority:value.authority,projection:value.projection,supportedNativeOperations:value.supportedNativeOperations,target,rootIdentity};
 }}):null;
 const requirePublicationMedia=()=>{if(!publicationMedia)throw Object.assign(Error('Publication photographs are not configured for this reader.'),{status:503});return publicationMedia;};
 const requireMedia=()=>{if(!media)throw Object.assign(Error('Original Photos are not configured for this read-only review.'),{status:503});return media;};
 const result=(fn,{binary=false}={})=>async input=>{try{const value=await fn(input);return binary?value:{body:value};}catch(error){return{status:[400,403,404,405,409,413,415,423,503].includes(error.status)?error.status:503,body:{error:error.message||'Existing work could not be read.'}};}};
 const readOverrides=new Map([
  ...[...inspectPaths].map(([pathname,inspect])=>[pathname,result(async({url})=>({...await inspect(url),readOnly:true}))]),
  ['/api/review/magazine-publication-reference',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash'],['storyId','pieceId','expectedHash']);return requirePublicationMedia().publicationReference(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash'],['storyId','pieceId','expectedHash']);return requirePublicationMedia().inspect(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/library',result(async({url})=>{
   exactQuery(url,['storyId','pieceId','expectedHash'],['storyId','pieceId','expectedHash']);
   const input=Object.fromEntries(url.searchParams),publication=requirePublicationMedia();
   const catalog=await readAuthority('/api/magazine/library-photos'),media=await publication.inspect(input);
   const usage=projectMagazineMediaUsage({catalog,inspection:media,expectedOwnerRef:media.ownerRef,expectedCatalogRevision:catalog.revision});
   const current=await publication.inspect(input);
   if(current.revision!==media.revision||JSON.stringify(current.ownerRef)!==JSON.stringify(media.ownerRef))throw Object.assign(Error('The working article changed while its photo library was read.'),{status:409});
   return {schema:'ar-create.magazine-media-library.v1',catalog,media,usage};
  })],
  ['/api/review/magazine-working-edition',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash'],['storyId','pieceId','expectedHash']);return requirePublicationMedia().workingEdition(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/move-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','beforeId'],['storyId','pieceId','expectedHash','revision','placementId','beforeId']);return requirePublicationMedia().planMove(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/annotation-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','annotation'],['storyId','pieceId','expectedHash','revision','placementId','annotation']);const input=Object.fromEntries(url.searchParams);let annotation;try{annotation=JSON.parse(input.annotation);}catch{throw Object.assign(Error('Use one canonical caption and credit object.'),{status:400});}return requirePublicationMedia().planAnnotation({...input,annotation});})],
  ['/api/review/magazine-media/credits-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','credits'],['storyId','pieceId','expectedHash','revision','credits']);const input=Object.fromEntries(url.searchParams);let credits;try{credits=JSON.parse(input.credits);}catch{throw Object.assign(Error('Use credit lines, an empty list, or remove the override.'),{status:400});}return requirePublicationMedia().planCredits({...input,credits});})],
  ['/api/review/magazine-media/description-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','description'],['storyId','pieceId','expectedHash','revision','placementId']);if(url.searchParams.getAll('description').length!==1)throw Object.assign(Error('Use one photo description, which may be empty.'),{status:400});return requirePublicationMedia().planDescription(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/focus-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','x','y'],['storyId','pieceId','expectedHash','revision','placementId','x','y']);const input=Object.fromEntries(url.searchParams);return requirePublicationMedia().planFocus({...input,x:input.x.trim()?Number(input.x):NaN,y:input.y.trim()?Number(input.y):NaN});})],
  ['/api/review/magazine-media/library-replace-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','assetRootId','assetSourceId','assetRevision','assetHash','description'],['storyId','pieceId','expectedHash','revision','placementId','assetRootId','assetSourceId','assetRevision','assetHash']);if(url.searchParams.getAll('description').length!==1)throw Object.assign(Error('Use one photo description, which may be empty.'),{status:400});return requirePublicationMedia().planLibraryReplace(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/replace-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','replacementPlacementId','sourceId','sourceHash'],['storyId','pieceId','expectedHash','revision','placementId','replacementPlacementId','sourceId','sourceHash']);return requirePublicationMedia().planReplace(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/aspect-plan',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','revision','placementId','aspect'],['storyId','pieceId','expectedHash','revision','placementId','aspect']);return requirePublicationMedia().planAspect(Object.fromEntries(url.searchParams));})],
  ['/api/review/magazine-media/file',result(({url})=>{exactQuery(url,['storyId','pieceId','expectedHash','sourceId','sourceHash','revision'],['storyId','pieceId','expectedHash','sourceId','sourceHash','revision']);return requirePublicationMedia().preview(Object.fromEntries(url.searchParams));},{binary:true})],
  ['/api/review/media',result(({url})=>{if([...url.searchParams].length)throw Object.assign(Error('Media discovery accepts no caller paths or selectors.'),{status:400});return requireMedia().list();})],
  ['/api/review/media/file',result(({url})=>{if([...url.searchParams.keys()].some(key=>!['id','revision','hash'].includes(key))||[...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw Object.assign(Error('Use only an exact media identity, revision and optional hash.'),{status:400});return requireMedia().open({id:url.searchParams.get('id'),expectedRevision:url.searchParams.get('revision'),...(url.searchParams.has('hash')?{expectedHash:url.searchParams.get('hash')}:{} )});},{binary:true})],
  ['/api/review/retained-carousels',result(({url,request})=>{if(request.method!=='GET')throw Object.assign(Error('Retained originals require GET.'),{status:405});exactQuery(url,[]);return retainedCarousels.list();})],
  ['/api/review/retained-carousel',result(({url,request})=>{if(request.method!=='GET')throw Object.assign(Error('Retained originals require GET.'),{status:405});exactQuery(url,['outputId','expectedSourceHash','expectedOutputHash'],['outputId','expectedSourceHash','expectedOutputHash']);return retainedCarousels.read(Object.fromEntries(url.searchParams));})],
  ['/api/review/catalog',result(()=>reader.catalog())],
  ['/api/review/artifact',result(({url})=>reader.readArtifact({artifactId:url.searchParams.get('id'),expectedHash:url.searchParams.get('hash')}))],
  ['/api/magazine/portfolio',result(()=>reader.portfolio.list())],
  ['/api/magazine/artifact',result(({url})=>reader.portfolio.read({artifactId:url.searchParams.get('id'),expectedHash:url.searchParams.get('hash')}))],
 ]);
 const server=createReviewConnection({publicDir:path.join(root,'public'),authorityURL:config.authorityURL,allowedAuthorityPort:config.allowedAuthorityPort,actualWorkReview:true,catalogCacheScope,translationProposals,translationAdmissionDataDir,translationPermissionCurrent:translationProposals?()=>libraryInspection.assertCurrent():null,sourceCorrections:true,studyDraftCorrections:true,studyDraftApprovals:config.studyDraftApprovals??false,browserCarouselCorrections:true,nativeCarouselCorrections:config.nativeCarouselCorrections??false,magazineDraftCorrections:config.magazineDraftCorrections??false,magazineFeedbackCorrections:config.magazineFeedbackCorrections??false,magazineCheckReceipts:config.magazineCheckReceipts??false,readPostPaths:['/api/magazine/check','/api/concept/sources/search','/api/study-draft/inspect','/api/study-draft/history-preview','/api/study/outputs/export-check','/api/work-continuity/read','/api/work-continuity/context','/api/work-continuity/understanding','/api/work-continuity/artifacts'],readOverrides});
 return{server,reader,media,retainedCarousels};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv[2]!=='--config'||!path.isAbsolute(process.argv[3]||'')||![4,6].includes(process.argv.length)||process.argv.length===6&&(process.argv[4]!=='--library-inspection-config'||!path.isAbsolute(process.argv[5]||'')))throw Error('Use --config with an external absolute path and optional --library-inspection-config host file.');
 const file=process.argv[3],stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Review configuration must be a regular external file.');
 const config=JSON.parse(await fs.readFile(file,'utf8'));const port=config.port;
 if(!Number.isInteger(port)||port<1||port>65535||port===8841||port===config.allowedAuthorityPort)throw Error('Use a distinct loopback review port.');
 const libraryInspection=process.argv.length===6?createLibraryReviewInspection({configFile:process.argv[5]}):null;const {server}=await createExistingWorkReview({config,libraryInspection,libraryInspectionConfigFile:process.argv.length===6?process.argv[5]:null});server.on('error',error=>{console.error(error.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`Existing-work review with source and manuscript corrections: http://127.0.0.1:${port}/document-study/index.html`));
}
