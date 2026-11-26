import {currentWorkSchemas} from './contracts/current-work.mjs';
import {AGENT_ACTORS,currentActor} from './services/actor.mjs';
import {StateError} from './store.mjs';
import {isICloudAlbum} from './services/icloud-albums.mjs';
import {INQUIRY_METHODS} from './services/inquiry-interface-routes.mjs';
import {NEEDS_YOU_COMMANDS, NEEDS_YOU_HUMAN_ONLY, NEEDS_YOU_BODY} from './commands/needs-you.mjs';
import {WORDS_COMMANDS, WORDS_HUMAN_ONLY, WORDS_BODY} from './commands/words.mjs';
import {LOOKS_COMMANDS, LOOKS_READ_ONLY, LOOKS_BODY} from './commands/looks.mjs';
import {ACCOUNTS_COMMANDS, ACCOUNTS_BODY} from './commands/accounts.mjs';
import {TEMPLATES_COMMANDS, TEMPLATES_HUMAN_ONLY, TEMPLATES_BODY} from './commands/templates.mjs';
import {TRANSCRIPT_CHECK_COMMANDS, TRANSCRIPT_CHECK_HUMAN_ONLY, TRANSCRIPT_CHECK_BODY} from './commands/transcript-check.mjs';
import {PHONE_PICKUP_COMMANDS, PHONE_PICKUP_HUMAN_ONLY, PHONE_PICKUP_BODY} from './commands/phone-pickup.mjs';
import {SUBJECT_PLACES_COMMANDS, SUBJECT_PLACES_HUMAN_ONLY, SUBJECT_PLACES_UNDO, SUBJECT_PLACES_BODY} from './commands/subject-places.mjs';
import {STANDING_COMMANDS} from './commands/standing.mjs';
import {AGENT_GUIDE_COMMANDS} from './commands/agent-guide.mjs';
import {RESEARCH_TOPICS_COMMANDS, RESEARCH_TOPICS_HUMAN_ONLY, RESEARCH_TOPICS_READ_ONLY, RESEARCH_TOPICS_UNDO, RESEARCH_TOPICS_BODY} from './commands/research-topics.mjs';

/**
 * One command registry for every entrance: the app, the CLI (agents/cli/ar-create.mjs)
 * and the MCP server (agents/mcp/server.mjs). Each entry:
 *   {name, section, method, route, schema, readOnly, actors, undo?, mount}
 * - route: the HTTP path; {id} marks a path parameter.
 * - schema: a summary of the input — query fields for GET, body fields for POST.
 *   Services remain the authority on validation.
 * - actors: ['any'] or ['human'] (a decision only Adrian makes).

 * - mode: scope (query carries identity; body must not), scope-copy (query and body both carry it), input-json (GET ?input=<json>).
 * - mount: 'map' (dispatched from the route map below) or 'custom' (bespoke
 *   handler in server.mjs: streams, path parameters, query-scoped bodies).
 */
export const SCHEMA = 'ar-create.capabilities.v1';
const HUMAN = Object.freeze(['human']), ANY = Object.freeze(['any']);

/** POST routes that only read. They need no actor. */
export const READ_ONLY_POSTS = new Set(['/api/source-transcript/candidate/review','/api/source-language/requests','/api/source-language/capabilities','/api/source-language/review','/api/source-transcript/terms/preview','/api/source-transcript/candidate/compare','/api/research/atlas/search','/api/concept/sources/search', '/api/study-draft/inspect', '/api/study-draft/history-preview', '/api/study/outputs/export-check', '/api/sources/reconnect/preview']);

