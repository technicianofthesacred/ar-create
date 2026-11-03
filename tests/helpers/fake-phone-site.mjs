// A stand-in for the phone site (mandalacodes) that speaks the real pickup contract, so no test touches the network
// or a paid service. It keeps the phone's first draft separate from the better transcript it is sent.
import http from 'node:http';
import {randomUUID} from 'node:crypto';

export const KEY='k'.repeat(40);
export const WRONG_KEY='w'.repeat(40);

export async function startPhoneSite({key=KEY,segments=[],notReady=false}={}){
 const rows=new Map(),seen={lists:0,audio:0,posts:[],unauthorised:0};
 const row=(extra={})=>({draft:'a quick draft',bytes:Buffer.from('invented phone audio '+randomUUID()),mimeType:'audio/mp4',recordedAt:'2026-11-01T08:00:00.000Z',durationMs:12000,improved:null,skipped:null,hexagram:12,...extra});
 for(const s of segments){const {id,...extra}=s;rows.set(id,row(extra));}
 const server=http.createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  if(notReady)return send(503,{ok:false,error:'pickup is not set up on this site'});
  if(req.headers.authorization!==`Bearer ${key}`){seen.unauthorised+=1;return send(401,{ok:false,error:'unauthorized'});}
  const url=new URL(req.url,'http://x');
  if(req.method==='GET'&&url.pathname==='/api/oracle/pickup/segments'){
   seen.lists+=1;
   const list=[...rows].filter(([,r])=>!r.improved&&!r.skipped).map(([id,r])=>({id,sessionId:randomUUID(),hexagramNumber:r.hexagram,recordedAt:r.recordedAt,durationMs:r.durationMs,mimeType:r.mimeType,byteSize:r.bytes.length,status:'transcribed',draft:{text:r.draft,provider:'groq'},audioPath:`/api/oracle/pickup/segments/${id}/audio`}));
   return send(200,{ok:true,segments:list,more:false});
  }
  const audio=url.pathname.match(/^\/api\/oracle\/pickup\/segments\/([^/]+)\/audio$/);
  if(req.method==='GET'&&audio){const r=rows.get(audio[1]);if(!r)return send(404,{ok:false});seen.audio+=1;res.writeHead(200,{'Content-Type':r.mimeType});return res.end(r.bytes);}
  const post=url.pathname.match(/^\/api\/oracle\/pickup\/segments\/([^/]+)\/transcript$/);
  if(req.method==='POST'&&post){
   const r=rows.get(post[1]);if(!r)return send(404,{ok:false});
   let text='';for await(const c of req)text+=c;const body=JSON.parse(text);seen.posts.push({id:post[1],body});
   if(body.outcome==='skipped'){r.skipped=body.reason;return send(200,{ok:true,result:'skipped'});}
   if(r.improved?.resultHash===body.resultHash)return send(200,{ok:true,result:'unchanged'});
   r.improved=body;return send(201,{ok:true,result:r.edited?'reconcile':'applied'});
  }
  send(404,{ok:false});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 return {origin,rows,seen,key,close:()=>new Promise(r=>{server.closeAllConnections?.();server.close(r);}),add(id=randomUUID(),extra={}){rows.set(id,row(extra));return id;}};
}

/** The Mac's side, without a model: Library import, a job that finishes when told to, and a canned transcript. */
export function fakeLocal({autoFinish=true,ready=true}={}){
 const sources=new Map(),jobs=new Map(),calls={imports:[],started:[],failImportOnce:false};
 return {
  calls,sources,jobs,
  async ready(){return ready?{ready:true}:{ready:false,problem:'Transcription is not connected on this Mac.'};},
  async importAudio({name,bytes}){
   if(calls.failImportOnce){calls.failImportOnce=false;throw new Error('The Library is busy.');}
   const sourceId=randomUUID(),id=randomUUID();calls.imports.push({name,bytes});sources.set(sourceId,{name,bytes});jobs.set(sourceId,{id,sourceId,state:'saved',transcriptReady:false});return {sourceId};
  },
  async jobForSource(sourceId){const job=jobs.get(sourceId);return job?{...job}:null;},
  async startJob(jobId){calls.started.push(jobId);for(const job of jobs.values())if(job.id===jobId){job.state=autoFinish?'done':'running';job.transcriptReady=autoFinish;}},
  finish(jobId){for(const job of jobs.values())if(job.id===jobId){job.state='done';job.transcriptReady=true;}},
  fail(jobId,error='The model stopped.'){for(const job of jobs.values())if(job.id===jobId){job.state='failed';job.error=error;}},
  async readResult(){return {result:{language:'en',speakers:[{id:'s1',name:'Adrian'}],segments:[
   {start:0,end:2.4,speaker:'s1',text:' Lu Yu wrote the Classic of Tea.',words:[{word:' Lu',start:0,end:.3,probability:.9},{word:' Yu',start:.3,end:.6,probability:.95}]},
   {start:2.4,end:5,speaker:'s1',text:'The gaiwan was warmed.'},
  ],metadata:{engine:'invented-model'}}};},
 };
}
export const fakeWords=()=>{const calls=[];return {calls,async recognise(input){calls.push(input);return {state:'open',items:[{status:'open'},{status:'open'}]};}};};
