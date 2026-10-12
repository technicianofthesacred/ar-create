import {articleOriginMatches,initialWritingSurface,untouchedInitialSurface,validatedEmptyProjectOrigin,type EmptyProjectReviewOrigin} from './article-origin';
import {articleContextReceipt,type ArticleContextReceipt} from './article-context-receipt';
import {preparedSourceReceipt,type PreparedSource} from './prepared-source';
import {documentParts,readableBlock,plain} from '../donors/mag/markdown-blocks';
import {markdownToDoc} from '../donors/wordforge/wf-block-markdown';
import {freshManuscriptProject} from '../shell/fresh-manuscript';
import {uid,type Manuscript,type Paragraph,type MagazineProvenance} from './document';
import {approvalMarks,approveMarkedProse,personalNoteQuestions} from './editorial-state.mjs';

export type FirstDraftReceipt={artifactHash:string;completionHash:string};
export type ArticleDraftReview={firstDraft?:FirstDraftReceipt;projectId?:string;raw:string;filename:string;requestId:string;documentId:string|null;manuscriptRevision:number|null;manuscriptTitle?:string|null;sourceIds:string[];notes?:string;preparedSource?:PreparedSource;contextReceipt?:ArticleContextReceipt};
export const manuscriptReviewIdentity=(doc:Manuscript)=>JSON.stringify({id:doc.id,revision:doc.revision,title:doc.title,paragraphs:doc.paragraphs});
export type EditorialReview={approvalResolvedAt?:string;skippedPersonalNotes?:string[];personalNotesSkippedAt?:string;method?:'explicit-interface-action'};
export type WholeDraftCandidate={firstDraft?:FirstDraftReceipt;title:string;raw:string;originalRaw?:string;originalRawKind?:'captured-source';editorialReview?:EditorialReview;fileName:string;paragraphs:Paragraph[];warnings:string[];baseDocumentId:string;baseRevision:number;baseIdentity?:string;baseOrigin?:EmptyProjectReviewOrigin;magazineProvenance?:MagazineProvenance;makeReceipt?:{requestId:string;sourceIds:string[];notes?:string;preparedSource?:PreparedSource;contextReceipt?:ArticleContextReceipt}};
export type {MagazineProvenance} from './document';
/** This is an attribution receipt, never permission to read or write a path. */
export function validatedMagazineProvenance(input:unknown):MagazineProvenance {
 const value=input as any,keys=['rootId','rootLabel','rootPath','relativePath','sha256','readOnly'];
 const text=(field:string,max:number)=>typeof value?.[field]==='string'&&value[field].trim().length>0&&value[field].length<=max&&!/[\u0000-\u001f\u007f]/.test(value[field]);
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||!text('rootId',128)||!text('rootLabel',256)||!text('rootPath',4096)||!value.rootPath.startsWith('/')||!text('relativePath',4096)||value.relativePath.startsWith('/')||value.relativePath.includes('\\')||value.relativePath.split('/').some((part:string)=>!part||part==='.'||part==='..')||typeof value.sha256!=='string'||!(/^[a-f0-9]{64}$/).test(value.sha256)||value.readOnly!==true)throw new Error('The Magazine source receipt is invalid. Open the original from the portfolio again.');
 return {rootId:value.rootId,rootLabel:value.rootLabel,rootPath:value.rootPath,relativePath:value.relativePath,sha256:value.sha256,readOnly:true};
}
// A source hash identifies the untouched original even after review edits raw.
// Bare manual previews have no request ID: their exact raw/file identity is
// required, so two undefined request IDs can never equate unrelated drafts.
export function sameWholeDraftReview(a:WholeDraftCandidate,b:WholeDraftCandidate):boolean {
 if(a.baseDocumentId!==b.baseDocumentId||a.baseRevision!==b.baseRevision||(a.baseIdentity&&b.baseIdentity&&a.baseIdentity!==b.baseIdentity))return false;
 if(a.magazineProvenance||b.magazineProvenance){if(!a.magazineProvenance||!b.magazineProvenance)return false;const left=validatedMagazineProvenance(a.magazineProvenance),right=validatedMagazineProvenance(b.magazineProvenance);return left.rootId===right.rootId&&left.rootPath===right.rootPath&&left.relativePath===right.relativePath&&left.sha256===right.sha256;}
 if(a.makeReceipt||b.makeReceipt)return !!a.makeReceipt?.requestId&&a.makeReceipt.requestId===b.makeReceipt?.requestId;
 return (a.originalRaw||a.raw)===(b.originalRaw||b.raw)&&a.fileName===b.fileName;
}
export function candidateFromMagazineArtifact(result:{raw:string;fileName:string;provenance:unknown},document:Manuscript):WholeDraftCandidate {
 const magazineProvenance=validatedMagazineProvenance(result.provenance);return {...parseWholeDraft(result.raw,document,result.fileName),magazineProvenance};
}
const MAX_DRAFT_BYTES=256*1024;
// This adapter reads the actual /mag DEV grammar. File markup and editorial
// notes remain in the receipt; they are neither fake citations nor story prose.
export function parseWholeDraft(raw:string,base:Manuscript,fileName='Pasted DEV draft'):WholeDraftCandidate {
 if(new TextEncoder().encode(raw).length>MAX_DRAFT_BYTES)throw new Error('Choose a DEV draft under 256 KB.');
 const model=documentParts(raw,false);
 if(!/^type:\s*['"]?DEV['"]?\s*$/im.test(model.prefix))throw new Error('Choose the complete /mag DEV draft, including its type: DEV frontmatter.');
 const declared=model.prefix.match(/^title:\s*(.+)\s*$/im)?.[1]?.trim()||'';
 const title=declared.replace(/^(['"])([\s\S]*)\1$/,'$2').replace(/\\"/g,'"');
 if(!title||title.length>256)throw new Error('The DEV draft needs a title of at most 256 characters in its frontmatter.');
 const blocks=model.blocks;
 // In both the DEV template and frozen Porcelain and Tea gold, page credits
 // precede a standalone rule. Without that rule, only the actual header
 // forms are excluded, so an opening or a quotation is never dropped.
 const header=(raw:string)=>!raw.trim()||/^#\s/.test(raw.trim())||/^\*\*(?:Conversations over Tea|Story Subject|Interview by|Interview Date|Photography, Words, Translation|Location|By|Published)\b/.test(raw.trim());
 const preambleEnd=blocks.findIndex(b=>b.raw.trim()==='---');
 let firstStory=0;while(firstStory<blocks.length&&header(blocks[firstStory].raw))firstStory++;
 const story=preambleEnd>=0&&blocks.slice(0,preambleEnd).every(b=>header(b.raw))?blocks.slice(preambleEnd+1):blocks.slice(firstStory);
 const paragraphs=story.flatMap(block=>{
  // == is an unresolved approval mark in /mag, not ordinary emphasis.
  // Preserve it in accepted words while reusing the donor's note/term reader.
  const approvalToken=uid();
  const text=readableBlock(block.raw.replaceAll('==',approvalToken)).replaceAll(approvalToken,'==').trim();
  if(!text||text==='---')return [];
  if(/^#{4,6}\s/m.test(text))throw new Error('This draft uses a heading deeper than the passage editor supports. Adjust it to H1–H3 before importing.');
  if(/^```|^~~~|^\|/m.test(text))throw new Error('This draft contains a table or code block outside the /mag story grammar. Review it before importing.');
  return [{id:uid(),doc:markdownToDoc(text,{links:true}),text,attributions:[],kept:[],origin:'ai' as const}];
 });
 if(!paragraphs.length||!paragraphs.some(p=>plain(p.text)))throw new Error('The DEV draft contains no story text.');
 const warnings:string[]=[];
 const notes=personalNoteQuestions(raw).length;
 const connecting=approvalMarks(raw).pairs;
 if(connecting)warnings.push(`${connecting} connecting ${connecting===1?'line is':'lines are'} marked for approval (==…==). Review them before accepting.`);
 if(notes)warnings.push(`${notes} editorial ${notes===1?'note is':'notes are'} retained in the original DEV receipt.`);
 if(/%%(?:photo|photos|side|glyph|pull)\s*:/i.test(raw))warnings.push('Photo and layout directives stay in the DEV receipt. Choose photos in Make after reviewing the writing.');
 if(/\[\[term:/.test(raw))warnings.push('Glossary terms read as their displayed words. Their original identifiers stay in the DEV receipt.');
 warnings.push('Quotation marks are preserved. Source links require explicit evidence attribution; importing does not certify a speaker or create citations.');
 return {title,raw,originalRaw:raw,originalRawKind:'captured-source',fileName,paragraphs,warnings,baseDocumentId:base.id,baseRevision:base.revision,baseIdentity:manuscriptReviewIdentity(base)};
}
export function reviseWholeDraftReview(candidate:WholeDraftCandidate,raw:string,base:Manuscript,editorialReview=candidate.editorialReview):WholeDraftCandidate{return {...parseWholeDraft(raw,base,candidate.fileName),originalRaw:candidate.originalRaw,originalRawKind:candidate.originalRawKind,editorialReview,baseDocumentId:candidate.baseDocumentId,baseRevision:candidate.baseRevision,baseIdentity:candidate.baseIdentity,baseOrigin:candidate.baseOrigin,firstDraft:candidate.firstDraft,makeReceipt:candidate.makeReceipt,magazineProvenance:candidate.magazineProvenance};}
export function approveWholeDraftMarks(candidate:WholeDraftCandidate,base:Manuscript):WholeDraftCandidate{return reviseWholeDraftReview(candidate,approveMarkedProse(candidate.raw),base,{...candidate.editorialReview,approvalResolvedAt:new Date().toISOString(),method:'explicit-interface-action'});}
export function skipWholeDraftPersonalNotes(candidate:WholeDraftCandidate,base:Manuscript):WholeDraftCandidate{return reviseWholeDraftReview(candidate,candidate.raw,base,{...candidate.editorialReview,skippedPersonalNotes:personalNoteQuestions(candidate.raw),personalNotesSkippedAt:new Date().toISOString(),method:'explicit-interface-action'});}

/** Only the shell may persist this result, atomically with the recovery version. */
export function freshWholeDraftProject(project:any,candidate:WholeDraftCandidate,shared:any,options?:Parameters<typeof freshManuscriptProject>[3]) {
 const origin=candidate.baseOrigin===undefined?undefined:validatedEmptyProjectOrigin(candidate.baseOrigin,project.id);
 if(origin&&(!candidate.makeReceipt?.requestId||typeof candidate.baseIdentity!=='string'||!untouchedInitialSurface(project,initialWritingSurface(project))))throw new Error('The empty project changed while this first draft was being reviewed. Load a current draft before accepting.');
 const before=(origin?initialWritingSurface(project):project.document) as Manuscript|undefined;
 if(!before||before.id!==candidate.baseDocumentId||before.revision!==candidate.baseRevision||(candidate.baseIdentity&&candidate.baseIdentity!==manuscriptReviewIdentity(before)))throw new Error('The current manuscript changed while this draft was being reviewed. Load the draft again before accepting.');
 // Re-parse at the acceptance boundary rather than trusting caller-owned
 // paragraph JSON, identities, attributions or a stale edited candidate.
 const magazineProvenance=candidate.magazineProvenance===undefined?undefined:validatedMagazineProvenance(candidate.magazineProvenance);
 const reviewed=parseWholeDraft(candidate.raw,before,candidate.fileName);
 const preparedSource=candidate.makeReceipt?.preparedSource===undefined?undefined:preparedSourceReceipt(candidate.makeReceipt.preparedSource);
 if(preparedSource&&preparedSource.requestId!==candidate.makeReceipt?.requestId)throw new Error('The prepared source belongs to a different draft request.');
 const contextReceipt=candidate.makeReceipt?.contextReceipt===undefined?undefined:articleContextReceipt(candidate.makeReceipt.contextReceipt);
 const next=freshManuscriptProject(project,reviewed.title,shared,options);
 // A new draft may inherit only its recorded source IDs. A previous piece’s
 // working selection is not evidence for a manual or receipt-free import.
 next.materialSelection={sourceIds:candidate.makeReceipt?[...new Set([...(preparedSource?[preparedSource.sourceId]:[]),...candidate.makeReceipt.sourceIds])].slice(0,100):[]};
 next.document.paragraphs=structuredClone(reviewed.paragraphs);
 next.document.importedDraft={kind:'mag-dev',raw:reviewed.raw,...(candidate.originalRaw?{originalRaw:candidate.originalRaw,originalRawKind:'captured-source'}:{}),...(candidate.editorialReview?{editorialReview:structuredClone(candidate.editorialReview)}:{}),fileName:reviewed.fileName,importedAt:options?.now||new Date().toISOString(),...(magazineProvenance?{magazineProvenance}:{}),...(candidate.makeReceipt?{makeReceipt:{...structuredClone(candidate.makeReceipt),...(contextReceipt?{contextReceipt}:{})}}:{})};
 return next;
}

export function candidateFromArticleResult(result:ArticleDraftReview,document:Manuscript,project?:any):WholeDraftCandidate {
 if(!articleOriginMatches(result,document,project))throw new Error('Your writing changed after this AI request. Prepare a current request before reviewing it.');
 return {...parseWholeDraft(result.raw,document,result.filename),...(result.firstDraft?{firstDraft:result.firstDraft}:{}),...(result.documentId===null?{baseOrigin:{kind:'empty-project' as const,projectId:project.id}}:{}),makeReceipt:{requestId:result.requestId,sourceIds:[...result.sourceIds],...(result.notes?{notes:result.notes}:{}),...(result.contextReceipt?{contextReceipt:articleContextReceipt(result.contextReceipt)}:{}),...(result.preparedSource?{preparedSource:preparedSourceReceipt(result.preparedSource)}:{})}};
}