const UNDO = {
  'POST /api/magazine/working-draft/ai/accept': 'magazine.working-draft.undo',
  'POST /api/magazine/working-draft/share-feedback/save': 'magazine.working-draft.share-feedback.undo',
  'POST /api/magazine/working-draft/save': 'magazine.working-draft.undo', 'POST /api/magazine/working-draft/edit': 'magazine.working-draft.undo',
  'POST /api/library/folders': 'library.folders.post',
  'POST /api/magazine/library-photos/album': 'library.folders.post',
  'POST /api/study-draft/save': 'study-draft.undo', 'POST /api/study-draft/history-restore': 'study-draft.undo',
  'POST /api/study/human-direction/write': 'study.human-direction.undo', 'POST /api/concept/save': 'study.human-direction.undo',
  'POST /api/study/share/save': 'study.share.undo', 'POST /api/study/outputs/save': 'study.outputs.undo',
  'POST /api/source-sessions/edit': 'source-sessions.undo',
  'POST /api/source-sessions/translation-accept': 'source-sessions.undo',
  'POST /api/inquiries/references/propose': 'inquiries.references.undo', 'POST /api/inquiries/direction-references/propose': 'inquiries.direction-references.undo',
  'POST /api/inquiries/save': 'inquiries.learning.undo', 'POST /api/inquiries/update': 'inquiries.learning.undo',
  'POST /api/work-continuity/assign': 'work-continuity.undo', 'POST /api/work-continuity/result': 'work-continuity.undo', 'POST /api/work-continuity/complete': 'work-continuity.undo',
};
/** Body fields for the commands agents use most; the rest say 'object'. */
const BODY = {
  '/api/study/carousel-make/preview':['rootBindingId','parentStudyId','sourceBindingId','sourceOutputId','expectedNative','expectedOutput','operationId'],
  ...Object.fromEntries(['run','register','cancel'].map(action=>['/api/study/carousel-make/'+action,['rootBindingId','parentStudyId','requestId']])),
  '/api/instagram/plan': ['id? (omit to create)', 'operationId', 'expectedRevision?', 'expectedHash?', 'subject?', 'title?', 'door?', 'material?:{transcripts:[{sourceId,sourceHash}],photos:[{sourceId,caption?}]}', 'stories?:[{id?,title,dish,readback,why,reader,format?,spine:[lineId],matches:[{photoId,lineId,why}]}]', 'gaps?:[{question,why,storyIds,status,finding?,sources?}]', 'heard?:{storyId,quote}', 'flags?:[{lineId,heard,kind,suggestion?,why?}]', 'coverage?:[{momentId,status:saved|skipped|null,why}]'],
  '/api/instagram/layout': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'storyId', 'format', 'frames? (omit for the default; a frame\'s templateId may be a layout code such as C1)', 'caption? (text, or {parts:[{kind:quote,lineId,text}|{kind:suggested,lineId,text}|{kind:draft,text}]})'],
  '/api/instagram/plan/codes': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'say? (the line he said or typed, e.g. "use C1, 2 and 5") or codes? (list, e.g. ["C1","C2","C5"])', 'storyId? (default: the chosen story, or the only one)', 'format? (default carousel)'],
  '/api/instagram/choose': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'storyId?', 'named?', 'forWhom?', 'said? (an agent carrying his decision from chat: {quote, via:"chat", at})'],
  '/api/instagram/confirm': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'flagId', 'verdict (as-heard|corrected)', 'correction?', 'said? (an agent carrying his decision from chat: {quote, via:"chat", at})'],
  '/api/instagram/meaning': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'storyId', 'verdict (right|not-meant)', 'words (his exact words; required for not-meant)', 'said? (an agent carrying his decision from chat: {quote, via:"chat", at})'],
  '/api/instagram/handoff': ['id', 'memoId (the phone memo the plan was made from; the Mac takes it in at its next phone check)'],
  '/api/instagram/ready': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'format', 'caption?', 'said? (an agent carrying his decision from chat: {quote, via:"chat", at})'],
  '/api/study/material/attach':['bindingId','parentStudyId','operationId','sourceIds'],

  '/api/magazine/working-draft/ai/run': ['storyId','pieceId','edition','parentStudyId','expectedHash','contextHash','operationId','instruction?'],
  '/api/magazine/working-draft/ai/propose': ['storyId','pieceId','edition','parentStudyId','expectedHash','contextHash','operationId','claims','gaps'],
  '/api/magazine/working-draft/ai/accept': ['storyId','pieceId','edition','parentStudyId','expectedHash','contextHash','operationId','proposalId','proposalHash'],
  '/api/magazine/working-draft/ai/reject': ['storyId','pieceId','edition','parentStudyId','expectedHash','contextHash','operationId','proposalId','proposalHash','reason?'],

  '/api/first-flow/material-triage': ['projectId','operationId','sourceId','expectedRevision','expectedHash','expectedSourceHash','decision','reason','humanDecision'],
  '/api/magazine/working-draft/share-feedback/prepare-paragraph': ['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','block','seen','text'],
  '/api/magazine/working-draft/share-feedback/prepare-mapping': ['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','recipientId?','recipientName?','sections?','invitationChange?'],
  '/api/magazine/working-draft/share-feedback/prepare': ['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','content'],
  '/api/magazine/working-draft/share-feedback/save': ['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','content','operationId','reason?'],
  '/api/magazine/working-draft/share-feedback/undo': ['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','undoOperationId','operationId'],
  '/api/source-sessions/check': ['sessionId','turnId','textHash','operationId'],
  '/api/source-sessions/translation-accept': ['operationId','expectedRevision','expectedSourceHash','sessionId','turnId','speaker','text','receiptSha256'],
  '/api/magazine/mechanical-check': ['parentStudyId','storyId','pieceId','expectedDraftHash','expectedInputRevision','operationId'],
  '/api/magazine/working-draft/prepare': ['storyId','pieceId','edition','expectedHash','operations'],
  '/api/magazine/working-draft/save': ['storyId','pieceId','edition','expectedHash','content','operationId'],
  '/api/magazine/working-draft/edit': ['storyId','pieceId','edition','block','seen','text','operationId'],
  '/api/magazine/working-draft/undo': ['storyId','pieceId','edition','undoOperationId','operationId'],
  '/api/magazine/library-photos/album': ['action','folderId','operationId','expectedRevision','expectedHash','photo:{rootId,sourceId,revision,sourceHash}'],
  '/api/library/folders': ['domain', 'action', 'operationId', 'expectedRevision', 'expectedHash', 'folderId?', 'parentId?', 'name?', 'sourceIds?', 'undoOperationId?'],
  '/api/concepts': ['parentStudyId', 'title', 'operationId'],
  '/api/concept/save': ['parentStudyId', 'operationId', 'expectedRevision', 'expectedHash', 'authorThoughts', 'adoptedDirection?', 'aiInterpretation', 'suggestions', 'sourceSelections', 'body?', 'replaceExistingDirection?', 'dictated? (true: an agent appends the author\'s words verbatim)'],
  '/api/concept/sources/search': ['parentStudyId?', 'query', 'limit?'],
  '/api/study/structure-tests/research-note':['bindingId','parentStudyId','operationId','expectedRevision','expectedHash','kind','pointId','title','text','origin'],
  '/api/research/atlas/search':['query','limit?'],
  '/api/study/outputs/stand-in-review-words':['rootBindingId','parentStudyId','selectedOutputId','operationId','expectedOutput','expectedWords','wordsHash'],
  '/api/study/outputs/stand-in-refresh':['rootBindingId','parentStudyId','selectedOutputId','operationId','expectedOutput','expectedNative'],
  '/api/study/outputs/stand-in-create':['rootBindingId','parentStudyId','operationId','expectedOutput','kind','sourceBindingId','expectedNative'],
  '/api/study/outputs/stand-in-save':['rootBindingId','parentStudyId','selectedOutputId','operationId','expectedOutput','expectedNative?','changes'],
  '/api/study/video-briefs':['projectKey','parentStudyId','operationId','findingId','title','sourcePath','sourceHash','from','to','quote','collectionId?'],
  '/api/study/video-briefs/relink':['projectKey','parentStudyId','id','operationId','expectedFindingId','findingId'],
  '/api/study/video-briefs/inquiry':['projectKey','parentStudyId','id','operationId','expectedCollectionId','collectionId'],
  '/api/study-research/findings/save':['projectKey','parentStudyId','operationId','expectedExportHash','title','sourcePath','sourceHash','from','to','quote','speaker','location','clarity'],
  '/api/study/footage/ranges':['bindingId','parentStudyId','operationId','expected','sourceId','sourceHash','metadataHash','inTicks','outTicks','label','decision','rangeId?'],
  '/api/study/outputs/visual-review':['rootBindingId','parentStudyId','selectedOutputId','exportId','operationId','expectedOutput','expectedManifestHash','reviewedFiles','humanDecision'],
  '/api/study/structure-tests/visual-review':['rootBindingId','parentStudyId','selectedOutputId','exportId','operationId','expectedOutput','expectedManifestHash','reviewedFiles'],
  '/api/study/research/brief/prepare':['bindingId','parentStudyId','operationId','question','sourceIds','sourceReviews?','humanDecision?'],
  '/api/study/research/brief/run':['bindingId','parentStudyId','operationId','requestId'],
  '/api/study/research/brief/reinspect':['bindingId','parentStudyId','operationId','requestId'],
  '/api/study/research/prepare':['bindingId','parentStudyId','question','sourceIds','cardIds?'],
  '/api/study/research/run':['bindingId','parentStudyId','id'],
  '/api/study/research/keep':['bindingId','parentStudyId','id'],
  '/api/study/structure-tests/review-mark':['bindingId','parentStudyId','expected','operationId','id','rawFrom','rawTo','seenBlockHash','seenMarkupHash'],
  '/api/study/structure-tests': ['sourceBindingId','sourceParentStudyId','expected','title','operationId'],
  '/api/study-draft/create-collection': ['parentStudyId', 'title', 'operationId', 'sourceBindingId', 'sourceParentStudyId', 'expected'],
  '/api/study-draft/open': ['parentStudyId', 'originalId', 'originalHash', 'operationId'],
  '/api/study-draft/capture-sources': ['bindingId', 'parentStudyId', 'operationId', 'expectedSourcesHash', 'sources:[{sourceId,sourceHash,again?}]'],
  '/api/study-draft/capture-sources/stop': ['bindingId', 'parentStudyId', 'operationId', 'expectedSourcesHash', 'sourceId', 'copiedHash'],
  // Marking material reviewed is Adrian's alone. reviewed:true is refused to everyone else inside the service; reviewed:false (withdrawing) is open.
  '/api/first-flow/source-review': ['projectId', 'operationId', 'sourceId', 'expectedHash', 'reviewed', 'humanDecision'],
  // Open to assistants. A sourceReviews entry that would ADD a review is refused (403) by the service for anyone but Adrian; entries already on file are accepted.
  '/api/first-flow/prepare': ['projectId', 'operationId', 'sourceIds', 'question', 'sourceReviews?:[{sourceId,hash}]'],
  '/api/study-draft/quote-link': ['bindingId','parentStudyId','operationId','expected','paragraph','source'],
  '/api/study-draft/save': ['bindingId', 'parentStudyId', 'operationId', 'expected', 'operations'],
  '/api/study-draft/undo': ['bindingId', 'parentStudyId', 'operationId', 'expected', 'undoOperationId'],
  '/api/study-draft/set-aside': ['bindingId', 'parentStudyId', 'operationId', 'reason (conflict|recovery|failed-save)', 'expected? (the revision the words were written against)', 'paragraphs:[{id?, words, baseHash?, savedHash?}]'],
  '/api/study/direction-decision':['parentStudyId','bindingId','operationId','expectedRevision','expectedHash','target','kind','action','optionId?','text?','reason?','source?'],
  '/api/study/human-direction/select': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'title'],
  '/api/study/human-direction/write': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'expectedRevision', 'expectedHash', 'body'],
  '/api/study/human-direction/undo': ['parentStudyId', 'scope', 'bindingId?', 'outputId?', 'operationId', 'expectedRevision', 'expectedHash', 'undoOperationId'],
  '/api/study-ai/run': ['bindingId','parentStudyId','requestId','operationId'],
  '/api/study/structure-tests/proposal-contract': ['bindingId','parentStudyId','kind','operationId','expectedContractHash','...'],
  '/api/study/structure-tests/proposal-review': ['bindingId','parentStudyId','action','requestId','operationId','reason?'],
  '/api/study-ai/prepare': ['sourceIds', 'answerIds?', 'purpose?', 'openingRequestId?', 'selectedOptionId?','instruction?','targetParagraphIds?'], '/api/study-ai/propose': ['requestId', 'replacements?', 'openingOptions?', 'continuationParagraphs?','draftParagraphs?','sourcedParagraph?','sourcedEvidence?'],
  '/api/study-ai/cancel': ['requestId?','operationId'],
  '/api/study-ai/accept': ['requestId', '...'], '/api/study-ai/reject': ['requestId', 'reason?'],
  '/api/study-ai/finish': ['requestId', 'operationId', 'edits?:[{id,words}]', 'marks?:[{id,note?}]'],
  '/api/voice-corrections/decide': ['id', 'decision', 'operationId', 'key?', 'note?', 'reason?'],
  '/api/voice-corrections/sent': ['id', 'operationId', 'ref?'],
  '/api/pieces': ['expectedProjectId', 'expectedRevision', 'title'], '/api/pieces/switch': ['expectedProjectId', 'expectedRevision', 'projectId'],
  '/api/consent/claims/record': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','claim:{kind:claim|quote,text,where?,source?}'],
  '/api/consent/claims/link': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','claimId','source:{type:library|recording|photo,sourceId,sourceHash?,start?,quote?,atMs?,endMs?}'],
  '/api/consent/claims/flag': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','claimId','reason'],
  '/api/consent/claims/clear-flag': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','claimId','note?'],
  '/api/consent/people/record': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','person:{personId?,name,appears:[named|pictured|quoted],note?}'],
  '/api/consent/people/draft-request': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','personId','text'],
  '/api/consent/people/sent': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','personId','sentAt','channel'],
  '/api/consent/people/answer': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','personId','state:not-asked|asked|yes|yes-with-changes|no','changes?','said? (an agent carrying his answer from chat: {quote, via:"chat", at})'],
  '/api/consent/people/remove': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','personId','reason'],
  '/api/consent/share/answer': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','question:comfort|accuracy','answer:yes|not-yet','note?'],
  '/api/consent/share/override': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash','reason'],
  '/api/consent/share/release': ['parentStudyId','pieceKey?','operationId','expectedRevision','expectedHash'],
  '/api/presence': ['stage', 'scope:{kind,id}', 'dirty', 'sequence'],
  '/api/simmer/board': ['subject', 'operationId', 'expectedRevision', 'expectedHash', 'board'],
  '/api/simmer/intake': ['subject? (or title for a new subject)', 'title?', 'operationId', 'folder? (full path Adrian named)', 'photos? (file names in it)', 'words?:[{text,said?:typed|spoken}] (his exact words)', 'group?', 'collectionId?', 'expectedRevision?', 'expectedHash?', 'resume?:{expectedRevision,expectedHash} (identical interrupted operation only)'],
  '/api/simmer/propose': ['subject', 'operationId', 'expectedRevision', 'expectedHash', 'groups?:[{key?,title,sub?,blockIds?}]', 'letter?:{recurs,voice,unresolved,group?}', 'dishes?:[{title,why}] (two or three)', 'questions?:[text|{text,group?}]', 'feelings?:[text|{text,group?,options?}]'],
  '/api/simmer/dish': ['subject', 'sentence (his exact words, never paraphrased)', 'said?:typed|spoken', 'operationId', 'expectedRevision?', 'expectedHash?', 'resume?:{expectedRevision,expectedHash} (identical interrupted operation only)'],
};
function section(route) {
  const r = route.replace(/^\/api\//, '');
  if (/^(words|phone-pickup)(\/|$)/.test(r)) return 'transcript';
  if (/^(subject-places|subjects?\/standing)(\/|$)/.test(r)) return 'subjects';
  const rules = [[/^first-flow\/material-triage$/, 'material'], [/^(concept|study\/human-direction|study\/direction)/, 'direction'], [/^(library|sources|collections|collection-relationships|connections|icloud-albums|evidence|study-originals|study\/source-context)/, 'library'], [/^material/, 'material'],
    [/^(study-draft|study-ai)/, 'draft'], [/^(study\/(outputs|carousel-make)|carousel|article|exports|shared-articles|shared-carousels|instagram|looks?(\/|$)|accounts?(\/|$)|templates?(\/|$))/, 'outputs'], [/^study\/share/, 'share'], [/^consent/, 'consent'], [/^(study\/footage|study\/photos|study\/media-usage|media)/, 'media'],
    [/^(study\/research|study-research|research-material|research|first-flow)/, 'research'], [/^(pieces|state)/, 'piece'], [/^(source-sessions|recordings|ingestion|transcript-tools|transcription)/, 'transcript'],
    [/^inquiries/, 'collection'], [/^work-continuity/, 'continuity'], [/^magazine/, 'magazine'], [/^(terminal|ai\/execution|requests|passage)/, 'agent-runtime'], [/^(writing-template|guidance|voice-corrections)/, 'writing'],
    [/^(i64os|capabilities|events|presence|leases|journal)/, 'system']];
  return rules.find(([pattern]) => pattern.test(r))?.[1] || 'system';
}
const nameOf = route => route.replace(/^\/api\//, '').replace(/\{(\w+)\}/g, '$1').split('/').join('.');
const VERB = { GET: 'get', POST: 'post', PUT: 'put', DELETE: 'delete', HEAD: 'head' };

/** Commands mounted by bespoke handlers in server.mjs (not the route map). */
export const CUSTOM_COMMANDS = [
  ['GET','/api/current-work/contract'],['POST','/api/current-work/read'],['POST','/api/current-work/validate'],['POST','/api/conversation/capture'],
  ['GET', '/api/magazine/working-draft/export-file', ['storyId','pieceId','expectedHash','exportId']],
  ['GET','/api/study/footage/preview',['bindingId','parentStudyId','sourceId','expectedHash']],
  ['GET', '/api/study/photos/available-preview', ['projectId','documentId','bindingId','parentStudyId','sourceId','expectedHash']],
  ['GET', '/api/study/photos/preview', ['projectId','documentId','bindingId','parentStudyId','sourceId','expectedHash']],
  ['GET', '/api/state'], ['PUT', '/api/state'],
  ['GET', '/api/shared-articles/capabilities'], ['GET', '/api/shared-articles/current', ['projectId?', 'allowEditedMarkdown?']], ['GET', '/api/shared-articles/requests', ['projectId?', 'documentId?']],
  ['GET', '/api/shared-articles/requests/{id}'], ['GET', '/api/shared-articles/requests/{id}/external'], ['POST', '/api/shared-articles/requests/{id}/accept'], ['POST', '/api/shared-articles/requests/{id}/reject'],
  ['POST', '/api/shared-articles/prepare'], ['POST', '/api/shared-articles/propose'], ['POST', '/api/shared-articles/recover-external'], ['POST', '/api/shared-articles/launches'], ['GET', '/api/shared-articles/launches/{id}'], ['POST', '/api/shared-articles/launches/{id}/send'],
  ['GET', '/api/shared-carousels/capabilities'], ['GET', '/api/shared-carousels/current', ['projectId', 'documentId', 'outputId', 'allowEditedMarkdown?']], ['GET', '/api/shared-carousels/requests', ['projectId', 'documentId', 'outputId']],
  ['GET', '/api/shared-carousels/requests/{id}', ['projectId', 'documentId', 'outputId']], ['GET', '/api/shared-carousels/requests/{id}/external', ['projectId', 'documentId', 'outputId']],
  ['POST', '/api/shared-carousels/prepare', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/recover-external', ['projectId', 'documentId', 'outputId'], 'scope-copy'], ['POST', '/api/shared-carousels/propose', ['projectId', 'documentId', 'outputId'], 'scope-copy'],
  ['POST', '/api/shared-carousels/requests/{id}/review', ['projectId', 'documentId', 'outputId'], 'scope'], ['POST', '/api/shared-carousels/requests/{id}/accept', ['projectId', 'documentId', 'outputId'], 'scope'], ['POST', '/api/shared-carousels/requests/{id}/reject', ['projectId', 'documentId', 'outputId'], 'scope'],
  ['GET', '/api/passage/revisions/{id}'], ['POST', '/api/passage/revisions/{id}/send'], ['POST', '/api/passage/revisions/{id}/run'],
  ['GET', '/api/research/answers/{id}'], ['GET', '/api/research/answers/{id}/markdown'], ['POST', '/api/research/answers/{id}/run'], ['POST', '/api/research/answers/{id}/keep'],
  ['GET', '/api/article/visual/{id}'], ['POST', '/api/article/visual/{id}/send'], ['POST', '/api/article/visual/{id}/run'],
  ['GET', '/api/article/make/{id}'], ['GET', '/api/article/make/{id}/context'], ['POST', '/api/article/make/{id}/send'], ['POST', '/api/article/make/{id}/run'], ['POST', '/api/article/make/{id}/propose'], ['POST', '/api/article/make/{id}/accept'],
  ['GET', '/api/carousel/make/{id}'], ['POST', '/api/carousel/make/{id}/send'], ['POST', '/api/carousel/make/{id}/run'],
  ['GET', '/api/terminal/sessions/{id}'], ['POST', '/api/terminal/sessions/{id}/input'], ['POST', '/api/terminal/sessions/{id}/resize'], ['POST', '/api/terminal/sessions/{id}/stop'],
  ['GET', '/api/carousel/exports/{id}/render/{index}', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']], ['GET', '/api/carousel/exports/{id}/file/{name}', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']],
  ['GET', '/api/exports/{id}/file', ['rootBindingId?', 'parentStudyId?', 'selectedOutputId?']], ['GET', '/api/ingestion/raw', ['id', 'file']], ['GET', '/api/study-originals/audio', ['id']], ['GET', '/api/sources/blob', ['id', 'original?']],
  ['POST', '/api/media', ['image bytes (image/jpeg|png|webp)']],
  ['GET', '/transcription/{id}/view'], ['GET', '/transcription/{id}/look'], ['POST', '/transcription/{id}/review'], ['POST', '/transcription/{id}/{action}'],
  ...NEEDS_YOU_COMMANDS,
  ...WORDS_COMMANDS,
  ...LOOKS_COMMANDS,
  ...ACCOUNTS_COMMANDS,
  ...TEMPLATES_COMMANDS,
  ...TRANSCRIPT_CHECK_COMMANDS,
  ...PHONE_PICKUP_COMMANDS,
  ...SUBJECT_PLACES_COMMANDS,
  ...STANDING_COMMANDS,
  ...AGENT_GUIDE_COMMANDS,
  ...RESEARCH_TOPICS_COMMANDS,
  ['GET', '/api/simmer/board', ['subject']], ['POST', '/api/simmer/board', ['subject', 'operationId', 'expectedRevision', 'expectedHash', 'board']],
  // Simmer from a chat: an agent carries Adrian's photos and exact words in, proposes onto the board, and records the dish he names.
  ['GET', '/api/simmer/material', ['subject']],
  ['POST', '/api/simmer/intake'], ['POST', '/api/simmer/propose'], ['POST', '/api/simmer/dish'],
  ['GET', '/api/instagram/templates'], ['GET', '/api/instagram/plans', ['subject?']], ['GET', '/api/instagram/plan', ['id']],
  ['POST', '/api/instagram/plan'], ['POST', '/api/instagram/layout'], ['POST', '/api/instagram/plan/codes'], ['POST', '/api/instagram/choose'], ['POST', '/api/instagram/confirm'], ['POST', '/api/instagram/meaning'], ['POST', '/api/instagram/ready'], ['POST', '/api/instagram/handoff'],
  ['GET', '/api/instagram/render', ['id', 'format', 'frame']], ['GET', '/api/instagram/preview', ['id', 'format', 'frame', 'layout (a code such as C1, a layout id, or a template id; a proposal too)', 'plain? (1: without the things placed on the slide)']], ['GET', '/api/instagram/sheet', ['id', 'format']], ['GET', '/api/instagram/captions', ['id']], ['GET', '/api/instagram/png', ['id', 'format', 'frame']],
  ...['read', 'seen', 'assign', 'result', 'complete', 'undo', 'recover', 'context', 'understanding', 'artifacts'].map(op => ['POST', '/api/work-continuity/' + op]),
  ...Object.values(INQUIRY_METHODS).map(([method, path]) => [method, '/api/inquiries' + path, method === 'GET' ? ['input (one JSON selector)'] : undefined, method === 'GET' ? 'input-json' : undefined]),
];
/** POST routes in the custom families that only read. */
const CUSTOM_READ_ONLY = new Set([...LOOKS_READ_ONLY, 'POST /api/current-work/read','POST /api/current-work/validate','POST /api/work-continuity/read', 'POST /api/work-continuity/context', 'POST /api/work-continuity/understanding', 'POST /api/work-continuity/artifacts', 'POST /api/shared-carousels/requests/{id}/review']);
/**
 * study-ai.finish (3 Nov 2026) closes Adrian's read-through of a machine draft: it saves his edits and the
 * paragraphs he left alone, so it is his alone like every save below.
 * Prose saves (Adrian, 3 Nov 2026; review Track 3.1): agents never save prose directly, they propose it
 * (study-ai.propose, shared-articles.propose, magazine.working-draft.ai.propose, the stand-in paths, and
 * magazine.write, magazine.working-draft.save and its share-feedback save, which turn an agent's prose into a
 * proposal). These routes write the words themselves. study-draft.undo is gated in the draft service: an agent
 * may undo only on a structure-test copy, where its stand-in marks live.
 */
export const PROSE_SAVES = Object.freeze(['POST /api/study-draft/save', 'POST /api/study-draft/history-restore',
  'POST /api/study/outputs/save', 'POST /api/study/outputs/undo', 'POST /api/study/outputs/undo-words',
  'POST /api/study/human-direction/write', 'POST /api/study/human-direction/undo', 'POST /api/study-ai/finish']);
/** Human-only decisions an agent may carry from a chat with Adrian, with his exact words (actor.mjs chatDecider). */
export const CHAT_RELAYABLE = Object.freeze(new Set(['POST /api/instagram/choose', 'POST /api/instagram/confirm', 'POST /api/instagram/meaning', 'POST /api/instagram/ready', 'POST /api/consent/people/answer']));
/** Decisions only a human makes. Agents propose; the record says who decided. */
const HUMAN_ONLY = new Set([...PROSE_SAVES, 'POST /api/study-draft/capture-sources', 'POST /api/study-draft/capture-sources/stop', 'POST /api/study-draft/set-aside', 'POST /transcription/{id}/review', 'POST /api/instagram/choose', 'POST /api/instagram/confirm', 'POST /api/instagram/meaning', 'POST /api/instagram/ready', 'POST /api/source-sessions/check','POST /api/recordings/source','POST /api/study/language/accept','POST /api/study/language/reject','POST /api/source-language/accept','POST /api/source-language/reject','POST /api/study/outputs/visual-review','POST /api/magazine/working-draft/ai/run', 'POST /api/magazine/working-draft/ai/accept', 'POST /api/magazine/working-draft/ai/reject', 'POST /api/first-flow/material-triage', 'POST /api/magazine/working-draft/share-feedback/prepare-mapping', 'POST /api/magazine/working-draft/share-feedback/prepare-paragraph', 'POST /api/magazine/working-draft/share-feedback/undo', 'POST /api/magazine/mechanical-check', 'POST /api/source-sessions/translation-accept', 'POST /api/magazine/working-draft/prepare', 'POST /api/magazine/working-draft/edit', 'POST /api/magazine/working-draft/undo', 'POST /api/study-ai/accept', 'POST /api/study-ai/reject', 'POST /api/voice-corrections/decide', 'POST /api/study-ai/human-contract', 'POST /api/study/share/fact', 'POST /api/study/share/save', 'POST /api/study/share/undo',
  'POST /api/shared-articles/requests/{id}/accept', 'POST /api/shared-articles/requests/{id}/reject', 'POST /api/shared-carousels/requests/{id}/accept', 'POST /api/shared-carousels/requests/{id}/reject',
  'POST /api/article/make/{id}/accept', 'POST /api/consent/people/sent', 'POST /api/consent/people/answer', 'POST /api/consent/people/remove', 'POST /api/consent/share/answer', 'POST /api/consent/share/override', 'POST /api/consent/share/release', 'POST /api/inquiries/association/change', 'POST /api/inquiries/references/change', 'POST /api/inquiries/direction-references/change']);

function entry(method, route, { query, mode, mount }) {
  // Manuscript proposals take their identity from the query only; the body must not repeat it.
  if (route.startsWith('/api/study-ai/')&&route!=='/api/study-ai/run') { mode = 'scope'; query = ['bindingId', 'parentStudyId', 'requestId?']; }
  if(route==='/api/study/carousel-make'&&method==='GET')query=['rootBindingId','parentStudyId','requestId?'];
  if(route==='/api/study-ai/run'&&method==='GET')query=['bindingId','parentStudyId','requestId?','operationId'];
  if(route.startsWith('/api/study/language/')&&method==='GET')query=['kind?','bindingId','parentStudyId','outputId','recipientId?',...(route.endsWith('/review')?['requestId']:[])];
  const key = method + ' ' + route, readOnly = method === 'GET' || READ_ONLY_POSTS.has(route) || CUSTOM_READ_ONLY.has(key);
  const pattern = new RegExp('^' + route.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w+)\\?\}/g, '([^/]+)') + '$');
  return { name: '', section: section(route), method, route, schema: method === 'GET' || mode === 'scope' || mode === 'scope-copy' ? { query: query || [], ...(mode === 'scope-copy' ? { body: 'object (repeats the query scope)' } : mode === 'scope' && method !== 'GET' ? { body: BODY[route] || 'object (identity stays in the query)' } : {}), ...(mode === 'input-json' ? { encoding: 'input-json' } : {}) } : { body: BODY[route] || 'object' },
    readOnly, actors: (route.startsWith('/api/study/language/')||route.startsWith('/api/source-language/'))&&route.includes('/stand-in-')?['agent']:['POST /api/study/outputs/stand-in-refresh','POST /api/study/outputs/stand-in-create','POST /api/study/outputs/stand-in-review-words','POST /api/study/outputs/stand-in-save','POST /api/study/structure-tests/visual-review','POST /api/study/structure-tests','POST /api/study/structure-tests/proposal-review','POST /api/study/structure-tests/proposal-contract','POST /api/study/structure-tests/review-mark','POST /api/study/structure-tests/research-note'].includes(key)?['agent']:HUMAN_ONLY.has(key) ? HUMAN : ANY, ...(CHAT_RELAYABLE.has(key) ? { relay: 'chat' } : {}), ...(UNDO[key] ? { undo: UNDO[key] } : {}), mount, ...(mode ? { mode } : {}), pattern };
}
/** Query fields a GET handler reads, recovered from its source. */
const queryFields = fn => [...new Set([...String(fn).matchAll(/searchParams\.(?:get|getAll|has)\('([\w-]+)'\)/g)].map(m => m[1]))];

