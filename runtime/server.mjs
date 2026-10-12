import {sharedArticlesEnabled} from './services/shared-article-activation.mjs';
import {createSharedCarouselBridge} from './services/shared-carousel-bridge.mjs';
import {createSharedArticleBridge} from './services/shared-article-bridge.mjs';
import {parseArticle} from './article-codec.mjs';
import {createResearchAnswers} from './services/research-answer.mjs';
import {createFirstFlow} from './services/first-flow.mjs';
import {createStudyBindings} from './services/study-bindings.mjs';
import {createStudyAI} from './services/study-ai.mjs';
import {createStudyEditorialPlanContext} from './services/study-editorial-plan-context.mjs';
import {createStudyFirstFlowPlanContext} from './services/study-first-flow-plan-context.mjs';
import {createStudyProjectMaterialContext} from './services/study-project-material-context.mjs';
import {createStudyDerivedFindings} from './services/study-derived-findings.mjs';
import {createStudyOriginals} from './services/study-originals.mjs';
import {createStudyDraftCopies} from './services/study-draft-copies.mjs';
import * as studyPhotoFiles from './services/files.mjs';
import {createStudyPhotos} from './services/study-photos.mjs';
import {createStudyOwnedPhotoBindings} from './services/study-owned-photo-bindings.mjs';
import {createStudyHumanDirection} from './services/study-human-direction.mjs';
import {createStudyResearchChoices} from './services/study-research-choices.mjs';
import {createStudyDraftChecks} from './services/study-draft-checks.mjs';
import {createWorkspaceExecution} from './services/artifact-execution.mjs';
import http from 'node:http';
import { readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, StateError, MAX_BODY_BYTES } from './store.mjs';
import { createResearchMaterial } from './services/research-material.mjs';
import {createWritingTemplates} from './services/writing-template.mjs';
import { createLibrary } from './services/library.mjs';
import { createGuidance } from './services/guidance.mjs';
import { createRecordings } from './services/recordings.mjs';
import {createTranscriptToolConnection} from './services/transcript-tool-connection.mjs';
import {createSharedArticleLauncher} from './services/shared-article-launcher.mjs';
import { createTerminal, attachTerminalSockets } from './services/terminal.mjs';
import { createRequestPreviews } from './services/requests.mjs';
import {createMagazinePortfolio} from './services/magazine-portfolio.mjs';
import { createExports, MAX_EXPORT_BYTES } from './services/exports.mjs';
import { createCarouselExports } from './services/carousel.mjs';
import { createUrlIngestion } from './services/ingestion.mjs';
import { createCarouselMake } from './services/carousel-make.mjs';
import { createArticleMake } from './services/article-make.mjs';
import { createArticleVisual } from './services/article-visual.mjs';
import { createConnections } from './services/connections.mjs';
import { createPassageRevisions } from './services/passage-revision.mjs';
import { createICloudAlbums, isICloudAlbum } from './services/icloud-albums.mjs';
import { createReadStream } from 'node:fs';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
function body(request, limit = MAX_BODY_BYTES, raw = false) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let overflow = false;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        if (!overflow) reject(new StateError(`Request exceeds the ${Math.floor(limit / 1024 / 1024)} MB limit.`, 413));
        overflow = true;
        chunks.length = 0;
      } else if (!overflow) chunks.push(chunk);
    });
    request.on('end', () => {
      if (overflow) return;
      try { resolve(raw ? Buffer.concat(chunks) : JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new StateError('Request body must be valid JSON.')); }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new StateError('Request was interrupted.')));
  });
}
function localAuthorities(server) {
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : 8770;
  const suffix = port === 80 ? '' : `:${port}`;
  return [`127.0.0.1${suffix}`, `localhost${suffix}`];
}
function checkWriteOrigin(request, server) {
  if (!request.headers.origin) return; // Local CLI callers may omit Origin.
  if (!localAuthorities(server).some(host => request.headers.origin === `http://${host}`)) {
    throw new StateError('Writes must originate from this local workspace.', 403);
  }
}
async function staticFile(publicDir, pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (pathname.includes('\\') || pathname.includes('\0') || segments.some(segment => segment.startsWith('.'))) {
    throw new StateError('File is not available.', 404);
  }
  if (!segments.length || pathname.endsWith('/')) segments.push('index.html');
  const type = types[path.extname(segments.at(-1)).toLowerCase()];
  if (!type) throw new StateError('File is not available.', 404);
  let current = publicDir;
  for (const segment of [null, ...segments]) {
    if (segment !== null) current = path.join(current, segment);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new StateError('File is not available.', 404);
    if (current !== path.join(publicDir, ...segments) && !stat.isDirectory()) throw new StateError('File is not available.', 404);
  }
  const resolved = await realpath(current);
  const resolvedRoot = await realpath(publicDir);
  if (!resolved.startsWith(`${resolvedRoot}${path.sep}`) || !(await lstat(resolved)).isFile()) {
    throw new StateError('File is not available.', 404);
  }
  return { contents: await readFile(resolved), type };
}

/** Trusted startup file only; HTTP handlers never accept runtime paths. */
export async function loadTranscriptionRuntime(dataDir) {
  const file = path.join(dataDir, 'transcription-runtime.json');
  let configured;
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Transcription runtime config must be an owned regular file.');
    configured = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const paths = ['python', 'asrModelDirectory', 'diarizationModelDirectory'];
  const allowed = [...paths, 'diarizationEngine', 'offline'];
  if (!configured || typeof configured !== 'object' || Array.isArray(configured) || Object.keys(configured).some(key => !allowed.includes(key))) throw new Error('Transcription runtime config contains unsupported fields.');
  for (const key of paths) if (configured[key] !== undefined && (typeof configured[key] !== 'string' || !path.isAbsolute(configured[key]))) throw new Error('Transcription runtime paths must be explicit absolute paths.');
  if (configured.offline !== undefined && typeof configured.offline !== 'boolean') throw new Error('Transcription runtime offline setting must be boolean.');
  if (configured.diarizationEngine !== undefined && !['auto', 'community', 'sherpa'].includes(configured.diarizationEngine)) throw new Error('Unknown configured diarization engine.');
  return configured;
}

