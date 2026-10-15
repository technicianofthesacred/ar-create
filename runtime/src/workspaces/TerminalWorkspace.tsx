import {ContextHandoff} from './ContextHandoff';
import {contextCount,withInspectedFile,type WritingContextSelection} from './context-selection';
import React,{useEffect,useRef,useState} from 'react';
import type {WorkspaceOptions} from './EditorWorkspace';
import type {TerminalOrigin} from './document';
import './terminal-session.css';
import {boundedTerminalTranscript,TERMINAL_OUTPUT_MAX_BYTES} from './terminal-output.mjs';
type ContextReceipt={requestId:string;contextHash:string;manuscriptRevision:number|null;scope?:'research'|'manuscript';sourceIds?:string[];sentAt:string};
export const TERMINAL_OUTPUT_LIMIT=TERMINAL_OUTPUT_MAX_BYTES;
export const boundedTerminalOutput=boundedTerminalTranscript;
const processLabel=(cli?:string)=>cli==='codex'?'Codex CLI':cli==='claude'?'Claude CLI':'Local shell';
const selectionKey=(selection:WorkspaceOptions['requestSelection'])=>selection?JSON.stringify([selection.scope,[...selection.sourceIds].sort(),[...(selection.cardIds||[])].sort()]):'';
const sameIds=(left:unknown,right:string[])=>Array.isArray(left)&&JSON.stringify([...left].sort())===JSON.stringify([...right].sort());
type Session={id:string;projectId?:string;status:string;output:string;cwd?:string;socketUrl?:string;cli?:string;model?:string|null;contextSends?:ContextReceipt[]};
export type TerminalDraftContext={origin:TerminalOrigin;record?:{manifest:Record<string,any>;assembledContext:string}};
export function useTerminalSession(options:WorkspaceOptions,visible=true){
 const [session,setSession]=useState<Session|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sending,setSending]=useState(false);
 const [restorationComplete,setRestorationComplete]=useState(false),[sentArticleRequestId,setSentArticleRequestId]=useState('');
 const [contextSelection,setContextSelection]=useState<WritingContextSelection>(options.writingContext||{}),handoffNonce=useRef<number|undefined>(undefined);
 const [cli,setCliState]=useState('shell'),[model,setModel]=useState(''),[commands,setCommands]=useState<any[]>([]),[message,setMessage]=useState(''),[connection,setConnection]=useState('disconnected'),[attempt,setAttempt]=useState(0);
 const socketRef=useRef<WebSocket|null>(null),sessionRef=useRef(session),sendLock=useRef(false),recordRef=useRef<TerminalDraftContext['record']>(undefined);sessionRef.current=session;
 const [record,setRecord]=useState<TerminalDraftContext['record']>(),[contextStatus,setContextStatus]=useState<'none'|'loading'|'available'|'unavailable'>('none');
 const recordOwner=useRef<{projectId:string;sessionId:string}|null>(null),sessionProject=useRef(options.project.id),contextGeneration=useRef(0);
 const contextRef=useRef(contextSelection);contextRef.current=contextSelection;
 const optionsRef=useRef(options);optionsRef.current=options;
 const selectedModel=cli==='shell'?null:model.trim()||null;
 const selectionMatches=!!session&&session.cli===cli&&(cli==='shell'||(session.model||null)===selectedModel);
 function setCli(value:string){selectionChanged.current=true;selectionRevision.current++;setCliState(value);setModel(sessionRef.current?.cli===value?sessionRef.current.model||'':'');}
 function rememberContext(value:TerminalDraftContext['record'],projectId:string,sessionId:string){recordRef.current=value;recordOwner.current=value?{projectId,sessionId}:null;setRecord(value);}
 function matchingContext(current:Session,projectId:string){const receipt=current.cli!=='shell'?current.contextSends?.at(-1):undefined,value=recordRef.current;return receipt&&value&&recordOwner.current?.projectId===projectId&&recordOwner.current.sessionId===current.id&&value.manifest.id===receipt.requestId&&value.manifest.contextHash===receipt.contextHash&&(!value.manifest.projectId||value.manifest.projectId===projectId)?value:undefined;}
 const restoreGeneration=useRef(0),processLock=useRef(false),selectionChanged=useRef(false),selectionRevision=useRef(0);
 const queue=useRef<Promise<any>>(Promise.resolve());
 function receive(result:any,id:string){const next:Session={...(result.session||result),output:boundedTerminalOutput((result.session||result).output||'')};if(next.id===id)setSession(previous=>previous?.id===id?{...previous,...next,output:previous.output.startsWith(next.output||'')?previous.output:next.output}:previous);}
 useEffect(()=>{setContextSelection(options.writingContext||{});},[options.project.id,JSON.stringify(options.writingContext||{})]);
 useEffect(()=>{const handoff=options.terminalHandoff;if(!handoff||handoffNonce.current===handoff.nonce)return;handoffNonce.current=handoff.nonce;setSentArticleRequestId('');if(handoff.file)setContextSelection(previous=>withInspectedFile(previous,handoff.file!));setMessage(previous=>handoff.preparedArticle?handoff.prompt:previous.trim()?previous+'\n\n'+handoff.prompt:handoff.prompt);},[options.terminalHandoff?.nonce,options.project.id]);
 useEffect(()=>{restoreGeneration.current++;contextGeneration.current++;sessionProject.current=options.project.id;sessionRef.current=null;selectionChanged.current=false;setRestorationComplete(false);setSession(null);rememberContext(undefined,options.project.id,'');setContextStatus('none');setError('');},[options.project.id]);
 useEffect(()=>{let active=true;if(options.api)options.api('/api/terminal/capabilities').then(result=>{if(active)setCommands(result.commands||[]);}).catch(()=>{});return()=>{active=false;};},[options.api]);
 useEffect(()=>{
  if(!options.api)return;let active=true;const generation=restoreGeneration.current;const key='ar-create:terminal:last-session:'+options.project.id;
  void (async()=>{try{
   const result=await options.api!('/api/terminal/sessions');if(!active||restoreGeneration.current!==generation||sessionRef.current)return;
   let remembered='';try{remembered=window.sessionStorage.getItem(key)||'';}catch{}
   const existing=(result.sessions||[]) as Session[];const candidate=existing.find(value=>value.id===remembered)||existing.find(value=>value.status==='ready')||existing[0];if(!candidate)return;
   const response=await options.api!('/api/terminal/sessions/'+candidate.id);if(!active||restoreGeneration.current!==generation||sessionRef.current)return;
   const next={...(response.session||response),output:boundedTerminalOutput((response.session||response).output||'')};if(next.id!==candidate.id||next.projectId&&next.projectId!==options.project.id)return;sessionRef.current=next;setSession(next);if(!selectionChanged.current){setCliState(next.cli||'shell');setModel(next.model||'');}setError('');
   try{window.sessionStorage.setItem(key,next.id);}catch{}
  }catch(e){if(active&&restoreGeneration.current===generation)setError('Saved terminal session could not be restored: '+(e as Error).message);}finally{if(active&&restoreGeneration.current===generation)setRestorationComplete(true);}})();
  return()=>{active=false;};
 },[options.api,options.project.id]);
 useEffect(()=>{
  if(!options.terminalHandoff||!restorationComplete||session||selectionChanged.current||cli!=='shell')return;
  const preferred=commands.find(command=>command.cli==='codex'&&command.available)||commands.find(command=>command.cli==='claude'&&command.available);
  if(preferred){setCliState(preferred.cli);setModel('');}
 },[options.terminalHandoff?.nonce,restorationComplete,session,commands,cli]);
 useEffect(()=>{if(options.terminalHandoff?.preparedArticle&&restorationComplete&&!session&&!selectionChanged.current&&cli!=='shell'&&!busy)void open();},[options.terminalHandoff?.nonce,restorationComplete,session?.id,cli]);
 const receipt=session?.cli!=='shell'?session?.contextSends?.at(-1):undefined;
 useEffect(()=>{
  const current=sessionRef.current,projectId=options.project.id,generation=++contextGeneration.current;
  if(!current||sessionProject.current!==projectId||current.cli==='shell'||!receipt){rememberContext(undefined,projectId,'');setContextStatus('none');return;}
  if(matchingContext(current,projectId)){setContextStatus('available');return;}
  rememberContext(undefined,projectId,current.id);
  if(sendLock.current||processLock.current){setContextStatus('loading');return;}
  if(!options.api){setContextStatus('unavailable');return;}
  let active=true;
  const stillCurrent=()=>{const latest=sessionRef.current?.contextSends?.at(-1);return active&&contextGeneration.current===generation&&!sendLock.current&&!processLock.current&&optionsRef.current.project.id===projectId&&sessionProject.current===projectId&&sessionRef.current?.id===current.id&&sessionRef.current.cli!=='shell'&&latest?.requestId===receipt.requestId&&latest.contextHash===receipt.contextHash;};
  setContextStatus('loading');
  void options.api('/api/requests/recent').then(result=>{
   if(!stillCurrent())return;
   // A receipt is history, not a request to assemble today's guidance or sources.
   const recovered=Array.isArray(result?.records)?result.records.find((value:any)=>value?.manifest?.id===receipt.requestId&&value.manifest.contextHash===receipt.contextHash&&value.manifest.projectId===projectId&&typeof value.assembledContext==='string'):undefined;
   rememberContext(recovered,projectId,current.id);setContextStatus(recovered?'available':'unavailable');
  }).catch(()=>{if(stillCurrent())setContextStatus('unavailable');});
  return()=>{active=false;};
 },[options.api,options.project.id,session?.id,session?.cli,receipt?.requestId,receipt?.contextHash,sending,busy]);
 async function open(){if(!options.api||processLock.current||sendLock.current)return;processLock.current=true;const projectId=options.project.id,generation=++restoreGeneration.current,choiceRevision=selectionRevision.current;contextGeneration.current++;setBusy(true);setError('');try{const result=await options.api('/api/terminal/sessions',{method:'POST',body:{projectId,cli,...(selectedModel?{model:selectedModel}:{})}});if(optionsRef.current.project.id!==projectId||restoreGeneration.current!==generation)return;const next={...(result.session||result),output:boundedTerminalOutput((result.session||result).output||'')};if(next.projectId&&next.projectId!==projectId)throw new Error('The terminal session belongs to another project.');if(next.id!==sessionRef.current?.id||next.cli==='shell')rememberContext(undefined,projectId,next.id);sessionRef.current=next;setSession(next);if(selectionRevision.current===choiceRevision)setModel(next.model||'');try{window.sessionStorage.setItem('ar-create:terminal:last-session:'+projectId,next.id);}catch{}setAttempt(value=>value+1);}catch(e){if(optionsRef.current.project.id===projectId)setError((e as Error).message);}finally{processLock.current=false;setBusy(false);}}
 function reconnect(){if(!sessionRef.current||processLock.current||sendLock.current)return;setError('');setAttempt(value=>value+1);}
 async function stop(){
  const current=sessionRef.current;
  if(!options.api||!current||current.status!=='ready'||processLock.current||sendLock.current)return;
  processLock.current=true;setBusy(true);setError('');
  try{
   const result=await options.api('/api/terminal/sessions/'+current.id+'/stop',{method:'POST',body:{}});
   // The stop endpoint acknowledges the kill before the PTY exit frame arrives.
   // An exit frame can also arrive first; a ready acknowledgement must not undo it.
   const next:Session=result.session||result;
   setSession(previous=>previous?.id===current.id&&next.id===current.id?{...previous,...next,status:previous.status==='exited'?'exited':next.status==='ready'?'stopping':next.status,output:previous.output.startsWith(next.output||'')?previous.output:next.output}:previous);
  }catch(e){setError('Could not stop terminal process: '+(e as Error).message);}
  finally{processLock.current=false;setBusy(false);}
 }
 useEffect(()=>{
  if(!visible||!session?.id)return;let active=true,detachedOnce=false;let socket:WebSocket|null=null;let timer:ReturnType<typeof setTimeout>|undefined;const id=session.id;
  // When detached, the HTTP transport also consumes output. Input alone cannot
  // observe asynchronous PTY output after a socket failure.
  const poll=async()=>{if(!active)return;try{if(options.api){const result=await options.api('/api/terminal/sessions/'+id);if(active&&socket?.readyState!==1)receive(result,id);}}catch(e){if(active)setError((e as Error).message);}finally{if(active&&socket?.readyState!==1)timer=setTimeout(poll,1000);}};
  const detached=()=>{if(!active||detachedOnce)return;detachedOnce=true;if(socketRef.current===socket)socketRef.current=null;setConnection('disconnected');setError('Terminal connection closed. Reconnect preserves the live session.');clearTimeout(timer);void poll();};
  setConnection('connecting');
  try{
   if(session.socketUrl){const url=new URL(session.socketUrl,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url);socketRef.current=socket;
    socket.onopen=()=>{if(active){setConnection('connected');setError('');clearTimeout(timer);}};
    socket.onmessage=event=>{if(!active)return;try{const frame=JSON.parse(event.data);if(frame.type==='ready')setSession(previous=>previous?.id===id?{...previous,status:frame.status||previous.status}:previous);if(frame.type==='output')setSession(previous=>previous?.id===id?{...previous,output:boundedTerminalOutput(frame.replay?frame.data:previous.output+frame.data)}:previous);if(frame.type==='exit')setSession(previous=>previous?.id===id?{...previous,status:'exited'}:previous);if(frame.type==='error')setError(frame.message||'Terminal needs attention.');}catch{setError('An unreadable terminal frame arrived.');}};
    socket.onerror=()=>{if(active){setError('Terminal connection needs attention. Reconnect preserves the live session.');socket?.close();detached();}};
    socket.onclose=detached;
   }else{setConnection('HTTP');void poll();}
  }catch(e){setError((e as Error).message);setConnection('disconnected');void poll();}
  return()=>{active=false;clearTimeout(timer);socket?.close();if(socketRef.current===socket)socketRef.current=null;};
 },[session?.id,session?.socketUrl,visible,attempt,options.api]);
 const input=(data:string)=>{const current=sessionRef.current;if(!current||current.status!=='ready'||!options.api||processLock.current)return;if(socketRef.current?.readyState===1){try{socketRef.current.send(JSON.stringify({type:'input',data}));}catch(e){setError((e as Error).message);}return;}queue.current=queue.current.then(async()=>receive(await options.api!('/api/terminal/sessions/'+current.id+'/input',{method:'POST',body:{data}}),current.id)).catch(e=>setError(e.message));};
 const resize=(cols:number,rows:number)=>{if(socketRef.current?.readyState===1){try{socketRef.current.send(JSON.stringify({type:'resize',cols,rows}));}catch(e){setError((e as Error).message);}return;}if(session&&options.api)options.api('/api/terminal/sessions/'+session.id+'/resize',{method:'POST',body:{cols,rows}}).catch(e=>setError(e.message));};
 async function send(){
  const current=sessionRef.current,text=message,projectId=options.project.id;if(!current||sessionProject.current!==projectId||current.status!=='ready'||!options.api||!text.trim()||sendLock.current||processLock.current)return;
  if(current.cli==='shell'&&(contextCount(contextSelection)||options.terminalHandoff?.preparedArticle)){setError('Choose Codex or Claude in Settings to ask about selected context. The local shell runs commands.');return;}
  sendLock.current=true;contextGeneration.current++;setSending(true);setError('');
  try{
   await queue.current;
   if(optionsRef.current.project.id!==projectId||sessionRef.current?.id!==current.id)throw new Error('The terminal project or session changed. Send again.');
   const launch=options.terminalHandoff?.preparedArticle;
   if(launch){
    await options.ensureSaved?.();
    if(optionsRef.current.project.id!==projectId||optionsRef.current.terminalHandoff?.preparedArticle?.request.id!==launch.request.id||sessionRef.current?.id!==current.id)throw new Error('The article or terminal changed. Reopen its launch.');
    const result=await options.api('/api/shared-articles/launches/'+launch.request.id+'/send',{method:'POST',body:{sessionId:current.id,instruction:text,promptReady:true}});
    receive(result,current.id);if(result.launch?.state==='sent')setSentArticleRequestId(launch.request.id);setMessage(value=>value===text?'':value);return;
   }
   let body:any={data:text+'\r'},record:TerminalDraftContext['record'];
   if(current.cli&&current.cli!=='shell'){
    const selection=options.requestSelection;
    const id=options.selectedParagraphId||options.document?.paragraphs[0]?.id||options.project.document?.paragraphs[0]?.id;
    const research=selection?.scope==='research'||(!id&&contextCount(contextSelection)>0),requestedSourceIds=selection?.sourceIds||[],requestedCardIds=selection?.cardIds||[];
    if(research&&!requestedSourceIds.length&&!contextCount(contextSelection))throw new Error('Choose source material before exploring it with the CLI.');
    if(!research&&!id)throw new Error('Select source material, saved context or an accepted passage before sending to the CLI.');
    await options.ensureSaved?.();
    const request=research?{scope:'research',paragraphIds:[],sourceIds:requestedSourceIds,...(requestedCardIds.length?{cardIds:requestedCardIds}:{})}:{paragraphIds:[id]};
    record=await options.api('/api/requests/preview',{method:'POST',body:{...request,...(contextCount(contextSelection)?{contextSelection}:{})}});
    if(record?.manifest?.projectId&&record.manifest.projectId!==projectId)throw new Error('The request belongs to another project. Nothing was sent.');
    if(!record?.manifest?.id||!record.manifest.contextHash||record.manifest.mode!=='dry-run'||record.manifest.modelExecuted!==false)throw new Error('The service did not confirm recorded context. Nothing was sent.');
    if(research){
     if(record.manifest.scope!=='research'||record.manifest.projectId!==options.project.id||!sameIds(record.manifest.paragraphIds,[])||!sameIds(record.manifest.sourceSelection?.requestedIds,requestedSourceIds)||!sameIds(record.manifest.cardSelection?.requestedIds||[],requestedCardIds))throw new Error('The service did not confirm this source selection. Nothing was sent.');
     if(selectionKey(optionsRef.current.requestSelection)!==selectionKey(selection))throw new Error('The source selection changed while preparing context. Send again.');
    }else{
     if(!record.manifest.paragraphIds?.includes(id))throw new Error('The service did not confirm context for this passage. Nothing was sent.');
     const document=optionsRef.current.document||optionsRef.current.project.document;
     if(document&&(record.manifest.documentId!==document.id||record.manifest.manuscriptRevision!==document.revision))throw new Error('The manuscript changed while preparing context. Save and send again.');
     if(optionsRef.current.requestSelection||optionsRef.current.selectedParagraphId&&optionsRef.current.selectedParagraphId!==id)throw new Error('The selected context changed while preparing it. Send again.');
    }
    if(JSON.stringify(contextRef.current)!==JSON.stringify(contextSelection))throw new Error('Selected additional context changed while preparing it. Send again.');
    if(optionsRef.current.project.id!==projectId||sessionRef.current?.id!==current.id)throw new Error('The terminal session changed. Send again in the selected session.');
    const receipt=sessionRef.current?.contextSends?.at(-1);
    body=receipt?.contextHash===record.manifest.contextHash?{data:`\x1b[200~${text}\x1b[201~\r`}:{data:text,includeContext:true,requestId:record.manifest.id};
   }
   const result=await options.api('/api/terminal/sessions/'+current.id+'/input',{method:'POST',body});if(optionsRef.current.project.id!==projectId||sessionRef.current?.id!==current.id)return;receive(result,current.id);if(record&&body.includeContext===true)rememberContext(record,projectId,current.id);
   setMessage(value=>value===text?'':value);
  }catch(e){setError((e as Error).message);}finally{sendLock.current=false;setSending(false);}
 }
 function draftContext():TerminalDraftContext|undefined{const current=sessionRef.current,projectId=optionsRef.current.project.id;if(!current||sessionProject.current!==projectId)return;const receipt=current.cli!=='shell'?current.contextSends?.at(-1):undefined,record=matchingContext(current,projectId);return {origin:{sessionId:current.id,cli:current.cli||'shell',...(receipt?{requestId:receipt.requestId,contextHash:receipt.contextHash}:{})},...(record?{record}:{})};}
 return {sentArticleRequestId,restorationComplete,contextSelection,setContextSelection,session,error,busy,sending,cli,setCli,model,setModel:(value:string)=>{selectionChanged.current=true;selectionRevision.current++;setModel(value);},selectedModel,selectionMatches,commands,message,setMessage,connection,open,reconnect,stop,input,resize,send,draftContext,record:session&&sessionProject.current===options.project.id?matchingContext(session,options.project.id)&&record:undefined,contextStatus};
}
export function TerminalWorkspace({options,onDraft,visible=true}:{options:WorkspaceOptions;visible?:boolean;onDraft:(text:string,context:TerminalDraftContext)=>void}){
 const {sentArticleRequestId,restorationComplete,contextSelection,setContextSelection,session,error,busy,sending,cli,setCli,model,setModel,selectedModel,selectionMatches,commands,message,setMessage,connection,open,reconnect,stop,input,resize,send,draftContext,record,contextStatus}=useTerminalSession(options,visible);
 const [confirmedSession,setConfirmedSession]=useState<string|null>(null),[previousOutputOpen,setPreviousOutputOpen]=useState(false);
 const [Terminal,setTerminal]=useState<React.ComponentType<any>|null>(null),[loadError,setLoadError]=useState('');
 useEffect(()=>{if(!visible)return;let active=true;import('../donors/wordforge/WordforgeTerminal').then(module=>{if(active)setTerminal(()=>module.WordforgeTerminal);}).catch(e=>{if(active)setLoadError(e.message);});return()=>{active=false;};},[visible]);
 const selectDraft=(text:string)=>{if(options.terminalHandoff?.preparedArticle){options.onShelfRequest?.('shared-review');return;}const context=draftContext();if(context)onDraft(text,context);};
 const receipt=session?.cli!=='shell'?session?.contextSends?.at(-1):undefined,research=options.requestSelection?.scope==='research';
 const running=session?.status==='ready',stopping=session?.status==='stopping';
 const processStatus=running?'Running':stopping?'Stopping…':'Stopped';
 const connectionNotice=/^Terminal connection (closed|needs attention)\./.test(error);
 const displayError=loadError||(!running&&connectionNotice?'':error);
 const provider=processLabel(running||stopping?session?.cli:cli);
 const articleLaunch=options.terminalHandoff?.preparedArticle;
 const attachedFiles=contextSelection.inspectedFiles||[],stagedQuestion=contextCount(contextSelection)>0||!!articleLaunch;
 const attachedLabel=attachedFiles.map(file=>options.terminalHandoff&&JSON.stringify(file)===JSON.stringify(options.terminalHandoff.file)&&options.terminalHandoff.title?options.terminalHandoff.title:file.kind==='guidance'?{voice:'Voice file',positions:'My perspective file',recipe:'Recipe file'}[file.key]:'Library file').join(', ');
 return <section className="ar-terminal-room" aria-label="Terminal">
  <div className="ar-terminal-status">
   <div className="ar-terminal-identity"><strong>{provider}</strong><span className={'ar-terminal-state'+(running?' is-running':'')} role={visible?'status':undefined}>{processStatus}</span></div>
   {research&&<><span className="ar-terminal-research">{options.requestSelection!.sourceIds.length} sources</span><button type="button" onClick={()=>options.onShelfRequest?.('research-return')}>Back to material</button></>}
   {running&&<button className="ar-terminal-stop" type="button" onClick={()=>void stop()} disabled={busy||sending}>Stop session</button>}
   <details className="ar-terminal-settings"><summary>Settings</summary><div className="ar-terminal-settings-body">
    <div className="ar-terminal-settings-fields"><label>Provider <select aria-label="Terminal process" value={cli} onChange={e=>setCli(e.target.value)} disabled={busy||sending}><option value="shell">Local shell</option>{commands.filter(c=>c.cli!=='shell').map(c=><option key={c.cli} value={c.cli} disabled={!c.available}>{processLabel(c.cli)}{!c.available?' · unavailable':''}</option>)}</select></label>
    {cli!=='shell'&&<label>Model override <input aria-label="Terminal model" value={model} onChange={event=>setModel(event.target.value)} disabled={busy||sending} placeholder="CLI default"/></label>}</div>
    <p>Provider and model apply to the next session.{cli!=='shell'&&' Leave the model blank for the CLI default. The CLI checks sign-in and model access after Start.'}</p>
    {running&&!selectionMatches&&<div className="ar-terminal-next-session"><span>Next session: {processLabel(cli)}{selectedModel?' · '+selectedModel:''}</span><button type="button" onClick={()=>void open()} disabled={busy||sending}>Start new session</button></div>}
    {session&&<dl className="ar-terminal-session-details"><div><dt>Session</dt><dd><code>{session.id}</code></dd></div>{session.cli!=='shell'&&<div><dt>Model choice</dt><dd>{session.model||'CLI default · Actual model shown by CLI'}</dd></div>}<div><dt>Connection</dt><dd>{connection}</dd></div>{session.cwd&&<div><dt>Folder</dt><dd><code>{session.cwd}</code></dd></div>}</dl>}
    {running&&<button type="button" onClick={reconnect} disabled={busy||sending}>Reconnect terminal</button>}
    {receipt&&<details className="ar-request-preview ar-terminal-receipt"><summary>Last sent context</summary><p>Selected output may come from an earlier exchange.</p>{record?<><p>{record.manifest.scope==='research'?`${record.manifest.sources?.length||0} research sources`:'Saved manuscript revision '+record.manifest.manuscriptRevision} · automatic personal thoughts {record.manifest.thoughts?.included?'included':'excluded'}{record.manifest.retainedContext&&` · ${record.manifest.retainedContext.units.length} selected retained items`}</p><div className="ar-request-context">{record.assembledContext}</div></>:<p>{contextStatus==='loading'?'Recovering saved context…':'Saved context is unavailable. The request ID and hash are preserved.'}</p>}<p>Sent {new Date(receipt.sentAt).toLocaleString()} · <code title={receipt.contextHash}>{receipt.contextHash.slice(0,10)}</code></p></details>}
   </div></details>
  </div>
  {displayError&&<p className="ar-terminal-error" role="alert">{displayError}</p>}
  {articleLaunch&&<p className="ach-attached">This article · personal thoughts excluded. {sentArticleRequestId===articleLaunch.request.id?'Sent for review. ':''}<button type="button" onClick={()=>options.onShelfRequest?.('shared-review')}>Review changes</button></p>}
  {running&&!!attachedFiles.length&&<p className="ach-attached">Attached for this question: <strong>{attachedLabel}</strong></p>}
  {running?<>
   {session.cli&&session.cli!=='shell'&&confirmedSession!==session.id&&<div className="ar-terminal-startup"><p>Finish any sign-in or trust prompts below, then confirm the input prompt is ready.</p><button type="button" onClick={()=>setConfirmedSession(session.id)} disabled={busy||sending}>Prompt is ready</button></div>}
   {Terminal&&visible?<Terminal sessionId={session.id} output={session.output||''} input={input} resize={resize} onDraft={selectDraft} allowReplyReview={!articleLaunch}/>:<div className="ar-terminal-empty"><p>Loading terminal…</p></div>}
   {!articleLaunch&&(session.cli!=='shell'||contextCount(contextSelection)>0)&&<ContextHandoff project={options.project} api={options.api} value={contextSelection} onChange={setContextSelection} disabled={busy||sending}/>}
   {session.cli==='shell'&&contextCount(contextSelection)>0&&<p className="ar-terminal-startup">Choose Codex or Claude in Settings to ask about selected context.</p>}
   <form className="ar-terminal-composer" title={articleLaunch?'Uses the whole article, accepted guidance and its captured sources.':session.cli==='shell'?'Local command; no writing context':research?'Includes selected sources and accepted guidance.':'Includes the selected passage, Voice, Perspective, Recipe and attached sources.'} onSubmit={e=>{e.preventDefault();if(session.cli==='shell'||confirmedSession===session.id)void send();}}>
    <textarea aria-label={articleLaunch?'Request for this article':session.cli==='shell'?'Local terminal command':'Message to selected CLI'} placeholder={session.cli==='shell'?'Enter a command…':'Ask '+processLabel(session.cli)+'…'} value={message} onChange={e=>setMessage(e.target.value)}/>
    <div><span>{articleLaunch?'Uses this article’s captured context.':session.cli==='shell'?'Runs in this local session.':research?`Includes ${options.requestSelection!.sourceIds.length} selected sources and guidance.`:'Includes the selected passage and guidance.'}</span><button disabled={!!articleLaunch&&sentArticleRequestId===articleLaunch.request.id||!message.trim()||sending||busy||(session.cli==='shell'&&(contextCount(contextSelection)>0||!!articleLaunch))||(session.cli!=='shell'&&confirmedSession!==session.id)}>{sending?'Sending…':articleLaunch&&sentArticleRequestId===articleLaunch.request.id?'Sent':'Send'}</button></div>
   </form>
  </>:<div className="ar-terminal-rest">
   {stagedQuestion?<div className="ach-staged-panel">
    {!!attachedFiles.length&&<p className="ach-attached">Attached for this question: <strong>{attachedLabel}</strong></p>}
    <label className="ach-staged-question"><span>Question for AI</span><textarea aria-label="Question for AI" value={message} onChange={event=>setMessage(event.target.value)} placeholder="What would you like to ask?"/></label>
    <div className="ach-staged-actions"><small>{!restorationComplete?'Checking saved sessions…':stopping?'Stopping; your question stays here.':cli==='shell'?'Choose Codex or Claude in Settings.':'Start, finish sign-in, then send.'}</small><button className="ar-terminal-start" type="button" onClick={()=>void open()} disabled={busy||sending||stopping||cli==='shell'}>{busy?'Starting…':'Start session'}</button></div>
    {!articleLaunch&&<ContextHandoff project={options.project} api={options.api} value={contextSelection} onChange={setContextSelection} disabled={busy||sending}/>}
   </div>:<>
    {cli!=='shell'&&<ContextHandoff project={options.project} api={options.api} value={contextSelection} onChange={setContextSelection} disabled={busy||sending}/>}
    <div className="ar-terminal-empty"><h3>{stopping?'Stopping terminal…':session?'Terminal stopped':'Start a terminal session'}</h3><p>{stopping?'Your output will stay saved.':session?'Your previous output is saved. Start session opens a new process.':cli==='shell'?'Run commands here, or choose Codex or Claude in Settings.':`Open ${processLabel(cli)} here. Sign-in and trust prompts appear in the terminal.`}</p><button className="ar-terminal-start" type="button" onClick={()=>void open()} disabled={busy||sending||stopping}>{busy?'Starting…':'Start session'}</button></div>
   </>}
   {session?.output&&<details className="ar-terminal-previous" onToggle={event=>setPreviousOutputOpen(event.currentTarget.open)}><summary>Previous output</summary>{previousOutputOpen&&Terminal&&visible&&<Terminal sessionId={session.id} output={session.output} input={()=>{}} resize={()=>{}} onDraft={selectDraft} allowReplyReview={!articleLaunch} readOnly/>}</details>}
  </div>}
 </section>;
}
