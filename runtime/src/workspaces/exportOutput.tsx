import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ConversationCanvas from '../donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../donors/teajia/storyEdit';
import {deriveMarkdown,type Manuscript,type Output,type Placement} from './document';
import {outputSpec} from './compositionSpec';
import {assertOutputEditorialReady} from './editorial-state.mjs';
export function outputMarkdown(doc:Manuscript,output:Output):string {
 assertOutputEditorialReady(output,{paragraphs:doc.paragraphs,title:doc.title});
 return '# '+(output.title||doc.title)+'\n\n'+deriveMarkdown({...doc,paragraphs:output.manuscript||doc.paragraphs,title:output.title||doc.title})+'\n\n---\nManuscript revision '+output.manuscriptRevision+'\n';
}
export function saveDownload(filename:string,body:string,type:string){const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const outputFilename=(output:Output)=>((output.title||'article').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'article')+'-r'+output.manuscriptRevision;
const blobDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('An output asset could not be read.'));reader.readAsDataURL(blob);});
export async function outputHtml(doc:Manuscript,output:Output,{readAsset=fetch,stylesheetUrl='/assets/app.css'}:{readAsset?:typeof fetch;stylesheetUrl?:string}={}):Promise<string> {
 assertOutputEditorialReady(output,{paragraphs:doc.paragraphs,title:doc.title});
 const cssResponse=await readAsset(stylesheetUrl);if(!cssResponse.ok)throw new Error('The article styles could not be included.');let css=await cssResponse.text();
 const workingFonts=await readAsset('/assets/fonts/wordforge.css');if(!workingFonts.ok)throw new Error('The article working fonts could not be included.');css+=(await workingFonts.text()).replace(/url\(([a-z0-9]+\.woff2)\)/g,"url('/assets/fonts/$1')");
 const fontPaths=[...new Set([...css.matchAll(/url\(["']?(\/assets\/[^"')]+\.woff2)["']?\)/g)].map(m=>m[1]))];
 for(const fontPath of fontPaths){const response=await readAsset(fontPath);if(!response.ok)throw new Error('An article font could not be included.');const embedded=await blobDataUrl(await response.blob());css=css.replaceAll(fontPath,embedded);}

 const placements=await Promise.all(output.placements.map(async(p):Promise<Placement>=>{
  if(!p.url)return p;
  const url=new URL(p.url,location.origin);if(url.origin!==location.origin)throw new Error('Import external photographs into your own library before exporting the page.');
  const response=await readAsset(url);if(!response.ok)throw new Error('One photograph could not be included.');const blob=await response.blob();
  const embedded=await blobDataUrl(blob);return {...p,url:embedded};
 }));
 const html=renderToStaticMarkup(<div className="ar-donor-workspace"><main className="ar-output-reader"><LocalStoryProvider placements={placements} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={outputSpec(doc,{...output,placements})} paragraphs={output.manuscript||doc.paragraphs}/></LocalStoryProvider></main></div>);
 const title=(output.title||doc.title).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+title+'</title><style>'+css.replaceAll('</style','<\\/style')+'\nbody{margin:0;background:#151b18}.ar-output-reader{margin:0 auto}@media print{body{background:white}.ar-output-reader{max-width:none}}</style>'+html+'</html>';
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
