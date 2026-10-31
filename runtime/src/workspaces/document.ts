import {replaceSelection} from './selection-rewrite.mjs';
import type {ArticleContextReceipt} from './article-context-receipt';
import type {PreparedSource} from './prepared-source';
import type { JSONContent } from '@tiptap/core';
import {captureArticleComposition,reconcileArticleComposition,type ArticleComposition} from './articleComposition';
import {structuredMarkdown} from './structured-markdown.mjs';
export {structuredMarkdown} from './structured-markdown.mjs';
import { markdownToDoc, docToMarkdown } from '../donors/wordforge/wf-block-markdown';
export type Attribution = { id:string; sourceId:string; sourceTitle:string; excerpt:string; locator:string|Record<string,unknown>; author?:string; sourceHash?:string; form:'quote'|'inline'|'reference'|'paraphrase' };
export type KeptConstraint={id:string;text:string;mode:'verbatim'|'point'};
export type GuidanceRef={status:'captured'|'unknown';ref:string;revision:string;hash:string};
export type GuidanceCapture={capturedAt:string;setRevision:string;voice:GuidanceRef;positions:GuidanceRef;recipe:GuidanceRef};
export type TerminalOrigin={sessionId:string;cli:string;requestId?:string;contextHash?:string};
export type PassageRevisionProvenance={recordId:string;documentId:string;paragraphId:string;manuscriptRevision:number;baselineHash:string;baselineJSON:string;artifactHash:string;requestId:string;contextHash:string;instruction:string;selection?:{from:number;to:number;text:string;runs?:{text:string;marks:any[]}[]};replacement?:string;replacementParts?:string[]};
export type Proposal={id:string;doc:JSONContent;text:string;createdAt:string;method?:'manual'|'terminal'|'ai-revision';passageRevisionId?:string;passageRevision?:PassageRevisionProvenance;acceptedId?:string;terminalOrigin?:TerminalOrigin;guidance?:GuidanceCapture;requestManifest?:Record<string,unknown>;assembledContext?:string};
export type PendingResearchCandidate={projectId:string;sourceIds:string[];cardIds:string[];proposal:Proposal};
export type Acceptance={proposalId:string;acceptedAt:string;method:'manual'|'terminal'|'ai-revision';passageRevision?:PassageRevisionProvenance;terminalOrigin?:TerminalOrigin;guidanceApplied:false;guidance:GuidanceCapture;sources:{cardId:string;sourceId:string;sourceHash:string;locator:Attribution['locator'];excerpt:string}[];keptConstraints:KeptConstraint[];requestManifest?:Record<string,unknown>};
export type Paragraph = { id:string; doc:JSONContent; text:string; attributions:Attribution[]; kept:KeptConstraint[]; origin:'his'|'source'|'ai'|'terminal'; proposal?:Proposal;acceptedFrom?:Acceptance;acceptanceHistory?:Acceptance[] };
export type Placement = {slot:string;url:string;x:number;y:number;zoom:number;alt:string;caption?:string;credit?:string;paragraphId?:string|null};
export type CarouselPhoto={src:string;x:number;y:number};
export type CarouselSlide={id:string;role:string;text:string;credit:string;label?:string;pillar?:''|'佳'|'家'|'嘉';typography?:{font:'original'|'caudex'|'serif'|'sans';scale:number;fit:'auto'|'manual'};template:string;photos:CarouselPhoto[];paragraphIds:string[]};
export type LanguageEdition={sourceOutputId:string;sourceOutputRevision:number;sourceOutputHash:string;sourceWordsHash:string;sourceProofHash:string;sourceWordOwner:{kind:'native';bindingId:string;parentStudyId:string}|{kind:'carousel-words';projectId:string;documentId:string;outputId:string}};
export type Output = {language?:string;languageEdition?:LanguageEdition;id:string;kind:'article'|'carousel'|'post'|'product-listing';articleComposition?:ArticleComposition;articleCompositionNotice?:string;articleVisualMake?:{requestId:string;artifactHash:string;wordsHash:string};articleVisualHistory?:{createdAt:string;wordsHash:string;composition?:ArticleComposition;placements:Placement[]}[];stage?:'words'|'look';wordsReview?:{hash:string;reviewedAt:string};outputRevision?:number;slides?:CarouselSlide[];caption?:string;manuscriptRevision:number;placements:Placement[];createdAt:string;manuscript?:Paragraph[];title?:string;recomposedFrom?:string};
export type MagazineProvenance={rootId:string;rootLabel:string;rootPath:string;relativePath:string;sha256:string;readOnly:true};
export type WritingTemplate={sourceId:string;attachmentId:string;attachedAt:string;source:{artifactId:string;fileName:string;provenance:MagazineProvenance}};
export type WritingTemplateSnapshot={schema:'ar-create.writing-template-snapshot.v1';attachment:WritingTemplate;raw:string;hash:string;capturedAt:string};
export type Manuscript = {schema:'ar-create.document.v1';id:string;revision:number;title:string;editorialFrame?:string;writingTemplate?:WritingTemplate;paragraphs:Paragraph[];outputs:Output[];pendingResearchCandidate?:PendingResearchCandidate;importedDraft?:{kind:string;raw:string;originalRaw?:string;originalRawKind?:'captured-source';editorialReview?:{approvalResolvedAt?:string;skippedPersonalNotes?:string[];personalNotesSkippedAt?:string;method?:'explicit-interface-action'};fileName:string;importedAt:string;magazineProvenance?:MagazineProvenance;makeReceipt?:{requestId:string;sourceIds:string[];notes?:string;preparedSource?:PreparedSource;contextReceipt?:ArticleContextReceipt}};legacyImport?:{draft:string;importedAt:string}};
export function locatorLabel(locator:Attribution['locator']):string {
 if(typeof locator==='string'){
  try{if(locator.trim().startsWith('{'))return locatorLabel(JSON.parse(locator));}catch{}
  return locator.length>120?'Passage in source':locator||'Passage in source';
 }
 if(!locator)return 'Passage in source';
 if(locator.page!==undefined)return `Page ${locator.page}`;
 if(locator.lineStart!==undefined)return `Line ${locator.lineStart}${locator.lineEnd!==undefined&&locator.lineEnd!==locator.lineStart?'–'+locator.lineEnd:''}`;
 if(typeof locator.start==='number')return `Characters ${locator.start+1}${typeof locator.end==='number'?'–'+locator.end:''}`;
 const path=typeof locator.path==='string'?locator.path:'';
 return path?path.split(/[\\/]/).at(-1)||'Passage in source':'Passage in source';
}
export function locatorDetails(locator:Attribution['locator']):string {
 if(typeof locator==='string')return locator;
 return Object.entries(locator||{}).map(([key,value])=>`${key}: ${typeof value==='object'?JSON.stringify(value):String(value)}`).join('\n');
}
export const uid=()=>crypto.randomUUID();
export function newParagraph(text=''):Paragraph {return {id:uid(),doc:markdownToDoc(text),text,attributions:[],kept:[],origin:'his'};}
export function newDocument(title=''):Manuscript {return {schema:'ar-create.document.v1',id:uid(),revision:0,title,paragraphs:[],outputs:[]};}
export function importLegacy(doc:Manuscript,draft:string):Manuscript {return {...doc,revision:doc.revision+1,paragraphs:[...doc.paragraphs,...draft.split(/\n\s*\n/).filter(Boolean).map(newParagraph)],legacyImport:{draft,importedAt:new Date().toISOString()}};}
export function deriveMarkdown(doc:Manuscript):string {
 const prose=doc.paragraphs.map(p=>structuredMarkdown(p.doc)).join('\n\n');
 const refs=doc.paragraphs.flatMap(p=>p.attributions).filter((a,i,all)=>all.findIndex(b=>b.id===a.id)===i);
 return prose+(refs.length?'\n\n## Sources\n\n'+refs.map(a=>`- ${a.form==='paraphrase'?'Paraphrase · review required':a.form==='reference'?'Reference':'Quotation'}: ${a.sourceTitle}${a.author?' — '+a.author:''}. ${locatorLabel(a.locator)}\n  Original excerpt: “${a.excerpt}”`).join('\n'):'');
}
export function plainText(doc:JSONContent):string {
 if(doc.type==='text')return doc.text||'';
 if(doc.type==='hardBreak')return '\n';
 return (doc.content||[]).map(plainText).join(['doc','bulletList','orderedList'].includes(doc.type||'')?'\n':'');
}
export function revise(doc:Manuscript,paragraphs:Paragraph[]):Manuscript {return {...doc,revision:doc.revision+1,paragraphs};}
export function captureGuidance(input?:any):GuidanceCapture {
 const read=(key:string):GuidanceRef=>{const ref=input?.refs?.[key];return ref?.hash?{status:'captured',ref:ref.id||'unknown',revision:ref.hash,hash:ref.hash}:{status:'unknown',ref:'unknown',revision:'unknown',hash:'unknown'};};
 return {capturedAt:new Date().toISOString(),setRevision:input?.revision||'unknown',voice:read('voice'),positions:read('positions'),recipe:read('recipe')};
}
export function createManualProposal(doc:Manuscript,id:string,guidance?:any):Manuscript {
 return {...doc,paragraphs:doc.paragraphs.map(p=>p.id===id?{...p,proposal:{id:uid(),doc:structuredClone(p.doc),text:p.text,createdAt:new Date().toISOString(),method:'manual',guidance:captureGuidance(guidance)}}:p)};
}
export function createTerminalCandidate(text:string,origin:TerminalOrigin,record?:{manifest:Record<string,any>;assembledContext:string}):Proposal {
 const guidance=record?{revision:record.manifest.guidance?.voice?.revision,refs:Object.fromEntries(Object.entries(record.manifest.guidance||{}).map(([key,value]:any)=>[key,{id:value.ref?.id,hash:value.hash}]))}:undefined;
 return {id:uid(),doc:markdownToDoc(text),text,createdAt:new Date().toISOString(),method:'terminal',acceptedId:`accepted-${uid()}`,guidance:captureGuidance(guidance),terminalOrigin:structuredClone(origin),...(record?{requestManifest:structuredClone(record.manifest),assembledContext:record.assembledContext}:{})};
}
export function createTerminalProposal(doc:Manuscript,id:string,text:string,origin:TerminalOrigin,record?:{manifest:Record<string,any>;assembledContext:string}):Manuscript {
 const candidate=createTerminalCandidate(text,origin,record);return {...doc,paragraphs:doc.paragraphs.map(p=>p.id===id?{...p,proposal:candidate}:p)};
}
export function appendTerminalCandidate(doc:Manuscript,proposal:Proposal):Manuscript {
 const acceptedId=proposal.acceptedId||`accepted-${proposal.id}`;
 if(doc.paragraphs.some(p=>p.id===acceptedId||p.acceptedFrom?.proposalId===proposal.id))return doc;
 const sources=((proposal.requestManifest?.sources||[]) as any[]).flatMap(source=>{const locators=source.locators?.length?source.locators:[{locator:'Context source',excerpt:''}];return locators.map((line:any)=>({cardId:line.cardId||'context:'+source.id,sourceId:source.id,sourceHash:line.sourceHashAtCapture||source.hash||'unknown',locator:structuredClone(line.locator||'Context source'),excerpt:line.excerpt||''}));});
 const accepted:Acceptance={proposalId:proposal.id,acceptedAt:new Date().toISOString(),method:proposal.requestManifest?.purpose==='study-inheritance'?'manual':'terminal',terminalOrigin:structuredClone(proposal.terminalOrigin),guidanceApplied:false,guidance:structuredClone(proposal.guidance||captureGuidance()),sources,keptConstraints:[],...(proposal.requestManifest?{requestManifest:structuredClone(proposal.requestManifest)}:{})};
 return revise(doc,[...doc.paragraphs,{id:acceptedId,doc:structuredClone(proposal.doc),text:proposal.text,origin:proposal.terminalOrigin?.cli==='shell'?'terminal':'ai',attributions:[],kept:[],acceptedFrom:accepted,acceptanceHistory:[accepted]}]);
}
// Waiting research belongs to the saved document, never to accepted paragraphs.
// Its selection is captured once; changing material cannot replace it silently.
export function pendingResearchCandidate(doc:Manuscript,projectId:string):PendingResearchCandidate|undefined {
 return doc.pendingResearchCandidate?.projectId===projectId?doc.pendingResearchCandidate:undefined;
}
export function stageResearchCandidate(doc:Manuscript,pending:PendingResearchCandidate):Manuscript {
 const current=doc.pendingResearchCandidate;
 if(current&&(current.projectId!==pending.projectId||current.proposal.id!==pending.proposal.id))return doc;
 return {...doc,pendingResearchCandidate:structuredClone(current?{...current,proposal:pending.proposal}:pending)};
}
export function dropResearchCandidate(doc:Manuscript,projectId:string,proposalId:string):Manuscript {
 if(pendingResearchCandidate(doc,projectId)?.proposal.id!==proposalId)return doc;
 const {pendingResearchCandidate:removed,...rest}=doc;return rest;
}
export function acceptResearchCandidate(doc:Manuscript,projectId:string,proposalId:string):Manuscript {
 const candidate=pendingResearchCandidate(doc,projectId)?.proposal;
 if(!candidate||candidate.id!==proposalId||!plainText(candidate.doc).trim())return doc;
 return appendTerminalCandidate(dropResearchCandidate(doc,projectId,proposalId),candidate);
}
export function passageBaselineJSON(paragraph:Paragraph):string {
 return JSON.stringify({id:paragraph.id,doc:paragraph.doc,text:paragraph.text,kept:paragraph.kept,attributions:paragraph.attributions});
}
export async function passageBaselineHash(paragraph:Paragraph):Promise<string> {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(passageBaselineJSON(paragraph)));
 return Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,'0')).join('');
}
// Source identity travels inside JSON too. Quoted words and reference nodes
// remain exact; paraphrases can change wording but cannot invent attribution.
function sourceJSON(value:unknown):string {
 const canonical=(input:any):any=>Array.isArray(input)?input.map(canonical):input&&typeof input==='object'?Object.fromEntries(Object.keys(input).sort().map(key=>[key,canonical(input[key])])):input;
 return JSON.stringify(canonical(value));
}
function sourceParts(doc:JSONContent):string[] {
 const parts:string[]=[];
 const visit=(node:JSONContent)=>{
  if(node.type==='blockquoteAttributed'||node.type==='referenceCard'){parts.push(sourceJSON(node));return;}
  for(const mark of node.marks||[])if(['sourced','inlineQuote','paraphrase'].includes(mark.type))parts.push(sourceJSON(mark.type==='paraphrase'?mark:{mark,text:node.text||''}));
  node.content?.forEach(visit);
 };visit(doc);return parts.sort();
}
export function passageCandidateIssue(paragraph:Paragraph,candidate:JSONContent):string|undefined {
 if(!plainText(candidate).trim()&&!candidate.content?.some(node=>node.type==='referenceCard'))return 'The revision has no passage wording to review.';
 if(paragraph.kept.some(kept=>kept.mode==='verbatim'&&!plainText(candidate).includes(kept.text)))return 'The revision changes kept wording. Restore the exact wording before accepting.';
 if(JSON.stringify(sourceParts(paragraph.doc))!==JSON.stringify(sourceParts(candidate)))return 'The revision changes attributed source wording or identity. Restore the source passages before accepting.';
}
export function proposalAcceptanceIssue(doc:Manuscript,id:string):string|undefined {
 const paragraph=doc.paragraphs.find(value=>value.id===id),proposal=paragraph?.proposal;
 if(!paragraph||!proposal)return 'This proposal is no longer waiting.';
 if(proposal.method==='terminal')return;
 if(proposal.method==='ai-revision'){
  const receipt=proposal.passageRevision;
  if(!receipt||receipt.documentId!==doc.id||receipt.paragraphId!==id||passageBaselineJSON(paragraph)!==receipt.baselineJSON)return 'The accepted passage, Kept constraints or sources changed after this request. Prepare a fresh revision.';
  if(receipt.selection){try{if(typeof receipt.replacement!=='string'||receipt.selection.runs&&(!Array.isArray(receipt.replacementParts)||receipt.replacementParts.join('')!==receipt.replacement)||JSON.stringify(replaceSelection(paragraph.doc,receipt.selection,receipt.selection.runs?receipt.replacementParts:receipt.replacement))!==JSON.stringify(proposal.doc))return 'The replacement changed words outside the captured selection. Prepare a fresh rewrite.';}catch(cause){return (cause as Error).message;}}
  return passageCandidateIssue(paragraph,proposal.doc);
 }
 if(paragraph.kept.some(kept=>kept.mode==='verbatim'&&!plainText(proposal.doc).includes(kept.text)))return 'The alternative changes kept wording. Preserve it or change the kept constraint before accepting.';
}
export type PassageRevisionResult={id:string;status:string;projectId:string;documentId:string;paragraphId:string;manuscriptRevision:number;baselineHash:string;baselineJSON?:string;originalDoc:JSONContent;originalText:string;originalKept:KeptConstraint[];originalAttributions:Attribution[];instruction:string;requestId:string;contextHash:string;sessionId?:string;terminal?:{cli:string;id:string;status?:string};selection?:{from:number;to:number;text:string;runs?:{text:string;marks:any[]}[]};artifact?:{doc:JSONContent;text:string;hash:string;replacement?:string;replacementParts?:string[]};requestManifest?:Record<string,any>;assembledContext?:string};
export async function stagePassageRevision(doc:Manuscript,projectId:string,record:PassageRevisionResult):Promise<Manuscript> {
 if(record.projectId!==projectId||record.documentId!==doc.id)throw new Error('This revision belongs to another manuscript.');
 const paragraph=doc.paragraphs.find(value=>value.id===record.paragraphId);
 if(!paragraph)throw new Error('The selected passage no longer exists.');
 if(paragraph.proposal)throw new Error('Review or drop the waiting alternative before staging another revision.');
 if(record.status!=='result-ready'||!record.artifact)throw new Error('The revision is not ready to review. Check the saved request again.');
 const baselineJSON=passageBaselineJSON(paragraph);
 if(record.baselineJSON&&record.baselineJSON!==baselineJSON||await passageBaselineHash(paragraph)!==record.baselineHash)throw new Error('The accepted passage, Kept constraints or sources changed after this request. Prepare a fresh revision.');
 if(passageBaselineJSON(paragraph)!==baselineJSON)throw new Error('The accepted passage changed while its revision was being checked. Prepare a fresh revision.');
 if(record.selection){if(typeof record.artifact.replacement!=='string'||record.selection.runs&&(!Array.isArray(record.artifact.replacementParts)||record.artifact.replacementParts.join('')!==record.artifact.replacement)||JSON.stringify(replaceSelection(paragraph.doc,record.selection,record.selection.runs?record.artifact.replacementParts:record.artifact.replacement))!==JSON.stringify(record.artifact.doc))throw Error('The replacement changed words outside the captured selection.');}
 const issue=passageCandidateIssue(paragraph,record.artifact.doc);if(issue)throw new Error(issue);
 const manifest=record.requestManifest,guidance=manifest?{revision:manifest.guidance?.voice?.revision,refs:Object.fromEntries(Object.entries(manifest.guidance||{}).map(([key,value]:any)=>[key,{id:value.ref?.id,hash:value.hash}]))}:undefined;
 const proposal:Proposal={id:uid(),method:'ai-revision',passageRevisionId:record.id,createdAt:new Date().toISOString(),doc:structuredClone(record.artifact.doc),text:structuredMarkdown(record.artifact.doc),guidance:captureGuidance(guidance),passageRevision:{recordId:record.id,documentId:doc.id,paragraphId:paragraph.id,manuscriptRevision:record.manuscriptRevision,baselineHash:record.baselineHash,baselineJSON,artifactHash:record.artifact.hash,requestId:record.requestId,contextHash:record.contextHash,instruction:record.instruction,...(record.selection?{selection:structuredClone(record.selection),replacement:record.artifact.replacement,...(record.selection.runs?{replacementParts:structuredClone(record.artifact.replacementParts)}:{})}:{})},...(record.sessionId?{terminalOrigin:{sessionId:record.sessionId,cli:record.terminal?.cli||'unknown',requestId:record.requestId,contextHash:record.contextHash}}:{}),...(manifest?{requestManifest:structuredClone(manifest)}:{}),...(record.assembledContext?{assembledContext:record.assembledContext}:{})};
 return {...doc,paragraphs:doc.paragraphs.map(value=>value.id===paragraph.id?{...value,proposal}:value)};
}
export function takeProposal(doc:Manuscript,id:string):Manuscript {
 const paragraph=doc.paragraphs.find(p=>p.id===id);if(!paragraph?.proposal)return doc;
 const proposal=paragraph.proposal;
 if(proposalAcceptanceIssue(doc,id))return doc;
 const accepted:Acceptance={proposalId:proposal.id,acceptedAt:new Date().toISOString(),method:proposal.method||'manual',...(proposal.passageRevision?{passageRevision:structuredClone(proposal.passageRevision)}:{}),...(proposal.terminalOrigin?{terminalOrigin:structuredClone(proposal.terminalOrigin)}:{}),guidanceApplied:false,guidance:structuredClone(proposal.guidance||captureGuidance()),sources:structuredClone(paragraph.attributions.map(a=>({cardId:a.id,sourceId:a.sourceId,sourceHash:a.sourceHash||(typeof a.locator==='object'&&typeof a.locator.sourceHash==='string'?a.locator.sourceHash:'unknown'),locator:a.locator,excerpt:a.excerpt}))),keptConstraints:structuredClone(paragraph.kept),...(proposal.requestManifest?{requestManifest:structuredClone(proposal.requestManifest)}:{})};
 if(proposal.method==='terminal'){
  const acceptedId=proposal.acceptedId||`accepted-${proposal.id}`;
  // The candidate carries its identity before save: retrying a lost response
  // can never append the same accepted block twice, as in donor takeDraft.
  if(doc.paragraphs.some(p=>p.id===acceptedId||p.acceptedFrom?.proposalId===proposal.id))return dropProposal(doc,id);
  const addition:Paragraph={id:acceptedId,doc:structuredClone(proposal.doc),text:proposal.text,origin:proposal.terminalOrigin?.cli==='shell'?'terminal':'ai',attributions:[],kept:[],acceptedFrom:accepted,acceptanceHistory:[accepted]};
  return revise(doc,[...doc.paragraphs.map(p=>p.id===id?{...p,proposal:undefined}:p),addition]);
 }
 return revise(doc,doc.paragraphs.map(p=>p.id!==id?p:{...p,doc:structuredClone(proposal.doc),text:structuredMarkdown(proposal.doc),proposal:undefined,...(proposal.method==='ai-revision'?{origin:'ai' as const}:{}),acceptedFrom:accepted,acceptanceHistory:[...(p.acceptanceHistory||(p.acceptedFrom?[p.acceptedFrom]:[])),accepted]}));
}
export function dropProposal(doc:Manuscript,id:string):Manuscript {return {...doc,paragraphs:doc.paragraphs.map(p=>p.id===id?{...p,proposal:undefined}:p)};}
export function snapshotOutput(doc:Manuscript):Output {
 const output:Output={id:uid(),kind:'article',manuscriptRevision:doc.revision,placements:[],createdAt:new Date().toISOString(),manuscript:structuredClone(doc.paragraphs.map(({proposal,...accepted})=>accepted)),title:doc.title};
 if(doc.importedDraft?.raw){
  try{const captured=captureArticleComposition(output.manuscript!,doc.importedDraft.raw);output.articleComposition=captured.composition;output.placements=captured.placements;}
  catch{output.articleCompositionNotice='The writing changed since its original layout. This preview uses your current words; review its visual arrangement.';}
 }
 return output;
}

