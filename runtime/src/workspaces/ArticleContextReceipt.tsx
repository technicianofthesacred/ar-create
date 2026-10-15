import React,{useEffect,useState} from 'react';
import type {Manuscript} from './document';
import './article-context-receipt.css';
const reviewLabel=(review:string)=>({'operator-saved':'Saved by you','operator-held':'Held by you','reference-only':'Reference only','unreviewed':'Unreviewed','reviewed':'Human reviewed'}[review]||review.replaceAll('-',' '));
const kindLabel=(kind:string)=>({'reflection':'Your note','position':'Your position','claim':'Source claim','account':'Exact account','research-answer':'Kept AI learning','inspected-guidance':'Inspected guidance'}[kind]||kind);
/** Captured context is inspectable across piece switches, never inserted as prose or evidence. */
export function ArticleContextReceipt({receipt,api}:{receipt:NonNullable<NonNullable<Manuscript['importedDraft']>['makeReceipt']>;api?:(path:string,options?:any)=>Promise<any>}){
 const ref=receipt.contextReceipt,[open,setOpen]=useState(false),[captured,setCaptured]=useState<any>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{setCaptured(null);setError('');},[receipt.requestId]);
 useEffect(()=>{
  if(!open||!ref||!api)return;let current=true;setError('');
  api('/api/article/make/'+encodeURIComponent(receipt.requestId)+'/context').then(result=>{
   if(!current)return;
   if(result.id!==receipt.requestId||result.projectId!==ref.projectId||result.requestId!==ref.requestId||result.contextHash!==ref.contextHash||result.promptHash!==ref.promptHash||typeof result.prompt!=='string'||typeof result.assembledContext!=='string')throw Error('The returned context does not match this article receipt.');
   setCaptured(result);
  }).catch(cause=>{if(current)setError(cause.message);});return()=>{current=false;};
 },[open,receipt.requestId,ref,api,retry]);
 const files=ref?.selection?.inspectedFiles||[],items=ref?.items||[];
 return <details className="ar-request-preview ar-article-context-receipt" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Article context{ref?` · ${items.length+files.filter(file=>file.kind==='source').length} selected items`:''}</summary>{open&&<>
  <p>{receipt.sourceIds.length} {receipt.sourceIds.length===1?'source':'sources'} supplied. Captured inputs are not verified citations. Your notes and positions remain personal interpretation.</p>
  {!ref?<p>This older draft retained source IDs and review notes, but no captured context reference.</p>:<>
   {!!items.length&&<ul>{items.map(item=><li key={item.kind+':'+item.id}><strong>{kindLabel(item.kind)}</strong> · {reviewLabel(item.reviewState)}<small>{item.kind==='reflection'||item.kind==='position'?'Personal interpretation':item.kind==='claim'?'Claim; not an established fact':item.kind==='account'?'Source-linked account':item.kind==='research-answer'?'AI learning; unreviewed, not established fact':'File reference'}</small><details><summary>Reference</summary><small>{item.id} · {item.role} · SHA-256 {item.hash}</small></details></li>)}</ul>}
   {!!files.some(file=>file.kind==='source')&&<ul>{files.filter(file=>file.kind==='source').map((file,index)=><li key={index}><strong>{file.kind==='source'?'Inspected Library file':'Inspected '+file.key+' file'}</strong><details><summary>Reference</summary><small>{file.kind==='source'?file.sourceId:file.key} · SHA-256 {file.hash}</small></details></li>)}</ul>}
   {!api?<p>Reconnect to the local service to inspect captured words. Their original request reference is retained.</p>:!captured&&!error?<p>Opening captured context…</p>:null}
   {error&&<p role="alert">Captured context is unavailable: {error} The recorded references remain here. <button onClick={()=>setRetry(value=>value+1)}>Retry</button></p>}
   {captured&&<>
    <details><summary>Captured words and evidence</summary><p>Exact captured context, including personal interpretation, claim review states, supporting and opposing evidence, and inspected files.</p><div className="ar-request-context">{captured.assembledContext}</div></details>
    <details><summary>Full captured request</summary><p>Request {ref.requestId} · context SHA-256 {ref.contextHash}</p><div className="ar-request-context">{captured.prompt}</div></details>
   </>}
  </>}
  {receipt.notes&&<details><summary>Draft review notes</summary><div className="ar-request-context">{receipt.notes}</div></details>}
 </>}</details>;
}