/** Build the registry: every route-map entry plus every custom route, with unique names. */
export function describeRoutes(routes, extra = []) {
  const list = [];
  for (const [route, methods] of Object.entries(routes)) for (const [method, fn] of Object.entries(methods)) list.push(entry(method, route, { query: method === 'GET' ? queryFields(fn) : undefined, mount: 'map' }));
  for (const [method, route, query, mode] of [...CUSTOM_COMMANDS, ...extra]) list.push(entry(method, route, { query, mode, mount: 'custom' }));
  const byRoute = new Map();for (const e of list) byRoute.set(e.route, (byRoute.get(e.route) || 0) + 1);
  for (const e of list) e.name = nameOf(e.route) + (byRoute.get(e.route) > 1 ? '.' + VERB[e.method] : '');
  const seen = new Set();for (const e of list) { if (seen.has(e.name)) throw new Error('Duplicate command name ' + e.name); seen.add(e.name); }
  // Undo names were written against unsuffixed names; resolve them to real entries.
  for (const e of list) if (e.undo && !seen.has(e.undo)) { const target = list.find(t => t.method === 'POST' && nameOf(t.route) === e.undo); if (target) e.undo = target.name; else delete e.undo; }
  return list;
}
/** The command matching an HTTP method and path (exact routes before patterns). */
export function findCommand(list, method, pathname) {
  return list.find(e => e.method === method && e.route === pathname) || list.find(e => e.method === method && e.route.includes('{') && e.pattern.test(pathname)) || null;
}
/** The registry as JSON for /api/capabilities. */
export const publicEntry = ({ pattern, ...rest }) => {const schema=rest.route==='/api/conversation/capture'?currentWorkSchemas.capture:rest.route.startsWith('/api/current-work/')?currentWorkSchemas[rest.route.split('/').at(-1)]:null;return {...rest,...(schema?{inputSchema:schema}:{})};};

