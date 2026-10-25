import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ConversationCanvas from '../donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../donors/teajia/storyEdit';
import {deriveMarkdown,type Manuscript,type Output,type Placement} from './document';
import {outputSpec} from './compositionSpec';
import {assertOutputEditorialReady} from './editorial-state.mjs';
import {standaloneArticleHtml} from './standaloneArticleHtml';
export function outputMarkdown(doc:Manuscript,output:Output):string {
 assertOutputEditorialReady(output,{paragraphs:doc.paragraphs,title:doc.title});
 return '# '+(output.title||doc.title)+'\n\n'+deriveMarkdown({...doc,paragraphs:output.manuscript||doc.paragraphs,title:output.title||doc.title})+'\n\n---\nManuscript revision '+output.manuscriptRevision+'\n';
}
export function saveDownload(filename:string,body:string,type:string){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const outputFilename=(output:Output)=>((output.title||'article').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'article')+'-r'+output.manuscriptRevision;
export async function outputHtml(doc:Manuscript,output:Output,{readAsset=fetch,stylesheetUrl='/assets/app.css'}:{readAsset?:typeof fetch;stylesheetUrl?:string}={}):Promise<string> {
 assertOutputEditorialReady(output,{paragraphs:doc.paragraphs,title:doc.title});
 const placements=output.placements;
 for(const p of placements)if(p.url&&new URL(p.url,globalThis.location?.origin||'http://localhost').origin!==(globalThis.location?.origin||'http://localhost'))throw new Error('Import external photographs into your own library before exporting the page.');
 const html=renderToStaticMarkup(<div className="ar-donor-workspace"><main className="ar-output-reader"><LocalStoryProvider placements={placements} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={outputSpec(doc,output)} paragraphs={output.manuscript||doc.paragraphs}/></LocalStoryProvider></main></div>);
 return standaloneArticleHtml({title:output.title||doc.title,markup:html,imageAssets:placements.flatMap(p=>p.url?[p.url]:[]),readAsset,stylesheetUrl,origin:globalThis.location?.origin||'http://localhost'});
}

export type ExportArtifact={id:string;name:string;path:string;url:string;mimeType:string;outputId:string;manuscriptRevision:number;createdAt:string;hash:string;sizeBytes:number};
export async function persistOutputExport(api:(path:string,options?:any)=>Promise<any>,doc:Manuscript,output:Output,format:'markdown'|'html'|'json',assets:{readAsset?:typeof fetch;stylesheetUrl?:string}={}):Promise<ExportArtifact>{
 const extension=format==='markdown'?'md':format==='html'?'html':'json';
 const mimeType=format==='markdown'?'text/markdown':format==='html'?'text/html':'application/json';
 const body=format==='markdown'?outputMarkdown(doc,output):format==='html'?await outputHtml(doc,output,assets):JSON.stringify(output,null,2);
 const result=await api('/api/exports',{method:'POST',body:{name:outputFilename(output)+'.'+extension,mimeType,body,outputId:output.id,manuscriptRevision:output.manuscriptRevision}});
 if(!result.artifact?.path||!result.artifact?.url)throw new Error('The export service did not confirm a saved file.');
 return result.artifact;
}
