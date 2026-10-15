import React,{useEffect,useState} from 'react';
import './automatic-execution.css';
export type AIExecution={transport:'codex-exec';state:'running'|'failed'|'complete'|'interrupted'|'timed-out'|'model-unavailable';error?:string;startedAt?:string;finishedAt?:string};
export function useAutomaticAI(api:any){
 const [capability,setCapability]=useState<{available:boolean|null;reason?:string}>({available:null});
 useEffect(()=>{let active=true;setCapability({available:null});if(!api){setCapability({available:false,reason:'The local AI service is disconnected.'});return;}
  void api('/api/ai/execution/capabilities').then((value:any)=>{if(active)setCapability({available:value.available===true,...(value.reason?{reason:value.reason}:value.available===true?{}:{reason:'Automatic AI is unavailable in this workspace.'})});}).catch((cause:any)=>{if(active)setCapability({available:false,reason:'AI availability could not be checked. '+(cause.message||'Reconnect and try again.')});});
  return()=>{active=false;};
 },[api]);return capability;
}
export function executionPending(record:any){return record?.execution?record.execution.state==='running':['sent','awaiting-artifact'].includes(record?.status);}
export function AutomaticExecutionNotice({capability,record,label='AI work'}:{capability:{available:boolean|null;reason?:string};record:any;label?:string}){
 if(record?.execution?.state==='running')return <p className="ai-execution-status" role="status">{label} is running. You can leave and return to this saved request.</p>;
 if(record?.execution&&['failed','interrupted','timed-out','model-unavailable'].includes(record.execution.state))return <p className="ai-execution-status">Stopped without changing your writing. Resolve the error above before trying again. This request will not retry automatically.</p>;
 if(record&&record.status!=='preview')return null;
 if(capability.available===null)return <p className="ai-execution-status" role="status">Checking local AI availability…</p>;
 if(!capability.available)return <p className="ai-execution-status">{capability.reason||'Automatic AI is unavailable.'} Use terminal instead to continue.</p>;
 return null;
}
