// Instagram studio: what a voice transcript and photos could become on Instagram. Shows the two or three stories an
// agent found (each line with the photo matched to it, and the research worth doing), lets Adrian pick one or name his
// own, shows the made story, reel, post or carousel at real proportions, and takes his final yes. Opens from Media,
// Arrange and Outputs, or from a link ending #instagram=<plan id>. Nothing here posts or sends anything.
(function(){
 if(window.arInstagram)return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const actor=()=>window.arCreateUiActor?.actor||'human:adrian',isAdrian=()=>/^human:/.test(actor());
 const headers=()=>({'Content-Type':'application/json','X-AR-Actor':actor(),'X-AR-Client':'ui'});
 const who=by=>{const m=/^agent:(.+)$/.exec(by||'');if(!m)return 'you';return /^claude/.test(m[1])?'Claude':m[1].replace(/^./,c=>c.toUpperCase());};
 const FORMAT={story:'Story',reel:'Reel',post:'Post',carousel:'Carousel'},SIZE={story:[1080,1920],reel:[1080,1920],post:[1080,1350],carousel:[1080,1350]};
 const STATUS={open:'Open',checking:'Being checked',answered:'Answered',resting:'Resting'};
 let dlg=null,plan=null,plans=[],format=null,ctx={},busy=false,opener=null;
 let cat=null,looksList=[],acctFor={},assetsFor={},rolesFor={},proposals=[],nextCodes={},sel=0,tab='layout',filter='',saveOpen=false,said=null;
 const $=sel=>dlg.querySelector(sel);
 async function call(url,options={}){const r=await fetch(url,{cache:'no-store',...options,headers:{...headers(),...options.headers}}),v=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(v.error||'The request was refused ('+r.status+').'),{status:r.status});return v;}
 const blob=id=>'/api/sources/blob?id='+encodeURIComponent(id);
 const photo=id=>plan.material.photos.find(p=>p.id===id);
 const line=id=>plan.lines.find(l=>l.id===id);
 const hashtags=t=>[...String(t||'').matchAll(/(^|\s)#[\p{L}\p{N}_]+/gu)].length;
 const clock=sec=>{sec=Math.max(0,Math.round(sec||0));const h=Math.floor(sec/3600),m=Math.floor(sec/60)%60,x=sec%60;return (h?h+':'+String(m).padStart(2,'0'):String(m))+':'+String(x).padStart(2,'0');};
 const momentOf=lineId=>(plan.moments||[]).find(m=>m.lineIds.includes(lineId));
 const at=lineId=>{const m=momentOf(lineId);return m?(m.estimated?'about ':'')+clock(m.at):'';};
 const COVER={used:'Used','in-story':'In a proposed story',saved:'Saved for later',skipped:'Skipped on purpose',unplaced:'Not placed yet'};
 const useText=u=>[...new Set(u.map(x=>FORMAT[x.format]+(x.frame?' frame '+x.frame:' caption')))].join(', ');
 // The coverage strip: every moment of the recording along its timeline, coloured by where it went.
 function stripHTML(){
  const c=plan.coverage;if(!c||!c.total)return '';
  const end=Math.max(1,...c.moments.map(m=>m.until||m.at));
  const segs=c.moments.map(m=>'<button type="button" class="igs-seg s-'+m.status+'" style="flex-grow:'+Math.max(1,(m.until||m.at)-m.at)+'" data-igs="moment" data-id="'+esc(m.id)+'" title="'+esc(m.id+' · '+clock(m.at)+' · '+COVER[m.status]+(m.uses.length?': '+useText(m.uses):m.why?': '+m.why:''))+'" aria-label="'+esc(m.id+' at '+clock(m.at)+', '+COVER[m.status])+'"></button>').join('');
  const legend=Object.keys(COVER).map(k=>'<span class="igs-key"><i class="s-'+k+'"></i>'+esc(COVER[k])+' '+c.counts[k]+'</span>').join('');
  return '<section class="igs-cover" aria-label="Coverage of the whole recording"><div class="igs-cover-head"><span class="igs-lab">Every moment of the recording · '+c.total+' moments · '+clock(end)+'</span>'+(c.counts.unplaced?'<span class="igs-warn">'+c.counts.unplaced+' not placed yet</span>':'<span class="igs-ok">Nothing left unplaced</span>')+'</div><div class="igs-strip-time" role="group" aria-label="Moments along the timeline">'+segs+'</div><div class="igs-ticks"><span>0:00</span><span>'+clock(end/2)+'</span><span>'+clock(end)+'</span></div><div class="igs-legend">'+legend+'</div><div class="igs-moment" hidden></div></section>';
 }
 function momentDetail(id){
  const m=plan.moments.find(x=>x.id===id),c=plan.coverage.moments.find(x=>x.id===id),box=$('.igs-moment');if(!m||!box)return;
  box.hidden=false;box.innerHTML='<p class="igs-lab">'+esc(m.id)+' · '+(m.estimated?'about ':'')+esc(clock(m.at))+'–'+esc(clock(m.until))+' · '+esc(COVER[c.status])+(c.uses.length?' · '+esc(useText(c.uses)):'')+(c.why?' · '+esc(c.why):'')+'</p><p class="igs-speech igs-exact">'+esc(m.text)+'</p><p class="igs-dim">Exact words from the transcript, unchanged.</p>'
   +(isAdrian()?'<div class="igs-row"><button type="button" data-igs="mark" data-id="'+esc(m.id)+'" data-s="saved">Save for later</button><button type="button" data-igs="mark" data-id="'+esc(m.id)+'" data-s="skipped">Skip on purpose</button></div>':'');
 }
 const KIND={'tea-term':'Tea term',name:'Name or place',place:'Place',number:'Number',date:'Date',other:'Word'};
 function flagsHTML(){
  const st=new Map((plan.flagStatus||[]).map(x=>[x.id,x])),flags=plan.flags||[];if(!flags.length)return '';
  const open=flags.filter(f=>st.get(f.id)?.status==='open'),inUse=open.filter(f=>st.get(f.id)?.inUse);
  const row=f=>{const l=line(f.lineId),c=plan.confirmations?.[f.id];const before=l?l.text.slice(Math.max(0,f.start-48),f.start):'',after=l?l.text.slice(f.start+f.heard.length,f.start+f.heard.length+48):'';
   return '<li data-flag="'+esc(f.id)+'"><p class="igs-lab">'+esc(KIND[f.kind]||'Word')+' · '+esc(at(f.lineId))+(st.get(f.id)?.inUse?' · in use':'')+'</p><p class="igs-speech">'+(f.start>48?'…':'')+esc(before)+'<mark>'+esc(f.heard)+'</mark>'+esc(after)+(l&&f.start+f.heard.length+48<l.text.length?'…':'')+'</p>'+(f.suggestion?'<p class="igs-dim">The tea-term library writes it: '+esc(f.suggestion)+'</p>':'')
    +(c?'<p class="igs-ok">'+(c.verdict==='as-heard'?'You confirmed it as heard.':'You corrected it to “'+esc(c.correction)+'”.')+'</p>':isAdrian()?'<form class="igs-row" data-igs="confirm" data-id="'+esc(f.id)+'"><button type="button" data-igs="as-heard" data-id="'+esc(f.id)+'">As heard</button><input name="correction" maxlength="200" placeholder="Or what you said" aria-label="Your correction"><button type="submit">Correct it</button></form>':'<p class="igs-dim">Waiting for Adrian.</p>')+'</li>';};
  const shown=[...inUse,...flags.filter(f=>!inUse.includes(f))];
  return '<section aria-label="Words to confirm"><h2>Words to confirm</h2><p class="igs-dim">Heard but not certain: names, places, tea terms, numbers and dates. Nothing is corrected without you. '+(inUse.length?inUse.length+' in what is being made, '+(open.length-inUse.length)+' elsewhere.':open.length?open.length+' open, none in what is being made.':'All confirmed.')+'</p><ul class="igs-flags">'+shown.slice(0,inUse.length+6).map(row).join('')+'</ul>'+(shown.length>inUse.length+6?'<p class="igs-dim">'+(shown.length-inUse.length-6)+' more in moments not used yet.</p>':'')+'</section>';
 }
 function note(text,bad){const n=$('.igs-note');n.hidden=!text;n.className='igs-note'+(bad?' bad':'');n.textContent=text||'';}

 /* ---------- rendering ---------- */
 function storyCard(s){
  const chosen=plan.chosen?.storyId===s.id,heard=plan.heard?.storyId===s.id,gaps=plan.gaps.filter(g=>g.storyIds.includes(s.id));
  const lines=s.spine.map(id=>{const l=line(id);if(!l)return '';const ms=s.matches.filter(m=>m.lineId===id);
   return '<li class="igs-line">'+(ms.length?ms.map(m=>{const p=photo(m.photoId);return p?'<img src="'+esc(blob(p.sourceId))+'" alt="'+esc(p.caption||'Photo')+'" title="'+esc(m.why||p.caption||'')+'" loading="lazy">':'';}).join(''):'<span class="igs-nophoto" title="No photo matched this line">no photo</span>')+'<div><p class="igs-speech">“'+esc(l.text)+'”</p><span class="igs-who">'+esc([at(id),l.speaker].filter(Boolean).join(' · '))+'</span>'+(ms[0]?.why?'<span class="igs-why">'+esc(ms[0].why)+'</span>':'')+'</div></li>';}).join('');
  return '<article class="igs-story'+(chosen?' on':'')+'" data-story="'+esc(s.id)+'"><header><span class="igs-lab">'+esc(FORMAT[s.format]||'Story')+' · from '+esc(who(s.by))+'</span>'+(heard?'<span class="igs-heard" title="Recorded by '+esc(who(plan.heard.by))+'">You said in chat: “'+esc(plan.heard.quote)+'”</span>':'')+'</header>'
   +'<h3>'+esc(s.title)+'</h3><p class="igs-dish">'+esc(s.dish)+'</p>'+(s.why?'<p class="igs-dim">'+esc(s.why)+'</p>':'')+(s.reader?'<p class="igs-dim">For: '+esc(s.reader)+'</p>':'')
   +'<div class="igs-readback"><span class="igs-lab">What this says</span><p>'+esc(s.readback||'')+'</p>'+(s.meaning?'<p class="'+(s.meaning.verdict==='right'?'igs-ok':'igs-warn')+'">'+(s.meaning.verdict==='right'?'You said: that is it.':'You said: “'+esc(s.meaning.words)+'”')+'</p>':isAdrian()?'<div class="igs-row"><button type="button" data-igs="meant" data-id="'+esc(s.id)+'">That is it</button><button type="button" data-igs="not-meant" data-id="'+esc(s.id)+'">Not what I meant</button></div><form class="igs-notmeant" data-igs="meaning" data-id="'+esc(s.id)+'" hidden><textarea name="words" rows="3" maxlength="1200" placeholder="What you meant, in your words"></textarea><button type="submit">Save what I meant</button></form>':'')+'</div>'
   +'<ol class="igs-lines">'+lines+'</ol>'
   +(gaps.length?'<div class="igs-gaps-mini"><span class="igs-lab">Worth checking</span>'+gaps.map(g=>'<p>'+esc(g.question)+' <span class="igs-status">'+esc(STATUS[g.status])+'</span></p>').join('')+'</div>':'')
   +'<button type="button" class="'+(chosen?'igs-primary':'')+'" data-igs="choose" data-id="'+esc(s.id)+'" aria-pressed="'+chosen+'" '+(isAdrian()?'':'disabled title="Only Adrian picks the story"')+'>'+(chosen?'Chosen':'This one')+'</button></article>';
 }
 // The made frames, small, in a row that wraps. Each is a slide to open in the slide studio below, with its layout code.
 function framesHTML(l){
  const [w,h]=SIZE[l.format],cw=innerWidth<600?96:l.format==='post'||l.format==='carousel'?132:108,scale=cw/w;let t=0;
  return l.frames.map((f,i)=>{const src='/api/instagram/render?'+new URLSearchParams({id:plan.id,format:l.format,frame:String(i),r:String(plan.revision)}),png='/api/instagram/png?'+new URLSearchParams({id:plan.id,format:l.format,frame:String(i)});
   const time=f.seconds?'<span>'+Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+' · '+f.seconds+'s</span>':'';if(f.seconds)t+=f.seconds;
   const code=codeOf(f.templateId);
   return '<figure class="igs-frame'+(i===sel?' on':'')+'" style="width:'+cw+'px"><button type="button" class="igs-tile igs-clip" data-igs="slide" data-n="'+i+'" aria-pressed="'+(i===sel)+'" aria-label="Slide '+(i+1)+(code?', '+esc(code):'')+'" style="width:'+cw+'px;height:'+Math.round(h*scale)+'px"><iframe title="Frame '+(i+1)+'" src="'+esc(src)+'" loading="lazy" tabindex="-1" style="width:'+w+'px;height:'+h+'px;transform:scale('+scale+')"></iframe></button><figcaption><span>'+(i+1)+(code?' · <b class="igs-code">'+esc(code)+'</b>':'')+'</span>'+time+'<a href="'+esc(src)+'" target="_blank" rel="noopener">Full size</a>'+(held()?'<span class="igs-off" title="On hold for consent">PNG</span>':'<a href="'+esc(png)+'" download>PNG</a>')+'</figcaption></figure>';}).join('');
 }
 // The consent hold: the same check the server enforces on the yes, the PNGs and the reel words. Says who is unanswered and where to answer.
 // Files for posting are held only by a real hold; a plan with no piece to check against just cannot be marked ready yet.
 const held=()=>!!plan?.publishHold&&!plan.publishHold.unlinked;
 function holdHTML(hold,after){if(!hold)return '';if(hold.unlinked)return '<span class="ar-hold igs-hold" '+(after?'':'id="igs-hold-note" ')+'role="status">'+esc(hold.summary)+'</span>';return '<span class="ar-hold igs-hold" '+(after?'':'id="igs-hold-note" ')+'role="status">'+(after?'Held again for consent. ':'On hold for consent. ')+esc(hold.summary)+(hold.link?' <a class="ar-hold-link" href="'+esc(hold.link)+'" data-igs="consent">Open the consent desk ›</a>':'')+'</span>';}
 function madeHTML(){
  const made=Object.keys(plan.layouts);if(!made.length)return '<div class="igs-empty"><p><b>Nothing made yet.</b> Once you pick a story, Claude lays it out with one template per frame: your words exactly as you said them, a caption drafted for you to change.</p></div>';
  if(!made.includes(format)){const pick=plan.stories.find(x=>x.id===(plan.chosen?.storyId||plan.heard?.storyId));format=pick&&made.includes(pick.format)?pick.format:made[0];sel=0;}
  const l=plan.layouts[format];if(sel>=l.frames.length)sel=0;
  const story=plan.stories.find(s=>s.id===l.storyId),r=plan.ready?.[format];
  const otherStory=plan.chosen?.storyId&&plan.chosen.storyId!==l.storyId,caption=l.captionFinal??l.caption.text??'';
  const hold=plan.publishHold,reason=hold?(hold.unlinked?hold.summary:'On hold for consent'):!isAdrian()?'Only Adrian gives the final yes':!plan.chosen?'Pick or name the story first':otherStory?'This was made for another story than the one you chose':'';
  return '<div class="igs-tabs" role="tablist">'+Object.keys(FORMAT).map(f=>'<button type="button" role="tab" data-igs="format" data-f="'+f+'" aria-selected="'+(f===format)+'" '+(plan.layouts[f]?'':'disabled title="Not made yet"')+'>'+FORMAT[f]+(plan.ready?.[f]?' · ready':'')+'</button>').join('')+'</div>'
   +'<p class="igs-dim">'+esc(FORMAT[format])+' of “'+esc(story?.title||'a story')+'”, laid out by '+esc(who(l.builtBy))+'. '+l.frames.length+' frame'+(l.frames.length>1?'s':'')+(format==='reel'?' · '+Math.round(l.frames.reduce((a,f)=>a+(f.seconds||0),0))+' seconds · '+(held()?'<span class="igs-off" title="On hold for consent">On-screen words (.srt)</span>':'<a href="/api/instagram/captions?id='+esc(plan.id)+'" download>On-screen words (.srt)</a>'):'')+'</p>'
   +lookHTML()+sayHTML()
   +'<div class="igs-strip">'+framesHTML(l)+'</div>'+studioHTML(l)
   +'<details class="igs-said"><summary>On screen, word for word</summary><ol>'+l.frames.map((f,i)=>'<li><span class="igs-lab">Frame '+(i+1)+'</span>'+f.words.map(w=>'<p><span class="igs-speech">“'+esc(w.text)+'”</span> <span class="igs-who">'+esc(at(w.lineId))+(w.corrected?' · with your correction':'')+'</span></p>').join('')+'</li>').join('')+'</ol></details>'
   +((l.caption.parts||[]).length?'<div class="igs-parts"><span class="igs-lab">Caption, part by part</span>'+l.caption.parts.map(p=>p.kind==='quote'?'<p><span class="igs-tag">His words · '+esc(at(p.lineId))+'</span><span class="igs-speech">“'+esc(p.text)+'”</span></p>':p.kind==='suggested'?'<p><span class="igs-tag warn">Suggested wording</span>'+esc(p.text)+'<span class="igs-orig">Original, '+esc(at(p.lineId))+': <span class="igs-speech">“'+esc(p.original)+'”</span></span></p>':'<p><span class="igs-tag">Drafted by '+esc(who(l.caption.by))+'</span>'+esc(p.text)+'</p>').join('')+'</div>':'')
   +'<label class="igs-cap"><span class="igs-lab">Caption · '+(l.captionFinal!=null?'yours':l.caption.text?'drafted by '+esc(who(l.caption.by))+', yours to change':'not drafted yet')+'</span><textarea rows="5" maxlength="2200" data-igs="caption" '+(isAdrian()&&!r?'':'readonly')+'>'+esc(caption)+'</textarea><span class="igs-count" data-igs="count"></span></label>'
   +(r?'<p class="igs-ready">You said yes '+esc(new Date(r.at).toLocaleString())+'. Nothing was posted from here: post it yourself when you are ready.</p>'+holdHTML(hold,true)
     :'<div class="igs-go"><button type="button" class="igs-primary" data-igs="ready" '+(reason?'disabled title="'+esc(reason)+'"':'')+(hold?' aria-describedby="igs-hold-note"':'')+'>Ready to post</button>'+(hold?holdHTML(hold,false):'<span class="igs-dim">'+esc(reason||'Ready records your yes with this caption. Nothing is posted from here.')+'</span>')+'</div>');
 }
 function render(){
  const body=$('.igs-body');
  if(!plan){body.innerHTML='<div class="igs-empty igs-first"><h2>Nothing here yet</h2><p>This is where a voice note and photos become a story, reel, post or carousel.</p><ol><li>In a Claude chat, give it your voice transcript and photos and say “make Instagram from this”.</li><li>Claude files them in Library and brings back two or three possible stories, each line with its photo, and what is worth researching.</li><li>You pick one or name your own; Claude lays it out; you say ready here.</li></ol></div>';return;}
  const m=plan.material,chosen=plan.chosen;
  body.innerHTML='<section class="igs-mat" aria-label="Material"><span class="igs-lab">Material</span><span>'+esc(m.transcripts.map(t=>t.title||'Transcript').join(', ')||'No transcript')+' · '+plan.lines.length+' lines · '+m.photos.length+' photos</span><div class="igs-thumbs">'+m.photos.map(p=>'<img src="'+esc(blob(p.sourceId))+'" alt="'+esc(p.caption||'Photo')+'" title="'+esc(p.caption||'')+'" loading="lazy">').join('')+'</div></section>'
   +stripHTML()+'<section aria-label="Possible stories"><h2>It could become</h2><p class="igs-dim">'+(chosen?(chosen.storyId?'You chose “'+esc(plan.stories.find(s=>s.id===chosen.storyId)?.title||'')+'”':'You named it: “'+esc(chosen.named)+'”')+(chosen.forWhom?', for '+esc(chosen.forWhom):'')+'.':'What Claude found in what was said. Pick one, or name it yourself.')+'</p><div class="igs-stories">'+plan.stories.map(storyCard).join('')+'</div>'
   +'<form class="igs-name" data-igs="name"><label><span class="igs-lab">Or name it yourself</span><input name="named" maxlength="400" placeholder="This is …" value="'+esc(chosen&&!chosen.storyId?chosen.named:'')+'" '+(isAdrian()?'':'disabled')+'></label><label><span class="igs-lab">For</span><input name="forWhom" maxlength="200" placeholder="Who it is for" value="'+esc(chosen?.forWhom||'')+'" '+(isAdrian()?'':'disabled')+'></label><button type="submit" '+(isAdrian()?'':'disabled title="Only Adrian names the dish"')+'>Name it</button></form></section>'
   +flagsHTML()+'<section aria-label="Made"><h2>Made</h2>'+madeHTML()+'</section>'
   +(plan.gaps.length?'<section aria-label="Research worth doing"><h2>Worth researching</h2><ul class="igs-gaps">'+plan.gaps.map(g=>'<li><p><b>'+esc(g.question)+'</b> <span class="igs-status">'+esc(STATUS[g.status])+'</span></p>'+(g.why?'<p class="igs-dim">'+esc(g.why)+'</p>':'')+(g.finding?'<p>'+esc(g.finding)+'</p>':'')+(g.sources.length?'<p class="igs-dim">'+g.sources.map(s=>s.url?'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title||s.url)+'</a>':esc(s.title)).join(' · ')+'</p>':'')+'</li>').join('')+'</ul></section>':'');
  count();fitStage();
 }
 /** Draw the Made part again on its own (after a change in the slide studio), keeping where the page and the chooser were scrolled. */
 function renderMade(){
  const box=$('section[aria-label="Made"]');if(!box||!plan)return render();
  const body=$('.igs-body'),top=body.scrollTop,list=$('.igs-pbody'),inner=list?list.scrollTop:0,focus=document.activeElement?.closest?.('[data-igs]')?.dataset;
  box.innerHTML='<h2>Made</h2>'+madeHTML();count();fitStage();applyFilter();
  body.scrollTop=top;const l2=$('.igs-pbody');if(l2)l2.scrollTop=inner;
  if(focus?.igs){const again=box.querySelector('[data-igs="'+CSS.escape(focus.igs)+'"]'+(focus.n!==undefined?'[data-n="'+CSS.escape(focus.n)+'"]':focus.id!==undefined?'[data-id="'+CSS.escape(focus.id)+'"]':''));again?.focus?.({preventScroll:true});}
 }
 function count(){const t=$('[data-igs="caption"]'),c=$('[data-igs="count"]');if(!t||!c)return;const n=hashtags(t.value);c.textContent=t.value.length+' / 2200 · '+n+' of 5 hashtags';c.classList.toggle('bad',n>5);}

 /* ---------- the slide studio: codes, saying them, the look, the account, placed things, templates ---------- */
 // Everything here goes through the same commands an assistant uses (instagram.layout, instagram.plan.codes,
 // instagram.look, instagram.account, instagram.placed, instagram.template, template.decide). Only accepting or turning
 // down an assistant's template is Adrian's alone.
 const mirror=/instagram-mirror\.html$/.test(location.pathname);
 const lookName=id=>String(id||'').split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
 const lookId=()=>plan?.drawnIn?.id||'teajia';
 const tplOf=id=>(cat||[]).find(t=>t.id===id)||null;
 const codeOf=id=>{const t=tplOf(id);return t?.code||'';};
 const ROLE={cover:'Cover',inner:'Inner',close:'Close'};
 const listing=(lst,last='and')=>lst.length<2?lst.join(''):lst.slice(0,-1).join(', ')+' '+last+' '+lst[lst.length-1];
 /** The catalogue, the looks and the assistants' proposals: read when the studio opens and after a template changes. */
 async function loadCatalogue(){
  const get=u=>call(u,{method:'GET'});
  const [t,l,pr]=await Promise.all([get('/api/instagram/templates'),get('/api/looks').catch(()=>({looks:[]})),get('/api/templates?status=proposed').catch(()=>({templates:[],next:{}}))]);
  cat=t.templates;looksList=(l.looks||[]).filter(x=>x.drawable!==false);proposals=pr.templates||[];nextCodes=pr.next||{};
 }
 /** The accounts a look may post to and its logo and marks, read once per look. */
 async function loadLook(id){
  const get=u=>call(u,{method:'GET'});
  if(!acctFor[id])acctFor[id]=await get('/api/accounts?look='+encodeURIComponent(id)).then(r=>r.forLook.map(a=>r.accounts.find(x=>x.id===a)).filter(Boolean)).catch(()=>[]);
  if(!rolesFor[id])rolesFor[id]=await get('/api/look?id='+encodeURIComponent(id)).then(r=>r.roles||null).catch(()=>null);
  if(!assetsFor[id]){const list=await get('/api/look/assets?id='+encodeURIComponent(id)).then(r=>r.assets||[]).catch(()=>[]);
   // A logo file's own proportions, so it is placed at its shape.
   await Promise.all(list.filter(a=>a.src).map(a=>new Promise(done=>{const img=new Image(),stop=setTimeout(done,3000);img.onload=()=>{if(img.naturalWidth&&img.naturalHeight)a.ratio=img.naturalWidth/img.naturalHeight;clearTimeout(stop);done();};img.onerror=()=>{clearTimeout(stop);done();};img.src=a.src;})));
   assetsFor[id]=list;}
 }
 /** The layouts offered for this format in this look: his own first, then the rows; never a row that belongs to another brand. */
 function offered(){
  const look=lookId(),seen=new Set(),ok=t=>t.code&&t.formats.includes(format)&&(!t.onlyIn||t.onlyIn===look)&&(!t.owner||!Array.isArray(t.looks)||t.looks.includes(look))&&!seen.has(t.code)&&seen.add(t.code);
  const all=(cat||[]).filter(ok),groups=[],yours=all.filter(t=>t.owner);
  if(yours.length)groups.push({key:'yours',title:'Yours',items:yours});
  for(const t of all.filter(t=>!t.owner)){let g=groups.find(x=>x.key===t.rowLetter);if(!g){g={key:t.rowLetter,letter:t.rowLetter,title:t.row||'',items:[]};groups.push(g);}g.items.push(t);}
  return groups;
 }
 /** Why a look cannot draw what is made: a slide on a layout that belongs to another brand. */
 function lookBlocked(id){
  for(const [f,l] of Object.entries(plan.layouts||{}))for(const [i,fr] of l.frames.entries()){const t=tplOf(fr.templateId);
   if(t?.onlyIn&&t.onlyIn!==id)return 'Slide '+(i+1)+' of the '+FORMAT[f]+' uses '+t.code+', a '+lookName(t.onlyIn)+' layout. Change that slide first.';
   if(t?.owner&&Array.isArray(t.looks)&&!t.looks.includes(id))return 'Slide '+(i+1)+' of the '+FORMAT[f]+' uses '+t.code+', your template for the '+listing(t.looks.map(lookName))+' look.';}
  return '';
 }
 function lookHTML(){
  const cur=lookId(),accts=acctFor[cur]||[],a=plan.account;
  const looks=looksList.length?looksList:[{id:cur,name:lookName(cur)}];
  const pills=looks.map(x=>{const why=x.id===cur?'':lookBlocked(x.id);return '<button type="button" data-igs="look" data-id="'+esc(x.id)+'" aria-pressed="'+(x.id===cur)+'"'+(why?' disabled title="'+esc(why)+'"':' title="'+esc(x.name||'')+'"')+'>'+esc(lookName(x.id))+'</button>';}).join('');
  const posts=accts.length>1?accts.map(x=>'<button type="button" data-igs="account" data-id="'+esc(x.id)+'" aria-pressed="'+(a?.id===x.id)+'" title="'+esc(x.name)+'">'+esc(x.name)+'</button>').join('')
   :'<span class="igs-one">'+esc(a?.name||(a?.id?a.id:'No account posts this look yet'))+'</span>';
  return '<div class="igs-lookrow"><div class="igs-pills" role="group" aria-label="Look"><span class="igs-lab">Look</span>'+pills+'</div><div class="igs-pills" role="group" aria-label="Posts to"><span class="igs-lab">Posts to</span>'+posts+'</div></div>';
 }
 // Saying the codes: a phone keyboard's own dictation types into the field. The page records no sound itself, so his voice
 // never goes to a speech service he did not choose.
 function sayHTML(){
  const rows=offered().filter(g=>g.key!=='yours'),first=k=>rows.find(g=>g.key===k)?.items[0]?.code,n=plan.layouts[format].frames.length;
  const a=[first('C'),first('S'),first('F'),first('E')].filter(Boolean).slice(0,n),c=rows.find(g=>g.key==='C')?.items||[];
  const tries=[a.length>1?a.join(', '):'',c.length>2?'use '+c[0].code+', '+c[1].code.slice(1)+' and '+c[2].code.slice(1):''].filter(Boolean);
  return '<form class="igs-say" data-igs="say"><label class="igs-sayline"><span class="igs-lab">Layouts by code</span><span class="igs-row">'
   +'<input name="say" maxlength="400" autocomplete="off" value="'+esc(said?.line||'')+'" placeholder="Say or type it: use C1, 2 and 5" aria-describedby="igs-say-help"><button type="submit">Build</button></span></label>'
   +'<p class="igs-dim" id="igs-say-help">Slide 1 takes the first code, slide 2 the next. A letter carries on: “C1, 2 and 5” is C1, C2 and C5.</p>'
   +(tries.length?'<div class="igs-row igs-tries"><span class="igs-dim">Try</span>'+tries.map(t=>'<button type="button" class="igs-try" data-igs="try" data-say="'+esc(t)+'">'+esc(t)+'</button>').join('')+'</div>':'')
   +(said?'<div role="status">'+(said.done?'<p class="igs-heardline">'+esc(said.done)+'</p>':'')+(said.missed?'<p class="igs-heardline bad">'+esc(said.missed)+'</p>':'')+'</div>':'')+'</form>';
 }
 /** One slide large, its layout and code, and the panel to change it: layouts, things to place, templates. */
 function studioHTML(l){
  const fr=l.frames[sel],t=tplOf(fr.templateId),[w,h]=SIZE[format],src='/api/instagram/render?'+new URLSearchParams({id:plan.id,format,frame:String(sel),r:String(plan.revision)});
  const a=plan.account,acct=a?.name?' · posts to '+a.name:'';
  const boxes=(fr.placed||[]).map((p,i)=>'<div class="igs-pl" tabindex="0" role="button" data-pl="'+i+'" style="'+plStyle(p)+'" aria-label="'+esc(thingName(p))+'. Drag to move, or use the arrow keys; plus and minus change its size."><span class="igs-plh" data-plh="'+i+'" aria-hidden="true"></span></div>').join('');
  return '<section class="igs-studio" aria-label="Slide '+(sel+1)+'"><div class="igs-stage"><div class="igs-big" data-w="'+w+'" data-h="'+h+'" style="aspect-ratio:'+w+'/'+h+'"><iframe title="Slide '+(sel+1)+', large" src="'+esc(src)+'" tabindex="-1" style="width:'+w+'px;height:'+h+'px"></iframe><div class="igs-over">'+boxes+'</div></div>'
   +'<div class="igs-capline"><p><b>Slide '+(sel+1)+'</b> · '+esc(ROLE[fr.role]||'Inner')+' · '+(t?'<b class="igs-code">'+esc(t.code||'')+'</b> '+esc(t.name):esc(fr.templateId))+'</p><p class="igs-dim">'+esc(t?(t.owner?'Yours':(t.rowLetter||'')+' '+(t.row||'')):'')+esc(acct)+'</p></div>'
   +'<div class="igs-row"><button type="button" data-igs="prev" aria-label="Previous slide" '+(sel?'':'disabled')+'>‹ Slide '+(sel||'')+'</button><button type="button" data-igs="next" aria-label="Next slide" '+(sel<l.frames.length-1?'':'disabled')+'>Slide '+(sel+2<=l.frames.length?sel+2:'')+' ›</button><button type="button" data-igs="savet-open" aria-expanded="'+saveOpen+'">Save as a template</button></div>'
   +(saveOpen?saveHTML(t):'')+'</div>'
   +(mirror?'':'<div class="igs-panel"><div class="igs-ptabs" role="tablist">'+[['layout','Layout'],['add','Add']].map(([k,n])=>'<button type="button" role="tab" data-igs="ptab" data-id="'+k+'" aria-selected="'+(tab===k)+'">'+n+'</button>').join('')+'</div><div class="igs-pbody">'+(tab==='add'?addHTML(fr):chooserHTML(fr))+'</div></div>')+'</section>';
 }
 const thumb=(layout,label)=>{const [w,h]=SIZE[format],cw=84,src='/api/instagram/preview?'+new URLSearchParams({id:plan.id,format,frame:String(sel),layout,plain:'1',r:String(plan.revision)});return '<span class="igs-thumb" style="width:'+cw+'px;height:'+Math.round(h*cw/w)+'px"><iframe title="'+esc(label)+'" src="'+esc(src)+'" loading="lazy" tabindex="-1" style="width:'+w+'px;height:'+h+'px;transform:scale('+(cw/w)+')"></iframe></span>';};
 function chooserHTML(fr){
  const cur=codeOf(fr.templateId),groups=offered(),props=proposals.filter(t=>(t.formats||[]).includes(format)&&(!Array.isArray(t.looks)||t.looks.includes(lookId())));
  const cell=t=>'<li class="igs-cell" data-find="'+esc((t.code+' '+t.name).toLowerCase())+'"><button type="button" class="igs-tile" data-igs="use" data-id="'+esc(t.id)+'" aria-pressed="'+(t.code===cur)+'" title="'+esc(t.code+' '+t.name)+'">'+thumb(t.id,t.code+' '+t.name)+'<span class="igs-tname"><b class="igs-code">'+esc(t.code)+'</b> '+esc(t.name)+'</span></button></li>';
  const prop=t=>'<li class="igs-cell igs-prop" data-find="'+esc(t.name.toLowerCase())+'">'+thumb(t.id,t.name)+'<span class="igs-tname">'+esc(t.name)+'<span class="igs-dim">'+esc((t.rowLetter||'')+' '+(t.row||''))+' · from '+esc(who(t.proposedBy))+'</span></span>'
   +(isAdrian()?'<span class="igs-row"><button type="button" data-igs="accept" data-id="'+esc(t.id)+'">Accept</button><button type="button" data-igs="turn-down" data-id="'+esc(t.id)+'">Turn down</button></span>':'<span class="igs-dim">Waiting for Adrian.</span>')+'</li>';
  return '<label class="igs-find"><span class="igs-lab">Find a layout</span><input data-igs="filter" type="search" value="'+esc(filter)+'" placeholder="A code or a name, like B1 or box" autocomplete="off"></label>'
   +'<p class="igs-dim">Press a layout to use it on slide '+(sel+1)+'. Only layouts this look can draw are here.</p>'
   +(props.length?'<div class="igs-group" data-group><h3>Proposed by assistants <span class="igs-dim">'+props.length+'</span></h3><p class="igs-dim">Accept one and it gets the next free code in its row.</p><ul class="igs-cells igs-props">'+props.map(prop).join('')+'</ul></div>':'')
   +groups.map(g=>'<div class="igs-group" data-group><h3>'+(g.letter?'<b class="igs-code">'+esc(g.letter)+'</b> ':'')+esc(g.title)+' <span class="igs-dim">'+g.items.length+'</span></h3><ul class="igs-cells">'+g.items.map(cell).join('')+'</ul></div>').join('')
   +'<p class="igs-dim igs-none" hidden>No layout has that code or name.</p>';
 }
 function applyFilter(){
  const q=filter.trim().toLowerCase().replace(/\s+/g,' '),qc=q.replace(/\s/g,''),root=$('.igs-pbody');if(!root)return;
  // A query shaped like a code (a letter, then numbers) finds codes only: "b" is the B row, "c1" is C1 and C10.
  const asCode=/^[a-z]\d*$/.test(qc);
  let any=false;for(const c of root.querySelectorAll('.igs-cell')){const f=c.dataset.find||'',code=f.split(' ')[0];const on=!q||code.startsWith(qc)||(!asCode&&f.includes(q));c.hidden=!on;any||=on;}
  for(const g of root.querySelectorAll('[data-group]'))g.hidden=![...g.querySelectorAll('.igs-cell')].some(c=>!c.hidden);
  const none=root.querySelector('.igs-none');if(none)none.hidden=any;
 }
 /* placed things */
 const FH=()=>SIZE[format][1];
 const plHeight=p=>p.height??(p.kind==='picture'?Math.round(p.width*1.25):p.kind==='label'?Math.ceil((p.size??30)*1.4):p.kind==='rule'?2:p.width);
 const plStyle=p=>'left:calc(var(--k) * '+p.x+'px);top:calc(var(--k) * '+p.y+'px);width:calc(var(--k) * '+p.width+'px);height:calc(var(--k) * '+Math.max(plHeight(p),8)+'px)';
 const assetOf=a=>(assetsFor[lookId()]||[]).find(x=>x.id===a);
 const thingName=p=>p.kind==='label'?'Label “'+p.text+'”':p.kind==='rule'?'Rule':p.kind==='picture'?'Picture':assetOf(p.asset)?.name||p.asset;
 function assetTile(a){
  // Shown on the look's own dark ground, in its own colours, as it will sit on a slide.
  const look=lookId(),r=rolesFor[look]?.dark,c=v=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:'',ground=c(r?.ground),accent=c(r?.accent),head=c(r?.headline);
  const face=a.src?'<img src="'+esc(a.src)+'" alt="">':a.kind==='mark'&&a.text?'<b class="igs-seal"'+(accent&&ground?' style="background:'+accent+';color:'+ground+'"':'')+'>'+esc(a.text)+'</b>':'<b class="igs-word"'+(head?' style="color:'+head+'"':'')+'>'+esc(a.kind==='logo'?(rolesFor[look]?.logo?.wordmark||looksList.find(x=>x.id===look)?.name||lookName(look)):a.name)+'</b>';
  return '<li><button type="button" class="igs-tile igs-thing" data-igs="place" data-kind="'+esc(a.kind)+'" data-id="'+esc(a.id)+'"><span class="igs-face"'+(ground?' style="background:'+ground+'"':'')+'>'+face+'</span><span class="igs-tname">'+esc(a.name)+'</span></button></li>';
 }
 function addHTML(fr){
  const list=fr.placed||[],left=(plan.placedLeftOut||[]).filter(x=>x.format===format&&x.slide===sel+1),assets=assetsFor[lookId()]||[];
  return '<h3>'+esc(lookName(lookId()))+'’s logo and marks</h3>'+(assets.length?'<ul class="igs-things">'+assets.map(assetTile).join('')+'</ul><p class="igs-dim">These belong to this look. Change the look and they change with it.</p>':'<p class="igs-dim">This look has no logo or marks yet.</p>')
   +'<h3>For any look</h3><form class="igs-row" data-igs="label"><input name="label" maxlength="60" placeholder="A short label, like JOURNEY 04" aria-label="Label words"><button type="submit">Add the label</button><button type="button" data-igs="place" data-kind="rule">Add a rule</button></form>'
   +'<h3>On this slide</h3>'+(list.length?'<ul class="igs-on">'+list.map((p,i)=>'<li><span>'+esc(thingName(p))+'</span><button type="button" data-igs="size" data-n="'+i+'" data-d="-1" aria-label="Smaller">Smaller</button><button type="button" data-igs="size" data-n="'+i+'" data-d="1" aria-label="Bigger">Bigger</button><button type="button" data-igs="unplace" data-n="'+i+'">Remove</button></li>').join('')+'</ul><p class="igs-dim">Drag anything you placed to move it on the slide. Drag its corner to change its size.</p>'
    :'<p class="igs-dim">Nothing placed yet. Press a logo, a mark, a label or a rule to put it on the slide, then drag it where you want it.</p>')
   +(left.length?'<p class="igs-warn">'+left.map(x=>esc(x.why)).join(' ')+'</p>':'');
 }
 /** Where a new thing goes and how big it is, in the slide's own pixels. */
 function newThing(kind,asset,text){
  const H=FH(),n=(plan.layouts[format].frames[sel].placed||[]).length,step=n*24;
  if(kind==='rule')return {kind,x:410,y:Math.min(H-40,900+step),width:260,height:3};
  if(kind==='label'){const size=30,width=Math.min(900,Math.round(text.length*size*0.82)+24);return {kind,text,size,x:90,y:Math.min(H-60,90+step),width};}
  const a=assetOf(asset)||{};
  if(kind==='mark'){const s=96;return {kind,asset,x:1080-72-s-step,y:72+step,width:s,height:s};}
  if(kind==='logo'){const word=rolesFor[lookId()]?.logo?.wordmark||lookName(lookId()),height=a.src?0:70,width=a.src?260:Math.min(900,Math.round(word.length*height*0.4)+40);const h=a.src?Math.round(width/(a.ratio||3.4)):height;return {kind,asset,x:Math.round((1080-width)/2),y:Math.min(H-h-60,H-200-step),width,height:h};}
  return {kind,asset,x:420-step,y:480+step,width:240,height:240};
 }
 function savePlaced(list,done){return act('/api/instagram/placed',{format,slide:sel+1,placed:list},done,{made:true});}
 function resized(p,factor){
  const H=FH(),q={...p};
  if(p.kind==='label'){q.size=Math.max(16,Math.min(160,Math.round((p.size||30)*factor)));q.width=Math.min(1080-p.x,Math.max(20,Math.round(p.width*factor)));if(q.y+Math.ceil(q.size*1.4)>H)return p;return q;}
  let w=Math.max(p.kind==='rule'?40:32,Math.round(p.width*factor));w=Math.min(w,1080-p.x);
  if(p.kind==='rule'){q.width=w;return q;}
  const ratio=plHeight(p)/p.width;let h=Math.round(w*ratio);if(p.y+h>H){h=H-p.y;w=Math.max(32,Math.round(h/ratio));}
  q.width=w;q.height=h;return q;
 }
 /* the save as a template form */
 function saveHTML(t){
  const row=t?.rowLetter,code=row&&nextCodes[row],look=lookName(lookId());
  return '<form class="igs-savet" data-igs="savet"><p>'+(isAdrian()?(code?'It will be called <b class="igs-code">'+esc(code)+'</b>, the next free code in '+esc(t.row||row)+'. ':'')+'It keeps the layout and anything you placed on it. The words and photographs stay with this '+esc(FORMAT[format])+'.':'An assistant’s template goes to Adrian as a proposal. It gets its code when he accepts it.')+'</p>'
   +'<label><span class="igs-lab">Name</span><input name="name" maxlength="80" required value="'+esc((t?.name||'My layout')+', mine')+'"></label>'
   +'<div class="igs-pills" role="radiogroup" aria-label="For which looks"><span class="igs-lab">For</span><label><input type="radio" name="looks" value="this" checked> The '+esc(look)+' look</label><label><input type="radio" name="looks" value="all"'+(t?.onlyIn?' disabled':'')+'> Every look</label></div>'
   +'<div class="igs-row"><button type="submit" class="igs-primary">Save template</button><button type="button" class="igs-quiet" data-igs="savet-cancel">Cancel</button></div></form>';
 }
 /** Size the large slide to the room it has. */
 function fitStage(){
  const big=$('.igs-big');if(!big)return;
  const k=big.clientWidth/Number(big.dataset.w||1080);big.style.setProperty('--k',String(k));const f=big.querySelector('iframe');if(f)f.style.transform='scale('+k+')';
  if(!stageWatch&&window.ResizeObserver){stageWatch=new ResizeObserver(()=>{const b=$('.igs-big');if(b){const kk=b.clientWidth/Number(b.dataset.w||1080);b.style.setProperty('--k',String(kk));const ff=b.querySelector('iframe');if(ff)ff.style.transform='scale('+kk+')';}});}
  if(stageWatch){stageWatch.disconnect();stageWatch.observe(big);}
 }
 /* dragging and resizing a placed thing, by mouse, pen or touch; the same thing moves inside the drawn slide while it is dragged */
 let drag=null,stageWatch=null,keyTimer=null;
 function liveMove(i,p){
  const big=$('.igs-big');if(!big)return;const box=big.querySelector('[data-pl="'+i+'"]');if(box)box.setAttribute('style',plStyle(p));
  try{const doc=big.querySelector('iframe').contentDocument,els=[...doc.querySelectorAll('[data-placed-index]')],n=(plan.layouts[format].frames[sel].placed||[]).length,max=Math.max(-1,...els.map(e=>+e.dataset.placedIndex)),off=Math.max(0,max+1-n),el=doc.querySelector('[data-placed-index="'+(off+i)+'"]');
   if(el){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.width+'px';el.style.height=plHeight(p)+'px';if(p.kind==='label')el.style.fontSize=(p.size||30)+'px';}}catch{}
 }
 function onPointerDown(e){
  const box=e.target.closest?.('.igs-pl');if(!box||busy)return;const i=+box.dataset.pl,p=plan.layouts[format].frames[sel].placed?.[i];if(!p)return;
  const big=box.closest('.igs-big'),k=parseFloat(big.style.getPropertyValue('--k'))||1;
  drag={i,k,start:p,cur:p,sx:e.clientX,sy:e.clientY,resize:!!e.target.closest('.igs-plh'),moved:false};try{box.setPointerCapture?.(e.pointerId);}catch{}box.classList.add('on');e.preventDefault();
 }
 function onPointerMove(e){
  if(!drag)return;const dx=(e.clientX-drag.sx)/drag.k,dy=(e.clientY-drag.sy)/drag.k,p=drag.start,H=FH();if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
  if(drag.resize){const f=Math.max(0.05,(p.width+dx)/p.width);drag.cur=resized(p,f);}
  else{const h=plHeight(p);drag.cur={...p,x:Math.round(Math.max(0,Math.min(1080-p.width,p.x+dx))),y:Math.round(Math.max(0,Math.min(H-h,p.y+dy)))};}
  liveMove(drag.i,drag.cur);
 }
 function onPointerUp(){
  if(!drag)return;const d=drag;drag=null;if(!d.moved){$('.igs-big [data-pl="'+d.i+'"]')?.classList.remove('on');return;}
  const list=[...plan.layouts[format].frames[sel].placed];list[d.i]=d.cur;void savePlaced(list,d.resize?thingName(d.cur)+': new size kept.':thingName(d.cur)+': moved.');
 }
 function onPlacedKey(e){
  const box=e.target.closest?.('.igs-pl');if(!box)return;const i=+box.dataset.pl,list=[...(plan.layouts[format].frames[sel].placed||[])],p=list[i];if(!p)return;
  const step=e.shiftKey?50:10,H=FH(),h=plHeight(p);let q=null;
  if(e.key==='ArrowLeft')q={...p,x:Math.max(0,p.x-step)};else if(e.key==='ArrowRight')q={...p,x:Math.min(1080-p.width,p.x+step)};
  else if(e.key==='ArrowUp')q={...p,y:Math.max(0,p.y-step)};else if(e.key==='ArrowDown')q={...p,y:Math.min(H-h,p.y+step)};
  else if(e.key==='+'||e.key==='=')q=resized(p,1.1);else if(e.key==='-')q=resized(p,1/1.1);
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();list.splice(i,1);void savePlaced(list,thingName(p)+': taken off the slide.');return;}
  if(!q)return;e.preventDefault();list[i]=q;plan.layouts[format].frames[sel].placed=list;liveMove(i,q);
  clearTimeout(keyTimer);keyTimer=setTimeout(()=>void savePlaced(plan.layouts[format].frames[sel].placed,thingName(q)+': moved.'),700);
 }
 /* his own words, said or typed: build by codes */
 async function build(line){
  line=String(line||'').trim();if(!line){note('');said={line:'',missed:'Type the codes first, like “use C1, 2 and 5”.'};return renderMade();}
  const l=plan.layouts[format];
  const out=await act('/api/instagram/plan/codes',{say:line,format,storyId:l.storyId},r=>{const c=r.codes||{},used=c.used||[],un=c.unused||[];
   said={line,done:used.length?'Built from what you said: '+used.map(u=>'slide '+u.slide+' is '+u.code+' '+u.name).join(', ')+'.':'',missed:un.length?'Could not use '+un.map(u=>u.code+': '+u.why.replace(/\.$/,'')).join('; ')+'.':''};return [said.done,said.missed].filter(Boolean).join(' ');},{made:true});
  if(!out){said={line,missed:$('.igs-note')?.textContent||'Nothing was built.'};renderMade();}
 }
 async function changeLook(id){
  if(id===lookId())return;await loadLook(id).catch(()=>{});
  const accts=acctFor[id]||[],a=plan.account,body={look:id};
  if(a?.from==='plan'&&!accts.some(x=>x.id===a.id))body.account=accts[0]?.id||'auto';
  const before=a?.id;
  await act('/api/instagram/look',body,r=>'Drawn in the '+lookName(id)+' look.'+(r.account&&r.account.id!==before?' Now posts to '+r.account.name+'.':''),{made:true});
 }
 async function templateCall(path,body,done){
  if(busy)return;busy=true;note('Saving…');
  try{const out=await call(path,{method:'POST',body:JSON.stringify({operationId:crypto.randomUUID(),...body})});await loadCatalogue();note(done(out));renderMade();}
  catch(e){note(e.message,true);}finally{busy=false;}
 }
 /* ---------- actions (Adrian's) ---------- */
 const stamp=()=>({id:plan.id,operationId:crypto.randomUUID(),expectedRevision:plan.revision,expectedHash:plan.hash});
 async function act(path,body,done,{made=false,after=null}={}){if(busy)return null;busy=true;note('Saving…');const yes=Object.keys(plan.ready||{});let out=null;
  try{out=await call(path,{method:'POST',body:JSON.stringify({...stamp(),...body})});const {codes,...next}=out;plan=next;if(after)await after(out);
   const cleared=yes.filter(f=>!plan.ready?.[f]);note((typeof done==='function'?done(out):done)+(cleared.length&&path!=='/api/instagram/ready'?' Your yes for the '+cleared.map(f=>FORMAT[f]).join(' and ')+' was cleared: say Ready again when it looks right.':''));made?renderMade():render();}
  catch(e){note(e.status===409?'This changed somewhere else (Claude may have updated it). Reopen to see the newest.':e.message,true);out=null;}finally{busy=false;}return out;}
 function onClick(e){
  const b=e.target.closest('[data-igs]');if(!b||b.disabled)return;const what=b.dataset.igs;
  if(what==='close')return close();
  if(what==='consent'){e.preventDefault();const id=plan?.publishHold?.parentStudyId||plan?.subject||'';close();if(id)void window.arConsentDesk?.open?.(id);return;}
  if(what==='choose')return act('/api/instagram/choose',{storyId:b.dataset.id,forWhom:dlg.querySelector('[name=forWhom]')?.value||''},'Chosen. Claude can lay it out now.');
  if(what==='format'){format=b.dataset.f;sel=0;saveOpen=false;return render();}
  if(what==='slide'){sel=+b.dataset.n;saveOpen=false;return renderMade();}
  if(what==='prev'||what==='next'){sel=Math.max(0,Math.min(plan.layouts[format].frames.length-1,sel+(what==='next'?1:-1)));saveOpen=false;return renderMade();}
  if(what==='ptab'){tab=b.dataset.id;return renderMade();}
  if(what==='try'){const f=$('[data-igs="say"] [name="say"]');if(f)f.value=b.dataset.say;return void build(b.dataset.say);}
  if(what==='look')return void changeLook(b.dataset.id);
  if(what==='account'){const a=(acctFor[lookId()]||[]).find(x=>x.id===b.dataset.id);if(!a||plan.account?.id===a.id)return;return act('/api/instagram/account',{account:a.id},'Now posts to '+a.name+'.',{made:true});}
  if(what==='use'){const t=tplOf(b.dataset.id),l=plan.layouts[format];if(!t)return;
   const fit=(w)=>{if(w.text.length<=t.maxChars)return w;const head=w.text.slice(0,t.maxChars),cut=Math.max(head.lastIndexOf(', '),head.lastIndexOf('; '),head.lastIndexOf(' - '));return {lineId:w.lineId,text:cut>t.maxChars*0.4?head.slice(0,cut):head.slice(0,head.lastIndexOf(' ')>0?head.lastIndexOf(' '):t.maxChars)};};
   const frames=l.frames.map((f,i)=>{const {words,...rest}=f,ws=words.map(w=>({lineId:w.lineId,text:w.text}));return i===sel?{...rest,templateId:t.id,words:ws.map(fit),photos:f.photos.slice(0,t.photos)}:{...rest,words:ws};});
   return act('/api/instagram/layout',{storyId:l.storyId,format,frames},'Slide '+(sel+1)+' is now '+t.code+' '+t.name+'.',{made:true});}
  if(what==='place'){const kind=b.dataset.kind,list=[...(plan.layouts[format].frames[sel].placed||[])];if(list.length>=12)return note('A slide holds up to twelve placed things.',true);
   const p=newThing(kind,b.dataset.id);list.push(p);return savePlaced(list,thingName(p)+' is on slide '+(sel+1)+'. Drag it where you want it.');}
  if(what==='size'||what==='unplace'){const i=+b.dataset.n,list=[...(plan.layouts[format].frames[sel].placed||[])],p=list[i];if(!p)return;
   if(what==='unplace'){list.splice(i,1);return savePlaced(list,thingName(p)+': taken off the slide.');}
   list[i]=resized(p,+b.dataset.d>0?1.18:1/1.18);return savePlaced(list,thingName(p)+': '+(+b.dataset.d>0?'bigger.':'smaller.'));}
  if(what==='savet-open'){saveOpen=!saveOpen;renderMade();if(saveOpen)$('[data-igs="savet"] [name="name"]')?.focus();return;}
  if(what==='savet-cancel'){saveOpen=false;return renderMade();}
  if(what==='accept'||what==='turn-down'){const t=proposals.find(x=>x.id===b.dataset.id);if(!t)return;
   return templateCall('/api/template/decide',{id:t.id,decision:what,expectedRevision:t.revision,expectedHash:t.hash},r=>what==='accept'?'Accepted. “'+r.name+'” is '+r.code+' now, listed first under Yours. Say '+r.code+' to use it.':'Turned down. “'+r.name+'” is no longer offered.');}
  if(what==='moment')return momentDetail(b.dataset.id);
  if(what==='mark')return act('/api/instagram/plan',{coverage:[{momentId:b.dataset.id,status:b.dataset.s,why:b.dataset.s==='skipped'?'Skipped by you.':'Saved by you.'}]},b.dataset.s==='saved'?'Saved for later.':'Skipped on purpose.');
  if(what==='meant')return act('/api/instagram/meaning',{storyId:b.dataset.id,verdict:'right'},'Noted: that is what you meant.');
  if(what==='not-meant'){const form=dlg.querySelector('form[data-igs="meaning"][data-id="'+CSS.escape(b.dataset.id)+'"]');form.hidden=false;form.querySelector('textarea').focus();return;}
  if(what==='as-heard')return act('/api/instagram/confirm',{flagId:b.dataset.id,verdict:'as-heard'},'Confirmed as heard.');
  if(what==='ready')return act('/api/instagram/ready',{format,caption:$('[data-igs="caption"]').value},'Marked ready. Nothing was posted.');
 }
 async function load(planId){
  const subject=ctx.subject;
  if(!planId){plans=(await call('/api/instagram/plans'+(subject?'?subject='+encodeURIComponent(subject):''),{method:'GET'})).plans;planId=plans[0]?.id;}
  plan=planId?await call('/api/instagram/plan?id='+encodeURIComponent(planId),{method:'GET'}):null;
  sel=0;saveOpen=false;said=null;
  if(plan){try{await loadCatalogue();await loadLook(lookId());}catch{cat=cat||[];}}
  const pick=$('.igs-pick');pick.hidden=plans.length<2;pick.innerHTML=plans.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===plan?.id?'selected':'')+'>'+esc(p.title||'Untitled')+'</option>').join('');
  $('.igs-title b').textContent=plan?.title||ctx.title||'Instagram';render();
 }
 function shell(){
  const d=document.createElement('dialog');d.className='igs';d.setAttribute('aria-label','Instagram');
  d.innerHTML='<div class="igs-bar"><span class="igs-title"><b></b> · Instagram</span><select class="igs-pick" aria-label="Other Instagram plans" hidden></select><button type="button" class="igs-quiet" data-igs="close">Close</button></div><div class="igs-note" role="status" hidden></div><div class="igs-body"></div>';
  d.addEventListener('click',onClick);
  d.addEventListener('input',e=>{if(e.target.matches('[data-igs="caption"]'))count();if(e.target.matches('[data-igs="filter"]')){filter=e.target.value;applyFilter();}});
  d.addEventListener('pointerdown',onPointerDown);d.addEventListener('pointermove',onPointerMove);d.addEventListener('pointerup',onPointerUp);d.addEventListener('pointercancel',onPointerUp);
  d.addEventListener('keydown',onPlacedKey);
  d.addEventListener('change',e=>{if(e.target.matches('.igs-pick'))void load(e.target.value).catch(err=>note(err.message,true));});
  d.addEventListener('submit',e=>{const form=e.target;
   if(form.matches('[data-igs="say"]')){e.preventDefault();return void build(form.querySelector('[name="say"]').value);}
   if(form.matches('[data-igs="label"]')){e.preventDefault();const text=form.querySelector('[name="label"]').value.trim();if(!text)return note('Type the label words first.',true);const list=[...(plan.layouts[format].frames[sel].placed||[])];const p=newThing('label',null,text);list.push(p);return void savePlaced(list,thingName(p)+' is on slide '+(sel+1)+'. Drag it where you want it.');}
   if(form.matches('[data-igs="savet"]')){e.preventDefault();const f=new FormData(form),looks=f.get('looks')==='all'?'all':[lookId()];saveOpen=false;
    return void templateCall('/api/instagram/template',{id:plan.id,format,slide:sel+1,name:String(f.get('name')||'').trim(),looks},r=>r.status==='kept'?'Saved as '+r.code+', “'+r.name+'”. It is listed first under Yours. Say '+r.code+' to use it again.'+(r.leftOut?' '+r.leftOut:''):'Sent to Adrian as a proposal: “'+r.name+'”. It gets its code when he accepts it.'+(r.leftOut?' '+r.leftOut:''));}if(form.matches('[data-igs="meaning"]')){e.preventDefault();return act('/api/instagram/meaning',{storyId:form.dataset.id,verdict:'not-meant',words:form.words.value},'Kept, in your words. Claude will propose it again from them.');}if(form.matches('[data-igs="confirm"]')){e.preventDefault();return act('/api/instagram/confirm',{flagId:form.dataset.id,verdict:'corrected',correction:form.correction.value},'Corrected, in your words. The transcript itself is unchanged.');}if(!e.target.matches('[data-igs="name"]'))return;e.preventDefault();const f=new FormData(e.target);act('/api/instagram/choose',{storyId:null,named:String(f.get('named')||''),forWhom:String(f.get('forWhom')||'')},'Named. Claude can lay it out now.');});
  d.addEventListener('close',()=>{d.remove();if(dlg===d)dlg=null;opener?.focus?.();if(/^#instagram=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search);});
  return d;
 }
 async function open({subject,title,planId}={}){
  if(dlg)close();opener=document.activeElement;ctx={subject:subject||'',title:title||''};
  dlg=shell();document.body.append(dlg);dlg.showModal();note('Opening…');
  try{await load(planId);note('');}catch(e){note(e.message,true);plan=null;render();}
 }
 function close(){if(dlg?.open)dlg.close();}

 /* ---------- entrances ---------- */
 // Media, Arrange and Outputs carry an Instagram button in their heading line, for the piece's project.
 const STAGES=new Set([8,9,12]);
 function decorate(){
  let p=null;try{p=typeof current==='function'?current():null;}catch{}
  const title=document.querySelector('#app .workspace>.c3-ws-title'),stage=p?.view==='record'?Number(p.viewedStage):0;
  const btn=title?.querySelector('[data-instagram-open]');
  if(!title||!STAGES.has(stage)){btn?.remove();return;}
  if(btn&&btn.dataset.instagramOpen===String(p.id||''))return;btn?.remove();
  const b=document.createElement('button');b.type='button';b.className='btn igs-open';b.dataset.instagramOpen=p.id||'';b.dataset.instagramTitle=p.name||'';b.textContent='Instagram';b.title='What this could become on Instagram';title.append(b);
 }
 let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}).observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('click',e=>{const b=e.target.closest?.('[data-instagram-open]');if(!b||b.disabled)return;e.preventDefault();void open({subject:b.dataset.instagramOpen,title:b.dataset.instagramTitle});});
 // A link an agent or the Needs you list hands over: …/document-study/index.html?instagram=<plan id> (or #instagram=)
 const fromHash=()=>{const m=/^#instagram=([a-f0-9-]{36})$/i.exec(location.hash)||/[?&]instagram=([a-f0-9-]{36})(?:&|$)/i.exec(location.search);if(m)void open({planId:m[1]});};
 window.addEventListener('hashchange',fromHash);if(document.readyState==='complete')setTimeout(fromHash,800);else window.addEventListener('load',()=>setTimeout(fromHash,800));
 window.arInstagram={open,close,state:()=>plan&&JSON.parse(JSON.stringify(plan))};
})();
