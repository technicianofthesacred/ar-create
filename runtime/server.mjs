import {sharedSimmerServices} from './services/simmer-board.mjs';
import {sharedInstagramStudio} from './services/instagram-studio.mjs';
import {sharedNeedsYou} from './services/needs-you.mjs';
import {createSubjectStanding,handleStanding} from './services/subject-standing.mjs';
import {sharedSubjectPlaces} from './services/subject-places.mjs';
import {createConversationCapture} from './services/conversation-capture.mjs';
import {createCurrentWork} from './services/current-work.mjs';
import {CURRENT_WORK_CONTRACT} from './contracts/current-work.mjs';
import {createStudyFootage} from './services/study-footage.mjs';
import {createSourceLineChecks} from './services/source-line-checks.mjs';
import {createStudyFootageScope} from './services/study-footage-scope.mjs';
import {createStudyResearchScope} from './services/study-research-scope.mjs';
import {createStudyResearchSources} from './services/study-research-sources.mjs';
import {createLocalAtlasRetrieval} from './services/local-atlas-retrieval.mjs';
import {createStructureTestRecords} from './services/structure-test-records.mjs';
import {createStudyDirectionOptions} from './services/study-direction-options.mjs';
import {createStudyDirectionTarget} from './services/study-direction-target.mjs';
import {createStructureTests} from './services/structure-tests.mjs';
import {createAssistanceDirectionContext} from './services/assistance-direction-context.mjs';
import {createMagazineOutputExports} from './services/magazine-output-exports.mjs';
import {createInquiryProjectSelectors} from './services/inquiry-project-selectors.mjs';
import {createNativeOutputExports} from './services/native-output-exports.mjs';
import {createNativeOutputFactory} from './services/native-output-factory.mjs';
import {createRetainedCarouselReader} from './services/review-retained-carousels.mjs';
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
import {createStudyOriginalSourceCatalog} from './services/study-original-source-catalog.mjs';
import {createStudyDraftCopies} from './services/study-draft-copies.mjs';
import * as studyPhotoFiles from './services/files.mjs';
import {createLibraryWorkReferences} from './services/library-work-references.mjs';
import {createProjectMembership} from './services/project-membership.mjs';
import {createCurrentUnderstandingResolver} from './services/current-understanding.mjs';
import {createInquiryInterfaceRoutes} from './services/inquiry-interface-routes.mjs';
import {createContinuityInterfaceRoutes} from './services/continuity-interface-routes.mjs';
import {createWorkContinuity} from './services/work-continuity.mjs';
import {conceptContextProjection} from './services/concept-markdown.mjs';
import {createMediaUsage} from './services/media-usage.mjs';
import {outputSpec as mediaArticleSpec} from './services/media-article-spec.mjs';
import mediaCarouselTemplates from './src/donors/mag/carousel/ig-templates.js';
import {createSharePreparation} from './services/share-preparation.mjs';
import {outputPrivatePrefix} from './output-records.mjs';
import {createStudyPhotos,studyPhotoPreviewInput} from './services/study-photos.mjs';
import {createStudyOwnedPhotoBindings} from './services/study-owned-photo-bindings.mjs';
import {createConceptWork} from './services/concept-work.mjs';
import {createConsentDesk} from './services/consent-desk.mjs';
import {createStudyHumanDirection} from './services/study-human-direction.mjs';
import {createStudyResearchChoices} from './services/study-research-choices.mjs';
import {createStudyDraftChecks} from './services/study-draft-checks.mjs';
import {createWorkspaceExecution} from './services/artifact-execution.mjs';
import {resolveRequestActor,withActor,isHuman,requireWriteActor,createProvenanceLedger,AGENT_ACTORS,CHAT_CARRIERS} from './services/actor.mjs';
import {createEventBus,scopeOf,revisionOf} from './services/events.mjs';
import {createPresence} from './services/presence.mjs';
import {createLeases} from './services/leases.mjs';
import {createJournal} from './services/journal.mjs';
import {createActivityRecovery} from './services/activity-recovery.mjs';
import {createRouteMap,describeRoutes,findCommand,publicEntry,SCHEMA as CAPABILITIES_SCHEMA,READ_ONLY_POSTS} from './commands.mjs';
import {createMagazineRoutes} from './commands/magazine.mjs';
import {createMagazineVault} from './services/magazine-vault/index.mjs';
import {createWorkingDraftBridge} from './services/magazine/working-draft-bridge.mjs';
import {createSourcedParagraphs} from './services/magazine/sourced-paragraphs.mjs';
import {createSourcedSubjectGuard} from './services/magazine/sourced-subject.mjs';
import {createMagazineMechanicalChecks} from './services/magazine-mechanical-checks.mjs';
import {createMagazineLibraryPhotos,magazinePhotoOriginHeader} from './services/magazine-library-photos.mjs';
import {createReviewMedia} from './services/review-media.mjs';
import {createPublicationPhotoCatalog} from '../scripts/magazine-media-inspection.mjs';
import {loadMagazineVaultConfig} from './services/magazine-vault/config.mjs';
import http from 'node:http';
import { readFile, lstat, realpath } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, StateError, MAX_BODY_BYTES } from './store.mjs';
import { createResearchMaterial } from './services/research-material.mjs';
import {createWritingTemplates} from './services/writing-template.mjs';
import { createLibrary } from './services/library.mjs';
import {createRetainedTranscriptCatalog} from './services/retained-transcript-catalog.mjs';
import {createMaterialFolder} from './services/material-folder.mjs';
import {createMaterialAlbums} from './services/material-albums.mjs';
import { createGuidance, resolveVoiceSource } from './services/guidance.mjs';
import { createVoiceCorrections } from './services/voice-corrections.mjs';
import { createRecordings } from './services/recordings.mjs';
import {createStudyLanguageConnection} from './services/study-language-connection.mjs';
import {createSourceTranslationSelectionReader,createSourceTranslationProposals} from './services/source-translation-proposals.mjs';
import {createSourceTranscriptProposals} from './services/source-transcript-proposals.mjs';
import {createLocalTranscriptCandidates} from './services/local-transcript-candidates.mjs';
import {createTranscriptToolConnection} from './services/transcript-tool-connection.mjs';
import {createSharedArticleLauncher} from './services/shared-article-launcher.mjs';
import { createTerminal, attachTerminalSockets } from './services/terminal.mjs';
import { createRequestPreviews } from './services/requests.mjs';
import {createMagazinePortfolio} from './services/magazine-portfolio.mjs';
import { createExports, MAX_EXPORT_BYTES } from './services/exports.mjs';
import { createCarouselExports } from './services/carousel.mjs';
import { createUrlIngestion } from './services/ingestion.mjs';
import { createCarouselMake } from './services/carousel-make.mjs';
import {createNativeCarouselMake} from './services/native-carousel-make.mjs';
import { createArticleMake } from './services/article-make.mjs';
import { createArticleVisual } from './services/article-visual.mjs';
import { createConnections } from './services/connections.mjs';
import { createPassageRevisions } from './services/passage-revision.mjs';
import { createICloudAlbums, isICloudAlbum } from './services/icloud-albums.mjs';
import { createReadStream } from 'node:fs';
import { releaseSha } from './services/release-sha.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicStudyModules=new Set(['/document-study/connected-workspace.mjs','/document-study/inquiry-workspace.mjs','/document-study/work-continuity-panel.mjs','/document-study/continuity-browser-recovery.mjs']);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.arResult = body;
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
      try { const value = raw ? Buffer.concat(chunks) : JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!raw) { request.arInput = value; request.arBeforeMutation?.(value); } resolve(value); }
      catch (error) { reject(error instanceof SyntaxError ? new StateError('Request body must be valid JSON.') : error); }
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
/** Read the commit this code runs from: AR_CREATE_GIT_SHA, else the checkout's HEAD. */
function gitSha(repoRoot) {
  if (/^[a-f0-9]{7,40}$/.test(process.env.AR_CREATE_GIT_SHA || '')) return process.env.AR_CREATE_GIT_SHA;
  try {
    let gitDir = path.join(repoRoot, '.git');
    const stat = fs.lstatSync(gitDir, { throwIfNoEntry: false });
    if (!stat) return null;
    if (stat.isFile()) { const pointer = fs.readFileSync(gitDir, 'utf8').match(/^gitdir: (.+)$/m); if (!pointer) return null; gitDir = path.resolve(repoRoot, pointer[1].trim()); }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (/^[a-f0-9]{40}$/.test(head)) return head;
    const ref = head.match(/^ref: (.+)$/)?.[1]; if (!ref) return null;
    const common = fs.existsSync(path.join(gitDir, 'commondir')) ? path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim()) : gitDir;
    for (const dir of [gitDir, common]) { const loose = path.join(dir, ref); if (fs.existsSync(loose)) return fs.readFileSync(loose, 'utf8').trim(); }
    const packed = fs.readFileSync(path.join(common, 'packed-refs'), 'utf8').split('\n').find(line => line.endsWith(' ' + ref));
    return packed ? packed.split(' ')[0] : null;
  } catch { return null; }
}
/** A write: local Origin (when sent) and a resolved actor. */
function checkWrite(request, server) {
  checkWriteOrigin(request, server);
  requireWriteActor();
}
async function staticFile(publicDir, pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (pathname.includes('\\') || pathname.includes('\0') || segments.some(segment => segment.startsWith('.'))) {
    throw new StateError('File is not available.', 404);
  }
  if (!segments.length || pathname.endsWith('/')) segments.push('index.html');
  const type = types[path.extname(segments.at(-1)).toLowerCase()]||(publicStudyModules.has(pathname)?'text/javascript; charset=utf-8':null);
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
export async function createServer({ dataDir = path.join(root, 'data'), i64osDirections, voiceHome, publicDir = path.join(root, 'public'), connections, connectionsEditable = true, extraction = null, transcriptionRuntime, ingestionOptions = null, magazineRoots, execution = createWorkspaceExecution(), nativeAIExecution, sharedArticles = false, publicationFault, articleMakeSkillRoot, studyOriginalRoots=null, studyRelocation=null, researchEnabled=true, localAtlasExportDir=null, transcriptLibrary=null, materialHostActions=null, importedSourceFactory=null, packageView=null, magazineVault: magazineVaultOptions, magazineCheckReceipts=false, release=null, retainedCarouselState, browserCarouselOrigins = [], phonePickup = null, activityFault, journalBeforeAppend } = {}) {
  if(typeof magazineCheckReceipts!=='boolean')throw new TypeError('Magazine check receipt permission must be an explicit boolean.');
  // Host-selected read capability only. No request can choose a source path or
  // establish an association between an original and the current manuscript.
  const retainedCarouselSource=retainedCarouselState===undefined||retainedCarouselState===null?null:createRetainedCarouselReader({retainedCarouselState});
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
  let recordings,libraryWorkReferences=null,projectMembership=null;
  const library = createLibrary({ dataDir, workReferences:{read:input=>{if(!libraryWorkReferences)throw new StateError('Existing work references are unavailable.',503);return libraryWorkReferences.read(input);},measure:input=>{if(!libraryWorkReferences)throw new StateError('Measured media usage is unavailable.',503);return libraryWorkReferences.measure(input);}},projectAssociations:{read:input=>{if(!projectMembership)throw new StateError('Named Project authority is unavailable.',503);return projectMembership.readAuthority(input);}}, connections, originalCatalog:studyOriginalRoots?createStudyOriginalSourceCatalog(studyOriginalRoots):null, retainedCatalog:transcriptLibrary?createRetainedTranscriptCatalog(transcriptLibrary):null, extraction, legacyState: () => store.get(), urlIngestion: extraction ? null : source => ingestion.schedule(source), ingestionState: id => ingestion.state(id), recordingState: id => recordings?.state(id), recordingSourceSnapshot: source => recordings?.sourceSnapshot?.(source) });
  const writingTemplates=createWritingTemplates({store,library,magazine:{read:input=>magazineRead(()=>magazine.read(input))}});
  const connectedFolders = createConnections({dataDir,library,connections,editable:connectionsEditable,...(!connectionsEditable?{reason:'Folders are managed by the server startup configuration.'}:{})});
  const researchMaterial = createResearchMaterial({dataDir,library});
  const researchInput = input => {if(input.projectId!==store.get().project.id)throw new StateError('Research belongs to another project.',409);return input;};
  const guidance = createGuidance({ dataDir, referenceDir: path.join(root, 'reference', 'guidance'), voiceSource: resolveVoiceSource({ dataDir, option: i64osDirections, home: voiceHome }) });
  const voiceCorrections = createVoiceCorrections({ dataDir });
  recordings = createRecordings({ dataDir, library, transcriptionRuntime });
  const transcriptTools=createTranscriptToolConnection({dataDir,library,recordings});
  const albums = createICloudAlbums({ dataDir, library, ...(ingestionOptions?.albumFetch ? { fetcher: ingestionOptions.albumFetch } : {}) });
  const studyBindings=createStudyBindings({dataDir,store});
  const materialFolder=createMaterialFolder({dataDir,bindings:studyBindings,library,store,...(materialHostActions?.openFolder?{openFolder:materialHostActions.openFolder}:{})});
  const studyOriginals=studyOriginalRoots?createStudyOriginals(studyOriginalRoots):null;
  const studyDerivedFindings=studyOriginals?createStudyDerivedFindings({dataDir,originals:studyOriginals}):null;
  const studyDrafts=studyOriginals?createStudyDraftCopies({dataDir,originals:studyOriginals,studyRelocation,vaultBound:source=>magazineVault.vaultBound(source)}):null;
  const studyHumanDirection=studyDrafts?createStudyHumanDirection({dataDir,store,bindings:studyBindings,drafts:studyDrafts,library,validateDecisionTarget:input=>createStudyDirectionTarget({drafts:studyDrafts,bindings:studyBindings,outputs:studyOutputs,structureTests})(input),loadDirectionOptions:input=>createStudyDirectionOptions({drafts:studyDrafts,bindings:studyBindings,firstFlow})(input),...sharedArticles?{readOutputDocument:input=>store.readArticle(input)}:{}}):null;
  const collectionDirection=studyHumanDirection||createStudyHumanDirection({dataDir,library});
  let researchAnswers;const answerContext={projectContext:(...args)=>researchAnswers.projectContext(...args)};
  const requests = createRequestPreviews({ dataDir, store, library, guidance, researchMaterial, researchAnswers:answerContext,...(studyHumanDirection?{humanDirection:studyHumanDirection}:{}) });
  const sharedArticleBridge=sharedArticles?createSharedArticleBridge({dataDir,store,requests,parseArticle,guidance,writingTemplates}):null;
  let sharedCarouselBridge=null;
  const exports = createExports({ dataDir, store });
  const carousel = createCarouselExports({dataDir,store,library});
  const terminal = createTerminal({ dataDir, store, requests });
  const sharedArticleLauncher=createSharedArticleLauncher({dataDir,store,bridge:sharedArticleBridge,terminal});
  const carouselMake = createCarouselMake({dataDir,store,library,requests,terminal,execution,publicDir,...(articleMakeSkillRoot?{skillRoot:articleMakeSkillRoot}:{})});
  const articleMake = createArticleMake({dataDir,store,library,requests,terminal,execution,...(articleMakeSkillRoot?{skillRoot:articleMakeSkillRoot}:{})});
  const articleVisual = createArticleVisual({dataDir,store,library,terminal,execution});
  const passageRevisions = createPassageRevisions({dataDir,store,requests,terminal,execution});
  researchAnswers=createResearchAnswers({dataDir,store,library,requests,execution,resolveStudySources:(binding,scope)=>createStudyResearchSources({drafts:studyDrafts,library,firstFlow,conceptWork})(binding,scope)});
  const firstFlow=createFirstFlow({dataDir,store,library,recordings,requests,execution,validateStudyScope:scope=>createStudyResearchScope({drafts:studyDrafts,bindings:studyBindings,resolveSources:createStudyResearchSources({drafts:studyDrafts,library,conceptWork}),validateStandInTarget:input=>structureTests.validateTarget(input)})(scope)});
  const materialAlbums=createMaterialAlbums({library,albums,bindings:studyBindings,firstFlow,store});
  const sourceSessions=importedSourceFactory?await importedSourceFactory():null;
  // Kept-conversation edits are journaled by the transcript owner; who made each is kept here.
  const provenanceLedger=createProvenanceLedger({dataDir});
  const stampSourceSession=async(action,input)=>{const out=await sourceSessions[action](input);if(typeof input?.operationId==='string'&&typeof input?.sessionId==='string'){try{provenanceLedger.stamp({area:'source-session',scopeId:input.sessionId,key:input.operationId,action});}catch(error){console.error('Source edit provenance was not recorded:',error.message);}}return out;};
  const studyOwnedPhotoBindings=studyDrafts?createStudyOwnedPhotoBindings({dataDir,drafts:studyDrafts,bindings:studyBindings,store}):null;
  const createStudyCollection=async input=>{const document=await studyDrafts.createCollection(input);if(document.binding.status!=='ready'||document.readiness?.ready!==true)return document;const projectBinding=await studyBindings.select({projectKey:document.binding.parentStudyId,title:document.binding.title,operationId:input.operationId}),photoBinding=await studyOwnedPhotoBindings.select({bindingId:document.binding.id,parentStudyId:document.binding.parentStudyId,operationId:input.operationId});return {...document,projectBinding,photoBinding};};
  const conceptWork=studyHumanDirection?createConceptWork({drafts:studyDrafts,humanDirection:studyHumanDirection,bindings:studyBindings,library,createCollection:createStudyCollection,ledger:createProvenanceLedger({dataDir})}):null;
  const validateOutputStandIn=async(input,{rootSnapshot}={})=>{let proof;if(rootSnapshot){const b=rootSnapshot.binding,m=b?.structureTest;if(b?.id!==input.rootBindingId||b.parentStudyId!==input.parentStudyId||b.kind!=='collection-root'||b.origin!=='structure-test'||b.status!=='ready'||rootSnapshot.readiness?.ready!==true||m?.role!=='structure-test'||m.label!=='stand-in'||!AGENT_ACTORS.includes(m.createdBy))throw new StateError('The exact verified test root changed during publication.',403);proof={root:rootSnapshot,view:{source:{parentStudyId:m.sourceParentStudyId,bindingId:m.sourceBindingId,draftHash:m.draftHash,captureHash:m.captureHash},createdBy:m.createdBy}};}else proof=await structureTests.validateTarget({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId});if(proof.root.binding.id!==input.rootBindingId)throw new StateError('Choose the exact registered structure-test root.',403);return {canStandInReview:true,fingerprint:studyPhotoFiles.digest(JSON.stringify({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId,source:proof.view.source,createdBy:proof.view.createdBy}))};};
  const studyOutputFactory=studyDrafts&&sharedArticles?createNativeOutputFactory({dataDir,store,native:studyDrafts,originals:studyOriginals,library,ownedPhotos:studyOwnedPhotoBindings,retainedSource:retainedCarouselSource,browserOrigins:browserCarouselOrigins,validateStandInReview:validateOutputStandIn}):null;
  const studyOutputs=studyOutputFactory?.owner;
  const structureTests=studyDrafts&&studyOutputs?createStructureTests({drafts:studyDrafts,bindings:studyBindings,photos:studyOwnedPhotoBindings,outputs:studyOutputs,humanDirection:studyHumanDirection}):null;
  const studyFootage=structureTests?createStudyFootage({dataDir,library,resolveScope:createStudyFootageScope({drafts:studyDrafts,bindings:studyBindings,firstFlow,structureTests})}):null;
  const structureTestRecords=structureTests&&studyOriginals&&studyDerivedFindings?createStructureTestRecords({structureTests,drafts:studyDrafts,originals:studyOriginals,derivedFindings:studyDerivedFindings}):null;
  const studyDraftChecks=studyDrafts?createStudyDraftChecks({dataDir,drafts:studyDrafts,outputs:studyOutputs}):null;
  const studyMediaUsage=studyOutputs?createMediaUsage({outputs:studyOutputs,library,articleSpec:mediaArticleSpec,carouselTemplates:mediaCarouselTemplates.T,listScopes:async()=>{const c=await studyDrafts.catalog(),seen=new Set();return [...(c.drafts||[]),...(c.collections||[])].filter(r=>r.bindingStatus==='ready'&&r.bindingId&&r.parentStudyId).flatMap(r=>{const scope={rootBindingId:r.bindingId,parentStudyId:r.parentStudyId},key=JSON.stringify(scope);if(seen.has(key))return [];seen.add(key);return [scope];});}}):null;
  const studyOutputExports=studyOutputFactory?createNativeOutputExports({dataDir,store,outputs:studyOutputs,resolveScope:studyOutputFactory.scope.resolve,library,exports,carousel,validateStandInReview:validateOutputStandIn}):null;
  libraryWorkReferences=createLibraryWorkReferences({store,outputs:studyOutputs||{read(){throw new StateError('Native output authority is unavailable.',503);}},mediaUsage:studyMediaUsage});
  projectMembership=studyDrafts&&studyOwnedPhotoBindings&&studyOutputs?createProjectMembership({store,bindings:studyBindings,drafts:studyDrafts,ownedPhotos:studyOwnedPhotoBindings,outputs:studyOutputs,library,workReferences:libraryWorkReferences}):null;
  const currentUnderstanding=createCurrentUnderstandingResolver({library,humanDirection:studyHumanDirection||collectionDirection,collectionDirection,nativeOutputs:studyOutputs,nativeWords:studyDrafts,carouselWords:store,conceptContextProjection,workReferences:libraryWorkReferences});
  const assistanceDirection=studyDrafts&&studyHumanDirection?createAssistanceDirectionContext({resolver:currentUnderstanding,humanDirection:studyHumanDirection,collectionDirection,library,drafts:studyDrafts}):null;
  const nativeCarouselMake=studyOutputFactory&&studyHumanDirection?createNativeCarouselMake({dataDir,native:studyDrafts,outputs:studyOutputs,scope:studyOutputFactory.scope,proof:studyOutputFactory.proof,guidance,humanDirection:studyHumanDirection,assistanceDirection,library,execution:nativeAIExecution??execution,terminal,publicDir,skillRoot:articleMakeSkillRoot}):null;
  sharedCarouselBridge=sharedArticles?createSharedCarouselBridge({dataDir,store,requests,guidance,writingTemplates,nativeOutputs:studyOutputs,humanDirection:studyHumanDirection,library,assistanceDirection}):null;
  const workContinuity=createWorkContinuity({dataDir,direction:studyHumanDirection||collectionDirection,outputs:studyOutputs,outputExports:studyOutputExports,understanding:currentUnderstanding});
  const inquiryInterface=createInquiryInterfaceRoutes({library,direction:collectionDirection,projectMembership:projectMembership||{read(){throw new StateError('Named Project authority is unavailable.',503);},readAuthority(){throw new StateError('Named Project authority is unavailable.',503);}},understanding:currentUnderstanding,listProjectSelectors:studyDrafts&&projectMembership?createInquiryProjectSelectors({drafts:studyDrafts,bindings:studyBindings,readAuthority:endpoint=>projectMembership.readAuthority(endpoint)}):async()=>[]});
  const continuityInterface=createContinuityInterfaceRoutes({continuity:workContinuity,understanding:currentUnderstanding,outputExports:studyOutputExports});
  const studyPhotos=studyOwnedPhotoBindings?createStudyPhotos({dataDir,library,runtime:studyPhotoFiles,resolveBinding:projectId=>studyOwnedPhotoBindings.resolve(projectId)}):null;
  const studyResearchChoices=studyDrafts?createStudyResearchChoices({dataDir,originals:studyOriginals,drafts:studyDrafts}):null;
  const studyEditorialPlan=studyDrafts?createStudyEditorialPlanContext({drafts:studyDrafts,originals:studyOriginals,choices:studyResearchChoices,validateStandInTarget:input=>structureTests.validateTarget(input)}):null;
  const studyPlanContext=studyDrafts?createStudyFirstFlowPlanContext({dataDir,savedPlan:studyEditorialPlan,firstFlow}):null;
  const studyProjectMaterial=studyDrafts?createStudyProjectMaterialContext({dataDir,firstFlow,drafts:studyDrafts}):null;
  const captureStudySources=studyDrafts?input=>studyDrafts.captureSources(input,{material:studyProjectMaterial}):null,stopStudySources=studyDrafts?input=>studyDrafts.stopSources(input):null,listStudySources=studyDrafts?input=>studyDrafts.listCaptureSources(input,{material:studyProjectMaterial}):null;
  const studyAI=studyDrafts?createStudyAI({dataDir,drafts:studyDrafts,execution:nativeAIExecution??execution,onExecutionChange:event=>events.emit(event),validateStandInTarget:input=>structureTests.validateTarget(input),humanDirection:studyHumanDirection,editorialPlan:studyPlanContext,projectMaterial:studyProjectMaterial,learning:researchAnswers.study,guidance,assistanceDirection,voiceCorrections}):null;
  const draftCall=async fn=>{if(!studyDrafts)throw new StateError('Current manuscript originals are not configured.',503);try{return await fn();}catch(error){throw Object.assign(new StateError(error.message,error.status||500),error.outcome?{outcome:error.outcome}:{});}};
  const originalRead=fn=>{if(!studyOriginals)throw new StateError('Current original records are not configured; retained snapshots remain available.',503);try{return fn();}catch(error){throw new StateError(error.message,error.status||500);}};
  const localAtlas=createLocalAtlasRetrieval({root:localAtlasExportDir});
  const researchAction=fn=>input=>{if(!researchEnabled)throw new StateError('Fresh research is being validated. Existing story records are ready to read.',503);return fn(input);};
  async function guardCarouselOutput(input){
    if(!sharedCarouselBridge||typeof input?.outputId!=='string')return;
    const state=await store.read({allowEditedMarkdown:true}),document=state.project.document;
    const output=document?.outputs?.find(o=>o.id===input.outputId&&o.kind==='carousel');
    // Saved historical artifacts remain downloadable; only a current owned
    // carousel can publish from its live wording file.
    if(output)await store.readCarouselWords({documentId:document.id,outputId:output.id});
  }
  // Agent coordination routes (mounted below, before the route map).
  const extraCommands=[['GET','/api/magazine/library-photos/preview',['rootId','sourceId','revision','sourceHash?','verify?']],['GET','/api/magazine/library-photos/asset',['file']],['GET','/api/events',['since?','bootId?','kind?','id?']],['GET','/api/events/since',['since?','bootId?','kind?','id?','limit?']],['GET','/api/presence',['kind?','id?']],['POST','/api/presence'],['GET','/api/leases',['kind?','id?']],['POST','/api/leases/acquire'],['POST','/api/leases/release'],['GET','/api/journal',['kind?','id?','status?','actor?','since?','before?','limit?']],['POST','/api/journal/handoff'],['POST','/api/journal/ask']];
  const events=createEventBus(),presence=createPresence({events}),sseClients=new Set(),leases=createLeases({dataDir,events}),journal=createJournal({dataDir,beforeAppend:journalBeforeAppend});
  // W3's owner projection is optional while source workstreams are isolated.
  // Once present, import failures are fatal rather than silently dropping history.
  const simmerActivity=fs.existsSync(path.join(root,'services/simmer-operations.mjs'))?(await import('./services/simmer-operations.mjs')).simmerOperations(dataDir):null;
  const activity=createActivityRecovery({dataDir,journal,events,readNativeReceipt:input=>studyDrafts.inspect(input),ownerReceipts:()=>[...(simmerActivity?.activityReceipts()||[]),...conversationCaptures.activityReceipts()],fault:activityFault});
  let activityHealth;
  // Standing reads settle announced changes only when some request that could write has arrived since the last settle.
  // A write counts when it has finished (after its change notice), and while any write is running every read settles.
  // Anything that emits a change (including background owners with no request) also asks for the next settle, and a
  // settle older than five seconds is repeated, so a quiet writer with no request or event is bounded to that long.
  // Writes that have answered but are still announcing their change are waited for, so a read made right after a write
  // answers cannot beat that write's announcement.
  let writesInFlight=0,writesDone=0,settledAt=-1,settledTime=0;const announcing=new Set();const ANNOUNCE_WAIT_MS=Math.max(1,Number(process.env.AR_ANNOUNCE_WAIT_MS)||5000);
  // The magazine's one writer (runtime/services/magazine-vault): configured by the host, read-only unless writable:true.
  const magazineConfig=await loadMagazineVaultConfig({dataDir,options:magazineVaultOptions});
  // One consent desk for the whole server: the app, agents and every publish path read the same hold through it.
  // A piece is known by more than one id: the app's project id and, for the Magazine, the vault's story id (mag-<slug>). They meet at
  // the draft file (the original catalog and the copies opened from it name the project; the registered story names its drafts).
  // The desk asks this for every id it is given, so a desk saved under either id holds paths that know only the other.
  const consentAliases=id=>{
    const out=new Set(),links=studyDrafts?.draftLinks?.()||[];
    if(/^mag-/.test(id)){
      let story=null;try{story=magazineVault.projects.project(id);}catch{}
      const rels=new Set([].concat(story?.vaultRecords?.draft||[]).map(d=>d.rel));
      for(const link of links)if(rels.has(link.path))for(const x of link.ids)out.add(x);
    }
    for(const link of links)if(link.ids.includes(id)){let story=null;try{story=magazineVault.projects.byFile(link.path);}catch{}if(story?.storyId)out.add(story.storyId);}
    out.delete(id);return [...out];
  };
  const consentDesk=createConsentDesk({dataDir,library,aliases:consentAliases});
  const magazineVault=createMagazineVault({...magazineConfig,dataDir,consentDesk,events,journal,leases,editorialRoot:path.join(root,'..','editorial'),intakeEngine:recordings.magazineIntake});
  let originalPhotoProvider,publicationPhotoProvider;
  const originalPhotos=magazineConfig.filesRoot?{list:()=> (originalPhotoProvider??=createReviewMedia({filesRoot:magazineConfig.filesRoot})).list(),open:input=>(originalPhotoProvider??=createReviewMedia({filesRoot:magazineConfig.filesRoot})).open(input)}:null;
  const publicationPhotos=magazineConfig.magSendRepo?{catalog:input=> (publicationPhotoProvider??=createPublicationPhotoCatalog({repoRoot:magazineConfig.magSendRepo})).catalog(input),preview:input=>(publicationPhotoProvider??=createPublicationPhotoCatalog({repoRoot:magazineConfig.magSendRepo})).preview(input)}:null;
  const magazineLibraryPhotos=createMagazineLibraryPhotos({library,originals:originalPhotos,publication:publicationPhotos});
  const magazineWorking=createWorkingDraftBridge({magazine:magazineVault,journal,photoLibrary:magazineLibraryPhotos});
  const shareSubjectGuard=createSourcedSubjectGuard({originals:studyOriginals,working:magazineWorking});
  const studyShare=createSharePreparation({dataDir,outputs:studyOutputs,files:studyPhotoFiles,outputPrivatePrefix,exportOwners:()=>({native:studyOutputExports,magazine:magazineOutputExports}),magazine:{read:async input=>{const value=await magazineWorking.read({storyId:input.storyId,pieceId:input.pieceId,edition:'working'});if(value.document.hash!==input.expectedWorkingHash)throw new StateError('The working Article changed before Share preparation.',409);shareSubjectGuard({parentStudyId:input.parentStudyId,authority:value.authority,draftHash:value.document.hash});return {...value,parentStudyId:input.parentStudyId,rootIdentity:magazineWorking.catalog().rootIdentity};}}});
  const sourcedParagraphs=createSourcedParagraphs({magazine:magazineVault,working:magazineWorking,humanDirection:studyHumanDirection,execution,dataDir,validateSubject:createSourcedSubjectGuard({originals:studyOriginals,working:magazineWorking})});
  const magazineOutputExports=createMagazineOutputExports({working:magazineWorking,exports,repoRoot:magazineConfig.magSendRepo,roots:magazineRoots,libraryPhotos:magazineLibraryPhotos});
  const magazineMechanicalChecks=studyOriginals&&magazineVault.extra.checks?createMagazineMechanicalChecks({dataDir,magazine:magazineVault,working:magazineWorking,originals:studyOriginals,enabled:magazineCheckReceipts}):null;
  // Coordination and navigation/selection are not authored changes. Keep them out of edit activity.
  const NOT_JOURNALED=new Set(['presence.post','leases.acquire','leases.release','journal.handoff','journal.ask','first-flow.select','study.photos.select','study.human-direction.select','study-draft.open']);
  // Decisions whose reason belongs in the journal line itself (Adrian overriding the consent hold, taking a person off).
  const JOURNAL_REASONS=new Set(['consent.share.override','consent.people.remove']);
  // The path the router will act on, so the journal reads the same spelling it does (the human-only gate checks every spelling, see gateSpellings):
  // decoded, as routeRequest matches it, and URL-normalised under /transcription/, as the recordings router
  // matches it (that folds `..`, `.` and backslashes). Null when the path cannot be decoded; the router refuses that.
  function routedPath(request){
   let pathname;try{pathname=decodeURIComponent((request.url||'/').split('?')[0]);}catch{return null;}
   if(!pathname.startsWith('/transcription/'))return pathname;
   try{return new URL(request.url,'http://local.invalid').pathname;}catch{return pathname;}
  }
  function activityMeta(request,response,context){
   if(['GET','HEAD','OPTIONS'].includes(request.method)||!context)return null;
   const pathname=routedPath(request);if(pathname===null)return null;
   const command=findCommand(commandList(),request.method,pathname);
   if(!command||command.readOnly||NOT_JOURNALED.has(command.name))return null;
   const input=request.arInput,result=response.arResult,query=new URL(request.url||'/','http://local.invalid').searchParams;
   const scope=scopeOf({input,result,query,section:command.section}),operationId=typeof input?.operationId==='string'?input.operationId:null;
   const expected=input&&typeof input==='object'?(Number.isSafeInteger(input.expectedRevision)||typeof input.expectedHash==='string'?{revision:input.expectedRevision??null,hash:input.expectedHash??null}:input.expected&&typeof input.expected==='object'?{revision:input.expected.revision??null,hash:input.expected.hash??null}:null):null;
   return {operationId,actor:context.actor,client:context.client,scope,kind:command.name,before:expected};
  }
  async function afterRequest(request,response,context){
   const meta=activityMeta(request,response,context);if(!meta)return;
   if(simmerActivity&&['simmer.intake','simmer.dish'].includes(meta.kind)||meta.kind==='conversation.capture'&&(response.arResult?.id||response.arResult?.receipt)){activityHealth=await activity.reconcile();return;}
   const input=request.arInput,result=response.arResult,status=response.statusCode,ok=status>=200&&status<300;
   const after=ok?{revision:revisionOf(result),hash:typeof result?.hash==='string'?result.hash:null}:null;
   activity.recordResponse({...meta,status:ok?'committed':result?.receipt?.status==='partial'?'partial':status===409||status===423?'conflict':'rejected',after,reason:ok?(JOURNAL_REASONS.has(meta.kind)&&typeof input?.reason==='string'?input.reason.slice(0,500):null):String(result?.error||'HTTP '+status).slice(0,500),http:status});
   activityHealth=await activity.reconcile();
  }
  function eventFilter(url){const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');return {...(kind?{kind}:{}),...(id?{id}:{})};}
  async function coordination(request,response,pathname,url){
   if(pathname==='/api/journal'||pathname.startsWith('/api/events'))activityHealth=await activity.reconcile();
   if(pathname==='/api/events/since'&&request.method==='GET'){const since=Number(url.searchParams.get('since')||0),limit=Number(url.searchParams.get('limit')||200);json(response,200,events.since(since,eventFilter(url),Number.isSafeInteger(limit)?limit:200,url.searchParams.get('bootId')));return true;}
   if(pathname==='/api/events'&&request.method==='GET'){
    const since=Number(url.searchParams.get('since')??request.headers['last-event-id']??events.cursor),filter=eventFilter(url);
    response.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const send=event=>response.write('id: '+event.cursor+'\nevent: change\ndata: '+JSON.stringify(event)+'\n\n');
    const backlog=events.since(Number.isSafeInteger(since)?since:events.cursor,filter,1000,url.searchParams.get('bootId'));
    const hello={bootId:backlog.bootId,cursor:backlog.cursor,headCursor:backlog.headCursor,reset:backlog.reset,resetReason:backlog.resetReason};
    response.write('retry: 3000\nevent: hello\ndata: '+JSON.stringify(hello)+'\n\n');
    if(backlog.reset)response.write('event: reset\ndata: '+JSON.stringify(hello)+'\n\n');
    for(const event of backlog.reset?[]:backlog.events)send(event);
    const stop=events.subscribe(send,filter),beat=setInterval(()=>response.write(': ping\n\n'),20_000);beat.unref?.();
    const client={response,close(){clearInterval(beat);stop();sseClients.delete(client);}};sseClients.add(client);
    request.on('close',()=>client.close());response.on('close',()=>client.close());
    return true;
   }
   if(pathname==='/api/leases'&&request.method==='GET'){json(response,200,leases.list(eventFilter(url)));return true;}
   if(pathname==='/api/journal'&&request.method==='GET'){const q=Object.fromEntries(['kind','id','status','actor','since','before','limit'].filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)]));json(response,200,{...await journal.read(q),recovery:activityHealth});return true;}
   const coordinationWrites={'/api/leases/acquire':input=>leases.acquire(input,request.arActor),'/api/leases/release':input=>leases.release(input,request.arActor),'/api/journal/handoff':async input=>{const line=await journal.handoff(input,request.arActor);events.emit({kind:'handoff',scope:line.scope,revision:null,actor:line.actor,client:line.client,operationId:line.operationId,to:line.to,summary:line.summary});return line;},'/api/journal/ask':async input=>{const line=await journal.ask(input,request.arActor);events.emit({kind:'needs-decision',scope:line.scope,revision:null,actor:line.actor,client:line.client,operationId:line.operationId,to:line.to,summary:line.summary,...(line.options?{options:line.options}:{})});return line;}};
   if(Object.hasOwn(coordinationWrites,pathname)){if(request.method!=='POST'){response.setHeader('Allow','POST');throw new StateError('Method is not supported.',405);}checkWrite(request,server);if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);json(response,200,await coordinationWrites[pathname](await body(request,64*1024)));return true;}
   if(pathname==='/api/presence'){
    if(request.method==='GET'){json(response,200,presence.list(eventFilter(url)));return true;}
    if(request.method==='POST'){checkWrite(request,server);if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);const input=await body(request,64*1024);const ctx=request.arActor;json(response,200,presence.post(input,ctx));return true;}
    response.setHeader('Allow','GET, POST');throw new StateError('Method is not supported.',405);
   }
   return false;
  }
  const simmer=await sharedSimmerServices({dataDir,library,concepts:conceptWork});
  const conversationCaptures=createConversationCapture({dataDir,concepts:conceptWork,...simmer,instagram:sharedInstagramStudio({dataDir,library,consentDesk})});
  const currentWork=conceptWork?createCurrentWork({concepts:conceptWork,direction:studyHumanDirection,...simmer,understanding:currentUnderstanding,studyAI,presence,continuity:workContinuity,captures:conversationCaptures,needs:sharedNeedsYou({dataDir,events,recordings})}):null;
  // Where a subject stands (subject.standing, subjects.standing): one gathered read per subject, cached for all and kept fresh by the change stream.
  events.subscribe(()=>{writesDone++;});
  const subjectStanding=studyDrafts?createSubjectStanding({dataDir,drafts:studyDrafts,outputs:studyOutputs,checks:studyDraftChecks,consentDesk,suggestions:studyAI?input=>studyAI.call('list',input):null,library,firstFlow,simmer,instagram:sharedInstagramStudio({dataDir,library,consentDesk}),needsYou:sharedNeedsYou({dataDir,events,recordings}),places:sharedSubjectPlaces({dataDir}),magazine:magazineVault.configured?magazineVault:null,working:magazineVault.configured?magazineWorking:null,magazineFiles:magazineConfig.filesRoot||null,originalsRoot:studyOriginalRoots?.vaultRoot||null,wordChecks:async()=>(await import('./services/words-http.mjs')).wordsFor({dataDir,events,recordings}).shared.checks({}),topics:inquiryInterface?async()=>(await inquiryInterface.handle({method:'GET',path:'/catalog',input:{}})).body:null,events,settle:async()=>{if(announcing.size){let timer;await Promise.race([Promise.all([...announcing]),new Promise(r=>{timer=setTimeout(r,ANNOUNCE_WAIT_MS);})]);clearTimeout(timer);}const seen=writesDone;if(!writesInFlight&&seen===settledAt&&Date.now()-settledTime<5000)return;activityHealth=await activity.reconcile();if(!writesInFlight){settledAt=seen;settledTime=Date.now();}}}):null;
  const studyLanguage=studyOutputs&&studyDrafts?createStudyLanguageConnection({dataDir,outputs:studyOutputs,drafts:studyDrafts,share:studyShare,structureTests,execution:nativeAIExecution??execution}):null;
  const sourceLanguage=createSourceTranslationProposals({dataDir,readSelection:createSourceTranslationSelectionReader({sourceSessions,drafts:studyDrafts,validateCopyTarget:input=>structureTests?.validateTarget(input)}),validateCopyTarget:input=>structureTests?.validateTarget(input),execution:nativeAIExecution??execution});
  const localTranscriptCandidates=createLocalTranscriptCandidates({dataDir,recordings,library});
  const sourceTranscript=createSourceTranscriptProposals({library,recordings,readCandidate:input=>localTranscriptCandidates.readCandidate(input)});
  const sourceLineChecks=createSourceLineChecks({dataDir});
  const maintainedCommandRoutes=createRouteMap({captureStudySources,stopStudySources,listStudySources,nativeCarouselMake,voiceCorrections,sourceLineChecks,studyLanguage,sourceLanguage,sourceTranscript,localTranscriptCandidates,studyFootage,studyDirectionOptions:createStudyDirectionOptions({drafts:studyDrafts,bindings:studyBindings,firstFlow}),studyDirectionTarget:createStudyDirectionTarget({drafts:studyDrafts,bindings:studyBindings,outputs:studyOutputs,structureTests}),structureTestRecords,localAtlas,structureTests,albums,articleMake,articleVisual,carousel,carouselMake,conceptWork,connectedFolders,createStudyCollection,draftCall,execution,exports,extraction,firstFlow,guardCarouselOutput,guidance,ingestion,library,magazine,magazineRead,materialAlbums,materialFolder,originalRead,passageRevisions,recordings,requests,researchAction,researchAnswers,researchEnabled,researchInput,researchMaterial,sharedArticles,sourceSessions,stampSourceSession,store,studyAI,studyBindings,studyDerivedFindings,studyDraftChecks,studyDrafts,studyHumanDirection,studyMediaUsage,studyOriginals,studyOutputExports,studyOutputs,studyOwnedPhotoBindings,studyPhotos,studyResearchChoices,studyShare,consentDesk,terminal,transcriptTools,writingTemplates,magazineWorking,sourcedParagraphs,magazineMechanicalChecks,magazineLibraryPhotos,magazineOutputExports,magazineRoutes:createMagazineRoutes(magazineVault,magazineVault.extra)});
  const commandRoutes=context=>({...maintainedCommandRoutes(context),'/api/study/outputs/copy-retained-carousel':{POST:input=>draftCall(()=>{
    if([...context.url.searchParams].length)throw new StateError('Use the exact retained copy command without a query.',400);
    if(!retainedCarouselSource||!studyOutputs)throw new StateError('Retained carousel copying is not configured for this workspace.',503);
    return studyOutputs.copyRetainedCarousel(input);
  })},'/api/study/outputs/undo-words':{POST:input=>draftCall(()=>{
    if([...context.url.searchParams].length)throw new StateError('Use the exact wording Undo command without a query.',400);
    if(!studyOutputs)throw new StateError('Saved carousel wording is not configured for this workspace.',503);
    return studyOutputs.undoCarouselWords(input);
  })},'/api/study/outputs/copy-browser-carousel':{POST:input=>draftCall(()=>{
    if([...context.url.searchParams].length)throw new StateError('Use the exact browser copy command without a query.',400);
    if(context.request.headers.origin!==context.url.origin)throw new StateError('Browser carousel copying requires this workspace origin.',403);
    if(!studyOutputs)throw new StateError('Browser carousel copying is not configured for this workspace.',503);
    return studyOutputs.copyBrowserCarousel(input,{origin:context.url.origin});
  })}});
  let registry=null;
  const commandList=()=>registry||(registry=describeRoutes(commandRoutes({url:new URL('http://127.0.0.1/'),request:{headers:{}},server:null,outputQuery:()=>({}),decorateOutputExports:value=>value,describe:async()=>({})}),extraCommands));
  const retainedCopyAvailability=async()=>{
    const result={readOnly:true,configured:!!retainedCarouselSource,available:false,requiresExplicitDestination:true,requiresOriginalValidation:true,items:[]};
    if(!retainedCarouselSource)return result;
    try{
      const retained=await retainedCarouselSource.list();
      return {...result,available:retained.available===true&&!!studyOutputs,items:retained.items.filter(item=>item.copyAllowed!==false),...(!studyOutputs?{error:'The existing native output writer is unavailable.'}:{})};
    }catch(error){return {...result,error:[403,409,413,415,503].includes(error.status)?error.message:'The retained originals are unavailable; their existing records were preserved.'};}
  };
  // Metadata only: no destination is selected/created here. The caller must
  // explicitly choose a ready existing root, then read /api/study/outputs for
  // photoScope + expectedOutput and /api/study-draft/read for expectedNative.
  const describeCapabilities=async({only}={})=>only==='commands'?{schema:CAPABILITIES_SCHEMA,git:{sha:gitSha(path.dirname(root))??releaseSha(path.dirname(root),release)},commands:commandList().map(publicEntry)}:({schema:CAPABILITIES_SCHEMA,git:{sha:gitSha(path.dirname(root))??releaseSha(path.dirname(root),release)},commands:commandList().map(publicEntry),retainedCarouselCopy:await retainedCopyAvailability(),browserCarouselCopy:{available:!!studyOutputs,requiresExplicitDestination:true,requiresBrowserSnapshot:true}});
  const gateSpellings=rawPath=>{const out=new Set(),add=value=>{if(typeof value!=='string')return;out.add(value);out.add(path.posix.normalize(value.replaceAll('\\','/')));};add(rawPath);try{const folded=new URL(rawPath,'http://local.invalid').pathname;add(folded);add(decodeURIComponent(folded));}catch{}try{const decoded=decodeURIComponent(rawPath);add(decoded);add(new URL(decoded,'http://local.invalid').pathname);}catch{}return [...out];};
  const guardHumanOnly=(method,rawPath,context)=>{for(const pathname of gateSpellings(rawPath)){guardOne(method,pathname,context);}};
  const guardOne=(method,pathname,context)=>{const command=findCommand(commandList(),method,pathname);if(!command||!command.actors.includes('human'))return;if(command.relay==='chat'&&CHAT_CARRIERS.includes(context?.actor))return;if(!context||!isHuman(context.actor))throw new StateError(`This decision is human-only; ${context?.actor||'an unattributed caller'} may propose but not decide.`,403);};
  // Every request runs inside its actor context so services can stamp writes.
  async function routeRequest(request, response) {
      let pathname;
      try { pathname = decodeURIComponent((request.url || '/').split('?')[0]); }
      catch { throw new StateError('Invalid request path.'); }
      if(pathname==='/api/current-work/contract'){if(request.method!=='GET')throw new StateError('Use GET.',405);return json(response,200,CURRENT_WORK_CONTRACT);}
      if(['/api/current-work/read','/api/current-work/validate','/api/conversation/capture'].includes(pathname)){
        if(request.method!=='POST')throw new StateError('Use POST.',405);
        if(!currentWork)throw new StateError('Current work requires the native Document Study owners.',503);
        const capturing=pathname==='/api/conversation/capture';if(capturing)checkWrite(request,server);else checkWriteOrigin(request,server);
        if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
        const input=await body(request,256*1024);
        if(capturing){request.arInput={operationId:input?.operationId,parentStudyId:input?.target?.parentStudyId};if(typeof input?.target?.parentStudyId==='string')leases.check({kind:'project',id:input.target.parentStudyId},request.arActor);}
        return json(response,200,capturing?await conversationCaptures.capture(input):await currentWork[pathname.endsWith('/validate')?'validate':'read'](input));
      }
      if(pathname.startsWith('/api/work-continuity/')&&request.method==='POST'&&!findCommand(commandList(),'POST',pathname)?.readOnly&&!(request.headers.origin&&!localAuthorities(server).some(host=>request.headers.origin===`http://${host}`)))requireWriteActor();
      if(pathname.startsWith('/api/events')||pathname==='/api/presence'||pathname.startsWith('/api/leases')||pathname.startsWith('/api/journal')){const coordinationUrl=new URL(request.url,'http://'+request.headers.host);if(await coordination(request,response,pathname,coordinationUrl))return;}
      // i64 OS health (B3): which release this program is. The sha comes from <home>/RELEASE.json, which serve.mjs reads and passes in.
      if(pathname==='/api/i64os/health'&&['GET','HEAD'].includes(request.method)){if(!studyDrafts)throw new StateError('Document study is not configured.',503);const sha=typeof release?.sha==='string'&&/^[a-f0-9]{7,40}$/.test(release.sha)?release.sha:null;return json(response,200,{service:'ar-create-document-study',ready:true,release:{sha}});}
      if(await continuityInterface.handle(request,response))return;
      if(await (await import('./services/needs-you.mjs')).handleNeedsYou(request,response,{dataDir,events,recordings,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/words-http.mjs')).handleWords(request,response,{dataDir,events,recordings,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/transcript-check-http.mjs')).handleTranscriptCheck(request,response,{dataDir,recordings,events,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/phone-pickup-http.mjs')).handlePhonePickup(request,response,{dataDir,events,recordings,library,origin:()=>server.listening?'http://127.0.0.1:'+server.address().port:null,checkWrite:()=>checkWrite(request,server)}))return;
      if(await handleStanding(request,response,subjectStanding))return;
      if(await (await import('./services/subject-places.mjs')).handleSubjectPlaces(request,response,{dataDir,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/research-topics-http.mjs')).handleResearchTopics(request,response,{dataDir,library,inquiries:inquiryInterface,drafts:studyDrafts,bindings:studyBindings,membership:projectMembership,researchAnswers,findings:studyDerivedFindings,consent:consentDesk,atlas:localAtlas,events,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/simmer-board.mjs')).handleSimmer(request,response,{dataDir,library,concepts:conceptWork,leases}))return;
      if(await (await import('./services/looks.mjs')).handleLooks(request,response,{dataDir,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/accounts.mjs')).handleAccounts(request,response,{dataDir,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/templates.mjs')).handleTemplates(request,response,{dataDir,checkWrite:()=>checkWrite(request,server)}))return;
      if(await (await import('./services/instagram-studio.mjs')).handleInstagram(request,response,{dataDir,library,consentDesk}))return;
      if(pathname.startsWith('/api/inquiries/')){
        if(!inquiryInterface)throw new StateError('Inquiry and named Project connection is unavailable in this configuration.',503);
        if(request.headers.origin&&request.headers.origin!==new URL(request.url,'http://'+request.headers.host).origin)throw new StateError('Foreign-origin inquiry request refused.',403);
        const url=new URL(request.url,'http://'+request.headers.host),suffix=pathname.slice('/api/inquiries'.length);let input;
        if(request.method==='GET'){if([...url.searchParams.keys()].some(key=>key!=='input')||url.searchParams.getAll('input').length!==1||url.searchParams.get('input').length>32768)throw new StateError('Use one bounded inquiry selector.',400);try{input=JSON.parse(url.searchParams.get('input'));}catch{throw new StateError('Inquiry selector must be JSON.',400);}}
        else if(request.method==='POST'){requireWriteActor();input=await body(request,1200*1024);leases.check(scopeOf({input,section:'collection'}),request.arActor);}
        else throw new StateError('Unsupported inquiry method.',405);
        const result=await inquiryInterface.handle({method:request.method,path:suffix,input});return json(response,result.status,result.body);
      }
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
          checkWrite(request, server);
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
          checkWrite(request, server);
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
          checkWrite(request, server);
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
        if (request.method === 'POST') checkWrite(request, server);
        // The copied Magazine workshop contains its own inline controls.
        response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; media-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors "+(/^\/transcription\/[a-f0-9-]{36}\/view$/.test(pathname)?"'self'":"'none'")+"; base-uri 'none'; form-action 'self'");
        if (await recordings.route(request, response, url)) return;
        throw new StateError('Recording route is unavailable.', 404);
      }
      const routes = commandRoutes({ url, request, server, outputQuery, decorateOutputExports, describe: options => describeCapabilities(options) });
      const passageMatch=pathname.match(/^\/api\/passage\/revisions\/([a-f0-9-]{36})(?:\/(send|run))?$/);
      if(passageMatch){
        const [,id,action]=passageMatch;
        if(!action&&request.method==='GET')return json(response,200,await passageRevisions.get(id));
        if(['send','run'].includes(action)&&request.method==='POST'){
          checkWrite(request, server);
          if(!(request.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await passageRevisions[action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const researchAnswerMatch=pathname.match(/^\/api\/research\/answers\/([a-f0-9-]{36})(?:\/(run|keep|markdown))?$/);
      if(researchAnswerMatch){const [,id,action]=researchAnswerMatch;if(!action&&request.method==='GET')return json(response,200,await researchAnswers.get(id));if(action==='markdown'&&request.method==='GET'){response.writeHead(200,{'Content-Type':'text/markdown; charset=utf-8','Cache-Control':'no-store'});return response.end(await researchAnswers.markdown(id));}if(['run','keep'].includes(action)&&request.method==='POST'){checkWrite(request, server);const input=await body(request);return json(response,200,await researchAnswers[action](id,input));}throw new StateError('Use a supported research answer action.',405);}
      const articleVisualMatch=pathname.match(/^\/api\/article\/visual\/([a-f0-9-]{36})(?:\/(send|run))?$/);
      if(articleVisualMatch){
        const [,id,action]=articleVisualMatch;
        if(!action&&request.method==='GET')return json(response,200,await articleVisual.get(id));
        if(['send','run'].includes(action)&&request.method==='POST'){
          checkWrite(request, server);
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
          checkWrite(request, server);
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
          checkWrite(request, server);
          if(!(request.headers['content-type']||'').startsWith('application/json'))throw new StateError('Use Content-Type: application/json.',415);
          return json(response,200,await carouselMake[action](id,await body(request)));
        }
        throw new StateError('Method is not supported.',405);
      }
      const terminalMatch = pathname.match(/^\/api\/terminal\/sessions\/([a-f0-9-]{36})(?:\/(input|resize|stop))?$/);
      if (terminalMatch) {
        const [, id, action] = terminalMatch;
        if (!action && request.method === 'GET') return json(response, 200, terminal.get(id));
        if (action && request.method === 'POST') { checkWrite(request, server); if (!(request.headers['content-type'] || '').startsWith('application/json')) throw new StateError('Use Content-Type: application/json.',415); const input=await body(request); return json(response,200,action==='input'?await terminal.input(id,input):action==='resize'?terminal.resize(id,input):terminal.stop(id)); }
        throw new StateError('Method is not supported.',405);
      }
      function outputQuery(){return {rootBindingId:url.searchParams.get('rootBindingId'),parentStudyId:url.searchParams.get('parentStudyId'),selectedOutputId:url.searchParams.get('selectedOutputId')};}
      // A saved export file is what gets posted, so downloading it is held like making it: by the project in the query, or the
      // workspace's own project for the older unscoped files.
      const holdExportDownload=()=>{let id=url.searchParams.has('rootBindingId')?url.searchParams.get('parentStudyId'):null;if(!id){try{id=store.get().project.id;}catch{id=null;}}consentDesk.assertNotHeld([{parentStudyId:id}],'Downloading this export');};

      const carouselMatch=pathname.match(/^\/api\/carousel\/exports\/([a-f0-9-]{36})\/(render|file)\/(.+)$/);
      if(carouselMatch){
        if(!['GET','HEAD'].includes(request.method))throw new StateError('Method is not supported.',405);
        const [,id,action,name]=carouselMatch;
        // The render page contains the exact slide words and is also a usable
        // outward file. Hold it under the same consent decision as the PNG.
        holdExportDownload();
        if(action==='render'){
          if(!/^\d+$/.test(name))throw new StateError('Slide not found.',404);
          response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'");
          const scoped=url.searchParams.has('rootBindingId');const html=scoped?await studyOutputExports.page({...outputQuery(),exportId:id,index:Number(name)}):carousel.page(id,Number(name));if(sharedCarouselBridge&&!scoped){const manifest=JSON.parse(await readFile(path.join(dataDir,'carousel-exports',id,'.manifest.json'),'utf8'));await guardCarouselOutput(manifest);}response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:html);return;
        }
        const artifact=url.searchParams.has('rootBindingId')?await studyOutputExports.file({...outputQuery(),exportId:id,format:'carousel',name}):carousel.file(id,name);response.writeHead(200,{'Content-Type':artifact.mimeType,'Content-Length':artifact.sizeBytes,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(name)}`,'Cache-Control':'no-store'});
        if(request.method==='HEAD')return response.end();const stream=createReadStream(artifact.file);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);return;
      }
      if(pathname==='/api/magazine/working-draft/export-file'){
        if(!['GET','HEAD'].includes(request.method))throw new StateError('Method is not supported.',405);
        consentDesk.assertNotHeld([{parentStudyId:url.searchParams.get('storyId')}],'Downloading this export');
        const {artifact,file}=await magazineOutputExports.file(Object.fromEntries(url.searchParams));
        response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':artifact.sizeBytes,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`,'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; sandbox"});
        if(request.method==='HEAD')return response.end();const stream=createReadStream(file);stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);return;
      }
      const exportMatch = pathname.match(/^\/api\/exports\/([a-f0-9-]{36})\/file$/);
      if (exportMatch) {
        if (!['GET','HEAD'].includes(request.method)) throw new StateError('Method is not supported.',405);
        holdExportDownload();
        const { artifact, file } = url.searchParams.has('rootBindingId')?await studyOutputExports.file({...outputQuery(),exportId:exportMatch[1]}):exports.file(exportMatch[1]);
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
      if (['/api/magazine/library-photos/preview','/api/magazine/library-photos/asset'].includes(pathname)) {
        if(request.method!=='GET'){response.setHeader('Allow','GET');throw new StateError('Method is not supported.',405);}
        const asset=pathname.endsWith('/asset'),base=asset?['file']:url.searchParams.has('sourceHash')?['rootId','sourceId','revision','sourceHash']:['rootId','sourceId','revision'],keys=!asset&&url.searchParams.has('verify')?[...base,'verify']:base;
        if(!asset&&url.searchParams.has('verify')&&url.searchParams.get('verify')!=='1')throw new StateError('Use the bounded selected photograph verification.',400);
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1||!url.searchParams.get(key)))throw new StateError('Choose one exact photo library reference.',400);
        const input=Object.fromEntries(base.map(key=>[key,url.searchParams.get(key)]));
        let preview;try{preview=await(asset?magazineLibraryPhotos.resolve(input):magazineLibraryPhotos.preview(input,{selection:url.searchParams.get('verify')==='1'}));}catch(error){throw new StateError(error.message,Number.isInteger(error.status)&&error.status>=400&&error.status<500?error.status:500);}
        const photoOrigin=asset?magazinePhotoOriginHeader(preview):null;
        response.writeHead(200,{'Content-Type':preview.contentType,'Content-Length':preview.body.length,'X-Content-SHA256':preview.hash,...(photoOrigin?{'X-AR-Photo-Origin':photoOrigin}:{}),...(preview.rootId?{'X-AR-Photo-Root-Id':preview.rootId}:{}),...(preview.sourceId?{'X-AR-Photo-Source-Id':preview.sourceId}:{}),...(preview.revision?{'X-AR-Photo-Revision':preview.revision}:{}),'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
        return response.end(preview.body);
      }
      if (['/api/study/photos/preview','/api/study/photos/available-preview'].includes(pathname)) {
        if(request.method!=='GET'){response.setHeader('Allow','GET');throw new StateError('Method is not supported.',405);}
        const preview=await draftCall(()=>studyPhotos[pathname.endsWith('/available-preview')?'availablePreview':'preview'](studyPhotoPreviewInput(url)));
        response.writeHead(200,{'Content-Type':preview.contentType,'Content-Length':preview.contentLength,'X-Content-SHA256':preview.hash,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
        return response.end(preview.bytes);
      }
      if (pathname === '/api/study/footage/preview') {
        if (!['GET','HEAD'].includes(request.method)) throw new StateError('Use GET or HEAD for original footage playback.',405);
        const keys=['bindingId','parentStudyId','sourceId','expectedHash'];if([...url.searchParams.keys()].length!==keys.length||keys.some(key=>url.searchParams.getAll(key).length!==1)||[...url.searchParams.keys()].some(key=>!keys.includes(key)))throw new StateError('Choose one exact attached footage original.',400);
        if(!studyFootage)throw new StateError('Footage is unavailable.',503);
        const {file,source,contentType,expectedHash}=await studyFootage.preview(Object.fromEntries(url.searchParams));
        const size=(await lstat(file)).size,headers={'Content-Type':contentType,'Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Sha256':expectedHash,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(path.basename(source.rel_path))}`};
        let start=0,end=size-1;
        if(request.headers.range){const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);if(!match||(!match[1]&&!match[2]))throw new StateError('Invalid byte range.',416);if(!match[1])start=Math.max(0,size-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(start>end||start>=size||!Number.isSafeInteger(start)||!Number.isSafeInteger(end))throw new StateError('Byte range is unavailable.',416);headers['Content-Range']=`bytes ${start}-${end}/${size}`;}
        response.writeHead(request.headers.range?206:200,{...headers,'Content-Length':Math.max(0,end-start+1)});if(request.method==='HEAD'||!size)return response.end();
        const stream=createReadStream(file,{start,end});stream.on('error',()=>response.destroy());response.on('close',()=>stream.destroy());stream.pipe(response);return;
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
        checkWrite(request, server);
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
          if (request.method === 'POST' && READ_ONLY_POSTS.has(pathname)) checkWriteOrigin(request, server); else checkWrite(request, server);
          if (!(request.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new StateError('Use Content-Type: application/json.', 415);
          input = await body(request, pathname === '/api/study/outputs/copy-browser-carousel' ? 512 * 1024 : pathname === '/api/sources/import' ? 90 * 1024 * 1024 : ['/api/exports','/api/study/outputs/export','/api/magazine/working-draft/export'].includes(pathname) ? MAX_EXPORT_BYTES + 1024 * 1024 : MAX_BODY_BYTES);
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new StateError('Request body must be an object.');
          if (!READ_ONLY_POSTS.has(pathname)) { const command = findCommand(commandList(), request.method, pathname); leases.check(pathname==='/api/magazine/library-photos/album'?{kind:'library',id:'folders-media'}:scopeOf({ input, query: url.searchParams, section: command?.section }), request.arActor); }
        }
        return json(response, 200, await handler(input));
      }
      if (pathname.startsWith('/api/')) throw new StateError('API route was not found.', 404);
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.setHeader('Allow', 'GET, HEAD');
        throw new StateError('Method is not supported.', 405);
      }
      // The app's own address opens version three (public/v3/), the default since 12 November 2026. Version two
      // (public/v2/) keeps its own addresses, /v2 and /v2/index.html, and every address of the existing workspace
      // (/document-study/index.html and its deep links) is served exactly as before. The query is kept.
      if(pathname==='/'||pathname==='/v3'||pathname==='/v2'){const search=new URL(request.url||'/','http://local.invalid').search;response.writeHead(302,{Location:(pathname==='/v2'?'/v2/index.html':'/v3/index.html')+search,'Cache-Control':'no-cache'});return response.end();}
      let file;try{file=await staticFile(path.resolve(publicDir),pathname);}catch(error){if((error.status!==404&&error.code!=='ENOENT')||!/^\/(assets|ig-assets)\//.test(pathname))throw error;file=await staticFile(path.join(root,'public'),pathname);}
      response.writeHead(200, { 'Content-Type': file.type, 'Content-Length': file.contents.length, 'Cache-Control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : file.contents);
  }
  activityHealth=await activity.reconcile();
  const server = http.createServer(async (request, response) => {
    if(packageView&&request.method==='GET'&&new URL(request.url,'http://localhost').pathname==='/document-study/package-config.js'){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return response.end('window.AR_CREATE_PACKAGE_CONFIG='+JSON.stringify(packageView)+';');}
    const isWrite=request.method!=='GET'&&request.method!=='HEAD'&&request.method!=='OPTIONS';
    let announced=()=>{};
    if(isWrite){writesInFlight++;let over=false;const done=new Promise(resolve=>{announced=()=>{over=true;announcing.delete(done);resolve();};});const mark=()=>{if(!over)announcing.add(done);};response.once('finish',mark);response.once('close',mark);}
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'"+(new URL(request.url,'http://localhost').pathname==='/document-study/index.html'?" 'unsafe-inline'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (!localAuthorities(server).includes(request.headers.host)) throw new StateError('Only local workspace requests are accepted.', 403);
      const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      const actorContext = resolveRequestActor(request, { appOrigins: localAuthorities(server).map(host => `http://${host}`) });
      if (mutation) guardHumanOnly(request.method, (request.url || '/').split('?')[0], actorContext);
      request.arActor = actorContext;
      const getMeta=()=>activityMeta(request,response,actorContext);
      request.arBeforeMutation=input=>{const meta=getMeta();if(meta&&/^study-draft\./.test(meta.kind))activity.beginNative(meta,input);};
      const run=()=>studyPhotoFiles.observeAtomicWrites(change=>activity.observe(getMeta,change),()=>routeRequest(request,response));
      return await (actorContext ? withActor(actorContext, run) : routeRequest(request, response));
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return json(response, 404, { error: 'File was not found.' });
      const status = error instanceof StateError ? error.status : 500;
      if (status === 500) console.error('Local workspace request failed:', error.message);
      json(response, status, { error: status === 500 ? 'Could not save or load the local workspace. Existing data was preserved.' : error.message,...(error.outcome?{outcome:error.outcome}:{}),...(error.receipt?{receipt:error.receipt}:{}),...(error.holder?{holder:error.holder}:{}),...(error.hold?{code:'consent-hold',hold:error.hold}:{}) });
    } finally {
      // After the answer: tell watchers what changed (and, from B8, journal it).
      try { await afterRequest(request, response, request.arActor); } catch (failure) { console.error('Change notice failed; the write itself stands:', failure.message); }
      if(isWrite){writesInFlight--;writesDone++;announced();}
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
  { const wordsHttp=await import('./services/words-http.mjs'); wordsHttp.wordsFor({dataDir,events,recordings}).shared.start(); server.on('close',()=>wordsHttp.stopWords(dataDir)); }
  { // The phone pickup: built now so it can finish recordings left mid-way, and (installed app only) asks the phone site once at start.
    const pickupHttp=await import('./services/phone-pickup-http.mjs');
    const pickup=pickupHttp.pickupFor({dataDir,events,recordings,library,origin:()=>server.listening?'http://127.0.0.1:'+server.address().port:null,options:phonePickup||{}});
    server.on('close',()=>pickupHttp.stopPickup(dataDir));
    if(phonePickup?.checkOnStart===true)server.on('listening',()=>{const timer=setTimeout(()=>{pickup.checkOnStart().catch(()=>{});},5_000);server.on('close',()=>clearTimeout(timer));});
  }
  const close=server.close;
  server.close=function(callback){for(const client of [...sseClients]){client.close();client.response.end();}return close.call(this,error=>{store.close().then(()=>callback?.(error),failure=>{if(callback)callback(failure);else console.error('Workspace close failed:',failure.message);});});};
  server.closeWorkspace=()=>store.close();
  // Read where every subject stands once, so the first Home after a start is not the one that pays for it.
  // A home that has never listed its subjects (no subject-places folder yet) has nothing to warm, and the read would make that folder.
  server.once('listening',()=>{if(!subjectStanding||!fs.existsSync(path.join(dataDir,'subject-places')))return;const timer=setTimeout(()=>{if(server.listening)subjectStanding.all().catch(()=>{});},50);timer.unref();});
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

export function decorateOutputExports(result,input){
 const copy=structuredClone(result),scope={rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId};
 const scoped=value=>{const url=new URL(value,'http://local.invalid');for(const [key,entry] of Object.entries(scope))url.searchParams.set(key,entry);return url.pathname+url.search+url.hash;};
 const add=value=>{if(value?.url)value.url=scoped(value.url);for(const file of value?.files||[])if(file.url)file.url=scoped(file.url);};
 add(copy.artifact);add(copy.export);for(const item of copy.artifacts||[])add(item);for(const item of copy.exports||[])add(item);return copy;
}
