import {newDocument,type Manuscript} from './document';
export type EmptyProjectReviewOrigin={kind:'empty-project';projectId:string};
/** An unsaved empty UI surface is an absence of manuscript, not a saved draft. */
export function initialWritingSurface(project:any):Manuscript{return {...newDocument(project.title||''),id:project.id};}
export function alignInitialWritingTitle(project:any,document:Manuscript):Manuscript{
 if(project?.document!=null||String(project?.draft||'').trim()||document.id!==project?.id||document.revision!==0||document.paragraphs.length||document.outputs.length||document.pendingResearchCandidate||document.importedDraft||document.legacyImport)return document;
 const title=project.title||'';return document.title===title?document:{...document,title};
}
export function writingSnapshotForVersion(project:any):Manuscript|undefined{return project.document||(!String(project.draft||'').trim()?initialWritingSurface(project):undefined);}
export function untouchedInitialSurface(project:any,document:Manuscript){
 return !!project?.id&&project.document==null&&!String(project.draft||'').trim()&&document.id===project.id&&document.revision===0&&document.title===(project.title||'')&&document.paragraphs.length===0&&document.outputs.length===0&&!document.pendingResearchCandidate&&!document.importedDraft&&!document.legacyImport;
}
export function articleOriginMatches(record:{projectId?:string;documentId:string|null;manuscriptRevision:number|null;manuscriptTitle?:string|null},document:Manuscript,project?:any){
 if(record.documentId===null||record.manuscriptRevision===null)return record.documentId===null&&record.manuscriptRevision===null&&(record.manuscriptTitle===undefined||record.manuscriptTitle===null)&&!!project&&record.projectId===project.id&&untouchedInitialSurface(project,document);
 return (!project||record.projectId===undefined||record.projectId===project.id)&&record.documentId===document.id&&record.manuscriptRevision===document.revision&&(record.manuscriptTitle===undefined||record.manuscriptTitle===document.title);
}
export function validatedEmptyProjectOrigin(value:unknown,projectId:string):EmptyProjectReviewOrigin{
 const origin=value as any;if(!origin||typeof origin!=='object'||Array.isArray(origin)||Object.keys(origin).sort().join('|')!=='kind|projectId'||origin.kind!=='empty-project'||origin.projectId!==projectId)throw Error('The first-draft origin belongs to another project.');return {kind:'empty-project',projectId};
}