/** Await createServer(), then server.listen(port, '127.0.0.1'). No external services. */
export async function createServer({ dataDir = path.join(root, 'data'), publicDir = path.join(root, 'public'), connections, connectionsEditable = true, extraction = null, transcriptionRuntime, ingestionOptions = null, magazineRoots, execution = createWorkspaceExecution(), sharedArticles = false, publicationFault, articleMakeSkillRoot, studyOriginalRoots=null, researchEnabled=true, packageView=null } = {}) {
  dataDir = path.resolve(dataDir);
  const store = await createStore({ dataDir, sharedArticles, publicationFault });
  try {
  if (transcriptionRuntime === undefined) transcriptionRuntime = await loadTranscriptionRuntime(dataDir);
  if (connections === undefined) {
    const file = path.join(dataDir, 'connections.json');
    try { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Connections config must be an owned regular file.'); const configured = JSON.parse(await readFile(file, 'utf8')); connections = Array.isArray(configured) ? configured : configured.roots; if (!Array.isArray(connections)) throw new Error('Connections config requires an array of explicit read-only roots.'); } catch(error) { if (error.code === 'ENOENT') connections=[]; else throw error; }
  }
  if (magazineRoots === undefined) {
    const file=path.join(dataDir,'magazine-roots.json');
    try {const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Magazine roots must be an owned regular config file.');magazineRoots=JSON.parse(await readFile(file,'utf8'));}
    catch(error){if(error.code==='ENOENT')magazineRoots=[];else throw error;}
  }
  const magazine=createMagazinePortfolio({roots:magazineRoots});
  const magazineRead=async operation=>{try{return await operation();}catch(error){if([400,404,409,413,415].includes(error.status))throw new StateError(error.message,error.status);throw error;}};
  const ingestion = createUrlIngestion({ dataDir, ...(ingestionOptions || {}) });
  let recordings;
  const library = createLibrary({ dataDir, connections, extraction, legacyState: () => store.get(), urlIngestion: extraction ? null : source => ingestion.schedule(source), ingestionState: id => ingestion.state(id), recordingState: id => recordings?.state(id), recordingSourceSnapshot: source => recordings?.sourceSnapshot?.(source) });
  const writingTemplates=createWritingTemplates({store,library,magazine:{read:input=>magazineRead(()=>magazine.read(input))}});
  const connectedFolders = createConnections({dataDir,library,connections,editable:connectionsEditable,...(!connectionsEditable?{reason:'Folders are managed by the server startup configuration.'}:{})});
  const researchMaterial = createResearchMaterial({dataDir,library});
  const researchInput = input => {if(input.projectId!==store.get().project.id)throw new StateError('Research belongs to another project.',409);return input;};
  const guidance = createGuidance({ dataDir, referenceDir: path.join(root, 'reference', 'guidance') });
  recordings = createRecordings({ dataDir, library, transcriptionRuntime });
  const transcriptTools=createTranscriptToolConnection({dataDir,library,recordings});
  const albums = createICloudAlbums({ dataDir, library, ...(ingestionOptions?.albumFetch ? { fetcher: ingestionOptions.albumFetch } : {}) });
  const studyBindings=createStudyBindings({dataDir,store});
  const studyOriginals=studyOriginalRoots?createStudyOriginals(studyOriginalRoots):null;
  const studyDerivedFindings=studyOriginals?createStudyDerivedFindings({dataDir,originals:studyOriginals}):null;
  const studyDrafts=studyOriginals?createStudyDraftCopies({dataDir,originals:studyOriginals}):null;
  const studyHumanDirection=studyDrafts?createStudyHumanDirection({dataDir,store,bindings:studyBindings,drafts:studyDrafts}):null;
  let researchAnswers;const answerContext={projectContext:(...args)=>researchAnswers.projectContext(...args)};
  const requests = createRequestPreviews({ dataDir, store, library, guidance, researchMaterial, researchAnswers:answerContext,...(studyHumanDirection?{humanDirection:studyHumanDirection}:{}) });
  const sharedArticleBridge=sharedArticles?createSharedArticleBridge({dataDir,store,requests,parseArticle,guidance,writingTemplates}):null;
  const sharedCarouselBridge=sharedArticles?createSharedCarouselBridge({dataDir,store,requests,guidance,writingTemplates}):null;
  const exports = createExports({ dataDir, store });
  const carousel = createCarouselExports({dataDir,store,library});
  const terminal = createTerminal({ dataDir, store, requests });
  const sharedArticleLauncher=createSharedArticleLauncher({dataDir,store,bridge:sharedArticleBridge,terminal});
  const carouselMake = createCarouselMake({dataDir,store,library,requests,terminal,execution,publicDir});
  const articleMake = createArticleMake({dataDir,store,library,requests,terminal,execution,...(articleMakeSkillRoot?{skillRoot:articleMakeSkillRoot}:{})});
  const articleVisual = createArticleVisual({dataDir,store,library,terminal,execution});
  const passageRevisions = createPassageRevisions({dataDir,store,requests,terminal,execution});
  researchAnswers=createResearchAnswers({dataDir,store,library,requests,execution});
  const firstFlow=createFirstFlow({dataDir,store,library,recordings,requests,execution});
  const studyDraftChecks=studyDrafts?createStudyDraftChecks({dataDir,drafts:studyDrafts}):null;
  const studyOwnedPhotoBindings=studyDrafts?createStudyOwnedPhotoBindings({dataDir,drafts:studyDrafts,bindings:studyBindings,store}):null;
  const studyPhotos=studyOwnedPhotoBindings?createStudyPhotos({dataDir,library,runtime:studyPhotoFiles,resolveBinding:projectId=>studyOwnedPhotoBindings.resolve(projectId)}):null;
  const studyResearchChoices=studyDrafts?createStudyResearchChoices({dataDir,originals:studyOriginals,drafts:studyDrafts}):null;
  const studyEditorialPlan=studyDrafts?createStudyEditorialPlanContext({drafts:studyDrafts,originals:studyOriginals,choices:studyResearchChoices}):null;
  const studyPlanContext=studyDrafts?createStudyFirstFlowPlanContext({dataDir,savedPlan:studyEditorialPlan,firstFlow}):null;
  const studyProjectMaterial=studyDrafts?createStudyProjectMaterialContext({dataDir,firstFlow}):null;
  const studyAI=studyDrafts?createStudyAI({dataDir,drafts:studyDrafts,humanDirection:studyHumanDirection,editorialPlan:studyPlanContext,projectMaterial:studyProjectMaterial}):null;
  const draftCall=async fn=>{if(!studyDrafts)throw new StateError('Current manuscript originals are not configured.',503);try{return await fn();}catch(error){throw new StateError(error.message,error.status||500);}};
  const originalRead=fn=>{if(!studyOriginals)throw new StateError('Current original records are not configured; retained snapshots remain available.',503);try{return fn();}catch(error){throw new StateError(error.message,error.status||500);}};
  const researchAction=fn=>input=>{if(!researchEnabled)throw new StateError('Fresh research is being validated. Existing story records are ready to read.',503);return fn(input);};
  async function guardCarouselOutput(input){
    if(!sharedCarouselBridge||typeof input?.outputId!=='string')return;
    const state=await store.read({allowEditedMarkdown:true}),document=state.project.document;
    const output=document?.outputs?.find(o=>o.id===input.outputId&&o.kind==='carousel');
    // Saved historical artifacts remain downloadable; only a current owned
    // carousel can publish from its live wording file.
    if(output)await store.readCarouselWords({documentId:document.id,outputId:output.id});
  }
  const server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'"+(new URL(request.url,'http://localhost').pathname==='/document-study/index.html'?" 'unsafe-inline'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (!localAuthorities(server).includes(request.headers.host)) throw new StateError('Only local workspace requests are accepted.', 403);
      if (packageView && new URL(request.url,'http://localhost').pathname === '/document-study/package-config.js') {response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return response.end('window.AR_CREATE_PACKAGE_CONFIG='+JSON.stringify(packageView)+';');}
      let pathname;
      try { pathname = decodeURIComponent((request.url || '/').split('?')[0]); }
      catch { throw new StateError('Invalid request path.'); }
      if(pathname==='/api/shared-carousels/capabilities'&&request.method==='GET')return json(response,200,{enabled:sharedArticles});
      if(pathname.startsWith('/api/shared-carousels')){
        if(!sharedCarouselBridge)throw new StateError('Shared carousel review is disabled in this workspace.',409);
        const url=new URL(request.url,`http://${request.headers.host}`),scope={};
        for(const key of ['projectId','documentId','outputId']){
          const values=url.searchParams.getAll(key);if(values.length!==1||!values[0].trim()||values[0].length>240||/[\u0000-\u001f\u007f]/.test(values[0]))throw new StateError('Select exactly one project, document and carousel output.');scope[key]=values[0];
        }
        if([...url.searchParams.keys()].some(key=>!['projectId','documentId','outputId','allowEditedMarkdown'].includes(key)))throw new StateError('Unknown shared carousel query field.');
        const match=pathname.match(/^\/api\/shared-carousels\/requests\/([a-f0-9-]{36})(?:\/(review|accept|reject|external))?$/);
        const scopedReview=detail=>({...detail,...(detail.externalArtifact?{externalArtifact:{...detail.externalArtifact,url:detail.externalArtifact.url+'?'+new URLSearchParams(scope)}}:{})});
        const scopedRequest=async id=>{const list=await sharedCarouselBridge.list({projectId:scope.projectId,documentId:scope.documentId});if(!list.items.some(item=>item.id===id&&item.outputId===scope.outputId))throw new StateError('Shared carousel request was not found in this output.',404);};
        if(request.method==='GET'){
          if(pathname==='/api/shared-carousels/current'){
            const {bytes,...current}=await store.readCarouselWords({...scope,allowEditedMarkdown:url.searchParams.get('allowEditedMarkdown')==='true'});return json(response,200,current);
          }
          if(pathname==='/api/shared-carousels/requests')return json(response,200,await sharedCarouselBridge.list(scope));
          if(match){await scopedRequest(match[1]);if(!match[2])return json(response,200,scopedReview(await sharedCarouselBridge.review(match[1])));
            if(match[2]==='external'){const bytes=await sharedCarouselBridge.external(match[1]);if(bytes===null)return json(response,410,{missing:true,error:'The captured carousel words file was absent. There are no bytes to download.'});response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="external-carousel-words.md"','Cache-Control':'no-store','Content-Length':bytes.length});return response.end(bytes);}
          }
        }
        if(request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          const input=await body(request);if(!input||typeof input!=='object'||Array.isArray(input))throw new StateError('Request body must be an object.');
          if(['/api/shared-carousels/prepare','/api/shared-carousels/recover-external'].includes(pathname)){
            if(Object.keys(scope).some(key=>input[key]!==scope[key]))throw new StateError('Carousel body identity must match the selected query scope.',409);
            const result=await sharedCarouselBridge[pathname.endsWith('/prepare')?'prepare':'recoverExternal'](input);return json(response,200,pathname.endsWith('/prepare')?result:scopedReview(result));
          }
          if(pathname==='/api/shared-carousels/propose'){await scopedRequest(input.requestId);return json(response,200,await sharedCarouselBridge.propose(input));}
          if(match){await scopedRequest(match[1]);if(match[2]==='review'){if(Object.keys(input).some(key=>key!=='raw')||typeof input.raw!=='string')throw new StateError('Review requires exactly the editable raw Markdown.');return json(response,200,scopedReview(await sharedCarouselBridge.review(match[1],input)));}
            if(['accept','reject'].includes(match[2]))return json(response,200,await sharedCarouselBridge[match[2]](match[1],input));
          }
        }
        throw new StateError('Use a supported shared carousel review action.',405);
      }
      if(pathname==='/api/shared-articles/capabilities'&&request.method==='GET')return json(response,200,{enabled:sharedArticles});
      if(pathname.startsWith('/api/shared-articles')){
        if(!sharedArticleBridge)throw new StateError('Shared article review is disabled. Enable it only in this separate workspace with AR_SHARED_ARTICLES=1.',409);
        const launchMatch=pathname.match(/^\/api\/shared-articles\/launches\/([a-f0-9-]{36})(?:\/(send))?$/);
        const sharedUrl=new URL(request.url,`http://${request.headers.host}`),match=pathname.match(/^\/api\/shared-articles\/requests\/([a-f0-9-]{36})(?:\/(accept|reject|external))?$/);
        if(request.method==='GET'){
          if(launchMatch&&!launchMatch[2])return json(response,200,sharedArticleLauncher.get(launchMatch[1]));
          if(pathname==='/api/shared-articles/current')return json(response,200,await store.readArticle({projectId:sharedUrl.searchParams.get('projectId')||undefined,allowEditedMarkdown:sharedUrl.searchParams.get('allowEditedMarkdown')==='true'}));
          if(pathname==='/api/shared-articles/requests')return json(response,200,await sharedArticleBridge.list({projectId:sharedUrl.searchParams.get('projectId')||undefined,documentId:sharedUrl.searchParams.get('documentId')||undefined}));
          if(match&&!match[2])return json(response,200,await sharedArticleBridge.review(match[1]));
          if(match&&match[2]==='external'){const bytes=await sharedArticleBridge.external(match[1]);response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="external-article.md"','Cache-Control':'no-store','Content-Length':bytes.length});return response.end(bytes);}
        }
        if(request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          const input=await body(request);
          if(pathname==='/api/shared-articles/launches')return json(response,200,await sharedArticleLauncher.prepare(input,`http://${request.headers.host}`));
          if(launchMatch&&launchMatch[2]==='send')return json(response,200,await sharedArticleLauncher.send(launchMatch[1],input));
          if(pathname==='/api/shared-articles/prepare')return json(response,200,await sharedArticleBridge.prepare(input));
          if(pathname==='/api/shared-articles/propose')return json(response,200,await sharedArticleBridge.propose(input));
          if(pathname==='/api/shared-articles/recover-external')return json(response,200,await sharedArticleBridge.recoverExternal(input));
          if(match&&['accept','reject'].includes(match[2]))return json(response,200,await sharedArticleBridge[match[2]](match[1],input));
        }
        throw new StateError('Use a supported shared article review action.',405);
      }
      if (pathname === '/api/state') {
        if (request.method === 'GET') return json(response, 200, await store.read({allowEditedMarkdown:true}));
        if (request.method === 'PUT') {
          checkWriteOrigin(request, server);
          if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new StateError('Use Content-Type: application/json.', 415);
          if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
            request.resume();
            throw new StateError('Request exceeds the 2 MB limit.', 413);
          }
          return json(response, 200, await store.put(await body(request)));
        }
        response.setHeader('Allow', 'GET, PUT');
        throw new StateError('Method is not supported.', 405);
      }
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (pathname.startsWith('/transcription/')) {
        if (request.method === 'POST') checkWriteOrigin(request, server);
        // The copied Magazine workshop contains its own inline controls.
        response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors "+(/^\/transcription\/[a-f0-9-]{36}\/view$/.test(pathname)?"'self'":"'none'")+"; base-uri 'none'; form-action 'self'");
        if (await recordings.route(request, response, url)) return;
        throw new StateError('Recording route is unavailable.', 404);
      }
      const studyAICall=(action,input={})=>draftCall(()=>{
        const scope={};
        for(const key of ['bindingId','parentStudyId']){const values=url.searchParams.getAll(key);if(values.length!==1||!values[0])throw new StateError('Select one exact owned manuscript and parent project.',400);scope[key]=values[0];}
        if([...url.searchParams.keys()].some(key=>!['bindingId','parentStudyId','requestId'].includes(key))||url.searchParams.getAll('requestId').length>1)throw new StateError('Unsupported manuscript proposal query.',400);
        if(Object.keys(input).some(key=>['bindingId','parentStudyId'].includes(key)))throw new StateError('Manuscript identity comes from the explicit route scope.',400);
        const requestId=url.searchParams.get('requestId');if(requestId){if(input.requestId&&input.requestId!==requestId)throw new StateError('Request identity differs from its route.',409);input={...input,requestId};}
        return studyAI.call(action,{...scope,...input});
      });
      const routes = {
        '/api/writing-template': {GET:()=>writingTemplates.get({expectedProjectId:url.searchParams.get('expectedProjectId'),expectedDocumentId:url.searchParams.get('expectedDocumentId')})},
        '/api/writing-template/attach': {POST:input=>writingTemplates.attach(input)},
        '/api/writing-template/detach': {POST:input=>writingTemplates.detach(input)},
        '/api/writing-template/snapshot': {POST:input=>writingTemplates.snapshot(input)},
        '/api/writing-template/restore-copy': {POST:input=>writingTemplates.restoreCopy(input)},
        '/api/magazine/portfolio': {GET:()=>magazineRead(()=>magazine.list())},
        '/api/magazine/artifact': {GET:()=>magazineRead(()=>magazine.read({artifactId:url.searchParams.get('id'),expectedHash:url.searchParams.get('hash')}))},
        '/api/sources/tree': { GET: () => library.tree() },
        '/api/sources/file': { GET: () => library.read(url.searchParams.get('id'),{allowUnreconciled:true}), POST: input => library.write(input) },
        '/api/sources/import': { POST: async input => {
          if (!Array.isArray(input.urls || []) || !Array.isArray(input.files || []) || (input.urls?.length || 0) + (input.files?.length || 0) > 100) throw new StateError('Import up to 100 files or URLs.');
          const albumLinks=(input.urls || []).filter(isICloudAlbum);
          const result=await library.import({...input,urls:(input.urls || []).filter(url=>!isICloudAlbum(url))});
          for(const link of albumLinks) {try {const imported=await albums.import(link);result.receipts.push(...imported.receipts);}catch(error){result.receipts.push({ok:false,url:link,error:error.message});}}
          for (const receipt of result.receipts) if (receipt.ok && receipt.source) { try { await recordings.retain(receipt.source); } catch (error) { receipt.recordingError = error.message; } }
          return result;
        } },
        '/api/icloud-albums': { GET: () => albums.list() },
        '/api/sources/rename': { POST: input => library.rename(input) },
        '/api/sources/reconnect/preview': {POST:input=>library.reconnectPreview(input)},
        '/api/sources/reconnect': {POST:input=>library.reconnectMoved(input)},
        '/api/sources/folders': { POST: input => library.folder(input) },
        '/api/collections': { GET: () => library.collections(), POST: input => library.saveCollection(input) },
        '/api/collection-relationships': {GET:()=>library.collectionRelationships(url.searchParams.get('collectionId'))},
        '/api/collection-relationships/link': {POST:input=>library.linkCollections(input)},
        '/api/collection-relationships/detach': {POST:input=>library.detachCollectionRelationship(input)},
        '/api/connections': {GET:()=>connectedFolders.list(),POST:input=>connectedFolders.add(input),DELETE:input=>connectedFolders.remove(input)},
        '/api/guidance': { GET: () => guidance.get(), POST: input => guidance.put(input) },
        '/api/evidence': { GET: () => library.evidence(), POST: input => library.saveEvidence(input) },
        '/api/terminal/capabilities': { GET: () => terminal.capabilities() },
        '/api/terminal/sessions': { GET: () => terminal.list(), POST: input => terminal.start(input) },
        '/api/pieces': {GET:()=>store.listPieces(),POST:input=>store.createPiece(input)},
        '/api/i64os/health': {GET:()=>{if(!studyDrafts)throw new StateError('Document study is not configured.',503);return {service:'ar-create-document-study',ready:true};}},
        '/api/study-ai/contracts': {GET:()=>studyAICall('contracts')},
        '/api/study-ai/human-contract': {POST:input=>studyAICall('humanContract',input)},
        '/api/study-ai/read': {GET:()=>studyAICall('read')},
        '/api/study-ai/prepare': {POST:input=>studyAICall('prepare',input)},
        '/api/study-ai/context': {GET:()=>studyAICall('context')},
        '/api/study-ai/propose': {POST:input=>studyAICall('propose',input)},
        '/api/study-ai/review': {GET:()=>studyAICall('review')},
        '/api/study-ai/requests': {GET:()=>studyAICall('list')},
        '/api/study-ai/accept': {POST:input=>studyAICall('accept',input)},
        '/api/study-ai/reject': {POST:input=>studyAICall('reject',input)},
        '/api/study/human-direction': {GET:()=>draftCall(()=>studyHumanDirection.read({parentStudyId:url.searchParams.get('parentStudyId'),scope:url.searchParams.get('scope')||'project',...(url.searchParams.has('bindingId')?{bindingId:url.searchParams.get('bindingId')}:{}),...(url.searchParams.has('outputId')?{outputId:url.searchParams.get('outputId')}:{})}))},
        '/api/study/human-direction/select': {POST:input=>draftCall(()=>studyHumanDirection.select(input))},
        '/api/study/human-direction/write': {POST:input=>draftCall(()=>studyHumanDirection.write(input))},
        '/api/study/human-direction/undo': {POST:input=>draftCall(()=>studyHumanDirection.undo(input))},
        '/api/study-originals': {GET:()=>originalRead(()=>studyOriginals.list(url.searchParams.get('projectKey')))},
        '/api/study/photos/select': {POST:input=>draftCall(()=>studyOwnedPhotoBindings.select(input))},
        '/api/study/photos': {GET:()=>draftCall(()=>studyPhotos.list({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')}))},
        '/api/study/photos/available': {GET:()=>draftCall(()=>studyPhotos.available({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')}))},
        '/api/study/photos/add': {POST:input=>draftCall(()=>studyPhotos.add(input))},
        '/api/study/photos/update': {POST:input=>draftCall(()=>studyPhotos.update(input))},
        '/api/study-research/findings': {GET:()=>draftCall(()=>studyDerivedFindings.read({projectKey:url.searchParams.get('projectKey'),parentStudyId:url.searchParams.get('parentStudyId')}))},
        '/api/study-research/choices': {GET:()=>draftCall(()=>studyResearchChoices.read({projectKey:url.searchParams.get('projectKey'),bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyResearchChoices.save(input))},
        '/api/study-draft/root-recovery': {GET:()=>draftCall(()=>studyDrafts.inspectRoots({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyDrafts.recoverRoots(input))},
        '/api/study-draft/catalog': {GET:()=>draftCall(()=>studyDrafts.catalog())},
        '/api/study-draft/read': {GET:()=>draftCall(()=>studyDrafts.read({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
        '/api/study-draft/open': {POST:input=>draftCall(()=>studyDrafts.openCopy(input))},
        '/api/study-draft/save': {POST:input=>draftCall(()=>studyDrafts.save(input))},
        '/api/study-draft/undo': {POST:input=>draftCall(()=>studyDrafts.undo(input))},
        '/api/study-draft/inspect': {GET:()=>draftCall(()=>studyDrafts.inspect({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),operationId:url.searchParams.get('operationId')})),POST:input=>draftCall(()=>studyDrafts.inspect(input))},
        '/api/study-draft/recover': {POST:input=>draftCall(()=>studyDrafts.recover(input))},
        '/api/study-draft/check': {GET:()=>draftCall(()=>studyDraftChecks.read({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),...(url.searchParams.has('checkId')?{checkId:url.searchParams.get('checkId')}:{})})),POST:input=>draftCall(()=>studyDraftChecks.run(input))},

        '/api/first-flow/select': {POST:input=>studyBindings.select(input)},
        '/api/first-flow': {GET:async()=>({...await firstFlow.get({projectId:url.searchParams.get('projectId')||store.get().project.id}),researchAvailable:researchEnabled})},
        '/api/first-flow/source-review': {POST:input=>firstFlow.reviewSources(input)},
        '/api/first-flow/attach': {POST:input=>firstFlow.attach(input)},
        '/api/first-flow/prepare': {POST:researchAction(input=>firstFlow.prepare(input))},
        '/api/first-flow/run': {POST:researchAction(input=>firstFlow.run(input))},
        '/api/first-flow/pick': {POST:researchAction(input=>firstFlow.pick(input))},
        '/api/first-flow/check': {POST:researchAction(input=>firstFlow.check(input))},
        '/api/first-flow/decide-line': {POST:researchAction(input=>firstFlow.decideLine(input))},
        '/api/first-flow/reinspect': {POST:researchAction(input=>firstFlow.reinspect(input))},
        '/api/pieces/switch': {POST:input=>store.switchPiece(input)},
        '/api/research-material': {GET:()=>researchMaterial.list(store.get().project.id)},
        '/api/research-material/claim': {POST:input=>researchMaterial.saveClaim(researchInput(input))},
        '/api/research-material/account': {POST:input=>researchMaterial.saveAccount(researchInput(input))},
        '/api/research-material/concept': {POST:input=>researchMaterial.saveConcept(researchInput(input))},
        '/api/research-material/position': {POST:input=>researchMaterial.savePosition(researchInput(input))},
        '/api/research-material/preview': {POST:input=>researchMaterial.previewImport(researchInput(input))},
        '/api/research-material/import': {POST:input=>researchMaterial.import(researchInput(input))},
        '/api/research-material/inherit': {POST:input=>researchMaterial.inherit(researchInput(input))},
        '/api/research-material/review': {POST:input=>researchMaterial.review(researchInput(input))},
        '/api/requests/preview': { POST: input => requests.preview(input) },
        '/api/requests/recent': { GET: () => requests.recent() },
        '/api/exports': { GET: () => exports.list(), POST: async input => {await guardCarouselOutput(input);return exports.save(input);} },
        '/api/research/answers/recent': {GET:()=>researchAnswers.recent(url.searchParams.get('projectId')||store.get().project.id)},
        '/api/research/answers/preview': {POST:input=>researchAnswers.preview(researchInput(input))},
        '/api/ai/execution/capabilities': {GET:()=>execution.capabilities()},
        '/api/passage/revisions/recent': {GET:()=>passageRevisions.recent()},
        '/api/passage/revisions/preview': {POST:input=>passageRevisions.preview(input)},
        '/api/article/visual/recent': {GET:()=>articleVisual.recent()},
        '/api/article/visual/preview': {POST:input=>articleVisual.preview(input)},
        '/api/article/make/recent': {GET:()=>articleMake.recent()},
        '/api/article/make/preview': {POST: input => articleMake.preview(input, `http://${request.headers.host}`)},
        '/api/carousel/make/recent': {GET:()=>carouselMake.recent()},
        '/api/carousel/make/preview': {POST: async input => {if(input.stage==='look')await guardCarouselOutput(input);return carouselMake.preview(input);}},
        '/api/carousel/exports': {GET:()=>carousel.list(),POST:async input=>{await guardCarouselOutput(input);return carousel.save(input,`http://${request.headers.host}`);}},
        '/api/ingestion': { GET: () => ingestion.list() },
        '/api/ingestion/retry': { POST: input => ingestion.retry(input.id) },
        '/api/transcript-tools/connect': {POST:input=>transcriptTools.connect(input,url.origin)},
        '/api/recordings': { GET: () => recordings.list() },
        '/api/capabilities': { GET: async () => ({ library: 'file-backed', webExtraction: { configured: true, backend: extraction ? 'WordForge Firecrawl' : 'i64os Readability', local: ingestion.capabilities.article }, youtube: ingestion.capabilities.youtube, transcription: (await recordings.list()).capability, guidance: 'shared-own-files', sharedArticles: {enabled:sharedArticles} }) },
      };
      const passageMatch=pathname.match(/^\/api\/passage\/revisions\/([a-f0-9-]{36})(?:\/(send|run))?$/);
      if(passageMatch){
        const [,id,action]=passageMatch;
        if(!action&&request.method==='GET')return json(response,200,await passageRevisions.get(id));
        if(['send','run'].includes(action)&&request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await passageRevisions[action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const researchAnswerMatch=pathname.match(/^\/api\/research\/answers\/([a-f0-9-]{36})(?:\/(run|keep|markdown))?$/);
      if(researchAnswerMatch){const [,id,action]=researchAnswerMatch;if(!action&&request.method==='GET')return json(response,200,await researchAnswers.get(id));if(action==='markdown'&&request.method==='GET'){response.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'no-store'});return response.end(await researchAnswers.markdown(id));}if(['run','keep'].includes(action)&&request.method==='POST'){checkWriteOrigin(request,server);const input=await body(request);return json(response,200,await researchAnswers[action](id,input));}throw new StateError('Use a supported research answer action.',405);}
      const articleVisualMatch=pathname.match(/^\/api\/article\/visual\/([a-f0-9-]{36})(?:\/(send|run))?$/);
      if(articleVisualMatch){
        const [,id,action]=articleVisualMatch;
        if(!action&&request.method==='GET')return json(response,200,await articleVisual.get(id));
        if(['send','run'].includes(action)&&request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await articleVisual[action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const articleMakeMatch=pathname.match(/^\/api\/article\/make\/([a-f0-9-]{36})(?:\/(send|run|context|propose|accept))?$/);
      if(articleMakeMatch){
        const [,id,action]=articleMakeMatch;
        if(!action&&request.method==='GET')return json(response,200,await articleMake.get(id));
        if(action==='context'&&request.method==='GET')return json(response,200,await articleMake.context(id));
        if(['send','run','propose','accept'].includes(action)&&request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await articleMake[action==='accept'?'acceptFirstDraft':action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const makeMatch=pathname.match(/^\/api\/carousel\/make\/([a-f0-9-]{36})(?:\/(send|run))?$/);
      if(makeMatch){
        const [,id,action]=makeMatch;
        if(!action&&request.method==='GET')return json(response,200,await carouselMake.get(id));
        if(['send','run'].includes(action)&&request.method==='POST'){
          checkWriteOrigin(request,server);
          if(!(request.headers['content-type']||'').startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await carouselMake[action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const terminalMatch = pathname.match(/^\/api\/terminal\/sessions\/([a-f0-9-]{36})(?:\/(input|resize|stop))?$/);
      if (terminalMatch) {
        const [, id, action] = terminalMatch;
        if (!action && request.method === 'GET') return json(response, 200, terminal.get(id));
        if (action && request.method === 'POST') { checkWriteOrigin(request, server); if (!(request.headers['content-type'] || '').startsWith('application/json')) throw new StateError('Use Content-Type: application/json.',415); const input=await body(request); return json(response,200,action==='input'?await terminal.input(id,input):action==='resize'?terminal.resize(id,input):terminal.stop(id)); }
        throw new StateError('Method is not supported.',405);
      }
      const carouselMatch=pathname.match(/^\/api\/carousel\/exports\/([a-f0-9-]{36})\/(render|file)\/(.+)$/);
      if(carouselMatch){
        if(!['GET','HEAD'].includes(request.method))throw new StateError('Method is not supported.',405);
        const [,id,action,name]=carouselMatch;
        if(action==='render'){
          if(!/^\d+$/.test(name))throw new StateError('Slide not found.',404);
          response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'");
          const html=carousel.page(id,Number(name));if(sharedCarouselBridge){const manifest=JSON.parse(await readFile(path.join(dataDir,'carousel-exports',id,'.manifest.json'),'utf8'));await guardCarouselOutput(manifest);}response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:html);return;
        }
        const artifact=carousel.file(id,name);response.writeHead(200,{'Content-Type':artifact.mimeType,'Content-Length':artifact.sizeBytes,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store'});
        if(request.method==='HEAD')return response.end();const stream=createReadStream(artifact.file);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);return;
      }
      const exportMatch = pathname.match(/^\/api\/exports\/([a-f0-9-]{36})\/file$/);
      if (exportMatch) {
        if (!['GET','HEAD'].includes(request.method)) throw new StateError('Method is not supported.',405);
        const { artifact, file } = exports.file(exportMatch[1]);
        response.writeHead(200, { 'Content-Type': `${artifact.mimeType}; charset=utf-8`, 'Content-Length': artifact.sizeBytes, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`, 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
        if (request.method === 'HEAD') return response.end();
        const stream = createReadStream(file); stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response); return;
      }
      if (pathname === '/api/ingestion/raw') {
        if (!['GET','HEAD'].includes(request.method)) throw new StateError('Method is not supported.',405);
        const {file,type} = ingestion.raw(url.searchParams.get('id'),url.searchParams.get('file')); const stat = await lstat(file);
        response.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-store','Content-Disposition':'attachment'});
        if(request.method === 'HEAD') return response.end(); const stream = createReadStream(file);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);return;
      }
      if (pathname === '/api/study-originals/audio') {
        if (!['GET', 'HEAD'].includes(request.method)) throw new StateError('Method is not supported.', 405);
        const { file, type } = originalRead(()=>studyOriginals.audio(url.searchParams.get('id')));
        const size = (await lstat(file)).size;
        const mediaTypes = { '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.pdf': 'application/pdf' };
        const headers = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(file))}` };
        let start = 0, end = size - 1;
        if (request.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
          if (!match || (!match[1] && !match[2])) throw new StateError('Invalid byte range.', 416);
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
          if (start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new StateError('Byte range is unavailable.', 416);
          headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        }
        response.writeHead(request.headers.range ? 206 : 200, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
        if (request.method === 'HEAD' || !size) return response.end();
        const stream = createReadStream(file, { start, end }); stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response); return;
      }
      if (pathname === '/api/sources/blob') {
        if (!['GET', 'HEAD'].includes(request.method)) throw new StateError('Method is not supported.', 405);
        const { file, source } = await library.blob(url.searchParams.get('id'), url.searchParams.get('original') === '1');
        const size = (await lstat(file)).size;
        const mediaTypes = { '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.pdf': 'application/pdf' };
        const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || mediaTypes[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(path.basename(source.rel_path))}` };
        let start = 0, end = size - 1;
        if (request.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
          if (!match || (!match[1] && !match[2])) throw new StateError('Invalid byte range.', 416);
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
          if (start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new StateError('Byte range is unavailable.', 416);
          headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        }
        response.writeHead(request.headers.range ? 206 : 200, { ...headers, 'Content-Length': Math.max(0, end - start + 1) });
        if (request.method === 'HEAD' || !size) return response.end();
        const stream = createReadStream(file, { start, end }); stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response); return;
      }
      if (pathname === '/api/media') {
        if (request.method !== 'POST') throw new StateError('Method is not supported.', 405);
        checkWriteOrigin(request, server);
        const type = (request.headers['content-type'] || '').split(';')[0];
        const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
        if (!extensions[type]) throw new StateError('Upload a JPEG, PNG or WebP image.', 415);
        const bytes = await body(request, 5 * 1024 * 1024, true);
        const signatures = { 'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 'image/png': bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'image/webp': bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' };
        if (!signatures[type]) throw new StateError('Image bytes do not match the declared type.');
        const name = `${Date.now()}${extensions[type]}`;
        const result = await library.import({ rootId: 'library', folder: 'Media', files: [{ name, base64: bytes.toString('base64') }] });
        if (!result.receipts[0]?.ok) throw new StateError(result.receipts[0]?.error || 'Image could not be saved.');
        const source = result.receipts[0].source;
        return json(response, 200, { url: `/api/sources/blob?id=${encodeURIComponent(source.id)}`, source });
      }
      if (routes[pathname]) {
        const handler = routes[pathname][request.method];
        if (!handler) { response.setHeader('Allow', Object.keys(routes[pathname]).join(', ')); throw new StateError('Method is not supported.', 405); }
        let input;
        if (['POST','DELETE'].includes(request.method)) {
          checkWriteOrigin(request, server);
          if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new StateError('Use Content-Type: application/json.', 415);
          input = await body(request, pathname === '/api/sources/import' ? 90 * 1024 * 1024 : pathname === '/api/exports' ? MAX_EXPORT_BYTES + 1024 * 1024 : MAX_BODY_BYTES);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StateError('Request body must be an object.');
        }
        return json(response, 200, await handler(input));
      }
      if (pathname.startsWith('/api/')) throw new StateError('API route was not found.', 404);
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.setHeader('Allow', 'GET, HEAD');
        throw new StateError('Method is not supported.', 405);
      }
      const file = await staticFile(path.resolve(publicDir), pathname);
      response.writeHead(200, { 'Content-Type': file.type, 'Content-Length': file.contents.length, 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : file.contents);
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return json(response, 404, { error: 'File was not found.' });
      const status = error instanceof StateError ? error.status : 500;
      if (status === 500) console.error('Local workspace request failed:', error.message);
      json(response, status, { error: status === 500 ? 'Could not save or load the local workspace. Existing data was preserved.' : error.message,...(error.outcome?{outcome:error.outcome}:{}) });
    }
  });
  attachTerminalSockets(server, terminal, { checkHost: request => { if (!localAuthorities(server).includes(request.headers.host)) throw new StateError('Only local workspace requests are accepted.',403); }, checkOrigin: request => checkWriteOrigin(request,server) });
  // Guard factory callers as well as the CLI against accidentally exposing it.
  const listen = server.listen;
  server.listen = function (...args) {
    const first = args[0];
    const host = first && typeof first === 'object' ? first.host : args.find((arg, index) => index > 0 && typeof arg === 'string');
    if (typeof first !== 'number' && !(first && typeof first === 'object' && typeof first.port === 'number')) throw new Error('Listen requires a TCP port.');
    if (host !== '127.0.0.1') throw new Error('This workspace must bind to 127.0.0.1.');
    return listen.apply(this, args);
  };
  server.on('close',()=>execution.dispose());
  const close=server.close;
  server.close=function(callback){return close.call(this,error=>{store.close().then(()=>callback?.(error),failure=>{if(callback)callback(failure);else console.error('Workspace close failed:',failure.message);});});};
  server.closeWorkspace=()=>store.close();
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  return server;
  }catch(error){await store.close();throw error;}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8770);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
  const connections = process.env.AR_CREATE_SOURCE_ROOTS ? JSON.parse(process.env.AR_CREATE_SOURCE_ROOTS) : undefined;
  if (connections !== undefined && !Array.isArray(connections)) throw new Error('AR_CREATE_SOURCE_ROOTS must be a JSON array of explicit read-only roots.');
  const extraction = process.env.AR_CREATE_FIRECRAWL_URL ? { baseUrl: process.env.AR_CREATE_FIRECRAWL_URL } : null;
  const server = await createServer({ dataDir: process.env.AR_CREATE_DATA_DIR || path.join(root, 'data'), connections, connectionsEditable:connections===undefined, extraction, sharedArticles:sharedArticlesEnabled(process.env.AR_CREATE_DATA_DIR || path.join(root, 'data')) });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`ar-create local workspace: http://127.0.0.1:${port}`));
}
