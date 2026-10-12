import {deriveMarkdown,newDocument} from '../workspaces/document';

/** A fresh writing surface in the same workspace, with an exact recovery point. */
export function freshManuscriptProject(project:any,title:string,shared:any,{id=crypto.randomUUID(),now=new Date().toISOString()}={}) {
 const name=title.trim();
 if(!name||name.length>256)throw new Error('Name the fresh manuscript using at most 256 characters.');
 if(project.versions.length>=50)throw new Error('The 50-version limit is reached. Export this workspace before starting fresh.');
 const next=structuredClone(project),before=next.document;
 const document=before||newDocument(name),revision=document.revision+1;
 if(!Number.isSafeInteger(revision))throw new Error('The manuscript revision cannot advance safely.');
 next.versions.unshift({id,createdAt:now,label:next.title||'Untitled manuscript',draft:before?deriveMarkdown(before):next.draft,guidance:shared?{voice:shared.voice||'',perspective:shared.positions||'',recipe:shared.recipe||''}:structuredClone(next.guidance),...(before?{document:structuredClone(before)}:{})});
 next.title=name;next.draft='';
 next.document={schema:'ar-create.document.v1',id:document.id,revision,title:name,paragraphs:[],outputs:structuredClone(document.outputs)};
 return next;
}
