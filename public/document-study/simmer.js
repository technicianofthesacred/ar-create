// Simmer: one subject's material on a board before it is named. Opens from a subject on Home as its own full-width
// mode. Layout and the words written here save to /api/simmer/board; photos go into Library; his exact words are
// Library passages; Send writes the sentence into the project's human direction and opens Direction.
(function(){
 if(window.arSimmer)return;
 const GRID=20,ROW=4,RGAP=6,SAVE_DELAY=500;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const uid=p=>p+'-'+(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian',human=()=>/^human:/.test(actor());
 const headers=()=>({'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'});
 const who=by=>{const m=/^agent:(.+)$/.exec(by||'');if(!m)return 'Claude';return /^claude/.test(m[1])?'Claude':m[1].replace(/^./,c=>c.toUpperCase());};
 const KIND={photo:'Photo',passage:'Passage',mine:'Your words',note:'Your note',concept:'Concept',question:'Question',choice:'Choice',feeling:'Feeling check',guidance:'Guidance',check:'To check',consent:'Consent',voice:'Voice moment',thread:'Open thread',letter:'Reflection letter'};
 const WIDE=new Set(['passage','mine','concept','question','choice','feeling','voice','thread','check']),NO_HOLD=new Set(['note','guidance','consent']);
 const FEELING=['Moves me','Not sure','Not mine'];
 let dlg=null,s=0.8,tx=10,ty=10,mode=null,lastTarget=null,current=null,ctx=null,board=null,saving=null,dirty=false,timer=0,stale=false,mobile=matchMedia('(max-width:860px)'),opener=null;
 const $=sel=>dlg.querySelector(sel),$$=sel=>[...dlg.querySelectorAll(sel)];
 const vp=()=>$('.sm-vp'),world=()=>$('.sm-world'),editor=()=>$('.sm-editor'),scrim=()=>$('.sm-scrim');
 const groupOf=id=>board.groups.find(g=>g.id===id),blockOf=id=>{for(const g of board.groups){const b=g.blocks.find(x=>x.id===id);if(b)return {g,b};}return null;};

 /* ---------- server ---------- */
 async function call(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{...headers(),...options.headers}}),v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The request was refused ('+r.status+').'),{status:r.status});return v;}
 const readBoard=subject=>call('/api/simmer/board?subject='+encodeURIComponent(subject),{method:'GET'});
 function queueSave(){if(stale)return;dirty=true;clearTimeout(timer);status('Not saved yet');timer=setTimeout(flush,SAVE_DELAY);}
 async function flush(){
  clearTimeout(timer);if(!dirty||stale||!board)return saving;if(saving){await saving.catch(()=>{});return flush();}
  dirty=false;status('Saving…');const body={subject:ctx.subject,operationId:crypto.randomUUID(),expectedRevision:board.revision,expectedHash:board.hash,board:{title:ctx.title,groups:board.groups,links:board.links,forming:board.forming}};
  saving=call('/api/simmer/board',{method:'POST',body:JSON.stringify(body)}).then(saved=>{board.revision=saved.revision;board.hash=saved.hash;status(dirty?'Not saved yet':'Saved');},error=>{if(error.status===409){stale=true;note('This board changed somewhere else (another window or an agent). Your last change was not saved. Reload to see the newest board.','reload');}else{dirty=true;note(error.message||'Not saved.');}status('Not saved',true);throw error;}).finally(()=>{saving=null;});
  return saving.catch(()=>{});
 }
 function status(text,bad){const n=$('.sm-save');if(n){n.textContent=text?'· '+text:'';n.classList.toggle('bad',!!bad);}}
 function note(text,action){const n=$('.sm-note');if(!n)return;if(!text){n.hidden=true;n.innerHTML='';return;}n.hidden=false;n.classList.toggle('bad',action!=='talk');n.innerHTML='<span>'+esc(text)+'</span>'+(action==='reload'?'<button type="button" data-sm="reload">Reload</button>':'')+'<button type="button" class="sm-quiet" data-sm="note-close" aria-label="Dismiss">Dismiss</button>';}

 function intakeStatus(){
  const host=$('.sm-intake'),pending=(board.intakeOperations||[]).filter(r=>r.status!=='complete');
  host.hidden=!pending.length;
  host.innerHTML=pending.map(r=>{
   const steps=Object.entries(r.steps||{}),saved=steps.filter(([,s])=>s.status==='saved'),sources=saved.filter(([,s])=>s.sourceId),waiting=steps.filter(([,s])=>s.status==='pending'),changed=steps.filter(([,s])=>s.status==='changed'),uncertain=steps.filter(([,s])=>['running','unconfirmed'].includes(s.status));
   const label=k=>k.startsWith('photo-')?'photo':({project:'subject',note:'your words',membership:'Collection',board:'board',direction:'Direction'}[k]||'material');
   const kept=[sources.length?sources.length+' source'+(sources.length===1?'':'s')+' kept':'',...saved.filter(([k])=>['membership','board','direction'].includes(k)).map(([k])=>label(k)+' saved')].filter(Boolean).join(' · ');
   return '<div><strong>Chat material needs recovery</strong><p>'+esc(kept||'Saved steps need checking.')+(waiting.length?' · '+esc([...new Set(waiting.map(([k])=>label(k)))].join(', '))+' unfinished':'')+(uncertain.length?' · '+esc([...new Set(uncertain.map(([k])=>label(k)))].join(', '))+' awaiting confirmation':'')+(changed.length?' · '+esc([...new Set(changed.map(([k])=>label(k)))].join(', '))+' changed; restore the retained material first':'')+'</p><p>Continue the original request in your chat to finish safely. Your retained material stays here.</p><nav aria-label="Retained chat material">'+sources.map(([k,v],i)=>'<a href="'+esc(blobUrl(v.sourceId))+'" target="_blank" rel="noopener">Open '+esc(k==='note'?'your words':'photo '+(i+1))+'</a>').join('')+'</nav></div>';
  }).join('')+(pending.length?'<button type="button" data-sm="intake-refresh">Check again</button>':'');
 }

 /* ---------- view: pan and zoom ---------- */
 function apply(){if(mobile.matches)return;world().style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';$('.sm-zoom span').textContent=Math.round(s*100)+'%';world().classList.toggle('map',s<0.45);try{localStorage.setItem('simmer-view:'+ctx.subject,JSON.stringify({s,tx,ty}));}catch{}}
 const clampS=v=>Math.max(0.25,Math.min(1.6,v));
 function zoomAt(ns,cx,cy){ns=clampS(ns);const wx=(cx-tx)/s,wy=(cy-ty)/s;s=ns;tx=cx-wx*s;ty=cy-wy*s;apply();}
 function extent(){const fs=$$('.sm-frame');if(!fs.length)return {x:0,y:0,w:1200,h:700};let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const f of fs){x0=Math.min(x0,f.offsetLeft);y0=Math.min(y0,f.offsetTop);x1=Math.max(x1,f.offsetLeft+f.offsetWidth);y1=Math.max(y1,f.offsetTop+f.offsetHeight);}return {x:x0-40,y:y0-40,w:x1-x0+80,h:y1-y0+80};}
 function fit(){const r=vp().getBoundingClientRect(),e=extent();s=clampS(Math.min(r.width/e.w,r.height/e.h)*0.96);tx=(r.width-e.w*s)/2-e.x*s;ty=(r.height-e.h*s)/2-e.y*s;apply();}
 function center(el){const r=vp().getBoundingClientRect(),x=el.offsetLeft+el.offsetWidth/2,y=el.offsetTop+Math.min(el.offsetHeight/2,r.height/2/s-20);s=Math.max(s,0.8);tx=r.width/2-x*s;ty=r.height/2-y*s;apply();}
 function toWorld(cx,cy){const r=vp().getBoundingClientRect();return {x:(cx-r.left-tx)/s,y:(cy-r.top-ty)/s};}
 function sizeWorld(){const e=extent(),w=Math.max(1200,e.x+e.w+400),h=Math.max(800,e.y+e.h+400),wd=world(),svg=$('.sm-links');wd.style.width=w+'px';wd.style.height=h+'px';svg.setAttribute('width',w);svg.setAttribute('height',h);}

 /* ---------- rendering ---------- */
 const blobUrl=id=>'/api/sources/blob?id='+encodeURIComponent(id);
 function kindLabel(b){if(b.kind==='guidance'&&b.origin==='machine')return b.label||('From '+who(b.by));const base=b.label||(b.kind==='question'&&b.origin==='human'?'Question for yourself':KIND[b.kind]);return b.origin==='machine'?base+(b.proposal?' · proposed by ':' · from ')+who(b.by):base;}
 function holdHTML(b){if(NO_HOLD.has(b.kind))return '';return '<button class="sm-hold" type="button" aria-pressed="'+!!b.held+'">'+(b.held?'Held':'Hold')+'</button>';}
 function optsHTML(b){const opts=b.options?.length?b.options:b.kind==='feeling'?FEELING:[];if(!opts.length)return '';return '<div class="sm-opts">'+opts.map(o=>'<button type="button" data-pick="'+esc(o)+'" aria-pressed="'+(b.pick===o)+'">'+esc(o)+'</button>').join('')+'</div>';}
 function statusHTML(b){const t=b.status||(b.kind==='consent'?'Not asked':b.kind==='check'?'Not yet checked':'');if(!t)return '';return '<span class="sm-status'+(/^checked|^asked|agreed/i.test(t)?' ok':'')+'">'+esc(t)+'</span>';}
 function wave(seed){let h='';for(let i=0;i<40;i++){const v=6+Math.abs(Math.sin(i*1.7+seed)*13+Math.cos(i*.6)*5),hot=i>23&&i<30;h+='<i class="'+(hot?'hot':'')+'" style="height:'+(hot?3:Math.round(v))+'px"></i>';}return h;}
 function body(b){
  switch(b.kind){
   case 'photo':return '<img src="'+(b.photo?esc(blobUrl(b.photo.sourceId)):'')+'" alt="'+esc(b.caption||'Photo')+'" loading="lazy"><span class="sm-who">'+esc(b.caption||'')+'</span>';
   case 'passage':return '<p class="sm-speech">“'+esc(b.text)+'”</p><span class="sm-who">'+esc(b.source?.speaker||b.source?.title||'Library')+' · exact words</span>';
   case 'mine':return '<p class="sm-speech sm-empty-text">'+(b.text?'“'+esc(b.text)+'”':'')+'</p><span class="sm-who">You'+(b.dictated?' · said in chat':'')+'</span>';
   case 'letter':{const l=b.letter||{},part=(h,t)=>t?'<h4>'+h+'</h4><p>'+esc(t)+'</p>':'';return '<div class="sm-letter">'+(b.letter?part('What keeps coming back',l.recurs)+part('Where your voice changed',l.voice)+part('Still unresolved',l.unresolved):'<p>'+esc(b.text)+'</p>')+'</div>';}
   case 'note':return '<p class="sm-clamp sm-empty-text">'+esc(b.text)+'</p>';
   case 'concept':return '<p class="sm-term">'+esc(b.term||'')+(b.termNative?' <span>'+esc(b.termNative)+'</span>':'')+'</p><p>'+esc(b.text)+'</p>';
   case 'question':return '<p class="sm-empty-text">'+esc(b.text)+'</p><p class="sm-answer">'+esc(b.answer||'')+'</p>';
   case 'choice':case 'feeling':case 'thread':return '<p class="sm-empty-text">'+esc(b.text)+'</p>'+optsHTML(b);
   case 'check':case 'consent':return '<p class="sm-clamp sm-empty-text">'+esc(b.text)+'</p>'+statusHTML(b);
   case 'voice':return '<div class="sm-row"><button class="sm-play" type="button" aria-label="Play this moment" '+(b.audio?'':'disabled title="No recording is linked to this moment"')+'>▶</button><div class="sm-wave" aria-hidden="true">'+wave(b.id.length)+'</div></div><p>'+esc(b.text)+'</p>';
   default:return '<p>'+esc(b.text)+'</p>';
  }
 }
 function blockEl(b){const el=document.createElement('div');el.className='sm-blk'+(b.wide?' wide':'')+(b.kind==='mine'||b.kind==='note'?' mine':'')+(b.origin==='machine'?' machine':'');el.tabIndex=0;el.dataset.id=b.id;el.dataset.kind=b.kind;el.innerHTML='<div class="sm-bh"><span class="sm-kind">'+esc(kindLabel(b))+'</span>'+holdHTML(b)+'</div>'+body(b);const img=el.querySelector('img');if(img)img.addEventListener('load',()=>sizeBlock(el),{once:true});return el;}
 function frameEl(g){const f=document.createElement('section');f.className='sm-frame'+(g.resting?' resting':'');f.dataset.id=g.id;f.style.cssText='left:'+g.x+'px;top:'+g.y+'px;width:'+(g.w||502)+'px';f.innerHTML='<div class="sm-fh"><h3 '+(g.resting?'':'contenteditable="true" ')+'spellcheck="false">'+esc(g.title)+'</h3>'+(g.sub||g.resting?'<span class="sub">'+esc(g.sub||'wakes when new material touches it')+'</span>':'')+'</div><div class="sm-inner"></div>';const inner=f.querySelector('.sm-inner');for(const b of g.blocks)inner.append(blockEl(b));addTile(inner);return f;}
 function addTile(inner){const t=document.createElement('button');t.type='button';t.className='sm-addtile';t.textContent='+ Add';inner.append(t);}
 function render(){
  const w=world();w.querySelectorAll('.sm-frame,.sm-hint').forEach(n=>n.remove());
  if(!board.groups.length){const g=document.createElement('section');g.className='sm-frame ghost';g.dataset.ghost='';g.style.cssText='left:40px;top:40px;width:502px';g.innerHTML='<div class="sm-fh"><h3>Your first group</h3><span class="sub">nothing here yet</span></div><div class="sm-inner"></div>';addTile(g.querySelector('.sm-inner'));w.append(g);const h=document.createElement('p');h.className='sm-hint';h.style.top='260px';h.textContent='Add a note, a photo or a passage to start. Drop photos onto a group; double-click empty board for another group.';w.append(h);}
  for(const g of board.groups)w.append(frameEl(g));
  buildNav();renderForming();requestAnimationFrame(()=>layout());
 }

 /* ---------- snapping grid inside groups ---------- */
 function sizeBlock(b){b.style.gridRowEnd='';const h=b.getBoundingClientRect().height/(mobile.matches?1:s);b.style.gridRowEnd='span '+Math.max(1,Math.ceil((h+RGAP)/(ROW+RGAP)));}
 function layout(scope){(scope||world()).querySelectorAll('.sm-inner > .sm-blk, .sm-inner > .sm-addtile, .sm-inner > .sm-addpick').forEach(sizeBlock);settle();sizeWorld();drawLinks();}
 // A group that grows pushes the groups below it down, so groups never overlap.
 function settle(){if(mobile.matches)return;const fs=$$('.sm-frame').sort((a,b)=>a.offsetTop-b.offsetTop);let moved=false;
  for(let i=0;i<fs.length;i++)for(let j=i+1;j<fs.length;j++){const a=fs[i],b=fs[j],xo=a.offsetLeft<b.offsetLeft+b.offsetWidth&&b.offsetLeft<a.offsetLeft+a.offsetWidth,need=a.offsetTop+a.offsetHeight+40;if(xo&&b.offsetTop<need&&b.offsetTop>=a.offsetTop){b.style.transition='top .22s cubic-bezier(.2,.7,.2,1)';b.style.top=need+'px';const g=groupOf(b.dataset.id);if(g&&g.y!==need){g.y=need;moved=true;}}}
  if(moved)queueSave();}
 function flip(inner,mutate){const first=new Map();[...inner.children].forEach(el=>first.set(el,el.getBoundingClientRect()));mutate();[...inner.children].forEach(el=>{const f=first.get(el);if(!f||el.classList.contains('sm-slot'))return;const l=el.getBoundingClientRect(),dx=(f.left-l.left)/(mobile.matches?1:s),dy=(f.top-l.top)/(mobile.matches?1:s);if(!dx&&!dy)return;el.style.transition='none';el.style.transform='translate('+dx+'px,'+dy+'px)';requestAnimationFrame(()=>{el.style.transition='transform .22s cubic-bezier(.2,.7,.2,1)';el.style.transform='';});});}
 // The DOM order after a drag is the truth; carry it back into the board.
 function syncOrder(){const all=new Map();for(const g of board.groups)for(const b of g.blocks)all.set(b.id,b);for(const f of $$('.sm-frame[data-id]')){const g=groupOf(f.dataset.id);if(!g)continue;g.blocks=[...f.querySelectorAll(':scope>.sm-inner>.sm-blk')].map(el=>all.get(el.dataset.id)).filter(Boolean);g.x=f.offsetLeft;g.y=f.offsetTop;}}

 /* ---------- connectors ---------- */
 function drawLinks(){if(mobile.matches)return;let d='';for(const [a,b] of board.links||[]){const A=$('.sm-blk[data-id="'+CSS.escape(a)+'"]'),B=$('.sm-blk[data-id="'+CSS.escape(b)+'"]');if(!A||!B)continue;const p=pos(A),q=pos(B),ax=p.x+p.w/2,ay=p.y+p.h/2,bx=q.x+q.w/2,by=q.y+q.h/2,mx=(ax+bx)/2;d+='<path d="M'+ax+' '+ay+' C '+mx+' '+ay+', '+mx+' '+by+', '+bx+' '+by+'"/>';}$('.sm-links').innerHTML=d;}
 function pos(el){const r=el.getBoundingClientRect(),w=toWorld(r.left,r.top);return {x:w.x,y:w.y,w:r.width/s,h:r.height/s};}

 /* ---------- groups ---------- */
 function buildNav(){const nav=$('.sm-groups');nav.querySelectorAll('button').forEach(b=>b.remove());for(const g of board.groups){const b=document.createElement('button');b.type='button';b.dataset.go=g.id;b.textContent=g.title||'Unnamed group';nav.append(b);}nav.hidden=!board.groups.length;}
 function newGroup(x,y,title='New group'){const g={id:uid('g'),title,sub:'',x:Math.round(x/GRID)*GRID,y:Math.round(y/GRID)*GRID,w:502,resting:false,origin:'human',by:actor(),blocks:[]};board.groups.push(g);const ghost=$('.sm-frame[data-ghost]');ghost?.remove();$('.sm-hint')?.remove();const f=frameEl(g);world().append(f);buildNav();layout(f);queueSave();return f;}

 /* ---------- adding ---------- */
 const TEMPLATES={note:{kind:'note',wide:false},mine:{kind:'mine',wide:true},question:{kind:'question',wide:true},check:{kind:'check',wide:true,status:'Not yet checked'},feeling:{kind:'feeling',wide:true}};
 function openPicker(tile){
  let inner=tile.parentElement;const p=document.createElement('div');p.className='sm-addpick';
  p.innerHTML='<button type="button" data-k="note">Note</button><button type="button" data-k="mine">Your words</button><button type="button" data-k="question">Question for yourself</button><button type="button" data-k="check">Something to check</button><button type="button" data-k="feeling">Feeling check</button><button type="button" data-k="passage">Passage from Library</button><label>Photo from your files<input type="file" accept="image/*" multiple hidden></label><button type="button" data-k="cancel" class="sm-quiet">Cancel</button>';
  inner.replaceChild(p,tile);sizeBlock(p);
  const ensure=()=>{const f=inner.closest('.sm-frame');if(f.hasAttribute('data-ghost')){const nf=newGroup(f.offsetLeft,f.offsetTop,'First group');inner=nf.querySelector('.sm-inner');}return inner;};
  p.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;p.replaceWith(tile);if(k==='cancel'){layout(inner);return;}const target=ensure();if(k==='passage'){openSearch(target);return;}const t=TEMPLATES[k],block={id:uid('b'),...t,origin:'human',by:actor(),text:''};const g=groupOf(target.closest('.sm-frame').dataset.id);g.blocks.push(block);const el=blockEl(block);target.insertBefore(el,target.querySelector('.sm-addtile'));layout(target);openEditor(el,true);});
  p.querySelector('input').addEventListener('change',e=>{const files=[...e.target.files];p.replaceWith(tile);const target=ensure();void addFiles(files,target);});
 }
 async function addFiles(files,inner){
  files=files.filter(f=>/^image\//.test(f.type));if(!files.length)return;const g=groupOf(inner.closest('.sm-frame').dataset.id);if(!g)return;
  for(const file of files){note('Adding '+file.name+' to Library…','talk');try{const base64=await new Promise((ok,bad)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>bad(r.error);r.readAsDataURL(file);});const v=await call('/api/sources/import',{method:'POST',body:JSON.stringify({rootId:'library',folder:'',urls:[],files:[{name:file.name,base64}]})}),receipt=(v.receipts||[])[0];if(!receipt?.ok||!receipt.source?.id)throw Error(receipt?.error||file.name+' was not added.');const block={id:uid('b'),kind:'photo',origin:'human',by:actor(),text:'',wide:false,photo:{sourceId:receipt.source.id},caption:file.name.replace(/\.[^.]+$/,'')};g.blocks.push(block);const el=blockEl(block);inner.insertBefore(el,inner.querySelector('.sm-addtile'));sizeBlock(el);layout(inner);queueSave();note('');}catch(error){note((file.name+': '+(error.message||'could not be added.')));}}
 }
 // His exact words come from Library: type them as he said them; the search finds the source and its position.
 function openSearch(inner){
  current=null;const ed=editor();ed.className='sm-editor';ed.innerHTML='<div class="sm-eh"><span class="sm-kind">Passage from Library</span><button type="button" class="sm-quiet x" data-act="cancel">Close</button></div><div class="sm-field"><label for="sm-q">Type his words exactly as they are in the transcript</label><input type="search" id="sm-q" autocomplete="off" placeholder="A few exact words"></div><ul class="sm-results"></ul><p class="sm-emsg" role="status"></p>';
  ed.dataset.target=inner.closest('.sm-frame').dataset.id;show();const q=ed.querySelector('#sm-q');setTimeout(()=>q.focus({preventScroll:true}),60);
  let token=0;q.addEventListener('input',()=>{const text=q.value,mine=++token;clearTimeout(q._t);q._t=setTimeout(async()=>{const list=ed.querySelector('.sm-results'),msg=ed.querySelector('.sm-emsg');if(text.trim().length<3){list.innerHTML='';msg.textContent='';return;}try{const v=await call('/api/concept/sources/search',{method:'POST',body:JSON.stringify({query:text,limit:8})});if(mine!==token)return;msg.textContent=v.results.length?'':'No Library text contains exactly these words.';list.innerHTML=v.results.map((r,i)=>{const at=r.context.indexOf(text),pre=at<0?'':r.context.slice(Math.max(0,at-90),at),post=at<0?'':r.context.slice(at+text.length,at+text.length+90);return '<li><button type="button" data-result="'+i+'"><span>…'+esc(pre)+'<b>'+esc(text)+'</b>'+esc(post)+'…</span><small>'+esc(r.title)+'</small></button></li>';}).join('');list._results=v.results;list._query=text;}catch(error){msg.textContent=error.message;}},250);});
 }
 function pickResult(i){const ed=editor(),list=ed.querySelector('.sm-results'),r=list._results?.[i],quote=list._query;if(!r||!quote)return;const g=groupOf(ed.dataset.target);if(!g)return;const block={id:uid('b'),kind:'passage',origin:'human',by:actor(),text:quote,wide:true,source:{sourceId:r.sourceId,sourceHash:r.sourceHash,quote,start:r.start,title:r.title,speaker:''}};g.blocks.push(block);const inner=$('.sm-frame[data-id="'+CSS.escape(g.id)+'"] .sm-inner'),el=blockEl(block);inner.insertBefore(el,inner.querySelector('.sm-addtile'));hide();layout(inner);queueSave();}

 /* ---------- editor: a block opened for editing ---------- */
 function field(label,bind,value,ph){return '<div class="sm-field"><label>'+esc(label)+'</label><div contenteditable="true" data-bind="'+bind+'" data-ph="'+esc(ph||'Type')+'">'+esc(value||'')+'</div></div>';}
 function openEditor(el,isNew){
  const found=blockOf(el.dataset.id);if(!found)return;const {g,b}=found;current={el,id:b.id,isNew};const mine=b.kind==='mine'||b.kind==='note',own=b.origin==='human';
  let html='<div class="sm-eh"><span class="sm-kind">'+esc(kindLabel(b))+'</span><button type="button" class="sm-quiet x" data-act="close">Close</button></div>';
  if(b.kind==='photo')html+='<img src="'+esc(b.photo?blobUrl(b.photo.sourceId):'')+'" alt="'+esc(b.caption||'')+'">'+field('Caption','caption',b.caption,'What is this?')+field('Who is in it','people',b.people,'Names, and whether they agreed to be shown');
  else if(b.kind==='passage')html+='<p class="sm-speech">“'+esc(b.text)+'”</p><p class="sm-who">'+esc(b.source?.speaker||b.source?.title||'')+' · exact words</p><p class="sm-protected">His exact words are protected. They can be quoted, never changed.</p>'+field('Your reading of it','reading',b.reading,'What do you hear in this?');
  else if(b.kind==='question')html+=(own?field('Question','text',b.text,'Write the question'):'<p>'+esc(b.text)+'</p>')+field('Your answer','answer',b.answer,'Type it');
  else if(b.kind==='concept')html+='<p class="sm-term">'+esc(b.term||'')+(b.termNative?' <span>'+esc(b.termNative)+'</span>':'')+'</p>'+field('What it means here','text',b.text);
  else if(mine&&b.dictated)html+='<p class="sm-protected">You said this in chat and '+esc(who(b.dictated.carriedBy)==='Adrian'?'saved it':who(b.dictated.carriedBy)+' carried it here')+' word for word. The original stays in your Library; change it here and it becomes your typed words.</p>'+field('Your words','text',b.text,'Something you said or want to say');
  else if(mine)html+=field(b.kind==='mine'?'Your words (your own, so you can refine them)':'Note','text',b.text,b.kind==='mine'?'Something you said or want to say':'Type');
  else if(own&&(b.kind==='check'||b.kind==='feeling'))html+=field(b.kind==='check'?'What should be looked into?':'What are you checking?','text',b.text)+(b.kind==='feeling'?optsHTML(b):statusHTML(b));
  else html+=body(b);
  const opts=board.groups.map(x=>'<option value="'+esc(x.id)+'"'+(x===g?' selected':'')+'>'+esc(x.title||'Unnamed group')+'</option>').join('');
  html+='<div class="sm-eactions"><label class="sm-who" for="sm-move">Group</label><select id="sm-move" data-act="move">'+opts+'</select>'+(NO_HOLD.has(b.kind)?'':'<button type="button" data-act="hold" aria-pressed="'+!!b.held+'">'+(b.held?'Held':'Hold')+'</button>')+'<button type="button" data-act="talk">Talk</button>'+(own?'<button type="button" class="sm-quiet" data-act="remove">Remove</button>':'')+'<button type="button" class="sm-primary push" data-act="close">Done</button></div><p class="sm-emsg" role="status"></p>';
  const ed=editor();ed.className='sm-editor'+(mine?' mine':'');ed.innerHTML=html;delete ed.dataset.target;show(el);
  setTimeout(()=>{if(current?.id===b.id)(ed.querySelector('[contenteditable]')||ed.querySelector('[data-act=close]'))?.focus({preventScroll:true});},mobile.matches?0:300);
 }
 function show(from){
  const ed=editor(),sc=scrim(),v=vp();ed.hidden=false;sc.hidden=false;v.scrollLeft=0;v.scrollTop=0;
  if(from&&!mobile.matches&&!matchMedia('(prefers-reduced-motion:reduce)').matches){ed.style.transition='none';ed.style.transform='translate(-50%,-50%)';ed.style.opacity='1';const er=ed.getBoundingClientRect(),br=from.getBoundingClientRect();ed.style.transform='translate(-50%,-50%) translate('+(br.left-er.left)+'px,'+(br.top-er.top)+'px) scale('+(br.width/er.width)+','+(br.height/er.height)+')';ed.style.opacity='.4';requestAnimationFrame(()=>requestAnimationFrame(()=>{ed.style.transition='transform .28s cubic-bezier(.2,.7,.2,1), opacity .2s';ed.style.transform='translate(-50%,-50%)';ed.style.opacity='1';sc.classList.add('on');}));}
  else{ed.style.transition='none';ed.style.transform='translate(-50%,-50%)';ed.style.opacity='1';sc.classList.add('on');}
 }
 function hide(){const ed=editor();scrim().classList.remove('on');ed.hidden=true;scrim().hidden=true;ed.innerHTML='';}
 function writeBack(){
  if(!current)return;const found=blockOf(current.id);if(!found)return;const {b}=found;let changed=false;
  editor().querySelectorAll('[data-bind]').forEach(f=>{const v=f.innerText.replace(/\n+$/,'').trim(),k=f.dataset.bind;if((b[k]||'')!==v){
   // Words carried from a chat stay stamped only while they are exactly what he said; his own edit makes them typed words.
   if(k==='text'&&b.dictated&&v===(b.text||'').trim())return;b[k]=v;if(k==='text'&&b.dictated&&b.kind==='mine'){delete b.dictated;delete b.source;}changed=true;}});
  if(changed){const old=current.el,el=blockEl(b);old.replaceWith(el);current.el=el;sizeBlock(el);layout(el.closest('.sm-inner'));renderForming();queueSave();}
 }
 function closeEditor(){if(!current){hide();return;}writeBack();const {el,id,isNew}=current,found=blockOf(id);current=null;hide();
  // A new note left empty is not kept.
  if(isNew&&found&&!found.b.text&&!found.b.answer){found.g.blocks=found.g.blocks.filter(x=>x.id!==id);el.remove();layout();queueSave();return;}
  (dlg.querySelector('.sm-blk[data-id="'+CSS.escape(id)+'"]')||el).focus({preventScroll:true});}
 function moveTo(groupId){if(!current)return;writeBack();const found=blockOf(current.id),g=groupOf(groupId);if(!found||!g||found.g===g)return;found.g.blocks=found.g.blocks.filter(x=>x!==found.b);g.blocks.push(found.b);const el=$('.sm-blk[data-id="'+CSS.escape(found.b.id)+'"]'),from=el.parentElement,to=$('.sm-frame[data-id="'+CSS.escape(g.id)+'"] .sm-inner');flip(from,()=>flip(to,()=>to.insertBefore(el,to.querySelector('.sm-addtile'))));setTimeout(()=>layout(),260);queueSave();}
 function setHold(id,on){const found=blockOf(id);if(!found)return;found.b.held=on;const btn=$('.sm-blk[data-id="'+CSS.escape(id)+'"] .sm-hold');if(btn){btn.setAttribute('aria-pressed',String(on));btn.textContent=on?'Held':'Hold';}renderForming();queueSave();}
 function pick(id,value,btn){const found=blockOf(id);if(!found)return;const b=found.b;b.pick=b.pick===value?'':value;const group=btn.closest('.sm-opts');group.querySelectorAll('[data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pick===b.pick)));const blk=$('.sm-blk[data-id="'+CSS.escape(id)+'"]');if(blk&&blk!==btn.closest('.sm-blk'))blk.querySelectorAll('[data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pick===b.pick)));if(b.reader&&b.pick){board.forming.sentence.reader=b.pick.toLowerCase();renderForming();}queueSave();}

 /* ---------- Forming: what's holding, the dish, the sentence ---------- */
 const label=b=>(KIND[b.kind]||'Block')+': '+String(b.kind==='photo'?b.caption||'photo':b.kind==='concept'?b.term||b.text:b.text||'').slice(0,60);
 function renderForming(){
  if(!dlg)return;const held=[];for(const g of board.groups)for(const b of g.blocks)if(b.held)held.push(b);
  const ul=$('.sm-held');ul.innerHTML=held.length?held.map(b=>'<li><span>'+esc(label(b))+'</span><button type="button" data-open="'+esc(b.id)+'">Open</button><button type="button" data-letgo="'+esc(b.id)+'">Let go</button></li>').join(''):'<li class="empty">Hold anything on the board and it lands here.</li>';
  const dishes=board.forming.dishes||[];$('.sm-dishes').innerHTML=dishes.length?dishes.map(d=>'<button type="button" data-dish="'+esc(d.id)+'" aria-pressed="'+(board.forming.dish===d.id)+'">'+esc(d.title)+(d.why?'<small>'+esc(d.why)+'</small>':'')+'</button>').join(''):'<p class="empty">Possible dishes show up here as the board fills. Or name it yourself in the sentence below.</p>';
  const nm=$('.sm-named'),named=board.forming.named;if(nm){nm.hidden=!named;nm.innerHTML=named?'<h4>You named it in chat</h4><p class="sm-speech">“'+esc(named.text)+'”</p><p class="sm-who">'+(named.direction==='saved'?'Saved in Direction as your sentence.':esc(named.reason||'Not in Direction yet.'))+'</p>':'';}
  const sen=board.forming.sentence;for(const k of ['about','really','dish','reader']){const n=$('[data-sentence="'+k+'"]');if(n&&document.activeElement!==n&&n.textContent!==sen[k])n.textContent=sen[k]||'';}
  const ft=$('[data-sm="forming"]');ft.innerHTML='Forming'+(held.length?'<span class="n" aria-label="'+held.length+' held">'+held.length+'</span>':'');
 }
 async function send(){
  const msg=$('.sm-msg'),sen=board.forming.sentence,miss=[['about','what it is about'],['really','what it is really about'],['dish','the dish'],['reader','the reader']].filter(([k])=>!(sen[k]||'').trim()).map(x=>x[1]);
  msg.className='sm-msg';if(miss.length){msg.textContent='Still open: '+miss.join(', ')+'. Type it when you can say it.';return;}
  if(!human()){msg.textContent='Only Adrian sends the sentence to Direction.';return;}
  const btn=$('[data-sm="send"]');btn.disabled=true;msg.textContent='Saving to Direction…';
  try{
   await flush();if(stale)throw Error('Reload the board first; it changed somewhere else.');
   const pid=ctx.subject,sentence='This is about '+sen.about.trim()+'. Really it\'s about '+sen.really.trim()+'. It\'s '+sen.dish.trim()+' for '+sen.reader.trim()+'.';
   const noFolder=error=>{if(error.status===404&&/collection/i.test(error.message))throw Error('This subject has no project folder yet, so its direction cannot be saved. The sentence stays here on the board.');throw error;};
   let concept;try{concept=await call('/api/concept?parentStudyId='+encodeURIComponent(pid),{method:'GET'});}catch(error){if(error.status!==404)throw error;await call('/api/concepts',{method:'POST',body:JSON.stringify({parentStudyId:pid,title:ctx.title||'Untitled subject',operationId:crypto.randomUUID()})}).catch(noFolder);concept=await call('/api/concept?parentStudyId='+encodeURIComponent(pid),{method:'GET'});}
   if(concept.structured===false)throw Error('Direction already has hand-written text. Open Direction and add the sentence there; nothing was replaced.');
   const held=[];for(const g of board.groups)for(const b of g.blocks)if(b.held)held.push(b);
   const refs=[...(concept.sourceSelections||[]).map(({sourceId,sourceHash,quote,start})=>({sourceId,sourceHash,quote,start}))];for(const b of held)if(b.kind==='passage'&&b.source&&!refs.some(r=>r.sourceId===b.source.sourceId&&r.start===b.source.start&&r.quote===b.source.quote))refs.push({sourceId:b.source.sourceId,sourceHash:b.source.sourceHash,quote:b.source.quote,start:b.source.start});
   let thoughts=concept.authorThoughts||'';for(const b of held)if((b.kind==='mine'||b.kind==='note')&&b.text&&!thoughts.includes(b.text))thoughts+=(thoughts?'\n\n':'')+b.text;
   await call('/api/concept/save',{method:'POST',body:JSON.stringify({parentStudyId:pid,operationId:crypto.randomUUID(),expectedRevision:concept.revision,expectedHash:concept.hash,authorThoughts:thoughts,adoptedDirection:sentence,aiInterpretation:concept.aiInterpretation||'',suggestions:concept.suggestions||'',sourceSelections:refs.slice(0,20)})});
   board.forming.sentAt=new Date().toISOString();queueSave();await flush();
   msg.className='sm-msg ok';msg.textContent='Saved as this subject\'s direction'+(refs.length>20?' (the first 20 held passages)':'')+'. Opening Direction…';
   await openDirection();
  }catch(error){msg.className='sm-msg';msg.textContent=error.message||'Not sent.';}
  finally{btn.disabled=false;}
 }
 async function openDirection(){const storyId=ctx.storyId;close();try{if(storyId&&window.combinedSubjects?.open){await window.combinedSubjects.open({projectId:storyId});await window.combinedSubjects.openStage(4);return;}if(window.projectLibrary?.close)await window.projectLibrary.close();await window.combinedNavigation?.go?.('direction');}catch(error){console.warn('Simmer: Direction did not open',error);}}

 /* ---------- pointer: pan, drag group, drag block, click to edit ---------- */
 function frameAt(x,y){let hit=null;for(const f of $$('.sm-frame[data-id]'))if(x>=f.offsetLeft&&x<=f.offsetLeft+f.offsetWidth&&y>=f.offsetTop&&y<=f.offsetTop+f.offsetHeight)hit=f;return hit;}
 function onDown(e){
  if(!editor().hidden||e.button>0)return;const t=e.target;if(t.closest('button,[contenteditable],input,label,select,.sm-addpick'))return;if(mobile.matches)return;
  const blk=t.closest('.sm-blk');
  if(blk)mode={type:'press',el:blk,sx:e.clientX,sy:e.clientY};
  else if(t.closest('.sm-fh')&&t.closest('.sm-frame[data-id]')){const f=t.closest('.sm-frame'),w=toWorld(e.clientX,e.clientY);mode={type:'frame',el:f,ox:w.x-f.offsetLeft,oy:w.y-f.offsetTop};}
  else{mode={type:'pan',sx:e.clientX,sy:e.clientY,tx,ty};vp().classList.add('panning');}
  vp().setPointerCapture(e.pointerId);
 }
 function startBlockDrag(){const b=mode.el,r=b.getBoundingClientRect(),w=toWorld(mode.sx,mode.sy),p=toWorld(r.left,r.top),slot=document.createElement('div');slot.className='sm-slot'+(b.classList.contains('wide')?' wide':'');slot.style.gridRowEnd=b.style.gridRowEnd;const fl=b.cloneNode(true);fl.classList.add('sm-floater');fl.removeAttribute('tabindex');fl.dataset.id='';fl.style.width=(r.width/s)+'px';fl.style.left=p.x+'px';fl.style.top=p.y+'px';world().append(fl);const inner=b.parentElement;flip(inner,()=>{inner.insertBefore(slot,b);b.classList.add('gone');b.remove();});mode={type:'blk',el:b,fl,slot,ox:w.x-p.x,oy:w.y-p.y};}
 function onMove(e){
  if(!mode)return;
  if(mode.type==='press'){if(Math.hypot(e.clientX-mode.sx,e.clientY-mode.sy)>5)startBlockDrag();else return;}
  if(mode.type==='pan'){tx=mode.tx+(e.clientX-mode.sx);ty=mode.ty+(e.clientY-mode.sy);apply();return;}
  const w=toWorld(e.clientX,e.clientY);
  if(mode.type==='frame'){mode.el.style.transition='none';mode.el.style.left=Math.round(w.x-mode.ox)+'px';mode.el.style.top=Math.round(w.y-mode.oy)+'px';drawLinks();return;}
  mode.fl.style.left=(w.x-mode.ox)+'px';mode.fl.style.top=(w.y-mode.oy)+'px';
  const f=frameAt(w.x,w.y);$$('.sm-frame').forEach(x=>x.classList.toggle('drop',x===f));if(!f)return;
  const inner=f.querySelector('.sm-inner'),kids=[...inner.children].filter(c=>c.classList.contains('sm-blk'));let best=null,bd=1e9,after=false;
  for(const k of kids){const r=k.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(e.clientX-cx,e.clientY-cy);if(d<bd){bd=d;best=k;after=e.clientX>cx&&Math.abs(e.clientY-cy)<r.height/2||e.clientY>r.bottom-6;}}
  const ref=best?(after?best.nextSibling:best):inner.querySelector('.sm-addtile'),key=(best?best.dataset.id:'-')+':'+after+':'+f.dataset.id;if(key===lastTarget)return;lastTarget=key;
  const old=mode.slot.parentElement;flip(inner,()=>{if(old!==inner)flip(old,()=>inner.insertBefore(mode.slot,ref));else inner.insertBefore(mode.slot,ref);});drawLinks();
 }
 function onUp(){
  if(!mode)return;const m=mode;mode=null;vp().classList.remove('panning');
  if(m.type==='press'){openEditor(m.el);return;}
  if(m.type==='frame'){m.el.style.left=Math.round(parseFloat(m.el.style.left)/GRID)*GRID+'px';m.el.style.top=Math.round(parseFloat(m.el.style.top)/GRID)*GRID+'px';syncOrder();settle();sizeWorld();drawLinks();queueSave();return;}
  if(m.type==='blk'){const inner=m.slot.parentElement;m.el.classList.remove('gone');inner.replaceChild(m.el,m.slot);m.fl.remove();$$('.sm-frame').forEach(x=>x.classList.remove('drop'));sizeBlock(m.el);lastTarget=null;syncOrder();layout();queueSave();return;}
  if(m.type==='pan')apply();
 }

 /* ---------- the dialog ---------- */
 function shell(){
  const d=document.createElement('dialog');d.className='simmer';d.setAttribute('aria-label','Simmer');
  d.innerHTML='<div class="sm-bar"><span class="sm-title"><b></b> · Simmer<span class="sm-save" role="status"></span></span><div class="sm-zoom" aria-label="Zoom"><button type="button" class="sm-tb" data-sm="zout" aria-label="Zoom out">−</button><span>80%</span><button type="button" class="sm-tb" data-sm="zin" aria-label="Zoom in">+</button></div><button type="button" class="sm-tb" data-sm="fit" title="Zoom out to see every group">Fit</button><span class="sm-sep" aria-hidden="true"></span><button type="button" class="sm-tb" data-sm="talk"><span class="dot"></span>Talk</button><button type="button" class="sm-tb" data-sm="forming" aria-pressed="true" aria-controls="sm-forming">Forming</button><span class="sm-sep" aria-hidden="true"></span><button type="button" class="sm-tb" data-sm="leave">Leave</button></div>'
   +'<section class="sm-intake" hidden aria-label="Chat recovery" role="status"></section><nav class="sm-groups" aria-label="Groups"><span class="lbl">Go to</span></nav><div class="sm-note" hidden role="status"></div>'
   +'<div class="sm-body"><div class="sm-vp"><div class="sm-world"><svg class="sm-links" aria-hidden="true"></svg></div><div class="sm-scrim" hidden></div><div class="sm-editor" hidden role="dialog" aria-modal="true" aria-label="Edit block"></div></div>'
   +'<aside class="sm-forming" id="sm-forming" aria-label="Forming"><div><h2>Forming</h2><p class="intro">What\'s holding, and the dish taking shape. Nothing here is decided until you send it.</p></div><div class="sm-fsec"><h3>Holding</h3><ul class="sm-held"></ul></div><div class="sm-fsec"><h3>It could become</h3><div class="sm-dishes"></div></div><div class="sm-fsec"><h3>When you can say it</h3><div class="sm-named" hidden></div><p class="sm-sentence">This is about <span contenteditable="true" data-sentence="about" data-ph="the situation"></span>. Really it\'s about <span contenteditable="true" data-sentence="really" data-ph="the story"></span>. It\'s <span contenteditable="true" data-sentence="dish" data-ph="the dish"></span> for <span contenteditable="true" data-sentence="reader" data-ph="which reader"></span>.</p><button type="button" class="sm-primary" data-sm="send">Send to Direction</button><p class="sm-msg" aria-live="polite"></p></div></aside></div>';
  d.addEventListener('pointerdown',e=>{if(e.target.closest('.sm-vp'))onDown(e);});
  d.addEventListener('pointermove',onMove);d.addEventListener('pointerup',onUp);d.addEventListener('pointercancel',onUp);
  d.addEventListener('wheel',e=>{if(!e.target.closest('.sm-vp')||mobile.matches||!editor().hidden)return;e.preventDefault();const r=vp().getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoomAt(s*Math.exp(-e.deltaY*0.01),e.clientX-r.left,e.clientY-r.top);else{tx-=e.deltaX;ty-=e.deltaY;apply();}},{passive:false});
  d.addEventListener('dblclick',e=>{if(mobile.matches||!e.target.closest('.sm-vp')||e.target.closest('.sm-frame,.sm-editor'))return;const w=toWorld(e.clientX,e.clientY),f=newGroup(w.x,w.y),h=f.querySelector('h3');h.focus();getSelection()?.selectAllChildren(h);});
  d.addEventListener('click',onClick);
  d.addEventListener('input',e=>{const t=e.target;if(t.matches('.sm-fh h3')){const g=groupOf(t.closest('.sm-frame').dataset.id);if(g){g.title=t.textContent.trim();buildNav();queueSave();}}else if(t.dataset.sentence){board.forming.sentence[t.dataset.sentence]=t.textContent.trim();queueSave();}});
  d.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.sm-fh h3,[data-sentence]')){e.preventDefault();e.target.blur();}if(e.key==='Enter'&&e.target.classList?.contains('sm-blk')&&editor().hidden){e.preventDefault();openEditor(e.target);}});
  d.addEventListener('cancel',e=>{e.preventDefault();if(!editor().hidden)closeEditor();});
  d.querySelector('.sm-vp').addEventListener('scroll',e=>{if(!mobile.matches){e.currentTarget.scrollLeft=0;e.currentTarget.scrollTop=0;}});
  d.addEventListener('change',e=>{if(e.target.dataset.act==='move')moveTo(e.target.value);});
  d.addEventListener('dragover',e=>{if(![...(e.dataTransfer?.types||[])].includes('Files'))return;e.preventDefault();const f=e.target.closest?.('.sm-frame');$$('.sm-frame').forEach(x=>x.classList.toggle('drop',x===f));});
  d.addEventListener('dragleave',e=>{if(!e.relatedTarget||!d.contains(e.relatedTarget))$$('.sm-frame').forEach(x=>x.classList.remove('drop'));});
  d.addEventListener('drop',e=>{const f=e.target.closest?.('.sm-frame');$$('.sm-frame').forEach(x=>x.classList.remove('drop'));if(!f||!e.dataTransfer?.files?.length)return;e.preventDefault();let inner=f.querySelector('.sm-inner');if(f.hasAttribute('data-ghost'))inner=newGroup(f.offsetLeft,f.offsetTop,'First group').querySelector('.sm-inner');void addFiles([...e.dataTransfer.files],inner);});
  return d;
 }
 function onClick(e){
  const t=e.target,a=t.closest('[data-sm],[data-act],[data-go],[data-open],[data-letgo],[data-dish],[data-pick],[data-result],.sm-hold,.sm-addtile');
  if(!a){if(mobile.matches&&!t.closest('button,[contenteditable],input,label')){const b=t.closest('.sm-blk');if(b)openEditor(b);}return;}
  if(a.classList.contains('sm-addtile'))return openPicker(a);
  if(a.classList.contains('sm-hold')){const id=a.closest('.sm-blk')?.dataset.id;if(id)setHold(id,a.getAttribute('aria-pressed')!=='true');return;}
  if(a.dataset.pick!==undefined){const id=a.closest('.sm-blk')?.dataset.id||current?.id;if(id)pick(id,a.dataset.pick,a);return;}
  if(a.dataset.result!==undefined)return pickResult(Number(a.dataset.result));
  if(a.dataset.go){const f=$('.sm-frame[data-id="'+CSS.escape(a.dataset.go)+'"]');if(f){if(mobile.matches)f.scrollIntoView({behavior:'smooth',block:'start'});else center(f);}return;}
  if(a.dataset.open){const el=$('.sm-blk[data-id="'+CSS.escape(a.dataset.open)+'"]');if(el)openEditor(el);return;}
  if(a.dataset.letgo)return setHold(a.dataset.letgo,false);
  if(a.dataset.dish){const prev=(board.forming.dishes.find(d=>d.id===board.forming.dish)?.title||'').toLowerCase(),d=board.forming.dishes.find(x=>x.id===a.dataset.dish);board.forming.dish=board.forming.dish===d.id?null:d.id;const sen=board.forming.sentence,title=d.title.replace(/^./,c=>c.toLowerCase());if(board.forming.dish&&(!sen.dish||sen.dish===prev.replace(/^./,c=>c.toLowerCase())))sen.dish=title;renderForming();queueSave();return;}
  const act=a.dataset.act;
  if(act==='close')return closeEditor();if(act==='cancel')return hide();
  if(act==='hold'&&current){const on=a.getAttribute('aria-pressed')!=='true';a.setAttribute('aria-pressed',String(on));a.textContent=on?'Held':'Hold';return setHold(current.id,on);}
  if(act==='talk'){const m=editor().querySelector('.sm-emsg');if(m)m.textContent='Talk is not connected yet. Type here for now; it saves the same way.';return;}
  if(act==='remove'&&current){const found=blockOf(current.id),el=current.el;current=null;hide();if(found){found.g.blocks=found.g.blocks.filter(x=>x!==found.b);board.links=(board.links||[]).filter(l=>!l.includes(found.b.id));const inner=el.parentElement;flip(inner,()=>el.remove());layout(inner);renderForming();queueSave();}return;}
  const sm=a.dataset.sm,r=()=>vp().getBoundingClientRect();
  if(sm==='zin')return zoomAt(s*1.2,r().width/2,r().height/2);if(sm==='zout')return zoomAt(s/1.2,r().width/2,r().height/2);if(sm==='fit')return fit();
  if(sm==='talk')return note('Talk is not connected yet. Type into any block or the sentence for now.','talk');
  if(sm==='note-close')return note('');
  if(sm==='intake-refresh'){if(dirty||saving||stale)return note('Save or resolve your board edits before checking chat recovery.');return void reload();}
  if(sm==='reload')return void reload();
  if(sm==='forming'){const w0=r().width,on=a.getAttribute('aria-pressed')==='true';a.setAttribute('aria-pressed',String(!on));$('.sm-body').classList.toggle('noform',on);try{localStorage.setItem('simmer-forming',on?'off':'on');}catch{}if(!mobile.matches){tx+=(r().width-w0)/2;apply();}return;}
  if(sm==='send')return void send();
  if(sm==='leave')return void leave();
 }
 async function reload(){note('');stale=false;dirty=false;try{board=await readBoard(ctx.subject);normalize();render();status('Saved');}catch(error){note(error.message);}}
 function normalize(){intakeStatus();board.groups||=[];board.links||=[];board.forming||={};board.forming.dishes||=[];board.forming.sentence={about:'',really:'',dish:'',reader:'',...board.forming.sentence};}
 async function leave(){if(current)closeEditor();await flush();close();}
 function close(){clearTimeout(timer);if(dlg?.open)dlg.close();dlg?.remove();dlg=null;board=null;current=null;mode=null;const o=opener;opener=null;o?.isConnected&&o.focus?.({preventScroll:true});}

 /** Open the board for one subject: {subject: parentStudyId, title, storyId?}. */
 async function open({subject,title,storyId}={}){
  if(typeof subject!=='string'||!subject)throw Error('Choose a subject first.');
  if(dlg)close();opener=document.activeElement;ctx={subject,title:title||'',storyId:storyId||''};stale=false;dirty=false;
  dlg=shell();document.body.append(dlg);$('.sm-title b').textContent=ctx.title||'This subject';dlg.setAttribute('aria-label','Simmer: '+(ctx.title||'subject'));dlg.showModal();status('Opening…');
  try{const v=JSON.parse(localStorage.getItem('simmer-view:'+subject)||'null');if(v&&[v.s,v.tx,v.ty].every(Number.isFinite)){s=clampS(v.s);tx=v.tx;ty=v.ty;}else{s=0.8;tx=10;ty=10;}if(localStorage.getItem('simmer-forming')==='off'){$('[data-sm="forming"]').setAttribute('aria-pressed','false');$('.sm-body').classList.add('noform');}}catch{}
  try{board=await readBoard(subject);}catch(error){status('Not opened',true);note(error.message||'The board could not be read.');board={revision:0,hash:'',groups:[],links:[],forming:{}};stale=true;}
  normalize();if(!ctx.title&&board.title)ctx.title=board.title,$('.sm-title b').textContent=board.title;apply();render();if(!stale)status(board.revision?'Saved':'');
  (document.fonts?.ready||Promise.resolve()).then(()=>dlg&&layout());
 }
 // Escape closes an open block wherever focus is; it never leaves the board (Leave does).
 // Window capture runs before Home's own document-level Escape, which would otherwise close Home under the board.
 window.addEventListener('keydown',e=>{if(e.key!=='Escape'||!dlg?.open)return;e.preventDefault();e.stopImmediatePropagation();if(!editor().hidden)closeEditor();},true);
 mobile.addEventListener('change',()=>{if(!dlg)return;if(mobile.matches)world().style.transform='';else apply();layout();});
 // Home: any [data-simmer-open] control opens its subject.
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-simmer-open]');if(!b||b.disabled)return;e.preventDefault();void open({subject:b.dataset.simmerOpen,title:b.dataset.simmerTitle,storyId:b.dataset.simmerStory}).catch(error=>console.warn('Simmer did not open:',error));});
 window.addEventListener('pagehide',()=>{if(dirty)void flush();});
 window.arSimmer={open,close,flush,state:()=>board&&JSON.parse(JSON.stringify(board))};
})();