export function outputIsStale(doc:Manuscript,output:Output):boolean {
 if(output.title!==undefined&&output.title!==doc.title)return true;
 // A recorded output owns accepted paragraphs, not waiting alternatives or
 // workspace revisions. Legacy outputs have only their revision to compare.
 if(!Array.isArray(output.manuscript))return output.manuscriptRevision!==doc.revision;
 const accepted=(paragraphs:Paragraph[])=>paragraphs.map(({proposal,...paragraph})=>paragraph);
 return sourceJSON(accepted(output.manuscript))!==sourceJSON(accepted(doc.paragraphs));
}
export function recomposeOutput(doc:Manuscript,previous:Output):Output {
 if(previous.kind==='carousel')throw new Error('Create a new carousel from the current manuscript to preserve this edited output.');
 const next=snapshotOutput(doc),oldPhotos=previous.placements.filter(p=>p.slot!=='cover');
 next.recomposedFrom=previous.id;
 const capturedSlots=next.placements;
 next.placements=structuredClone(previous.placements.map(p=>p.slot==='cover'?p:{...p,paragraphId:p.paragraphId??previous.manuscript?.[oldPhotos.findIndex(v=>v.slot===p.slot)]?.id??null}));
 for(const slot of capturedSlots)if(!next.placements.some(p=>p.slot===slot.slot))next.placements.push(slot);
 if(previous.articleComposition){
  const result=reconcileArticleComposition(previous.articleComposition,previous.manuscript||[],next.manuscript!,next.placements);
  if(result.status==='ready'){next.articleComposition=result.composition;delete next.articleCompositionNotice;}
  else{delete next.articleComposition;next.articleCompositionNotice=result.reason+' Your previous composed output is still available.';}
 }
 return next;
}

// A deterministic cut of accepted words. Editing slides never writes canonical prose.
export function snapshotCarousel(doc:Manuscript):Output {
 const base=snapshotOutput(doc);
 const slides:CarouselSlide[]=[{id:uid(),role:'cover',text:doc.title||'Untitled piece',credit:'',template:'H6',photos:[],paragraphIds:[]}];
 for(const p of base.manuscript||[]){const text=plainText(p.doc);if(text.trim())slides.push({id:uid(),role:'inner',text,credit:p.attributions.map(a=>a.author||a.sourceTitle).filter((v,i,a)=>a.indexOf(v)===i).join(' · '),template:'M12',photos:[],paragraphIds:[p.id]});}
 const {articleComposition,articleCompositionNotice,...carouselBase}=base;
 return {...carouselBase,placements:[],kind:'carousel',outputRevision:0,slides,caption:'',stage:'words'};
}
export function updateCarousel(doc:Manuscript,id:string,update:(output:Output)=>Output):Manuscript {
 return {...doc,outputs:doc.outputs.map(o=>o.id===id&&o.kind==='carousel'?{...update(structuredClone(o)),outputRevision:(o.outputRevision||0)+1}:o)};
}