/**
 * The HTTP route map, moved verbatim from server.mjs. bind() is called once per
 * request (as the literal was) with that request's url/request/server, so every
 * handler behaves exactly as before.
 */
export function createRouteMap(services) {
  return function bind({ url, request, server, outputQuery, decorateOutputExports, describe }) {
    const {captureStudySources,stopStudySources,listStudySources,nativeCarouselMake,voiceCorrections,sourceLineChecks,studyLanguage,sourceLanguage,sourceTranscript,localTranscriptCandidates,studyFootage,studyDirectionOptions,studyDirectionTarget,structureTestRecords,localAtlas,structureTests,albums,articleMake,articleVisual,carousel,carouselMake,conceptWork,connectedFolders,createStudyCollection,draftCall,execution,exports,extraction,firstFlow,guardCarouselOutput,guidance,ingestion,library,magazine,magazineRead,materialAlbums,materialFolder,originalRead,passageRevisions,recordings,requests,researchAction,researchAnswers,researchEnabled,researchInput,researchMaterial,sharedArticles,sourceSessions,stampSourceSession,store,studyAI,studyBindings,studyDerivedFindings,studyDraftChecks,studyQuoteLinks,studyDrafts,studyHumanDirection,studyMediaUsage,studyOriginals,studyOutputExports,studyOutputs,studyOwnedPhotoBindings,studyPhotos,studyResearchChoices,studyVideoBriefs,studyShare,consentDesk,terminal,transcriptTools,writingTemplates,magazineWorking,sourcedParagraphs,magazineMechanicalChecks,magazineLibraryPhotos,magazineOutputExports} = services;
    // The one publish check (consent desk): refuses with the reason while anyone on the piece is unanswered.
    const holdPublish=(scopes,what)=>consentDesk.assertNotHeld(scopes,what);
    // The older single-project export routes belong to the workspace's own project.
    const workspaceScope=()=>{try{return [{parentStudyId:store.get().project.id}];}catch{return [];}};
    const languageScope=()=>{
      const allowed=['kind','bindingId','parentStudyId','outputId','recipientId','requestId'];
      if([...url.searchParams.keys()].some(k=>!allowed.includes(k))||allowed.some(k=>url.searchParams.getAll(k).length>1))throw new StateError('Use one exact language source scope.',400);
      const scope={kind:url.searchParams.get('kind')||'audience-article',bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),outputId:url.searchParams.get('outputId')};
      if(url.searchParams.has('recipientId'))scope.recipientId=url.searchParams.get('recipientId');
      return {scope,...(url.searchParams.has('requestId')?{requestId:url.searchParams.get('requestId')}:{})};
    };
    const languageCall=async(owner,action,input)=>{if(!owner)throw new StateError('The maintained language owner is unavailable.',503);if(request.method==='POST'&&url.search)throw new StateError('Use the exact language route without a query.',400);try{return await owner[action](input);}catch(error){throw new StateError(error.message,error.status||500);}};
    const studyAICall=(action,input={})=>draftCall(()=>{
      const scope={};
      for(const key of ['bindingId','parentStudyId']){const values=url.searchParams.getAll(key);if(values.length!==1||!values[0])throw new StateError('Select one exact owned manuscript and parent project.',400);scope[key]=values[0];}
      if([...url.searchParams.keys()].some(key=>!['bindingId','parentStudyId','requestId'].includes(key))||url.searchParams.getAll('requestId').length>1)throw new StateError('Unsupported manuscript proposal query.',400);
      if(Object.keys(input).some(key=>['bindingId','parentStudyId'].includes(key)))throw new StateError('Manuscript identity comes from the explicit route scope.',400);
      const requestId=url.searchParams.get('requestId');if(requestId){if(input.requestId&&input.requestId!==requestId)throw new StateError('Request identity differs from its route.',409);input={...input,requestId};}
      return studyAI.call(action,{...scope,...input});
    });
    const conceptCall=fn=>draftCall(()=>{if(!conceptWork)throw new StateError('Concept work requires configured collections.',503);return fn();});
    const nativeCarouselCall=(action,input)=>draftCall(()=>{
      if(request.method==='POST'&&url.search)throw new StateError('Use the exact native Carousel route without a query.',400);
      if(!nativeCarouselMake)throw new StateError('Native Carousel generation is unavailable.',503);
      return nativeCarouselMake[action](input);
    });
    const routes = {
      '/api/study/carousel-make': {GET:()=>{
        const keys=['rootBindingId','parentStudyId','requestId'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length>1)||!url.searchParams.get('rootBindingId')||!url.searchParams.get('parentStudyId')||(url.searchParams.has('requestId')&&!url.searchParams.get('requestId')))throw new StateError('Choose one exact native Carousel scope and optional request.',400);
        return nativeCarouselCall(url.searchParams.has('requestId')?'get':'list',Object.fromEntries(url.searchParams));
      }},
      ...Object.fromEntries(['preview','run','register','cancel'].map(action=>['/api/study/carousel-make/'+action,{POST:input=>nativeCarouselCall(action,input)}])),
      '/api/concept/capabilities': {GET:()=>conceptCall(()=>conceptWork.capabilities())},
      '/api/concepts': {GET:()=>conceptCall(()=>conceptWork.list()),POST:input=>conceptCall(()=>conceptWork.create(input))},
      '/api/concept': {GET:()=>conceptCall(()=>conceptWork.read({parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/concept/save': {POST:input=>conceptCall(()=>conceptWork.save(input))},
      '/api/concept/source': {GET:()=>conceptCall(()=>conceptWork.source({...url.searchParams.has('parentStudyId')?{parentStudyId:url.searchParams.get('parentStudyId')}:{},sourceId:url.searchParams.get('sourceId')}))},
      '/api/concept/sources/search': {POST:input=>conceptCall(()=>conceptWork.sourcesSearch(input))},
      '/api/writing-template': {GET:()=>writingTemplates.get({expectedProjectId:url.searchParams.get('expectedProjectId'),expectedDocumentId:url.searchParams.get('expectedDocumentId')})},
      '/api/writing-template/attach': {POST:input=>writingTemplates.attach(input)},
      '/api/writing-template/detach': {POST:input=>writingTemplates.detach(input)},
      '/api/writing-template/snapshot': {POST:input=>writingTemplates.snapshot(input)},
      '/api/writing-template/restore-copy': {POST:input=>writingTemplates.restoreCopy(input)},
      '/api/magazine/library-photos': {GET:async()=>{if([...url.searchParams].length)throw new StateError('Photo library browsing accepts no paths or selectors.',400);try{return await magazineLibraryPhotos.catalog();}catch(error){throw new StateError(error.message,Number.isInteger(error.status)&&error.status>=400&&error.status<500?error.status:500);}}},
      '/api/magazine/library-photos/album': {POST:async input=>{if([...url.searchParams].length)throw new StateError('Photo filing accepts only its exact route without query selectors.',400);try{const result=await magazineLibraryPhotos.changeAlbum(input);input.scope={kind:'library',id:'folders-media'};return result;}catch(error){throw new StateError(error.message,Number.isInteger(error.status)&&error.status>=400&&error.status<=599?error.status:500);}}},
      '/api/magazine/mechanical-check': {
        GET:()=>{const keys=['parentStudyId','storyId','pieceId','checkId'];if([...url.searchParams.keys()].some(k=>!keys.includes(k))||keys.some(k=>url.searchParams.getAll(k).length>1))throw new StateError('Use one exact saved check owner.',400);if(!magazineMechanicalChecks)throw new StateError('Saved Magazine checks are not configured.',503);return magazineMechanicalChecks.read({parentStudyId:url.searchParams.get('parentStudyId'),storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),...(url.searchParams.has('checkId')?{checkId:url.searchParams.get('checkId')}:{})});},
        POST:async input=>{if(!magazineMechanicalChecks)throw new StateError('Saved Magazine checks are not configured.',503);const result=await magazineMechanicalChecks.run(input);input.scope={kind:'story',id:input.storyId};return result;}
      },
      '/api/magazine/working-draft/export': {POST:input=>{const {parentStudyId,...rest}=input||{};holdPublish([{parentStudyId:rest.storyId},{parentStudyId}],'Saving this export');return magazineOutputExports.save(rest);}},
      '/api/magazine/working-draft/exports': {GET:()=>magazineOutputExports.list(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/ai/context': {GET:()=>sourcedParagraphs.context(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/ai/proposals': {GET:()=>sourcedParagraphs.list(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/ai/proposal': {GET:()=>sourcedParagraphs.review(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/ai/propose': {POST:input=>sourcedParagraphs.propose(input)},
      '/api/magazine/working-draft/ai/run': {POST:input=>sourcedParagraphs.run(input)},
      '/api/magazine/working-draft/ai/accept': {POST:input=>sourcedParagraphs.accept(input)},
      '/api/magazine/working-draft/ai/reject': {POST:input=>sourcedParagraphs.reject(input)},
      '/api/magazine/working-draft/catalog': {GET:()=>magazineWorking.catalog(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/read': {GET:()=>magazineWorking.read(Object.fromEntries(url.searchParams))},
      '/api/magazine/working-draft/share-context': {GET:()=>{
        const keys=['storyId','pieceId','edition','expectedHash'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Use one exact value for each Magazine share reference.',400);
        return magazineWorking.shareContext({storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),edition:url.searchParams.get('edition'),expectedHash:url.searchParams.get('expectedHash')});
      }},
      '/api/magazine/working-draft/share-feedback': {GET:()=>{
        const keys=['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Choose one exact registered feedback reference and its current hashes.',400);
        return magazineWorking.readShareFeedback({storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),edition:url.searchParams.get('edition'),expectedHash:url.searchParams.get('expectedHash'),registeredFeedbackPath:url.searchParams.get('registeredFeedbackPath'),expectedFeedbackHash:url.searchParams.get('expectedFeedbackHash')});
      }},
      '/api/magazine/working-draft/share-feedback/edit-model': {GET:()=>{
        const keys=['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Choose one exact feedback file and its current owner hashes.',400);
        return magazineWorking.readShareFeedbackEditModel({storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),edition:url.searchParams.get('edition'),expectedHash:url.searchParams.get('expectedHash'),registeredFeedbackPath:url.searchParams.get('registeredFeedbackPath'),expectedFeedbackHash:url.searchParams.get('expectedFeedbackHash')});
      }},
      '/api/magazine/working-draft/share-feedback/prepare-paragraph': {POST:input=>magazineWorking.prepareShareFeedbackParagraph(input)},
      '/api/magazine/working-draft/share-feedback/prepare-mapping': {POST:input=>magazineWorking.prepareShareFeedbackMapping(input)},
      '/api/magazine/working-draft/share-feedback/prepare': {POST:input=>magazineWorking.prepareShareFeedback(input)},
      '/api/magazine/working-draft/share-feedback/save': {POST:async input=>{const result=await magazineWorking.saveShareFeedback(input);if(result.scope)input.scope=result.scope;return result;}},
      '/api/magazine/working-draft/share-feedback/history': {GET:()=>{
        const keys=['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','invitationId'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==(key==='invitationId'&&!url.searchParams.has(key)?0:1)))throw new StateError('Choose one exact registered feedback reference and its current owner hashes.',400);
        return magazineWorking.shareFeedbackHistory({storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),edition:url.searchParams.get('edition'),expectedHash:url.searchParams.get('expectedHash'),registeredFeedbackPath:url.searchParams.get('registeredFeedbackPath'),expectedFeedbackHash:url.searchParams.get('expectedFeedbackHash'),...(url.searchParams.has('invitationId')?{invitationId:url.searchParams.get('invitationId')}:{})});
      }},
      '/api/magazine/working-draft/share-feedback/undo-eligibility': {GET:()=>{
        const keys=['storyId','pieceId','edition','expectedHash','registeredFeedbackPath','expectedFeedbackHash','operationId'];
        if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Choose one exact feedback save and its current owner hashes.',400);
        return magazineWorking.eligibleUndoShareFeedback({storyId:url.searchParams.get('storyId'),pieceId:url.searchParams.get('pieceId'),edition:url.searchParams.get('edition'),expectedHash:url.searchParams.get('expectedHash'),registeredFeedbackPath:url.searchParams.get('registeredFeedbackPath'),expectedFeedbackHash:url.searchParams.get('expectedFeedbackHash'),operationId:url.searchParams.get('operationId')});
      }},
      '/api/magazine/working-draft/share-feedback/undo': {POST:async input=>{const result=await magazineWorking.undoShareFeedback(input);if(result.scope)input.scope=result.scope;return result;}},
      '/api/magazine/working-draft/prepare': {POST:input=>magazineWorking.prepare(input)},
      '/api/magazine/working-draft/save': {POST:async input=>{const result=await magazineWorking.save(input);if(result.scope)input.scope=result.scope;return result;}},
      '/api/magazine/working-draft/edit': {POST:async input=>{const result=await magazineWorking.edit(input);if(result.scope)input.scope=result.scope;return result;}},
      '/api/magazine/working-draft/undo': {POST:async input=>{const result=await magazineWorking.undo(input);if(result.scope)input.scope=result.scope;return result;}},
      '/api/magazine/working-draft/operation': {GET:()=>magazineWorking.operation(Object.fromEntries(url.searchParams))},
      '/api/magazine/portfolio': {GET:()=>magazineRead(()=>magazine.list())},
      '/api/magazine/artifact': {GET:()=>magazineRead(()=>magazine.read({artifactId:url.searchParams.get('id'),expectedHash:url.searchParams.get('hash')}))},
      '/api/library/folders': {GET:()=>library.folders({domain:url.searchParams.get('domain')}),POST:input=>library.changeFolders(input)},
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
      '/api/recordings/source': {POST:input=>recordings.registerSource(input)},
      '/api/library/topics': {GET:()=>library.readTopics(),POST:input=>{if(Object.hasOwn(input,'actor'))throw new StateError('The command supplies the actual actor.',400);return library.saveTopics({...input,actor:currentActor()?.actor});}},
      '/api/library/source-projects': {GET:async()=>{if([...url.searchParams.keys()].length)throw new StateError('This read takes no parameters.',400);const flows=typeof firstFlow?.usedBy==='function'?firstFlow.usedBy():[],{pieces}=await store.listPieces({readOnly:true}),named=new Map((pieces||[]).map(p=>[p.id,p.title||p.name||null]));return {schema:'ar-create.library-source-projects.v1',coverage:'Projects that list a Library source as their material. Citations, Magazine story files and photo placements are not included.',projects:flows.map(f=>({projectId:f.projectId,title:named.get(f.projectId)||null,sourceIds:f.sourceIds}))};}},
      '/api/library/usage': {GET:()=>{if([...url.searchParams.keys()].some(k=>k!=='sourceId'))throw new StateError('Choose exact Library source IDs.',400);if(!studyMediaUsage)throw new StateError('Library usage is unavailable.',503);return studyMediaUsage.readGlobal({sourceIds:url.searchParams.getAll('sourceId')});}},
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
      '/api/study-ai/run': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact execution path.',400);return studyAI.call('run',input);}),GET:()=>draftCall(()=>{const input=Object.fromEntries(url.searchParams);if([...url.searchParams.keys()].some(key=>!['bindingId','parentStudyId','requestId','operationId'].includes(key))||Object.keys(input).some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Use one exact execution scope.',400);return studyAI.call('runStatus',input);})},
      '/api/study/structure-tests/research-note': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact test-note path.',400);return structureTests.researchNote(input);})},
      '/api/research/atlas/capabilities': {GET:()=>localAtlas.capabilities()},
      '/api/research/atlas/search': {POST:input=>localAtlas.search(input)},
      '/api/research/atlas/article': {GET:()=>localAtlas.read(Object.fromEntries(url.searchParams))},
      '/api/study/material/attach': {POST:input=>draftCall(async()=>{if(url.search)throw new StateError('Use the exact native material attachment path.',400);if(!input||Object.keys(input).sort().join(',')!=='bindingId,operationId,parentStudyId,sourceIds')throw new StateError('Attach retained sources to one exact native subject.',400);const parent=await studyBindings.lookup({projectKey:input.parentStudyId});return firstFlow.study.attach({...input,projectId:parent.projectId,documentId:parent.documentId});})},
      '/api/study/video-briefs': {
        GET:()=>draftCall(()=>{
          if(!studyVideoBriefs)throw new StateError('Video Editing briefs are unavailable.',503);
          if([...url.searchParams.keys()].sort().join(',')!=='parentStudyId,projectKey')throw new StateError('Choose one exact Video Editing subject.',400);
          const projectKey=url.searchParams.get('projectKey'),parentStudyId=url.searchParams.get('parentStudyId');
          return studyVideoBriefs.list({projectKey,parentStudyId});
        }),
        POST:input=>draftCall(()=>{
          if(url.search)throw new StateError('Use the exact Video Editing brief command.',400);
          if(!studyVideoBriefs)throw new StateError('Video Editing briefs are unavailable.',503);
          return studyVideoBriefs.add(input);
        }),
      },
      '/api/study/video-briefs/source': {GET:()=>draftCall(()=>{
        if(!studyVideoBriefs)throw new StateError('Video Editing briefs are unavailable.',503);
        if([...url.searchParams.keys()].sort().join(',')!=='id,parentStudyId,projectKey')throw new StateError('Choose one exact Video Editing brief.',400);
        const projectKey=url.searchParams.get('projectKey'),parentStudyId=url.searchParams.get('parentStudyId'),id=url.searchParams.get('id');
        return studyVideoBriefs.resolve({projectKey,parentStudyId,id});
      })},
      '/api/study/video-briefs/relink': {POST:input=>draftCall(()=>{
        if(url.search)throw new StateError('Use the exact Video Editing finding-link command.',400);
        if(!studyVideoBriefs)throw new StateError('Video Editing briefs are unavailable.',503);
        return studyVideoBriefs.relink(input);
      })},
      '/api/study/video-briefs/inquiry': {POST:input=>draftCall(()=>{
        if(url.search)throw new StateError('Use the exact Video Editing inquiry-link command.',400);
        if(!studyVideoBriefs)throw new StateError('Video Editing briefs are unavailable.',503);
        return studyVideoBriefs.linkInquiry(input);
      })},
      '/api/study/footage': {GET:()=>draftCall(()=>{if([...url.searchParams.keys()].sort().join(',')!=='bindingId,parentStudyId')throw new StateError('Choose one exact native footage scope.',400);if(!studyFootage)throw new StateError('Footage is unavailable.',503);return studyFootage.list({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')});})},
      '/api/study/footage/ranges': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact footage range command.',400);if(!studyFootage)throw new StateError('Footage is unavailable.',503);return studyFootage.save(input);})},
      '/api/study/outputs/visual-review': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use one exact Carousel visual review.',400);return studyOutputExports.reviewCarouselVisual(input);})},
      '/api/study/structure-tests/visual-review': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use one exact copy visual review.',400);return studyOutputExports.standInReviewCarouselVisual(input);})},
      '/api/study/research/brief': {GET:()=>draftCall(async()=>{if([...url.searchParams.keys()].sort().join(',')!=='bindingId,parentStudyId')throw new StateError('Choose one exact native Research brief.',400);const binding=Object.fromEntries(url.searchParams),document=await studyDrafts.read(binding);if(document.binding.parentStudyId!==binding.parentStudyId)throw new StateError('The Research subject changed.',409);const parent=await studyBindings.lookup({projectKey:binding.parentStudyId}),scope={...binding,projectId:parent.projectId,documentId:parent.documentId},flow=await firstFlow.study.read(scope);let agentStandIn=false;if(AGENT_ACTORS.includes(currentActor()?.actor)){try{await structureTests.validateTarget(binding);agentStandIn=true;}catch(error){if(![403,404,409].includes(error.status))throw error;}}return {...flow,...binding,canPrepare:currentActor()?.actor==='human:adrian'||agentStandIn,canRun:execution.capabilities().available===true,agentStandIn};})},
      ...Object.fromEntries(['prepare','run','reinspect'].map(action=>['/api/study/research/brief/'+action,{POST:input=>draftCall(async()=>{if(url.search||!input||Object.keys(input).some(k=>!(action==='prepare'?['bindingId','parentStudyId','question','sourceIds','operationId','sourceReviews','humanDecision']:['bindingId','parentStudyId','requestId','operationId']).includes(k)))throw new StateError('Use one exact native Research brief request.',400);const {bindingId,parentStudyId,...args}=input,binding={bindingId,parentStudyId},document=await studyDrafts.read(binding);if(document.binding.parentStudyId!==parentStudyId)throw new StateError('The Research subject changed.',409);const parent=await studyBindings.lookup({projectKey:parentStudyId});return {...await firstFlow.study[action]({...binding,projectId:parent.projectId,documentId:parent.documentId},args),...binding};})}])),
      '/api/study/research': {GET:()=>draftCall(()=>{if([...url.searchParams.keys()].sort().join(',')!=='bindingId,parentStudyId')throw new StateError('Choose one exact native Research subject.',400);return researchAnswers.study.sources(Object.fromEntries(url.searchParams));})},
      '/api/study/research/answer': {GET:()=>draftCall(()=>{if([...url.searchParams.keys()].sort().join(',')!=='bindingId,id,parentStudyId')throw new StateError('Choose one exact native Research answer.',400);return researchAnswers.study.get({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')},url.searchParams.get('id'));})},
      ...Object.fromEntries(['prepare','run','keep'].map(action=>['/api/study/research/'+action,{POST:input=>draftCall(()=>{if(url.search||!input||Object.keys(input).some(k=>!(action==='prepare'?['bindingId','parentStudyId','question','sourceIds','cardIds']:['bindingId','parentStudyId','id']).includes(k)))throw new StateError('Use exact native Research scope and request fields.',400);const {bindingId,parentStudyId,...args}=input;return researchAnswers.study[action==='prepare'?'preview':action]({bindingId,parentStudyId},action==='prepare'?args:args.id);})}])),
      '/api/study/structure-tests/proposal-contract': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact stand-in contract path.',400);return studyAI.standInContract(input);})},
      '/api/study/structure-tests/proposal-review': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact stand-in decision path.',400);return studyAI.standInReview(input);})},
      '/api/study-ai/contracts': {GET:()=>studyAICall('contracts')},
      '/api/study-ai/human-contract': {POST:input=>studyAICall('humanContract',input)},
      '/api/study-ai/read': {GET:()=>studyAICall('read')},
      '/api/study-ai/prepare': {POST:input=>studyAICall('prepare',input)},
      '/api/study-ai/context': {GET:()=>studyAICall('context')},
      '/api/study-ai/propose': {POST:input=>studyAICall('propose',input)},
      '/api/study-ai/cancel': {POST:input=>studyAICall('cancel',input)},
      '/api/study-ai/review': {GET:()=>studyAICall('review')},
      '/api/study-ai/requests': {GET:()=>studyAICall('list')},
      '/api/study-ai/accept': {POST:input=>studyAICall('accept',input)},
      '/api/study-ai/reject': {POST:input=>studyAICall('reject',input)},
      '/api/study-ai/finish': {POST:input=>studyAICall('finish',input)},
      '/api/voice-corrections': {GET:()=>voiceCorrections.list({status:url.searchParams.get('status')||undefined,parentStudyId:url.searchParams.get('parentStudyId')||undefined})},
      '/api/voice-corrections/export': {GET:()=>voiceCorrections.export()},
      '/api/voice-corrections/decide': {POST:input=>voiceCorrections.decide(input)},
      '/api/voice-corrections/sent': {POST:input=>voiceCorrections.sent(input)},
      '/api/study/direction-options': {GET:()=>draftCall(async()=>{if([...url.searchParams.keys()].sort().join(',')!=='bindingId,parentStudyId')throw new StateError('Choose an exact native Direction subject.',400);const scope=Object.fromEntries(url.searchParams),options=await studyDirectionOptions(scope),proof=await studyDirectionTarget({...scope,target:{kind:'subject'}});return {...options,canDecide:currentActor()?.actor==='human:adrian'||proof.canStandInReview,standIn:proof.canStandInReview};})},
      '/api/study/direction-decision': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact saved Direction decision path.',400);return studyHumanDirection.decide(input);})},
      '/api/study/human-direction': {GET:()=>draftCall(async()=>{const parentStudyId=url.searchParams.get('parentStudyId'),kind=url.searchParams.get('scope')||'project',bindingId=url.searchParams.get('bindingId'),record=await studyHumanDirection.read({parentStudyId,scope:kind,...(bindingId&&kind!=='project'?{bindingId}:{}),...(url.searchParams.has('outputId')?{outputId:url.searchParams.get('outputId')}:{})});if(kind==='project'&&bindingId&&AGENT_ACTORS.includes(currentActor()?.actor)){try{await structureTests.validateTarget({bindingId,parentStudyId});return {...record,canStandInResearchNotes:true};}catch(error){if(![403,404,409].includes(error.status))throw error;}}return record;})},
      '/api/study/human-direction/select': {POST:input=>draftCall(()=>studyHumanDirection.select(input))},
      '/api/study/human-direction/write': {POST:input=>draftCall(()=>studyHumanDirection.write(input))},
      '/api/study/human-direction/undo': {POST:input=>draftCall(()=>studyHumanDirection.undo(input))},
      '/api/study-originals': {GET:()=>{const key=url.searchParams.get('projectKey');return key?.startsWith('structure-test-')?draftCall(()=>structureTestRecords.list({parentStudyId:key})):originalRead(()=>studyOriginals.list(key));}},
      '/api/study-originals/check-inputs': {GET:()=>{const keys=['parentStudyKey','partKey','draftPath','expectedDraftHash'];if([...url.searchParams.keys()].length!==keys.length||keys.some(k=>url.searchParams.getAll(k).length!==1))throw new StateError('Use one exact current part and draft revision.',400);return originalRead(()=>studyOriginals.checkInputs(Object.fromEntries(url.searchParams)));}},
      '/api/study/photos/select': {POST:input=>draftCall(()=>studyOwnedPhotoBindings.select(input))},
      '/api/study/photos/inspect': {GET:()=>draftCall(()=>studyPhotos.inspect({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId'),bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study/photos': {GET:()=>draftCall(()=>studyPhotos.list({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId')}))},
      '/api/study/photos/available': {GET:()=>draftCall(()=>studyPhotos.available({projectId:url.searchParams.get('projectId'),documentId:url.searchParams.get('documentId'),bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study/photos/add': {POST:input=>draftCall(()=>studyPhotos.add(input))},
      '/api/study/photos/update': {POST:input=>draftCall(()=>studyPhotos.update(input))},
      '/api/study-research/findings': {GET:()=>draftCall(()=>{const projectKey=url.searchParams.get('projectKey'),parentStudyId=url.searchParams.get('parentStudyId');if(projectKey?.startsWith('structure-test-')){if(projectKey!==parentStudyId)throw new StateError('Choose the exact copy Research scope.',400);return structureTestRecords.findings({parentStudyId});}return studyDerivedFindings.read({projectKey,parentStudyId});})},
      '/api/study-research/findings/save': {
        POST:input=>draftCall(()=>{
          if(url.search)throw new StateError('Use the exact Research finding-save command.',400);
          if(!studyDerivedFindings)throw new StateError('Research findings are unavailable.',503);
          return studyDerivedFindings.save(input);
        }),
      },
      '/api/study-research/choices': {GET:()=>draftCall(()=>studyResearchChoices.read({projectKey:url.searchParams.get('projectKey'),bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyResearchChoices.save(input))},
      '/api/study-draft/root-recovery': {GET:()=>draftCall(()=>studyDrafts.inspectRoots({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')})),POST:input=>draftCall(()=>studyDrafts.recoverRoots(input))},
      '/api/study/source-context': {GET:async()=>{if([...url.searchParams.keys()].some(key=>key!=='id')||url.searchParams.getAll('id').length!==1)throw new StateError('Select one existing Library source.',400);const source=await library.snapshot(url.searchParams.get('id'),{includeBody:true});return {sourceId:source.id,hash:source.hash,title:source.title||source.name||'Source',text:typeof source.text==='string'?source.text:null,missing:!!source.missing};}},
      '/api/study/media-usage': {GET:()=>draftCall(()=>{if(!studyMediaUsage)throw new StateError('Saved media usage is unavailable.',503);const input=Object.fromEntries(url.searchParams);input.sourceIds=url.searchParams.getAll('sourceId');delete input.sourceId;return studyMediaUsage.read(input);})},
      '/api/study/media-usage/resolve': {GET:()=>draftCall(()=>{if(!studyMediaUsage)throw new StateError('Saved media usage is unavailable.',503);return studyMediaUsage.resolve(Object.fromEntries(url.searchParams));})},
      '/api/study/share/recipients': {GET:()=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);if([...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Use one exact value per Share selector.',400);return studyShare.list(Object.fromEntries(url.searchParams));})},
      '/api/study/share': {GET:()=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);if([...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Use one exact value per Share selector.',400);return studyShare.read(Object.fromEntries(url.searchParams));})},
      '/api/study/share/save': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.save(input);})},
      '/api/study/share/fact': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.appendFact(input);})},
      '/api/consent/desk': {GET:()=>{if([...url.searchParams.keys()].some(k=>!['parentStudyId','pieceKey'].includes(k)||url.searchParams.getAll(k).length!==1))throw new StateError('Name the piece with one parentStudyId and, optionally, one pieceKey.',400);return consentDesk.read({parentStudyId:url.searchParams.get('parentStudyId'),...(url.searchParams.has('pieceKey')?{pieceKey:url.searchParams.get('pieceKey')}:{})});}},
      '/api/consent/open': {GET:()=>{if([...url.searchParams.keys()].some(k=>k!=='parentStudyId'||url.searchParams.getAll(k).length!==1))throw new StateError('Filter open consent items by one parentStudyId, or none.',400);return consentDesk.open(url.searchParams.has('parentStudyId')?{parentStudyId:url.searchParams.get('parentStudyId')}:{});}},
      '/api/consent/claims/record': {POST:input=>consentDesk.recordClaim(input)},
      '/api/consent/claims/link': {POST:input=>consentDesk.linkClaim(input)},
      '/api/consent/claims/flag': {POST:input=>consentDesk.flagClaim(input)},
      '/api/consent/claims/clear-flag': {POST:input=>consentDesk.clearFlag(input)},
      '/api/consent/people/record': {POST:input=>consentDesk.recordPerson(input)},
      '/api/consent/people/draft-request': {POST:input=>consentDesk.draftRequest(input)},
      '/api/consent/people/sent': {POST:input=>consentDesk.recordSent(input)},
      '/api/consent/people/answer': {POST:input=>consentDesk.answer(input)},
      '/api/consent/people/remove': {POST:input=>consentDesk.removePerson(input)},
      '/api/consent/share/answer': {POST:input=>consentDesk.shareAnswer(input)},
      '/api/consent/share/override': {POST:input=>consentDesk.override(input)},
      '/api/consent/share/release': {POST:input=>consentDesk.release(input)},
      '/api/study/share/undo': {POST:input=>draftCall(()=>{if(!studyShare)throw new StateError('Local Share preparation is unavailable.',503);return studyShare.undo(input);})},
      '/api/study/outputs': {GET:()=>draftCall(async()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);const input={rootBindingId:url.searchParams.get('rootBindingId'),parentStudyId:url.searchParams.get('parentStudyId'),...(url.searchParams.has('selectedOutputId')?{selectedOutputId:url.searchParams.get('selectedOutputId')}:{})};const view=await studyOutputs.read(input);if(AGENT_ACTORS.includes(currentActor()?.actor)&&view.output&&['article','carousel','post','product-listing'].includes(view.output.kind)){try{const proof=await structureTests.validateTarget({bindingId:input.rootBindingId,parentStudyId:input.parentStudyId});if(proof.root.binding.id===input.rootBindingId)return {...view,standInOutputEditing:true,standInWordsReview:view.output.kind==='carousel'};}catch(error){if(![403,404,409].includes(error.status))throw error;}}return view;})},
      '/api/study/outputs/review-words': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.reviewCarouselWords(input);})},
      '/api/study/outputs/stand-in-review-words': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact test-copy word review path.',400);if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.standInReviewCarouselWords(input);})},
      '/api/study/outputs/export': {POST:input=>{holdPublish([{parentStudyId:input?.parentStudyId}],'Saving this export');return draftCall(async()=>{if(!studyOutputExports)throw new StateError('Output exports are not enabled.',503);const {kind,...payload}=input;if(!['article','carousel','post','product-listing'].includes(kind))throw new StateError('Choose a supported output export.',400);const result=kind!=='carousel'?await studyOutputExports.saveArticle(payload):await studyOutputExports.saveCarousel(payload,'http://127.0.0.1:'+server.address().port);return decorateOutputExports(result,input);});}},
      '/api/study/outputs/exports': {GET:()=>draftCall(async()=>{if(!studyOutputExports)throw new StateError('Output exports are not enabled.',503);const input=outputQuery();return decorateOutputExports(await studyOutputExports.list(input),input);})},
      '/api/study/outputs/stand-in-refresh': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact test-copy writing update path.',400);if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.standInRefresh(input);})},
      '/api/study/outputs/stand-in-create': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact test-copy creation path.',400);if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.standInCreate(input);})},
      '/api/study/outputs/create': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.create(input);})},
      '/api/study/outputs/stand-in-save': {POST:input=>draftCall(()=>{if(url.search)throw new StateError('Use the exact test-copy output save path.',400);if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.standInSave(input);})},
      '/api/study/outputs/save': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.save(input);})},
      '/api/study/outputs/refresh': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.refreshSelectedArticle(input);})},
      '/api/study/outputs/undo': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.undo(input);})},
      '/api/study/outputs/export-check': {POST:input=>draftCall(()=>{if(!studyOutputs)throw new StateError('Output persistence is not enabled.',503);return studyOutputs.assertExport(input);})},
      '/api/study/structure-tests/review-mark':{POST:input=>draftCall(()=>{if(!structureTests)throw new StateError('Structure-test review is unavailable.',503);if([...url.searchParams].length)throw new StateError('Use the exact stand-in mark command without a query.',400);return structureTests.reviewMark(input);})},
      '/api/study/structure-tests': {GET:()=>draftCall(()=>{if(!structureTests)throw new StateError('Structure-test copies are unavailable.',503);if([...url.searchParams.keys()].join(',')!=='parentStudyId')throw new StateError('Use one exact structure-test identity.',400);return structureTests.read({parentStudyId:url.searchParams.get('parentStudyId')});}),POST:input=>draftCall(()=>{if(!structureTests)throw new StateError('Structure-test copies are unavailable.',503);if([...url.searchParams].length)throw new StateError('Use the exact structure-test copy command without a query.',400);return structureTests.create(input);})},
      '/api/study-draft/catalog': {GET:()=>draftCall(()=>{if([...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length!==1))throw new StateError('Use one catalog purpose.',400);return studyDrafts.catalog(Object.fromEntries(url.searchParams));})},
      '/api/study-draft/quote-link': {GET:()=>draftCall(()=>studyQuoteLinks.list(Object.fromEntries(url.searchParams))),POST:input=>draftCall(()=>studyQuoteLinks.create(input))},
      '/api/study-draft/quote-link/source': {GET:()=>draftCall(()=>studyQuoteLinks.source(Object.fromEntries(url.searchParams)))},
      '/api/study-draft/read': {GET:()=>draftCall(()=>studyDrafts.read({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study-draft/create-collection': {POST:input=>draftCall(()=>createStudyCollection(input))},
      '/api/study-draft/open': {POST:input=>draftCall(()=>studyDrafts.openCopy(input))},
      '/api/study-draft/capture-sources': {POST:input=>draftCall(()=>captureStudySources(input))},
      '/api/study-draft/capture-sources/stop': {POST:input=>draftCall(()=>stopStudySources(input))},
      '/api/study-draft/capture-sources/list': {GET:()=>draftCall(()=>listStudySources({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study-draft/save': {POST:input=>draftCall(()=>studyDrafts.save(input))},
      '/api/study-draft/set-aside': {POST:input=>draftCall(()=>studyDrafts.setAside(input))},
      '/api/study-draft/set-aside/list': {GET:()=>draftCall(()=>studyDrafts.listSetAside({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId')}))},
      '/api/study-draft/history-preview': {POST:input=>draftCall(()=>studyDrafts.previewVersion(input))},
      '/api/study-draft/history-restore': {POST:input=>draftCall(()=>studyDrafts.restoreVersion(input))},
      '/api/study-draft/undo': {POST:input=>draftCall(()=>studyDrafts.undo(input))},
      '/api/study-draft/inspect': {GET:()=>draftCall(()=>studyDrafts.inspect({bindingId:url.searchParams.get('bindingId'),parentStudyId:url.searchParams.get('parentStudyId'),operationId:url.searchParams.get('operationId')})),POST:input=>draftCall(()=>studyDrafts.inspect(input))},
      '/api/study-draft/recover': {POST:input=>draftCall(()=>studyDrafts.recover(input))},
      '/api/study-draft/check': {GET:()=>draftCall(()=>{const keys=['bindingId','parentStudyId','checkId','targetKind','outputId'];if([...url.searchParams.keys()].some(k=>!keys.includes(k)||url.searchParams.getAll(k).length!==1))throw new StateError('Select one exact saved Check target.',400);return studyDraftChecks.read(Object.fromEntries(url.searchParams));}),POST:input=>draftCall(()=>studyDraftChecks.run(input))},

      '/api/source-sessions': {GET:()=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return sourceSessions.list();}},
      '/api/study/language/requests': {GET:()=>languageCall(studyLanguage,'requests',languageScope())},
      '/api/source-language/requests': {POST:input=>languageCall(sourceLanguage,'requests',input)},
      '/api/study/language/edition-review': {GET:()=>languageCall(studyLanguage,'editionReview',languageScope())},
      '/api/study/language/capabilities': {GET:()=>languageCall(studyLanguage,'capabilities',languageScope())},
      '/api/study/language/review': {GET:()=>languageCall(studyLanguage,'review',languageScope())},
      '/api/study/language/prepare': {POST:input=>languageCall(studyLanguage,'prepare',input)},
      '/api/study/language/run': {POST:input=>languageCall(studyLanguage,'run',input)},
      '/api/study/language/accept': {POST:input=>languageCall(studyLanguage,'accept',input)},
      '/api/study/language/reject': {POST:input=>languageCall(studyLanguage,'reject',input)},
      '/api/study/language/stand-in-accept': {POST:input=>languageCall(studyLanguage,'standInAccept',input)},
      '/api/study/language/stand-in-reject': {POST:input=>languageCall(studyLanguage,'standInReject',input)},
      '/api/source-language/prepare': {POST:input=>languageCall(sourceLanguage,'prepare',input)},
      '/api/source-language/run': {POST:input=>languageCall(sourceLanguage,'run',input)},
      '/api/source-language/accept': {POST:input=>languageCall(sourceLanguage,'accept',input)},
      '/api/source-language/reject': {POST:input=>languageCall(sourceLanguage,'reject',input)},
      '/api/source-language/stand-in-accept': {POST:input=>languageCall(sourceLanguage,'standInAccept',input)},
      '/api/source-language/stand-in-reject': {POST:input=>languageCall(sourceLanguage,'standInReject',input)},
      '/api/source-language/capabilities': {POST:input=>languageCall(sourceLanguage,'capabilities',input)},
      '/api/source-language/review': {POST:input=>languageCall(sourceLanguage,'review',input)},
      '/api/source-transcript/candidate/capabilities': {GET:()=>localTranscriptCandidates.capabilities()},
      '/api/source-transcript/candidate/prepare': {POST:input=>languageCall(localTranscriptCandidates,'prepare',input)},
      '/api/source-transcript/candidate/start': {POST:input=>languageCall(localTranscriptCandidates,'start',input)},
      '/api/source-transcript/candidate/review': {POST:input=>languageCall(localTranscriptCandidates,'review',input)},
      '/api/source-transcript/capabilities': {GET:()=>sourceTranscript.capabilities()},
      '/api/source-transcript/terms/preview': {POST:input=>languageCall(sourceTranscript,'previewTerms',input)},
      '/api/source-transcript/terms/propose': {POST:input=>languageCall(sourceTranscript,'proposeTerms',input)},
      '/api/source-transcript/candidate/compare': {POST:input=>languageCall(sourceTranscript,'compareCandidate',input)},
      '/api/source-transcript/candidate/propose': {POST:input=>languageCall(sourceTranscript,'proposeCandidate',input)},
      '/api/source-sessions/translation-review': {GET:()=>{const keys=['sessionId','expectedRevision','expectedSourceHash'];if([...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1)||!/^(0|[1-9][0-9]*)$/.test(url.searchParams.get('expectedRevision')||''))throw new StateError('Select the exact saved conversation review.',400);if(typeof sourceSessions?.readTranslationReview!=='function')throw new StateError('Saved conversation review is not connected in this workspace.',503);return sourceSessions.readTranslationReview({sessionId:url.searchParams.get('sessionId'),expectedRevision:Number(url.searchParams.get('expectedRevision')),expectedSourceHash:url.searchParams.get('expectedSourceHash')});}},
      '/api/source-sessions/translation-proposals': {POST:input=>{if(typeof sourceSessions?.proposeTranslation!=='function')throw new StateError('Kept-conversation proposals are not connected in this workspace.',503);return sourceSessions.proposeTranslation(input);}},
      '/api/source-sessions/checks': {GET:()=>{if(!sourceLineChecks)throw new StateError('Checked lines are not connected.',503);return sourceLineChecks.list();}},
      '/api/source-sessions/check': {POST:input=>{if(!sourceLineChecks)throw new StateError('Checked lines are not connected.',503);return sourceLineChecks.mark(input);}},
      '/api/source-sessions/edit': {POST:input=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return stampSourceSession('edit',input);}},
      '/api/source-sessions/translation-accept': {POST:input=>{if(typeof sourceSessions?.acceptTranslation!=='function')throw new StateError('Saved translation review is not connected in this workspace.',503);return stampSourceSession('acceptTranslation',input);}},
      '/api/source-sessions/undo': {POST:input=>{if(!sourceSessions)throw new StateError('Kept conversation editing is not connected in this workspace.',503);return stampSourceSession('undo',input);}},
      '/api/material/folder/open': {POST:input=>materialFolder.open(input)},
      '/api/material/album': {POST:input=>materialAlbums.add(input)},
      '/api/first-flow/binding': {GET:()=>studyBindings.lookup({projectKey:url.searchParams.get('projectKey')})},
      '/api/first-flow/select': {POST:input=>studyBindings.select(input)},
      ...Object.fromEntries([['context','context'],['material-context','materialContext']].map(([route,method])=>['/api/first-flow/'+route,{GET:()=>{if([...url.searchParams.keys()].some(key=>key!=='projectId')||url.searchParams.getAll('projectId').length!==1)throw new StateError('Choose one exact saved project context.',400);return firstFlow[method]({projectId:url.searchParams.get('projectId')});}}])),
      '/api/first-flow': {GET:async()=>({...await firstFlow.get({projectId:url.searchParams.get('projectId')||store.get().project.id}),researchAvailable:researchEnabled})},
      '/api/first-flow/material-triage': {POST:input=>firstFlow.triageMaterial(input)},
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
      '/api/exports': { GET: () => exports.list(), POST: async input => {holdPublish(workspaceScope(),'Saving this export');await guardCarouselOutput(input);return exports.save(input);} },
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
      '/api/carousel/exports': {GET:()=>carousel.list(),POST:async input=>{holdPublish(workspaceScope(),'Saving this export');await guardCarouselOutput(input);return carousel.save(input,`http://${request.headers.host}`);}},
      '/api/ingestion': { GET: () => ingestion.list() },
      '/api/ingestion/retry': { POST: input => ingestion.retry(input.id) },
      '/api/transcript-tools/connect': {POST:input=>transcriptTools.connect(input,url.origin)},
      '/api/recordings': { GET: () => recordings.list() },
      '/api/capabilities': { GET: async () => url.searchParams.get('only') === 'commands' ? describe({only: 'commands'}) : ({ library: 'file-backed', webExtraction: { configured: true, backend: extraction ? 'WordForge Firecrawl' : 'i64os Readability', local: ingestion.capabilities.article }, youtube: ingestion.capabilities.youtube, transcription: (await recordings.list()).capability, guidance: 'shared-own-files', sharedArticles: {enabled:sharedArticles}, ...await describe() }) },
    };
    // The magazine's commands (runtime/commands/magazine.mjs), when the server passes them.
    if (services.magazineRoutes) Object.assign(routes, services.magazineRoutes({ url }));
    return routes;
  };
}

// Magazine commands (runtime/commands/magazine.mjs): human-only decisions, read-only POSTs, body hints.
import {MAGAZINE_HUMAN_ONLY, MAGAZINE_READ_ONLY_POSTS, MAGAZINE_BODY} from './commands/magazine.mjs';
for (const key of MAGAZINE_HUMAN_ONLY) HUMAN_ONLY.add(key);
for (const route of MAGAZINE_READ_ONLY_POSTS) READ_ONLY_POSTS.add(route);
Object.assign(BODY, MAGAZINE_BODY);
// The needs-you list (runtime/commands/needs-you.mjs): agents raise and read; only Adrian answers.
for (const key of NEEDS_YOU_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(BODY, NEEDS_YOU_BODY);
// The shared word library (runtime/commands/words.mjs): agents read and suggest; only Adrian confirms or answers.
for (const key of WORDS_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(BODY, WORDS_BODY);
Object.assign(BODY, LOOKS_BODY);
Object.assign(BODY, ACCOUNTS_BODY);
for (const key of TEMPLATES_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(BODY, TEMPLATES_BODY);
for (const key of TRANSCRIPT_CHECK_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(BODY, TRANSCRIPT_CHECK_BODY);
// The phone pickup (runtime/commands/phone-pickup.mjs): on demand only, never a timer.
for (const key of PHONE_PICKUP_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(BODY, PHONE_PICKUP_BODY);
// Where a subject lives (runtime/commands/subject-places.mjs): ordinary organising, open to assistants; folder changes have Undo.
for (const key of SUBJECT_PLACES_HUMAN_ONLY) HUMAN_ONLY.add(key);
Object.assign(UNDO, SUBJECT_PLACES_UNDO);
Object.assign(BODY, SUBJECT_PLACES_BODY);
// Research topics and groups (runtime/commands/research-topics.mjs): assistants read, file and propose; his line and his decisions are his.
for (const key of RESEARCH_TOPICS_HUMAN_ONLY) HUMAN_ONLY.add(key);
for (const key of RESEARCH_TOPICS_READ_ONLY) CUSTOM_READ_ONLY.add(key);
Object.assign(UNDO, RESEARCH_TOPICS_UNDO);
Object.assign(BODY, RESEARCH_TOPICS_BODY);
