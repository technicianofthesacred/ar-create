/* Version two: the Capture sheet. Four ways in (Speak, Photograph, Write a thought, Ask a question), each opening in
   place inside one sheet. Everything goes through the shell's command client: bytes through sources.import, filed with
   a subject by study.material.attach (or first-flow.attach), a question through research-topics.start (an assistant's
   becomes research-topics.propose). Nothing here keeps a copy of a record; what is not saved yet stays in the sheet.
   The shell hands over what it can do (create({call,...})) and exposes the result as v2.capture(options). */
(function(root){
 'use strict';
 const doc=root.document,P=root.V2Parts||{},esc=P.esc||(v=>String(v??'')),icon=P.icon||(()=>'');
 const MAX_BYTES=8*1024*1024,MAX_MS=15*60*1000,MAX_FILE=64*1024*1024,LONG=180000;
 // A phone clock may run ahead of the app's: a file saved this long before the attempt began still counts as this one's.
 const CLOCK_MARGIN_MS=60000;

 // ---------- small pure helpers (also used by the tests) ----------
 const pad=n=>String(n).padStart(2,'0');
 /** 2026-11-11 21.05.34, in local time. */
 const stamp=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
 /** Words made safe to sit in a file name (never changes the saved words themselves). */
 const clean=text=>String(text||'').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').replace(/^[.\s]+/,'').trim();
 /** A file name from the first words and the date: "The leaf is ready 2026-11-11 21.05.34.md". */
 function thoughtName(text,date,fallback='Thought'){const words=clean(text).split(' ').filter(Boolean).slice(0,6).join(' ').slice(0,48).trim();return (words||fallback)+' '+stamp(date)+'.md';}
 function audioExt(mime){const m=String(mime||'').toLowerCase();return m.includes('mp4')||m.includes('m4a')||m.includes('aac')?'.m4a':m.includes('ogg')?'.ogg':m.includes('wav')?'.wav':m.includes('mpeg')||m.includes('mp3')?'.mp3':'.webm';}
 /** Microphone-2026-11-11 21.05.34.webm, or the type the browser gives. */
 const audioName=(date,mime)=>'Microphone-'+stamp(date)+audioExt(mime);
 const clock=ms=>{const s=Math.max(0,Math.floor((Number(ms)||0)/1000));return Math.floor(s/60)+':'+pad(s%60);};
 const plural=(n,one,many)=>n===1?`1 ${one}`:`${n} ${many}`;
 /** {id,name} from a subject given as an id, or an object with id (or parentStudyId) and name (or title). */
 function subjectOf(value){
  if(!value)return null;
  if(typeof value==='string')return value?{id:value,name:''}:null;
  const id=value.id||value.parentStudyId;if(typeof id!=='string'||!id)return null;
  return {id,name:String(value.name||value.title||'')};
 }
 const base64Of=blob=>new Promise((resolve,reject)=>{const r=new root.FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(new Error('The file could not be read.'));r.readAsDataURL(blob);});
 const GENERIC=new Set(['Subject','Write','Read','Check','Carousel','']);

 /** deps: call(name,input,options), isHuman(), advanced(target), href(route,params), expect(record). */
 function create(deps){
  let live=null;

  function open(options={}){
   const subject=subjectOf(options.subject);
   if(live){
    if((live.subject?.id||null)===(subject?.id||null)||live.unsafe()){live.focus();return live.api;}
    live.close();
   }
   const opener=doc.activeElement;
   const S={view:'tiles',subject,fellBack:false,thought:'',question:'',photos:[],photoId:0,rec:{state:'idle',problem:''},draft:null,busy:false,done:null,msg:'',tone:'',thoughtFile:null,note:null};
   let destPromise=null,nextView=null;
   const call=(name,input,o)=>deps.call(name,input,o);
   const human=()=>!!deps.isHuman();

   // ---------- where it goes ----------
   function destination(){
    if(destPromise)return destPromise;
    if(!S.subject)return destPromise=Promise.resolve({library:true});
    destPromise=(async()=>{
     try{
      const st=await call('subject.standing',{parentStudyId:S.subject.id}),f=st?.facts||{};
      if(st?.title&&S.subject.name!==st.title){S.subject.name=st.title;paintTo();}
      if(f.bindingId||f.projectId)return {subject:S.subject,projectId:f.projectId||null,bindingId:f.bindingId||null};
      S.fellBack=true;paintTo();return {library:true,why:'this subject has no place of its own yet'};
     }catch(error){destPromise=null;S.fellBack=true;paintTo();return {library:true,why:error?.message||'the subject could not be read'};}
    })();
    return destPromise;
   }
   const toLine=()=>S.subject&&!S.fellBack
    ?`Goes to <b>${esc(S.subject.name||'this subject')}</b>. A question goes to Research.`
    :'Goes to <b>the Library, to file later</b>. A question goes to Research.';

   // An answer that never arrived (the wait ran out, or the connection dropped) is not a refusal: the Library may have saved it.
   const lostAnswer=error=>error?.kind==='failed'&&!error.status;
   const lostError=()=>{const e=new Error('The app did not answer, so the sheet cannot be sure. It looks for the file before it saves it again.');e.lost=true;return e;};
   /** The bytes the Library receives for one file: its base64, or its words as UTF-8. */
   function bytesOf(file){
    if(file.content!=null){const E=root.TextEncoder;if(E)return new E().encode(file.content);const bin=unescape(encodeURIComponent(file.content)),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
    const bin=root.atob(file.base64||''),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;
   }
   /** The SHA-256 of those bytes as lower-case hex, the form the Library tree gives each file's hash; null when this browser cannot make it. */
   async function hashOf(file){
    try{
     const subtle=root.crypto?.subtle;if(!subtle)return null;
     return [...new Uint8Array(await subtle.digest('SHA-256',bytesOf(file)))].map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch{return null;}
   }
   const stripN=(rel,want)=>{
    // want is folder/name.ext; the Library also saves name-2.ext, name-3.ext when the name is taken.
    const dot=want.lastIndexOf('.'),slash=want.lastIndexOf('/'),stem=dot>slash?want.slice(0,dot):want,ext=dot>slash?want.slice(dot):'';
    return rel===want||(rel.startsWith(stem+'-')&&rel.endsWith(ext)&&/^\d+$/.test(rel.slice(stem.length+1,rel.length-ext.length)));
   };
   /** When the Library says it saved this file, in milliseconds (its capture time, else the file's own); null when it gives none. */
   const savedAt=f=>{const t=Date.parse(f?.provenance?.capturedAt||f?.modified_at||'');return Number.isFinite(t)?t:null;};
   /** The file this capture saved, known by its content: the same name or a numbered form of it, with these exact bytes
       (SHA-256), saved after this attempt began. An identical file saved earlier is told apart by that time, because the
       Library records when each file was saved. Null when none is found, or when the content or time cannot be checked
       (then the file is not taken for this one, and it is saved again). */
   async function findSaved(folder,name,since,hash){
    if(!hash)return null;
    const answer=await call(folder?'sources.folders':'sources.tree',folder?{rootId:'library',folder}:{});
    const want=(folder?folder+'/':'')+name;let hit=null;
    const walk=node=>{if(!node)return;for(const f of node.files||[]){
     if(!f.id||!stripN(f.rel_path||'',want)||f.hash!==hash)continue;
     const at=savedAt(f);if(at==null||at<since-CLOCK_MARGIN_MS)continue;
     if(!hit||at>savedAt(hit))hit=f;}
     for(const c of node.folders||[])walk(c);};
    for(const r of answer?.roots||[])if(!r.id||r.id==='library')walk(r.tree);
    return hit;
   }
   // Each file whose answer was lost, by its folder, name and content: when this capture began, so only a later save counts.
   // One operationId for each thing written, kept for a retry of the same thing (the server answers a repeated one with the
   // first result instead of writing again). A new thing, such as changed words, takes a new one.
   const ops=new Map();
   const opId=key=>{if(!ops.has(key))ops.set(key,deps.uuid?deps.uuid():(root.crypto?.randomUUID?root.crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g,()=>Math.floor(Math.random()*16).toString(16))));return ops.get(key);};
   const unsure=new Map();
   /** One file into the Library folder. A file whose answer was lost is looked for by its content first, and a found file counts as saved. */
   async function importOne(file,{folder='',refusal='The Library did not take it.'}={}){
    const hash=await hashOf(file);const key=folder+'/'+file.name+'/'+(hash||'');
    const lostBefore=unsure.get(key);
    if(lostBefore){
     let hit;try{hit=await findSaved(folder,file.name,lostBefore.since,hash);}catch{throw lostError();}
     if(hit){unsure.delete(key);return {id:hit.id,name:hit.name,rel_path:hit.rel_path};}
    }
    // The time this capture began stays the first attempt's, so a save from a lost first try is still recognised.
    const since=lostBefore?lostBefore.since:Date.now();
    let answer;
    try{answer=await call('sources.import',{rootId:'library',folder,files:[file]},{timeoutMs:LONG});}
    catch(error){if(lostAnswer(error)){if(!lostBefore)unsure.set(key,{since});throw lostError();}throw error;}
    unsure.delete(key);
    const receipt=answer?.receipts?.[0];
    if(!receipt?.ok||!receipt.source?.id)throw new Error(receipt?.error||refusal);
    return receipt.source;
   }
   /** One file into the Library, filed with the subject as the workspace does: its folder, import, attach. */
   async function fileIn(file){
    const d=await destination(),named=!!d.subject;
    let folder=d.projectId?'Projects/'+d.projectId:'';
    if(folder){try{await call('sources.folders',{rootId:'library',folder});}catch{folder='';}}
    const source=await importOne(file,{folder});
    let attached=false,why='';
    if(named){
     const tries=[];
     if(d.bindingId)tries.push(()=>call('study.material.attach',{bindingId:d.bindingId,parentStudyId:S.subject.id,sourceIds:[source.id],operationId:opId('attach:'+S.subject.id+':'+source.id)}));
     if(d.projectId)tries.push(()=>call('first-flow.attach',{projectId:d.projectId,sourceIds:[source.id],operationId:opId('first-flow:'+d.projectId+':'+source.id)}));
     for(const attempt of tries){try{await attempt();attached=true;break;}catch(error){why=error?.message||why;}}
    }
    // Saved inside the subject's own folder counts as with the subject even when the attach step was refused, but it is said as that.
    const home=!named?'library':attached?'subject':folder?'folder':'library';
    return {source,home,attached,why:named&&!attached?(why||'the app refused it'):'',fell:!named&&!!S.subject};
   }
   const subjectName=()=>esc(S.subject?.name||'this subject');
   const whereWords=homes=>{
    if(S.subject&&!S.fellBack&&homes.every(h=>h==='subject'))return `added to <b>${subjectName()}</b>`;
    if(S.subject&&!S.fellBack&&homes.every(h=>h==='subject'||h==='folder'))return `saved in the folder of <b>${subjectName()}</b>`;
    return 'saved in the Library, to file later';
   };
   const attachNote=why=>`It could not be attached to the subject: ${why}`;
   /** The plain line for a save that did not finish; a lost answer says it may already be saved. */
   const notSaved=(thing,error,still)=>error?.lost?`${thing} may already be saved. ${error.message} ${still}`:`${thing} was not saved. ${error?.message||'The app did not answer.'} ${still}`;

   // ---------- the sheet ----------
   const d=doc.createElement('dialog');d.className='v2-sheet v2-capture';d.setAttribute('aria-label','Capture');
   d.innerHTML=`<div class="v2-sheet-in"><header><h2 tabindex="-1">Capture</h2></header><div class="v2-sheet-body"><p class="v2-cap-to" data-cap-to></p><div class="v2-cap-view" data-cap-view></div><p class="v2-cap-msg" role="status" aria-live="polite" data-cap-msg></p></div></div>`;
   const $=sel=>d.querySelector(sel),viewEl=$('[data-cap-view]'),msgEl=$('[data-cap-msg]'),toEl=$('[data-cap-to]');
   function paintTo(){toEl.innerHTML=toLine();}
   function say(text,tone=''){S.msg=text||'';S.tone=tone;msgEl.textContent=S.msg;if(tone)msgEl.dataset.tone=tone;else delete msgEl.dataset.tone;}

   const unsafe=()=>S.busy||S.rec.state==='recording'||S.rec.state==='asking'||!!S.draft||!!S.thought.trim()||!!S.question.trim()||S.photos.some(p=>p.state!=='saved');
   const onUnload=e=>{if(unsafe()){e.preventDefault();e.returnValue='';}};
   root.addEventListener?.('beforeunload',onUnload);
   const onHash=()=>{if(!unsafe())return close();say(S.busy?'You moved to another screen while this is saving. The sheet stays open until it is saved.':'You moved to another screen, but something here is not saved yet. The sheet stays open: save it, or discard it, and then close.','bad');};
   root.addEventListener?.('hashchange',onHash);

   let closed=false,tick=null,urls=new Set(),mic=null;
   const url=blob=>{const u=root.URL.createObjectURL(blob);urls.add(u);return u;};
   const unurl=u=>{if(u&&urls.delete(u))try{root.URL.revokeObjectURL(u);}catch{}};
   function stopMic(){clearInterval(tick);tick=null;if(mic){try{if(mic.recorder.state!=='inactive'){mic.recorder.onstop=null;mic.recorder.stop();}}catch{}for(const t of mic.stream?.getTracks?.()||[])try{t.stop();}catch{}clearTimeout(mic.cap);mic=null;}}
   function close(){
    if(closed)return;closed=true;stopMic();for(const u of [...urls])unurl(u);
    root.removeEventListener?.('beforeunload',onUnload);root.removeEventListener?.('hashchange',onHash);
    try{d.close();}catch{}d.remove();live=null;
    const back=opener&&opener!==doc.body&&opener.isConnected?opener:doc.querySelector('[data-v2-capture]');
    back?.focus?.({preventScroll:true});
   }
   const keepWords=()=>S.rec.state==='recording'?'Stop the recording first. Nothing is closed while it runs.':S.busy?'It is saving. The sheet closes once it is saved.':S.view==='done'?'Something is still waiting, not saved. Choose it in the list to go back to it, then save or discard it.':'Something here is not saved yet. Save it, or discard it, and then close.';
   function tryClose(){
    if(unsafe()){say(keepWords(),'bad');return false;}
    close();return true;
   }
   /** What is still unsaved, each with the view it lives in. */
   function waiting(){
    const w=[];
    if(S.draft||S.rec.state==='recording'||S.rec.state==='asking')w.push({view:'speak',label:S.rec.state==='recording'?'A recording in progress':'A recording'});
    const n=S.photos.filter(p=>p.state!=='saved').length;if(n)w.push({view:'photo',label:plural(n,'photograph','photographs')});
    if(S.thought.trim())w.push({view:'thought',label:'A thought'});
    if(S.question.trim())w.push({view:'question',label:'A question'});
    return w;
   }
   /** The dialog is shown again after the browser closed it on its own (a second Escape). */
   function reopen(){
    try{if(typeof d.showModal==='function'){if(!d.open&&d.isConnected)d.showModal();}else if(!d.hasAttribute('open'))d.setAttribute('open','');}catch{}
   }

   // ---------- the views ----------
   const back=(extra='')=>`<button type="button" class="v2-ghost v2-icon-btn" data-cap="back" aria-label="Back to the four ways in"${extra}>${icon('back')}</button>`;
   const head=(title,locked)=>`<div class="v2-cap-head">${back(locked?' disabled':'')}<h3 tabindex="-1" data-cap-title>${esc(title)}</h3></div>`;
   const hint=text=>`<p class="v2-cap-hint">${text}</p>`;
   function tilesView(){
    const kept={speak:S.draft||S.rec.state==='recording'?'Not saved yet':'',photo:S.photos.some(p=>p.state!=='saved')?'Not saved yet':'',thought:S.thought.trim()?'Not saved yet':'',question:S.question.trim()?'Not saved yet':''};
    const tile=(id,cls,ic,label)=>`<button type="button" class="v2-tile${cls?' '+cls:''}" data-cap="tile" data-view="${id}">${icon(ic)}${label}${kept[id]?`<small>${kept[id]}</small>`:''}</button>`;
    return `<div class="v2-cap4">${tile('speak','rec','mic','Speak')}${tile('photo','','photo','Photograph')}${tile('thought','','pen','Write a thought')}${tile('question','','ask','Ask a question')}</div>`;
   }
   function audioPicker(label='Add an audio file'){return `<button type="button" data-cap="audio-pick">${esc(label)}</button><input class="v2-cap-file" type="file" accept="audio/*" data-cap-input="audio" tabindex="-1" aria-hidden="true">`;}
   function speakView(){
    const r=S.rec;
    if(S.draft){
     const dr=S.draft,len=dr.ms==null?'':` Length <b>${clock(dr.ms)}</b>.`;
     if(!dr.url)dr.url=url(dr.blob);
     return `${head('Speak',S.busy)}<p>${dr.fromFile?`<b>${esc(dr.name)}</b>.`:'Recording done.'}${len}</p><audio controls preload="metadata" src="${esc(dr.url)}"></audio>
      <div class="v2-cap-actions"><button type="button" class="pri" data-cap="save"${S.busy?' disabled':''}>${dr.failed?'Try again':'Save'}</button><button type="button" class="v2-ghost" data-cap="discard"${S.busy?' disabled':''}>Discard</button></div>`;
    }
    if(r.state==='recording')return `${head('Speak',true)}<div class="v2-cap-rec"><i aria-hidden="true"></i><span class="v2-cap-time" data-cap-time>${clock(Date.now()-mic.t0)}</span></div><div class="v2-cap-actions"><button type="button" class="pri" data-cap="stop">Stop</button></div>${hint('Up to 15 minutes or 8 MB.')}`;
    if(r.state==='asking')return `${head('Speak',true)}<p>Allow the microphone when your browser asks.</p>`;
    return `${head('Speak',false)}<p>${esc(r.problem||'The microphone is ready when you are.')}</p><div class="v2-cap-actions">${r.problem?`<button type="button" class="pri" data-cap="record">Try the microphone again</button>`:`<button type="button" class="pri" data-cap="record">Start recording</button>`}${audioPicker()}</div>`;
   }
   const photoState=p=>p.state==='saved'?'Saved':p.state==='saving'?'Saving':p.state==='failed'?esc(p.msg||'Not saved'):'Waiting';
   function photoItems(){
    return S.photos.map(p=>`<li data-state="${p.state}" data-id="${p.id}"><img alt="" src="${esc(p.url)}"><span>${esc(p.name)}<small>${photoState(p)}</small></span>${p.state==='failed'?`<button type="button" class="v2-ghost" data-cap="photo-retry" data-id="${p.id}">Try again</button>`:''}${p.state==='failed'||p.state==='waiting'?`<button type="button" class="v2-ghost" data-cap="photo-remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button>`:''}</li>`).join('');
   }
   function photoView(){
    return `${head('Photograph',S.busy)}${hint('Take one now, or choose several from this device.')}
     <div class="v2-cap-actions"><button type="button" class="pri" data-cap="photo-camera"${S.busy?' disabled':''}>Take a photograph</button><button type="button" data-cap="photo-choose"${S.busy?' disabled':''}>Choose photographs</button></div>
     <input class="v2-cap-file" type="file" accept="image/*" capture="environment" data-cap-input="camera" tabindex="-1" aria-hidden="true">
     <input class="v2-cap-file" type="file" accept="image/*" multiple data-cap-input="choose" tabindex="-1" aria-hidden="true">
     <ul class="v2-cap-photos" data-cap-photos aria-label="Photographs">${photoItems()}</ul>`;
   }
   function thoughtView(){
    return `${head('Write a thought',S.busy)}<label class="v2-cap-field"><span>Your thought</span><textarea data-cap-text rows="6" ${S.busy?'readonly':''}></textarea></label>
     <div class="v2-cap-actions"><button type="button" class="pri" data-cap="save"${S.busy||!S.thought.trim()?' disabled':''}>Save</button><button type="button" class="v2-ghost" data-cap="discard"${S.busy?' disabled':''}>Discard</button><span class="v2-cap-hint">Ctrl or Cmd with Enter saves.</span></div>`;
   }
   function questionView(){
    return `${head('Ask a question',S.busy)}<label class="v2-cap-field"><span>What do you want to understand?</span><input type="text" data-cap-text maxlength="200" autocomplete="off" ${S.busy?'readonly':''}></label>
     <div class="v2-cap-actions"><button type="button" class="pri" data-cap="save"${S.busy||!S.question.trim()?' disabled':''}>${human()?'Add to Research':'Propose to Research'}</button><button type="button" class="v2-ghost" data-cap="discard"${S.busy?' disabled':''}>Discard</button></div>
     ${hint(human()?'It is added to Research'+(S.subject&&!S.fellBack?`, linked to ${esc(S.subject.name||'this subject')}`:'')+'.':'You are not Adrian, so this goes to Research as a proposal for him to keep or let go.')}`;
   }
   function waitingHtml(){
    const w=waiting();if(!w.length)return '';
    return `<div class="v2-cap-wait" data-cap-wait><p>Still waiting, not saved:</p><div class="v2-cap-actions">${w.map(i=>`<button type="button" data-cap="tile" data-view="${i.view}" aria-label="Go back to: ${esc(i.label)}">${esc(i.label)}</button>`).join('')}</div></div>`;
   }
   function doneView(){
    const x=S.done;
    return `<div class="v2-cap-done">${icon('check')}<span id="v2-cap-said">${x.text}</span>${x.undo?`<button type="button" data-cap="undo">Undo</button>`:''}<button type="button" class="pri" data-cap="done" aria-describedby="v2-cap-said">Done</button></div>
     ${waitingHtml()}<div class="v2-cap-done-more">${x.link?`<a class="v2-cap-link" href="${esc(x.link.href)}" data-cap-link>${esc(x.link.label)}</a>`:''}${(x.notes||[]).map(n=>`<span>${esc(n)}</span>`).join('')}</div>`;
   }
   const VIEWS={tiles:tilesView,speak:speakView,photo:photoView,thought:thoughtView,question:questionView,done:doneView};
   function paint(focus){
    viewEl.innerHTML=(VIEWS[S.view]||tilesView)();
    const ta=viewEl.querySelector('[data-cap-text]');if(ta)ta.value=S.view==='thought'?S.thought:S.question;
    paintTo();
    if(focus==='title')viewEl.querySelector('[data-cap-title]')?.focus({preventScroll:true});
    else if(focus==='done')viewEl.querySelector('[data-cap="done"]')?.focus({preventScroll:true});
    else if(focus==='text')ta?.focus({preventScroll:true});
    else if(focus==='tile'&&nextView)viewEl.querySelector(`[data-view="${nextView}"]`)?.focus({preventScroll:true});
   }
   const show=(view,focus='title')=>{S.view=view;say('');paint(focus);};

   // ---------- Speak ----------
   async function startRecording(){
    if(S.rec.state==='recording'||S.rec.state==='asking')return;
    if(!root.MediaRecorder||!root.navigator?.mediaDevices?.getUserMedia){S.rec={state:'idle',problem:'This browser cannot record from the microphone here.'};paint('title');return;}
    S.rec={state:'asking',problem:''};paint('title');
    let stream;
    try{stream=await root.navigator.mediaDevices.getUserMedia({audio:true});}
    catch(error){
     const refused=error?.name==='NotAllowedError'||error?.name==='SecurityError',missing=error?.name==='NotFoundError'||error?.name==='OverconstrainedError';
     S.rec={state:'idle',problem:refused?'The microphone was not allowed. Allow it in your browser, or add an audio file.':missing?'No microphone was found. You can add an audio file instead.':'The microphone could not start. You can add an audio file instead.'};
     if(!closed&&S.view==='speak')paint('title');return;
    }
    if(closed||S.view!=='speak'){for(const t of stream.getTracks())t.stop();if(!closed&&S.rec.state==='asking'){S.rec={state:'idle',problem:''};}return;}
    const type=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>root.MediaRecorder.isTypeSupported?.(t));
    let recorder;try{recorder=new root.MediaRecorder(stream,type?{mimeType:type}:undefined);}catch{for(const t of stream.getTracks())t.stop();S.rec={state:'idle',problem:'The microphone could not start. You can add an audio file instead.'};paint('title');return;}
    const m={recorder,stream,chunks:[],bytes:0,t0:Date.now(),limit:''};mic=m;
    const halt=limit=>{if(m.limit)return;m.limit=limit||'stopped';const was=recorder.state;try{if(was!=='inactive')recorder.stop();}catch{}if(was==='inactive')recorder.onstop?.();};
    recorder.ondataavailable=e=>{if(e.data?.size){m.chunks.push(e.data);m.bytes+=e.data.size;if(m.bytes>=MAX_BYTES)halt('size');}};
    recorder.onerror=()=>halt('error');
    recorder.onstop=()=>{
     if(m.ended)return;m.ended=true;
     clearInterval(tick);tick=null;clearTimeout(m.cap);for(const t of stream.getTracks())t.stop();if(mic===m)mic=null;
     const ms=Date.now()-m.t0;
     if(!m.bytes){S.rec={state:'idle',problem:'Nothing was recorded. Try again, or add an audio file.'};if(!closed)paint('title');return;}
     const mime=recorder.mimeType||type||'audio/webm',date=new Date(m.t0);
     S.draft={blob:new Blob(m.chunks,{type:mime}),name:audioName(date,mime),type:mime,ms,fromFile:false,failed:false};S.rec={state:'idle',problem:''};
     if(closed)return;
     if(S.view==='speak'){paint('title');say(m.limit==='size'?'The 8 MB limit was reached, so the recording stopped. What was recorded is kept here.':m.limit==='time'?'The 15 minute limit was reached, so the recording stopped. What was recorded is kept here.':m.limit==='error'?'The recording stopped after a microphone problem. What was recorded is kept here.':'',m.limit&&m.limit!=='stopped'?'bad':'');}
    };
    m.cap=setTimeout(()=>halt('time'),MAX_MS);
    S.rec={state:'recording',problem:''};
    try{recorder.start(1000);}catch{stopMic();S.rec={state:'idle',problem:'The microphone could not start. You can add an audio file instead.'};if(!closed&&S.view==='speak')paint('title');return;}
    tick=setInterval(()=>{const el=viewEl.querySelector('[data-cap-time]');if(el)el.textContent=clock(Date.now()-m.t0);},500);
    paint('title');viewEl.querySelector('[data-cap="stop"]')?.focus({preventScroll:true});
   }
   function pickAudio(file){
    if(!file)return;
    if(file.size>MAX_FILE){say('That file is over 64 MB, which is more than the app takes in one go.','bad');return;}
    S.draft={blob:file,name:file.name||audioName(new Date(),file.type),type:file.type,ms:null,fromFile:true,failed:false};S.rec={state:'idle',problem:''};paint('title');say('');
   }
   /** After a recording is in the Library: start its transcript when this machine can, and say plainly where it stands. */
   async function transcriptNote(sourceId){
    try{
     const rec=await call('recordings',{});
     if(!rec?.capability?.ready)return 'The recording is saved. Transcription is not set up on this machine, so there is no transcript yet.';
     const job=(rec.jobs||[]).find(j=>j.sourceId===sourceId);
     if(!job)return 'The recording is saved. Its transcript has not been started.';
     if(job.state!=='saved')return 'The recording is saved. Its transcript is already being made.';
     await call('.transcription.id.action',{id:job.id,action:'start'});
     return 'The recording is saved and its transcript has started.';
    }catch(error){return 'The recording is saved. The transcript could not be started: '+(error?.message||'the app did not answer')+'.';}
   }
   async function saveRecording(){
    const dr=S.draft;if(!dr||S.busy)return;
    S.busy=true;dr.failed=false;paint();say('Saving the recording.');
    try{
     const file={name:dr.name,base64:await base64Of(dr.blob)};
     const r=await fileIn(file);
     const note=await transcriptNote(r.source.id);
     unurl(dr.url);S.draft=null;S.busy=false;
     finish({text:`<b>Recording</b> ${whereWords([r.home])}.`,r,notes:[note,...(r.why?[attachNote(r.why)]:[])]});
    }catch(error){S.busy=false;dr.failed=true;paint();say(notSaved('The recording',error,'It is still here: try again.'),'bad');}
   }

   // ---------- Photograph ----------
   async function addPhotos(files){
    for(const f of files){if(!f)continue;S.photos.push({id:++S.photoId,file:f,name:f.name||('Photograph '+stamp()+'.jpg'),url:url(f),state:'waiting',msg:''});}
    if(S.view==='photo')repaintPhotos();
    await savePhotos();
   }
   const repaintPhotos=()=>{const ul=viewEl.querySelector('[data-cap-photos]');if(ul)ul.innerHTML=photoItems();};
   async function savePhotos(){
    if(S.busy)return;
    if(!S.photos.some(p=>p.state==='waiting'))return;
    S.busy=true;if(S.view==='photo')paint();
    for(let p=S.photos.find(x=>x.state==='waiting');p;p=S.photos.find(x=>x.state==='waiting')){
     p.state='saving';repaintPhotos();
     try{
      if(p.file.size>MAX_FILE)throw new Error('This photograph is over 64 MB, which is more than the app takes in one go.');
      const r=await fileIn({name:p.name,base64:await base64Of(p.file)});p.state='saved';p.result=r;p.msg='';p.lost=false;
     }catch(error){p.state='failed';p.lost=!!error?.lost;p.msg=(p.lost?'May already be saved. ':'')+(error?.message||'The app did not answer.')+' It is still here.';}
     repaintPhotos();
    }
    S.busy=false;
    if(closed)return;
    const left=S.photos.filter(p=>p.state!=='saved');
    if(!left.length)return photosDone();
    if(S.view==='photo')paint();
    say(left.some(p=>p.lost)?`${plural(left.length,'photograph','photographs')} may already be saved: the app did not answer. Each is still here: try again and the sheet looks for it first, or remove it.`:`${plural(left.length,'photograph was','photographs were')} not saved. Each is still here: try again, or remove it.`,'bad');
   }
   function photosDone(){
    const saved=S.photos.filter(p=>p.state==='saved'),rs=saved.map(p=>p.result);
    if(!saved.length){S.photos=[];return show('tiles','tile');}
    for(const p of S.photos)unurl(p.url);S.photos=[];
    finish({text:`<b>${esc(plural(rs.length,'photograph','photographs'))}</b> ${whereWords(rs.map(r=>r.home))}.`,r:rs[0],notes:[...new Set(rs.map(r=>r.why).filter(Boolean))].map(attachNote)});
   }

   // ---------- a thought ----------
   async function saveThought(){
    const text=S.thought;if(!text.trim()||S.busy)return;
    S.busy=true;paint();say('Saving.');
    try{
     // One file name per capture, kept for a retry of the same words, so a save whose answer was lost can be found again.
     if(!S.thoughtFile||S.thoughtFile.text!==text)S.thoughtFile={text,name:thoughtName(text,new Date())};
     const r=await fileIn({name:S.thoughtFile.name,content:text});
     S.thought='';S.thoughtFile=null;S.busy=false;
     finish({text:`<b>Thought</b> ${whereWords([r.home])}.`,r,notes:r.why?[attachNote(r.why)]:[]});
    }catch(error){S.busy=false;paint('text');say(notSaved('The thought',error,'Your words are still here: try again.'),'bad');}
   }

   // ---------- a question ----------
   // The words decide the operation: the same words on a retry send the same one, changed words send a new one.
   const questionOp=(text,kind)=>opId('question:'+kind+':'+S.subject?.id+':'+text);
   async function saveQuestion(){
    const name=S.question;if(!name.trim()||S.busy)return;
    S.busy=true;paint();say('Sending it to Research.');
    const subjects=S.subject?{subjects:[S.subject.id]}:{};
    try{
     if(human()){
      const t=await call('research-topics.start',{name,...subjects,operationId:questionOp(name,'start')});
      S.question='';S.busy=false;
      finish({text:'<b>Question</b> added to Research.',link:{href:deps.href('research/topic/:id',{id:t.id}),label:'Open it in Research'},
       notes:S.subject&&!S.fellBack?[`Linked to ${S.subject.name||'this subject'}.`]:[],
       undo:async()=>{const now=await call('research-topics.read',{id:t.id});await call('research-topics.let-go',{id:t.id,...deps.expect(now)});}});
     }else{
      // The note is saved once for these words; a retry after a failed proposal points at the note already saved.
      if(!S.note||S.note.text!==name)S.note={text:name,file:{name:thoughtName(name,new Date(),'Question'),content:name},id:null};
      const note=S.note;
      if(!note.id)note.id=(await importOne(note.file,{folder:'',refusal:'The Library did not take the note the proposal points at.'})).id;
      const t=await call('research-topics.propose',{name,...subjects,operationId:questionOp(name,'propose'),origin:{kind:'note',label:'Asked from the Capture sheet',ref:{kind:'source',id:note.id}}});
      S.question='';S.note=null;S.busy=false;
      finish({text:'<b>Question</b> proposed to Research. Adrian keeps it or lets it go.',link:{href:deps.href('research/topic/:id',{id:t.id}),label:'Open it in Research'},notes:['The question is also saved as a note in the Library.']});
     }
    }catch(error){S.busy=false;paint('text');say(error?.lost||lostAnswer(error)?'The question may already have been sent: the app did not answer, so the sheet cannot be sure. Your words are still here. Try again: it will not be added twice.':`The question was not sent. ${error?.message||'The app did not answer.'} Your words are still here: try again.`,'bad');}
   }

   // ---------- done ----------
   function finish({text,r,link,notes=[],undo}){
    let l=link;
    if(!l&&r){l=r.home!=='library'&&S.subject?{href:deps.href('subject/:id',{id:S.subject.id}),label:'Open '+(S.subject.name||'the subject')}:{href:deps.advanced({section:'library'}),label:'See it in the Library (Advanced)'};}
    S.done={text,link:l,notes,undo};S.view='done';say('');paint('done');
   }
   async function runUndo(){
    const x=S.done;if(!x?.undo)return;
    S.busy=true;viewEl.querySelectorAll('button').forEach(b=>{b.disabled=true;});
    try{await x.undo();S.busy=false;S.done={text:'<b>Question</b> taken back. It will not be opened.',notes:[],link:null,undo:null};paint('done');say('Taken back.');}
    catch(error){S.busy=false;paint('done');say(`It could not be taken back. ${error?.message||''}`.trim(),'bad');}
   }

   // ---------- events ----------
   d.addEventListener('click',e=>{
    if(e.target===d)return void tryClose();
    if(e.target.closest('[data-cap-link]')){if(unsafe()){e.preventDefault();say(keepWords(),'bad');}else closeAfter();return;}
    const b=e.target.closest('[data-cap]');if(!b||b.disabled)return;
    const act=b.dataset.cap;
    if(act==='tile'){nextView=b.dataset.view;show(nextView,nextView==='thought'||nextView==='question'?'text':'title');if(nextView==='speak'&&!S.draft)void startRecording();}
    else if(act==='back'){if(S.busy||S.rec.state==='recording'||S.rec.state==='asking')return;show('tiles','tile');}
    else if(act==='record')void startRecording();
    else if(act==='stop'){if(mic){const m=mic;if(!m.limit){m.limit='stopped';}try{m.recorder.stop();}catch{m.recorder.onstop?.();}}}
    else if(act==='audio-pick')viewEl.querySelector('[data-cap-input="audio"]')?.click();
    else if(act==='photo-camera')viewEl.querySelector('[data-cap-input="camera"]')?.click();
    else if(act==='photo-choose')viewEl.querySelector('[data-cap-input="choose"]')?.click();
    else if(act==='photo-retry'){const p=S.photos.find(x=>x.id===Number(b.dataset.id));if(p){p.state='waiting';say('');void savePhotos();}}
    else if(act==='photo-remove'){const p=S.photos.find(x=>x.id===Number(b.dataset.id));if(p){unurl(p.url);S.photos=S.photos.filter(x=>x!==p);repaintPhotos();if(!S.photos.some(x=>x.state!=='saved'))say('');if(S.photos.length&&!S.photos.some(x=>x.state!=='saved'))photosDone();}}
    else if(act==='save'){if(S.view==='speak')void saveRecording();else if(S.view==='thought')void saveThought();else if(S.view==='question')void saveQuestion();}
    else if(act==='discard'){
     if(S.view==='speak'){unurl(S.draft?.url);S.draft=null;S.rec={state:'idle',problem:''};}
     else if(S.view==='thought'){S.thought='';S.thoughtFile=null;}else if(S.view==='question'){S.question='';S.note=null;}
     show('tiles','tile');
    }
    else if(act==='undo')void runUndo();
    else if(act==='done')tryClose();
   });
   const closeAfter=()=>setTimeout(close,0);
   d.addEventListener('input',e=>{
    if(!e.target.matches?.('[data-cap-text]'))return;
    if(S.view==='thought')S.thought=e.target.value;else if(S.view==='question')S.question=e.target.value;
    const save=viewEl.querySelector('[data-cap="save"]');if(save&&!S.busy)save.disabled=!e.target.value.trim();
   });
   d.addEventListener('keydown',e=>{
    if(!e.target.matches?.('[data-cap-text]'))return;
    if(e.key==='Enter'&&(S.view==='question'||e.metaKey||e.ctrlKey)&&!e.isComposing){e.preventDefault();if(S.view==='thought')void saveThought();else void saveQuestion();}
   });
   d.addEventListener('change',e=>{
    const input=e.target.closest?.('[data-cap-input]');if(!input)return;
    const files=[...(input.files||[])];input.value='';
    if(input.dataset.capInput==='audio')pickAudio(files[0]);else void addPhotos(files);
   });
   d.addEventListener('cancel',e=>{e.preventDefault();tryClose();});
   // A second Escape closes the dialog natively. Anything recording, unsaved or saving is kept: the dialog is shown again.
   d.addEventListener('close',()=>{
    if(closed)return;
    if(unsafe()){reopen();say(keepWords(),'bad');$('h2')?.focus({preventScroll:true});return;}
    close();
   });

   doc.body.append(d);
   if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
   if(S.subject&&GENERIC.has(S.subject.name))S.subject.name='';
   paintTo();paint();
   void destination();
   $('h2').focus({preventScroll:true});
   const api={el:d,close,get subject(){return S.subject;}};
   live={api,close,subject:S.subject,unsafe,focus:()=>{reopen();$('h2')?.focus({preventScroll:true});}};
   return api;
  }
  return Object.freeze({open,isOpen:()=>!!live});
 }

 root.V2Capture=Object.freeze({create,stamp,clean,thoughtName,audioName,audioExt,clock,subjectOf,CLOCK_MARGIN_MS});
 if(typeof module==='object'&&module.exports)module.exports=root.V2Capture;
})(typeof window!=='undefined'?window:globalThis);
