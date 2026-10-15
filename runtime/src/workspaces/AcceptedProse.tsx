import {safePassageHref} from '../donors/wordforge/passage-links.mjs';
import React from 'react';
import type {JSONContent} from '@tiptap/core';
// A reading projection of recorded accepted JSON. No editable state or markup
// round trip: canvas and saved HTML use the exact same document and source IDs.
const sourceProps=(attrs:Record<string,any>={})=>({'data-passage-id':attrs.passageId||undefined,'data-source-ref':attrs.sourceRef||undefined,'data-source-title':attrs.sourceTitle||undefined});
const safeHref=(value:unknown)=>safePassageHref(value)?value as string:undefined;
function renderNode(node:JSONContent,key:string):React.ReactNode{
 if(node.type==='text'){
  let words:React.ReactNode=node.text||'';
  for(const [index,mark] of (node.marks||[]).entries()){
   const attrs=mark.attrs||{},props={key:key+'m'+index};
   switch(mark.type){
    case 'bold':words=<strong {...props}>{words}</strong>;break;
    case 'italic':words=<em {...props}>{words}</em>;break;
    case 'code':words=<code {...props}>{words}</code>;break;
    case 'strike':words=<s {...props}>{words}</s>;break;
    case 'link':{const href=safeHref(attrs.href);words=href?<a {...props} href={href} title={typeof attrs.title==='string'?attrs.title:undefined}>{words}</a>:words;break;}
    case 'inlineQuote':words=<q {...props} {...sourceProps(attrs)}>{words}</q>;break;
    case 'sourced':words=<span {...props} {...sourceProps(attrs)} className="ar-recorded-sourced">{words}</span>;break;
    case 'paraphrase':words=<span {...props} {...sourceProps(attrs)} className="ar-recorded-paraphrase"><span className="ar-recorded-flag">Paraphrase · review required: </span>{words}</span>;break;
   }
  }
  return <React.Fragment key={key}>{words}</React.Fragment>;
 }
 const children=(node.content||[]).map((child,index)=>renderNode(child,key+'-'+index));
 switch(node.type){
  case 'doc':return <React.Fragment key={key}>{children}</React.Fragment>;
  case 'paragraph':return <p key={key}>{children}</p>;
  case 'heading':{const level=Math.max(1,Math.min(3,Number(node.attrs?.level)||2));const Tag=('h'+level) as 'h1'|'h2'|'h3';return <Tag key={key}>{children}</Tag>;}
  case 'bulletList':return <ul key={key}>{children}</ul>;
  case 'orderedList':return <ol key={key} start={Number.isInteger(node.attrs?.start)?node.attrs?.start:undefined}>{children}</ol>;
  case 'listItem':return <li key={key}>{children}</li>;
  case 'hardBreak':return <br key={key}/>;
  case 'horizontalRule':return <hr key={key}/>;
  case 'codeBlock':return <pre key={key}><code>{children}</code></pre>;
  case 'blockquote':return <blockquote key={key}>{children}</blockquote>;
  case 'blockquoteAttributed':return <blockquote key={key} {...sourceProps(node.attrs)}><p>{children}</p><footer>— {node.attrs?.author||node.attrs?.sourceTitle||'Source'}</footer></blockquote>;
  case 'referenceCard':return <aside key={key} {...sourceProps(node.attrs)} className="ar-recorded-reference"><strong>Reference · {node.attrs?.sourceTitle||'Source'}</strong><p>{node.attrs?.text||''}</p></aside>;
  default:return <React.Fragment key={key}>{children}</React.Fragment>;
 }
}
export function AcceptedProse({document,paragraphId}:{document:JSONContent;paragraphId:string}){return <div className="ar-recorded-prose" data-paragraph-id={paragraphId}>{renderNode(document,paragraphId)}</div>;}
