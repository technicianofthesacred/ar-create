/* The slide studio, full screen, for one Carousel (an Instagram plan). Every read and write is a registry command
   (instagram.plan.get, instagram.templates, instagram.layout, instagram.placed, instagram.look, instagram.account,
   instagram.plan.codes, instagram.template, template.decide, looks, look, look.assets, accounts, templates). The slides
   themselves are drawn by the app's own renderer in frames, scaled to fit. His words are never written here. */
(function(v2){
 'use strict';
 const esc=v2.ui.esc,ic=v2.ui.icon,FORMAT='carousel',W=1080,H=1350;
 const ROLE={cover:'Cover',inner:'Inner',close:'Close'},BRANDS=['teajia','art','mandala-codes'];
 const lookName=id=>String(id||'').split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
 const listing=l=>l.length<2?l.join(''):l.slice(0,-1).join(', ')+' and '+l[l.length-1];
 const sig=x=>{const s=JSON.stringify(x)||'';let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36);};
 const q=o=>new URLSearchParams(o).toString();

 v2.screen({id:'slides',title:'Slides',route:'slides/:id',
  render:()=>'<div class="v2-page sl"><p class="sl-wait" role="status">Opening the slides.</p></div>',
  async mount(el,ctx){
   const root=el.querySelector('.sl');
   let plan=null,cat=[],looksList=[],proposals=[],nextCodes={},sel=0,tab='layout',lset='suits',slot=0,saveOpen=false,busy=false,said=null,sayText='',cropOpen=false,labelOpen=false,tints={};
   const stripCw=()=>window.innerWidth<851?54:63;
   const acctFor={},rolesFor={},assetsFor={},keys={};
   let drag=null,keyTimer=null,rzTimer=null,watch=null,stopReorder=()=>{},io=null,reloadTimer=null,gone=false;
   const human=()=>v2.isHuman();
   const who=a=>v2.actorName(a);
   const lookId=()=>plan?.drawnIn?.id||'teajia';
   const tplOf=id=>cat.find(t=>t.id===id)||null;
   const frames=()=>plan.layouts[FORMAT].frames;
   const storyId=()=>plan.layouts[FORMAT].storyId;
   const photoOf=id=>(plan.material?.photos||[]).find(p=>p.id===id)||null;
   const blob=p=>'/api/sources/blob?id='+encodeURIComponent(p?.sourceId||'');
   const say=(t,tone)=>v2.ui.say(t,{tone:tone||'info'});
   ctx.signal.addEventListener('abort',()=>{gone=true;io?.disconnect();watch?.disconnect();stopReorder();clearTimeout(keyTimer);clearTimeout(reloadTimer);});

   /* ---------- reading ---------- */
   async function loadCatalogue(){
    const [t,l,pr]=await Promise.all([v2.call('instagram.templates'),v2.call('looks').catch(()=>({looks:[]})),v2.call('templates',{status:'proposed'}).catch(()=>({templates:[],next:{}}))]);
    cat=t.templates||[];looksList=(l.looks||[]).filter(x=>x.drawable!==false).sort((a,b)=>{const o=i=>{const k=BRANDS.indexOf(i);return k<0?BRANDS.length:k;};return o(a.id)-o(b.id)||String(a.id).localeCompare(b.id);});await Promise.all(looksList.map(x=>tints[x.id]?0:v2.call('look',{id:x.id}).then(r=>{const c=r.roles?.dark?.accent;tints[x.id]=/^#[0-9a-f]{3,8}$/i.test(c||'')?c:'-';}).catch(()=>{tints[x.id]='-';})));proposals=pr.templates||[];nextCodes=pr.next||{};
   }
   async function loadLook(id){
    if(!acctFor[id])acctFor[id]=await v2.call('accounts',{look:id}).then(r=>(r.forLook||[]).map(a=>r.accounts.find(x=>x.id===a)).filter(Boolean)).catch(()=>[]);
    if(!rolesFor[id])rolesFor[id]=await v2.call('look',{id}).then(r=>r.roles||null).catch(()=>null);
    if(!assetsFor[id]){
     const list=await v2.call('look.assets',{id}).then(r=>r.assets||[]).catch(()=>[]);
     await Promise.all(list.filter(a=>a.src).map(a=>new Promise(done=>{const img=new Image(),stop=setTimeout(done,3000);img.onload=()=>{if(img.naturalWidth&&img.naturalHeight)a.ratio=img.naturalWidth/img.naturalHeight;clearTimeout(stop);done();};img.onerror=()=>{clearTimeout(stop);done();};img.src=a.src;})));
     assetsFor[id]=list;
    }
   }
   async function loadAll(){
    plan=await v2.call('instagram.plan.get',{id:ctx.params.id});
    if(!plan.layouts?.[FORMAT])return;
    await loadCatalogue();await loadLook(lookId());
    if(sel>=frames().length)sel=0;
   }

   /* ---------- what the layouts offer ---------- */
   function offered(){
    const look=lookId(),seen=new Set(),ok=t=>t.code&&t.formats.includes(FORMAT)&&(!t.onlyIn||t.onlyIn===look)&&(!t.owner||!Array.isArray(t.looks)||t.looks.includes(look))&&!(t.owner&&t.status&&t.status!=='kept')&&!seen.has(t.code)&&seen.add(t.code);
    const all=cat.filter(ok),groups=[],yours=all.filter(t=>t.owner);
    if(yours.length)groups.push({key:'yours',title:'Yours',items:yours});
    for(const t of all.filter(t=>!t.owner)){let g=groups.find(x=>x.key===t.rowLetter);if(!g){g={key:t.rowLetter,letter:t.rowLetter,title:t.row||'',items:[]};groups.push(g);}g.items.push(t);}
    return groups;
   }
   const flat=()=>offered().flatMap(g=>g.items);
   const wordsLen=fr=>fr.words.map(w=>w.text).join('\n\n').length;
   const suits=(t,fr,i)=>t.photos===fr.photos.length&&t.maxChars>=wordsLen(fr)&&t.textParts>=fr.words.length&&(!t.roles?.length||t.roles.includes(fr.role||(i===0?'cover':'inner')));
   function blocked(id){
    for(const [i,fr] of frames().entries()){const t=tplOf(fr.templateId);
     if(t?.onlyIn&&t.onlyIn!==id)return 'Slide '+(i+1)+' uses '+t.code+', a '+lookName(t.onlyIn)+' layout. Change that slide first.';
     if(t?.owner&&Array.isArray(t.looks)&&!t.looks.includes(id))return 'Slide '+(i+1)+' uses '+t.code+', your template for the '+listing(t.looks.map(lookName))+' look.';}
    return '';
   }

   /* ---------- writing: one place, so a held, stale or refused answer reads the same everywhere ---------- */
   const clean=list=>list.map(f=>{const {words,...rest}=f;return {...rest,words:words.map(w=>({lineId:w.lineId,text:w.text}))};});
   async function act(name,input,done){
    if(busy)return null;busy=true;
    const yes=Object.keys(plan.ready||{});
    try{
     const out=await v2.call(name,{id:plan.id,...v2.expect(plan),...input});
     const {codes,...next}=out;plan=next;
     const cleared=yes.filter(f=>!plan.ready?.[f]);
     const text=(typeof done==='function'?done(out):done)+(cleared.length?' Your yes was cleared: say Ready again when it looks right.':'');
     busy=false;paint();
     if(text)say(text,'good');
     return out;
    }catch(e){
     busy=false;
     if(e.kind==='stale'){try{plan=e.fresh||await v2.call('instagram.plan.get',{id:plan.id});}catch{}keys.stage=keys.panel=keys.strip=null;paint();say(e.message,'warn');}
     else say(e.message,'bad');
     return null;
    }finally{busy=false;}
   }
   async function writeFrames(list,msg,{undo=true}={}){
    const before=clean(frames());
    const out=await act('instagram.layout',{storyId:storyId(),format:FORMAT,frames:clean(list)},msg);
    if(out&&undo)v2.ui.undo(msg,()=>{void writeFrames(before,'Put back.',{undo:false});});
    return out;
   }
   function fitWords(t){
    return w=>{if(w.text.length<=t.maxChars)return w;const head=w.text.slice(0,t.maxChars),cut=Math.max(head.lastIndexOf(', '),head.lastIndexOf('; '),head.lastIndexOf(' - '),head.lastIndexOf('. '));
     return {lineId:w.lineId,text:cut>t.maxChars*0.4?head.slice(0,cut):head.slice(0,head.lastIndexOf(' ')>0?head.lastIndexOf(' '):t.maxChars)};};
   }
   function useLayout(t,i=sel){
    const fit=fitWords(t),cut=frames()[i].words.some(w=>w.text.length>t.maxChars);
    const list=frames().map((f,k)=>k===i?{...f,templateId:t.id,words:f.words.map(fit),photos:f.photos.slice(0,t.photos)}:f);
    return writeFrames(list,'Slide '+(i+1)+' is now '+t.code+' '+t.name+'.'+(cut?' Its words were cut to fit; the full line stays in the transcript.':''));
   }
   function step(dir){
    const list=flat();if(!list.length)return;const cur=tplOf(frames()[sel].templateId),at=list.findIndex(t=>t.id===cur?.id);
    const next=list[(at<0?(dir>0?0:list.length-1):at+dir+list.length)%list.length];if(next)void useLayout(next);
   }
   /* Mix: each slide gets a layout that suits it (same photo count, room for its words, the right role), never the same as
      its neighbour, and the rows take turns. Nothing is cut; Undo puts every slide back. */
   function mix(){
    const list=flat(),n=frames().length;if(!list.length)return;
    const out=[],picked=[];let lastRow='';
    frames().forEach((fr,i)=>{
     const prev=picked[i-1],after=tplOf(frames()[i+1]?.templateId)?.id,ok=list.filter(t=>suits(t,fr,i)&&t.id!==prev&&t.id!==after&&t.id!==fr.templateId);
     const other=ok.filter(t=>t.rowLetter!==lastRow),pool=other.length?other:ok;
     if(!pool.length){picked.push(fr.templateId);out.push(fr);return;}
     const t=pool[(i*7+3)%pool.length];picked.push(t.id);lastRow=t.rowLetter||'';
     out.push({...fr,templateId:t.id});
    });
    if(out.every((f,i)=>f.templateId===frames()[i].templateId))return say('No other layouts suit these slides, so nothing changed.');
    void writeFrames(out,'Mixed the layouts across '+n+' slides: '+out.map(f=>tplOf(f.templateId)?.code||'?').join(', ')+'.');
   }
   async function build(line){
    line=String(line||'').trim();
    if(!line){sayText='';said={line:'',missed:'Type the codes first, like "use C1, 2 and 5".'};return paint();}
    const out=await act('instagram.plan.codes',{say:line,format:FORMAT,storyId:storyId()},r=>{const used=r.codes?.used||[];return used.length?'Built from what you said: '+used.map(u=>'slide '+u.slide+' is '+u.code+' '+u.name).join(', ')+'.':'';});
    if(out){sayText='';const c=out.codes||{},used=c.used||[],un=c.unused||[];said={line,done:used.length?'Built '+used.length+' slide'+(used.length>1?'s':'')+' from what you said.':'',missed:un.length?'Could not use '+un.map(u=>u.code+': '+String(u.why||'').replace(/\.$/,'')).join('; ')+'.':(!used.length?'No layout code was found in that line.':'')};}
    else said={line,missed:'Nothing was built.'};
    keys.panel=null;paint();
   }
   async function changeLook(id){
    if(id===lookId())return;await loadLook(id).catch(()=>{});
    const accts=acctFor[id]||[],a=plan.account,body={look:id};
    if(a?.from==='plan'&&!accts.some(x=>x.id===a.id))body.account=accts[0]?.id||'auto';
    const before=a?.id;
    const out=await act('instagram.look',body,r=>'Drawn in the '+lookName(id)+' look.'+(r.account&&r.account.id!==before?' Now posts to '+r.account.name+'.':''));
    if(out)v2.brand(lookId());
   }
   async function templateCall(name,input,done){
    if(busy)return;busy=true;
    try{const out=await v2.call(name,input);await loadCatalogue();busy=false;keys.panel=keys.stage=null;paint();say(done(out),'good');}
    catch(e){busy=false;say(e.message,'bad');}finally{busy=false;}
   }
   async function crop(dx,dy){
    const fr=frames()[sel],cur=fr.photos[slot];if(!cur)return;
    const clamp=v=>Math.max(0,Math.min(100,v));
    const next=(dx||dy)?{...cur,x:clamp((cur.x??50)+dx),y:clamp((cur.y??50)+dy)}:{...cur,x:50,y:50};
    await writeFrames(frames().map((f,i)=>i===sel?{...f,photos:f.photos.map((p,j)=>j===slot?next:p)}:f),'Slide '+(sel+1)+': the crop of place '+(slot+1)+' moved.');
   }
   function makeSheet(){
    const sh=v2.ui.sheet({title:'Make a new layout',body:'<p>It would be drawn inside the '+esc(lookName(lookId()))+' look: its colours, type, logo and rules.</p><p class="sl-dim">Drawing a layout from words is not built yet. For now an assistant adds one as a proposal: it appears under Proposed by assistants in Layout, and you accept or turn it down. You can also keep this slide as a template.</p><p class="sl-row"><button type="button" class="pri" data-make="save">Save this slide as a template</button><button type="button" data-make="close">Close</button></p>'});
    sh.body.addEventListener('click',e=>{const b=e.target.closest('[data-make]');if(!b)return;sh.close();if(b.dataset.make==='save'){saveOpen=true;paint();root.querySelector('[data-sl-form="savet"] [name="name"]')?.focus();}});
   }
   const savePlaced=(list,msg)=>act('instagram.placed',{format:FORMAT,slide:sel+1,placed:list},msg);
   async function setPhoto(j,photoId){
    const fr=frames()[sel],t=tplOf(fr.templateId),list=[...fr.photos];
    if(j<list.length)list[j]={...list[j],photoId};else if(!t||list.length<t.photos)list.push({photoId,x:50,y:50});else return;
    await writeFrames(frames().map((f,i)=>i===sel?{...f,photos:list}:f),'Slide '+(sel+1)+' now uses '+(photoOf(photoId)?.caption||photoId)+'.');
   }

   /* ---------- placed things ---------- */
   const plHeight=p=>p.height??(p.kind==='picture'?Math.round(p.width*1.25):p.kind==='label'?Math.ceil((p.size??30)*1.4):p.kind==='rule'?2:p.width);
   const plStyle=p=>'left:calc(var(--k) * '+p.x+'px);top:calc(var(--k) * '+p.y+'px);width:calc(var(--k) * '+p.width+'px);height:calc(var(--k) * '+Math.max(plHeight(p),8)+'px)';
   const assetOf=a=>(assetsFor[lookId()]||[]).find(x=>x.id===a);
   const thingName=p=>p.kind==='label'?'Label "'+p.text+'"':p.kind==='rule'?'Rule':p.kind==='picture'?'Picture':assetOf(p.asset)?.name||p.asset;
   function newThing(kind,asset,text){
    const n=(frames()[sel].placed||[]).length,off=n*24;
    if(kind==='rule')return {kind,x:410,y:Math.min(H-40,900+off),width:260,height:3};
    if(kind==='label'){const size=30,width=Math.min(900,Math.round(text.length*size*0.82)+24);return {kind,text,size,x:90,y:Math.min(H-60,90+off),width};}
    if(kind==='picture')return {kind,asset,x:420-off,y:480+off,width:300,height:360};
    const a=assetOf(asset)||{};
    if(kind==='mark'){const s=96;return {kind,asset,x:W-72-s-off,y:72+off,width:s,height:s};}
    if(kind==='logo'){const word=rolesFor[lookId()]?.logo?.wordmark||lookName(lookId()),height=a.src?0:70,width=a.src?260:Math.min(900,Math.round(word.length*height*0.4)+40);const h=a.src?Math.round(width/(a.ratio||3.4)):height;return {kind,asset,x:Math.round((W-width)/2),y:Math.min(H-h-60,H-200-off),width,height:h};}
    return {kind,asset,x:420-off,y:480+off,width:240,height:240};
   }
   function resized(p,factor){
    const r={...p};
    if(p.kind==='label'){r.size=Math.max(16,Math.min(160,Math.round((p.size||30)*factor)));r.width=Math.min(W-p.x,Math.max(20,Math.round(p.width*factor)));if(r.y+Math.ceil(r.size*1.4)>H)return p;return r;}
    let w=Math.max(p.kind==='rule'?40:32,Math.round(p.width*factor));w=Math.min(w,W-p.x);
    if(p.kind==='rule'){r.width=w;return r;}
    const ratio=plHeight(p)/p.width;let h=Math.round(w*ratio);if(p.y+h>H){h=H-p.y;w=Math.max(32,Math.round(h/ratio));}
    r.width=w;r.height=h;return r;
   }
   function liveMove(i,p){
    const big=root.querySelector('.sl-big');if(!big)return;const box=big.querySelector('[data-pl="'+i+'"]');if(box)box.setAttribute('style',plStyle(p));
    try{const doc=big.querySelector('iframe').contentDocument,els=[...doc.querySelectorAll('[data-placed-index]')],n=(frames()[sel].placed||[]).length,max=Math.max(-1,...els.map(e=>+e.dataset.placedIndex)),off=Math.max(0,max+1-n),el=doc.querySelector('[data-placed-index="'+(off+i)+'"]');
     if(el){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.width=p.width+'px';el.style.height=plHeight(p)+'px';if(p.kind==='label')el.style.fontSize=(p.size||30)+'px';}}catch{}
   }
   function onPointerDown(e){
    const box=e.target.closest?.('.sl-pl');if(!box||busy)return;const i=+box.dataset.pl,p=frames()[sel].placed?.[i];if(!p)return;
    const big=box.closest('.sl-big'),k=parseFloat(big.style.getPropertyValue('--k'))||1;
    drag={i,k,start:p,cur:p,sx:e.clientX,sy:e.clientY,resize:!!e.target.closest('.sl-plh'),moved:false};try{box.setPointerCapture?.(e.pointerId);}catch{}box.classList.add('on');e.preventDefault();box.focus({preventScroll:true});
   }
   function onPointerMove(e){
    if(!drag)return;const dx=(e.clientX-drag.sx)/drag.k,dy=(e.clientY-drag.sy)/drag.k,p=drag.start;if(Math.abs(dx)+Math.abs(dy)>2)drag.moved=true;
    if(drag.resize)drag.cur=resized(p,Math.max(0.05,(p.width+dx)/p.width));
    else{const h=plHeight(p);drag.cur={...p,x:Math.round(Math.max(0,Math.min(W-p.width,p.x+dx))),y:Math.round(Math.max(0,Math.min(H-h,p.y+dy)))};}
    liveMove(drag.i,drag.cur);
   }
   function onPointerUp(){
    if(!drag)return;const d=drag;drag=null;
    if(!d.moved){root.querySelector('.sl-big [data-pl="'+d.i+'"]')?.classList.remove('on');return;}
    const list=[...frames()[sel].placed];list[d.i]=d.cur;void savePlaced(list,d.resize?thingName(d.cur)+': new size kept.':thingName(d.cur)+': moved.');
   }
   function onPlacedKey(e){
    const box=e.target.closest?.('.sl-pl');if(!box)return;const i=+box.dataset.pl,list=[...(frames()[sel].placed||[])],p=list[i];if(!p)return;
    const stp=e.shiftKey?50:10,h=plHeight(p);let n=null;
    if(e.key==='ArrowLeft')n={...p,x:Math.max(0,p.x-stp)};else if(e.key==='ArrowRight')n={...p,x:Math.min(W-p.width,p.x+stp)};
    else if(e.key==='ArrowUp')n={...p,y:Math.max(0,p.y-stp)};else if(e.key==='ArrowDown')n={...p,y:Math.min(H-h,p.y+stp)};
    else if(e.key==='+'||e.key==='=')n=resized(p,1.1);else if(e.key==='-')n=resized(p,1/1.1);
    else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();list.splice(i,1);void savePlaced(list,thingName(p)+': taken off the slide.');return;}
    if(!n)return;e.preventDefault();list[i]=n;frames()[sel].placed=list;liveMove(i,n);
    clearTimeout(keyTimer);keyTimer=setTimeout(()=>void savePlaced(frames()[sel].placed,thingName(n)+': moved.'),700);
   }

   /* ---------- drawing ---------- */
   const FR=(src,cw,label)=>'<span class="sl-fr" style="--cw:'+cw+'px;--s:'+(cw/W).toFixed(5)+'"><iframe title="'+esc(label)+'" data-src="'+esc(src)+'" tabindex="-1"></iframe></span>';
   const renderSrc=i=>'/api/instagram/render?'+q({id:plan.id,format:FORMAT,frame:String(i),r:sig([frames()[i],lookId(),plan.account?.id])});
   const previewSrc=layout=>'/api/instagram/preview?'+q({id:plan.id,format:FORMAT,frame:String(sel),layout,plain:'1',r:sig([frames()[sel].words,frames()[sel].photos,lookId()])});

   const needI=()=>frames().findIndex(f=>{const t=tplOf(f.templateId);return t&&t.photos>0&&f.photos.length<t.photos;});
   function headHTML(){
    const cur=lookId(),accts=acctFor[cur]||[],a=plan.account,fl=frames().length,need=needI();
    const looks=looksList.length?looksList:[{id:cur}];
    const why=[];
    const dot=id=>tints[id]&&tints[id]!=='-'?'<i style="--brc:'+tints[id]+'"></i>':'<i></i>';
    const pill=(x,chip)=>{const w=x.id===cur?'':blocked(x.id);if(w&&!chip)why.push(lookName(x.id)+' cannot draw these slides yet. '+w);return '<button type="button" data-sl="look" data-id="'+esc(x.id)+'" aria-pressed="'+(x.id===cur)+'"'+(w?' disabled title="'+esc(w)+'"':'')+'>'+(chip?'':dot(x.id))+esc(lookName(x.id))+(chip?' look':'')+'</button>';};
    const pills=looks.map(x=>pill(x,false)).join(''),chips=looks.map(x=>pill(x,true)).join('');
    const acctBtn=x=>'<button type="button" data-sl="account" data-id="'+esc(x.id)+'" aria-pressed="'+(a?.id===x.id)+'">'+esc(x.name)+'</button>';
    const posts=accts.length?accts.map(acctBtn).join(''):a?.name?'<button type="button" aria-pressed="true">'+esc(a.name)+'</button>':'<span class="sl-one">No account posts this look yet</span>';
    // Back and Done return to the form and step he left: the Carousel form at The slides step (the studio is opened from there).
        const formKey='ig:'+plan.id,back=plan.subject?v2.href('subject/:id',{id:plan.subject},{form:formKey,step:'slides'}):'#/';
    return '<div class="sl-bar"><a class="sl-back" href="'+esc(back)+'" aria-label="Back to the subject">'+ic('back')+'<span>The subject</span></a><h1 class="sl-t">Carousel</h1><span class="sl-n">'+fl+' slide'+(fl>1?'s':'')+(need>=0?' · slide '+(need+1)+' needs a photograph':'')+'</span><span class="sl-sp"></span>'
     +'<div class="sl-seg sl-looks" role="group" aria-label="Look">'+pills+'</div><div class="sl-seg sl-acct" role="group" aria-label="Posts to"><em>Posts to</em>'+posts+'</div>'
     +'<button type="button" data-sl="mix" title="Give each slide a different layout that suits it">Mix the layouts</button><a class="sl-done" href="'+esc(back)+'">Done</a></div>'
     +'<div class="sl-looks2" role="group" aria-label="Look">'+chips+(accts.length>1?'<span class="sl-sp"></span>'+accts.map(acctBtn).join(''):'')+'</div>'
     +why.map(w=>'<p class="sl-dim sl-why">'+esc(w)+'</p>').join('');
   }
   const codesList=()=>offered().map(g=>g.items[0]?.code).filter(Boolean).slice(0,9);
   function sayHTML(){
    const n=said,codes=codesList();
    return '<form class="sl-say" data-sl-form="say"><button type="button" class="v2-ghost v2-icon-btn" data-sl="speak" aria-label="Speak">'+ic('ask')+'</button><input name="say" maxlength="400" autocomplete="off" value="'+esc(sayText)+'" placeholder="Say or type it: use '+esc(codes.length?codes.slice(0,6).join(', '):'C1, 2 and 5')+'" aria-label="Tell the studio which layouts to use" title="Slide 1 takes the first code, slide 2 the next. A letter carries on: C1, 2 and 5 is C1, C2 and C5."><button type="submit" class="pri">Build</button></form>'
     +(codes.length?'<div class="sl-try"><span>Try</span><button type="button" data-sl="try" data-text="'+esc(codes.join(', '))+'">'+esc(codes.join(', '))+'</button></div>':'')
     +(n?'<div class="sl-said" role="status">'+(n.done?'<p class="sl-ok">'+esc(n.done)+'</p>':'')+(n.missed?'<p class="sl-bad">'+esc(n.missed)+'</p>':'')+'</div>':'');
   }
   function stripHTML(){
    return frames().map((fr,i)=>{const t=tplOf(fr.templateId);
     return '<div class="sl-thumb" role="button" tabindex="0" data-n="'+i+'" aria-label="Slide '+(i+1)+(t?', '+esc(t.code)+' '+esc(t.name):'')+'" aria-current="'+(i===sel)+'">'+FR(renderSrc(i),stripCw(),'Slide '+(i+1))+'<span class="sl-tl">'+(i+1)+'</span></div>';}).join('')+'<button type="button" class="sl-addsl" data-sl="addslide" aria-label="Add a slide">'+ic('plus')+'</button>';
   }
   function stageHTML(){
    const fr=frames()[sel],t=tplOf(fr.templateId),a=plan.account;
    const boxes=(fr.placed||[]).map((p,i)=>'<div class="sl-pl" tabindex="0" role="button" data-pl="'+i+'" style="'+plStyle(p)+'" aria-label="'+esc(thingName(p))+'. Drag to move, or use the arrow keys; plus and minus change its size."><span class="sl-plh" aria-hidden="true"></span></div>').join('');
    const code=t?.rowLetter&&nextCodes[t.rowLetter];
    return '<div class="sl-big" style="aspect-ratio:'+W+'/'+H+'"><iframe class="sl-first" title="Slide '+(sel+1)+', large" data-src="'+esc(renderSrc(sel))+'" tabindex="-1"></iframe><div class="sl-over">'+boxes+'</div></div>'
     +'<div class="sl-cap"><span class="sl-capt"><b>'+(sel+1)+' · '+esc(ROLE[fr.role]||'Inner')+'</b> · '+(t?'<b class="sl-code">'+esc(t.code||'')+'</b> '+esc(t.name):esc(fr.templateId))+'<small>'+esc(t?(t.owner?'Yours':(t.row||t.rowLetter||'')):'')+(a?.name?' · posts to '+esc(a.name):'')+'</small></span>'
     +'<button type="button" class="v2-ghost sl-fav" data-sl="fav" aria-label="Mark as a favourite" title="Favourites are not built yet">☆</button><span class="sl-sp"></span>'
     +'<button type="button" class="v2-ghost v2-icon-btn" data-sl="prev-layout" aria-label="Previous layout">'+ic('back')+'</button><button type="button" class="v2-ghost v2-icon-btn" data-sl="next-layout" aria-label="Next layout">'+ic('right')+'</button>'
     +'<button type="button" data-sl="make"><span aria-hidden="true">✦ </span>Make a layout</button><button type="button" data-sl="save-open" aria-expanded="'+saveOpen+'">Save as a template</button>'
     +'<button type="button" data-sl="mv" data-d="-1" class="sl-mv" '+(sel?'':'disabled')+'>Move earlier</button><button type="button" data-sl="mv" data-d="1" class="sl-mv" '+(sel<frames().length-1?'':'disabled')+'>Move later</button></div>'
     +(saveOpen?'<form class="sl-savet" data-sl-form="savet"><p>'+(human()?(code?'It will be called <b class="sl-code">'+esc(code)+'</b>, the next free code in '+esc(t.row||t.rowLetter)+'. ':'')+'It keeps the layout and anything placed on it. The words and photographs stay with this Carousel.':'An assistant\'s template goes to Adrian as a proposal. It gets its code when he accepts it.')+'</p>'
      +'<label><span class="sl-lab">Name</span><input name="name" maxlength="80" required value="'+esc((t?.name||'My layout')+', mine')+'"></label>'
      +'<div class="sl-pills" role="radiogroup" aria-label="For which looks"><span class="sl-lab">For</span><label><input type="radio" name="looks" value="this" checked> The '+esc(lookName(lookId()))+' look</label><label><input type="radio" name="looks" value="all"'+(t?.onlyIn?' disabled':'')+'> Every look</label></div>'
      +'<div class="sl-row"><button type="submit" class="pri">Save template</button><button type="button" data-sl="save-cancel">Cancel</button></div></form>':'');
   }
   const tile=(t,cur)=>'<li class="sl-cell" data-find="'+esc((t.code+' '+t.name).toLowerCase())+'"><div class="sl-tile" role="button" tabindex="0" data-sl="use" data-id="'+esc(t.id)+'" aria-pressed="'+(t.code===cur)+'" title="'+esc(t.code+' '+t.name)+'">'+FR(previewSrc(t.id),104,t.code+' '+t.name)+'<span class="sl-tname"><b class="sl-code">'+esc(t.code)+'</b> '+esc(t.name)+'</span></div></li>';
   const yoursList=()=>flat().filter(t=>t.owner);
   function layoutTab(fr){
    const cur=tplOf(fr.templateId)?.code,groups=offered(),all=flat();
    const props=proposals.filter(t=>(t.formats||[]).includes(FORMAT)&&(!Array.isArray(t.looks)||t.looks.includes(lookId())));
    const fits=all.filter(t=>suits(t,fr,sel)&&(t.code!==cur)),yours=yoursList(),here=all.find(t=>t.code===cur);
    const list=here?[here,...fits]:fits;
    let set=lset;if(set==='yours'&&!yours.length)set='all';if(set==='suits'&&!list.length)set='all';
    const prop=t=>'<li class="sl-cell sl-prop"><span class="sl-propbox">'+FR(previewSrc(t.id),96,t.name)+'</span><span class="sl-tname">'+esc(t.name)+'<span class="sl-dim">'+esc((t.rowLetter||'')+' '+(t.row||''))+' · from '+esc(who(t.proposedBy))+'</span></span>'
     +(human()?'<span class="sl-row"><button type="button" data-sl="accept" data-id="'+esc(t.id)+'">Accept</button><button type="button" data-sl="turn-down" data-id="'+esc(t.id)+'">Turn down</button></span>':'<span class="sl-dim">Waiting for Adrian.</span>')+'</li>';
    const sw=[['suits','Suits this slide'],['all','All '+all.length],...(yours.length?[['yours','Yours · '+yours.length]]:[])];
    const body=set==='suits'?'<ul class="sl-cells">'+list.map(t=>tile(t,cur)).join('')+'</ul>'
     :set==='yours'?'<ul class="sl-cells">'+yours.map(t=>tile(t,cur)).join('')+'</ul>'
     :groups.map(g=>'<h4>'+(g.letter?'<b>'+esc(g.letter)+'</b>':'')+esc(g.title)+'<span>'+g.items.length+'</span></h4><ul class="sl-cells">'+g.items.map(t=>tile(t,cur)).join('')+'</ul>').join('');
    return '<div class="sl-chips" role="group" aria-label="Which layouts">'+sw.map(([k,n])=>'<button type="button" data-sl="lset" data-id="'+k+'" aria-pressed="'+(k===set)+'">'+esc(n)+'</button>').join('')+'</div>'
     +(props.length?'<h4>Proposed by assistants<span>'+props.length+'</span></h4><p class="sl-dim">Accept one and it gets the next free code in its row.</p><ul class="sl-cells sl-props">'+props.map(prop).join('')+'</ul>':'')
     +body
     +'<button type="button" class="sl-new" data-sl="make"><i aria-hidden="true">✦</i><span><b>Make a new layout</b><small>Describe it, or show a post you like. It is drawn in this look.</small></span></button>';
   }
   const advancedHref=section=>plan.subject?v2.advanced({subject:plan.subject,section}):'/document-study/index.html?instagram='+encodeURIComponent(plan.id);
   function photosTab(fr){
    const t=tplOf(fr.templateId),want=t?.photos??fr.photos.length,all=plan.material?.photos||[],slots=Math.max(want,fr.photos.length);
    if(slot>=Math.max(slots,1))slot=0;
    if(!slots)return '<p class="sl-dim">This layout carries no photograph. Choose another layout to add one, or place an inset picture from Add.</p>';
    const used=new Map();frames().forEach((f,i)=>f.photos.forEach(p=>{if(!used.has(p.photoId))used.set(p.photoId,[]);used.get(p.photoId).push(i+1);}));
    const places=Array.from({length:slots},(_,j)=>{const ph=fr.photos[j],p=ph&&photoOf(ph.photoId);
     return '<button type="button" class="sl-place" data-sl="slot" data-n="'+j+'" aria-pressed="'+(j===slot)+'" aria-label="Place '+(j+1)+(p?': '+esc(p.caption||p.id):': none yet')+'">'+(p?'<img src="'+esc(blob(p))+'" alt="" loading="lazy">':'<span class="sl-blank"></span>')+'<small>'+(j+1)+'</small></button>';}).join('');
    const cur=fr.photos[slot];
    return '<p class="sl-label">Places on this slide</p><div class="sl-places">'+places+'</div>'
     +'<p class="sl-label">This subject\'s photographs</p>'+(all.length?'<ul class="sl-photos">'+all.map(p=>{const on=used.get(p.id)||[];return '<li><button type="button" class="sl-photo" data-sl="photo" data-id="'+esc(p.id)+'" aria-pressed="'+(cur?.photoId===p.id)+'" title="'+esc(p.caption||p.id)+'" aria-label="'+esc((p.caption||p.id)+(on.length?', on slide '+on.join(' and '):''))+'"><img src="'+esc(blob(p))+'" alt="" loading="lazy"></button></li>';}).join('')+'</ul>':'<p class="sl-dim">This plan has no photographs yet.</p>')
     +'<div class="sl-row"><a class="sl-btn" href="'+esc(advancedHref('media'))+'">From the Library</a><button type="button" class="v2-ghost" data-sl="crop-open" aria-expanded="'+cropOpen+'"'+(cur?'':' disabled')+'>Move the crop</button></div>'
     +(cropOpen&&cur?'<div class="sl-crop" role="group" aria-label="Move the crop of place '+(slot+1)+'"><button type="button" data-sl="crop" data-dx="-10" data-dy="0">Left</button><button type="button" data-sl="crop" data-dx="10" data-dy="0">Right</button><button type="button" data-sl="crop" data-dx="0" data-dy="-10">Up</button><button type="button" data-sl="crop" data-dx="0" data-dy="10">Down</button><button type="button" data-sl="crop" data-dx="0" data-dy="0">Centre</button></div>':'')
     +'<p class="sl-dim">Photographs are cropped to fit and never stretched.</p>';
   }
   function assetTile(a){
    const look=lookId(),r=rolesFor[look]?.dark,c=v=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:'',ground=c(r?.ground),accent=c(r?.accent),head=c(r?.headline);
    const face=a.src?'<img src="'+esc(a.src)+'" alt="">':a.kind==='mark'&&a.text?'<b class="sl-seal"'+(accent&&ground?' style="background:'+accent+';color:'+ground+'"':'')+'>'+esc(a.text)+'</b>':'<b class="sl-word"'+(head?' style="color:'+head+'"':'')+'>'+esc(a.kind==='logo'?(rolesFor[look]?.logo?.wordmark||lookName(look)):a.name)+'</b>';
    return '<li><div class="sl-tile sl-thing" role="button" tabindex="0" data-sl="place" data-kind="'+esc(a.kind)+'" data-id="'+esc(a.id)+'"><span class="sl-face"'+(ground?' style="background:'+ground+'"':'')+'>'+face+'</span><span class="sl-tname">'+esc(a.name)+'</span></div></li>';
   }
   function addTab(fr){
    const list=fr.placed||[],left=(plan.placedLeftOut||[]).filter(x=>x.format===FORMAT&&x.slide===sel+1),assets=assetsFor[lookId()]||[],ph=(plan.material?.photos||[])[0];
    const plain=(k,face,name,extra)=>'<li><div class="sl-tile sl-thing" role="button" tabindex="0" data-sl="'+k+'"'+(extra||'')+'><span class="sl-face sl-neutral">'+face+'</span><span class="sl-tname">'+name+'</span></div></li>';
    return '<p class="sl-label">'+esc(lookName(lookId()))+'\'s logo, marks and graphics</p><ul class="sl-things">'+assets.map(assetTile).join('')
     +'<li><a class="sl-tile sl-thing sl-up" href="'+esc(v2.href('looks',{},{look:lookId()}))+'"><span class="sl-face sl-up">'+ic('plus')+'</span><span class="sl-tname">Bring in a logo, icon or graphic</span></a></li></ul>'
     +(assets.length?'':'<p class="sl-dim">This look has no logo or marks yet.</p>')+'<p class="sl-dim">These belong to this look. Change the look and they change with it.</p>'
     +'<p class="sl-label">For any look</p><ul class="sl-things">'+plain('label-open','<b class="sl-lab2">LABEL</b>','Small label',' aria-expanded="'+labelOpen+'"')+plain('place','<b class="sl-rule"></b>','Rule',' data-kind="rule"')+plain('place','<b class="sl-inset">'+(ph?'<img src="'+esc(blob(ph))+'" alt="">':'')+'</b>','Inset picture',' data-kind="picture"'+(ph?' data-id="'+esc(ph.id)+'"':''))+'</ul>'
     +(labelOpen?'<form class="sl-row" data-sl-form="label"><input name="label" maxlength="60" placeholder="A short label, like JOURNEY 04" aria-label="Label words"><button type="submit">Add the label</button></form>':'')
     +'<p class="sl-label">On this slide</p>'+(list.length?'<ul class="sl-on">'+list.map((p,i)=>'<li><span>'+esc(thingName(p))+'</span><button type="button" class="v2-ghost v2-icon-btn" data-sl="size" data-n="'+i+'" data-d="-1" aria-label="Smaller: '+esc(thingName(p))+'">−</button><button type="button" class="v2-ghost v2-icon-btn" data-sl="size" data-n="'+i+'" data-d="1" aria-label="Bigger: '+esc(thingName(p))+'">+</button><button type="button" class="v2-ghost v2-icon-btn" data-sl="unplace" data-n="'+i+'" aria-label="Remove: '+esc(thingName(p))+'">'+ic('close')+'</button></li>').join('')+'</ul><p class="sl-dim">Drag anything you placed to move it on the slide, or focus it and use the arrow keys.</p>'
      :'<p class="sl-dim">Nothing placed yet. Press a logo or graphic to put it on the slide, then drag it where you want it.</p>')
     +(left.length?'<p class="sl-warn">'+left.map(x=>esc(x.why)).join(' ')+'</p>':'');
   }
   function wordsTab(fr){
    const t=tplOf(fr.templateId),text=fr.words.map(w=>w.text).join(' ').trim(),n=text?text.split(/\s+/).length:0,chars=fr.words.map(w=>w.text).join('\n\n').length;
    const f=(l,v)=>'<div class="sl-f"><span class="sl-label">'+esc(l)+'</span><p class="sl-field">'+esc(v)+'</p></div>';
    return (fr.words.length?fr.words.map((w,j)=>f(fr.words.length>1?(j===0?'Main line':'Second line'):'The line',w.text)).join(''):'<p class="sl-dim">This layout carries no words. The photograph speaks.</p>')
     +(fr.label?f('Small label',fr.label):'')+(fr.credit?f('Who said it',fr.credit):'')
     +(fr.words.length?'<p class="sl-dim'+(t&&chars>t.maxChars?' sl-over-limit':'')+'">'+n+' word'+(n===1?'':'s')+'. '+(t?'This layout holds up to '+t.maxChars+' characters.':'')+'</p>':'')
     +'<div class="sl-row"><a class="sl-btn" href="'+esc(advancedHref('write'))+'">Change the words in Write</a></div>'
     +'<p class="sl-dim">These are his words from the transcript, kept exactly, so they are changed in Write, not here. Saying a line again, and three other lines from the recording, are not built yet.</p>';
   }
   function panelHTML(){
    const fr=frames()[sel],body=tab==='photos'?photosTab(fr):tab==='add'?addTab(fr):tab==='words'?wordsTab(fr):layoutTab(fr);
    return sayHTML()+'<div class="sl-ptabs" role="group" aria-label="Change this slide">'+[['layout','Layout'],['photos','Photographs'],['add','Add'],['words','Words']].map(([k,n])=>'<button type="button" data-sl="ptab" data-id="'+k+'" aria-pressed="'+(tab===k)+'">'+n+'</button>').join('')+'</div><div class="sl-pbody">'+body+'</div>';
   }

   /* a region repaints only when what it shows has changed, so slides do not flash while he works */
   /* Frames load as they come near the window, six at a time, and are let go again when they are far away; the box keeps its size. */
   const wait=[];let loading=0;
   function pump(){
    while(loading<6&&wait.length){const f=wait.shift();if(!f.isConnected||f.dataset.live||!f.dataset.src)continue;
     f.dataset.live='1';loading++;let done=false;const fin=()=>{if(done)return;done=true;loading=Math.max(0,loading-1);pump();};
     f.addEventListener('load',fin,{once:true});f.addEventListener('error',fin,{once:true});setTimeout(fin,6000);f.src=f.dataset.src;}
   }
   function seen(en){
    const f=en.target;if(!f.dataset.src)return;
    if(en.isIntersecting){if(!f.dataset.live&&!wait.includes(f)){f.classList.contains('sl-first')?wait.unshift(f):wait.push(f);pump();}}
    else{const at=wait.indexOf(f);if(at>=0)wait.splice(at,1);if(f.dataset.live){delete f.dataset.live;f.src='about:blank';}}
   }
   function lazy(scope){
    for(const f of scope.querySelectorAll('iframe[data-src]')){
     if(!io){f.src=f.dataset.src;continue;}
     io.observe(f);
    }
   }
   function fit(){
    const big=root.querySelector('.sl-big');if(!big)return;
    const set=()=>big.style.setProperty('--k',String(big.clientWidth/W));set();
    watch?.disconnect();if(window.ResizeObserver){watch=new ResizeObserver(set);watch.observe(big);}
   }
   function region(name,html,key,after){
    const node=root.querySelector('[data-region="'+name+'"]');if(!node||keys[name]===key)return false;
    keys[name]=key;
    const top=node.scrollTop,had=node.contains(document.activeElement)?document.activeElement.dataset:null;
    node.innerHTML=html;after?.(node);
    if(top)node.scrollTop=top;
    if(had?.sl){const again=node.querySelector('[data-sl="'+CSS.escape(had.sl)+'"]'+(had.id!==undefined?'[data-id="'+CSS.escape(had.id)+'"]':had.n!==undefined?'[data-n="'+CSS.escape(had.n)+'"]':''));again?.focus?.({preventScroll:true});try{if(again&&again.setSelectionRange&&again.type==='search'){const n=again.value.length;again.setSelectionRange(n,n);}}catch{}}
    return true;
   }
   function paint(){
    if(!root.isConnected||!plan?.layouts?.[FORMAT])return;
    const fr=frames()[sel],fsig=sig([fr,lookId(),plan.account?.id]);
    region('head',headHTML(),sig([lookId(),plan.account,looksList.map(l=>l.id),acctFor[lookId()],tints,frames().map(f=>[f.templateId,f.photos.length])]));
    region('strip',stripHTML(),sig([stripCw(),frames().map(f=>[f,lookId(),plan.account?.id])]),n=>{lazy(n);stopReorder();stopReorder=v2.ui.reorder(n,{item:'.sl-thumb',label:e=>'Slide '+(+e.dataset.n+1),onMove:moveSlide});});
    region('stage',stageHTML(),sig([fsig,sel,saveOpen,frames().length,nextCodes,human(),assetsFor[lookId()]?.length]),n=>{lazy(n);fit();});
    region('panel',panelHTML(),sig([tab,sel,fsig,slot,lset,cropOpen,labelOpen,lookId(),said,proposals.map(p=>p.revision),assetsFor[lookId()]?.length,human(),(plan.material?.photos||[]).length,plan.placedLeftOut,frames().map(f=>f.photos)]),n=>{lazy(n);});
    for(const t of root.querySelectorAll('.sl-thumb'))t.setAttribute('aria-current',String(+t.dataset.n===sel));
   }
   async function moveSlide(from,to){
    const list=[...frames()],roles=list.map(f=>f.role),moved=list.splice(from,1)[0];list.splice(to,0,moved);
    const out=await writeFrames(list.map((f,i)=>({...f,role:roles[i]})),'Slide '+(from+1)+' moved to place '+(to+1)+'.');
    if(!out){keys.strip=null;paint();throw new Error('The new order could not be saved.');}
    sel=sel===from?to:(from<sel&&to>=sel?sel-1:(from>sel&&to<=sel?sel+1:sel));
    keys.strip=null;paint();
   }

   /* ---------- events ---------- */
   function onClick(e){
    if(e.target.closest('.v2-move'))return;
    const th=e.target.closest('.sl-thumb');if(th){sel=+th.dataset.n;saveOpen=false;return paint();}
    const b=e.target.closest('[data-sl]');if(!b||b.disabled)return;const what=b.dataset.sl;
    if(what==='mix')return mix();
    if(what==='make')return makeSheet();
    if(what==='fav')return say('Favourites are not built yet. Claude does not keep a list of the layouts you like.');
    if(what==='speak')return say('Speaking to the studio is not built yet. Type the codes instead.');
    if(what==='addslide')return say('Adding a slide is not built yet. The slides follow the story you write.');
    if(what==='try'){sayText=b.dataset.text||'';keys.panel=null;paint();return void root.querySelector('[name="say"]')?.focus();}
    if(what==='crop-open'){cropOpen=!cropOpen;return paint();}
    if(what==='crop')return void crop(+b.dataset.dx,+b.dataset.dy);
    if(what==='label-open'){labelOpen=!labelOpen;paint();return void root.querySelector('[data-sl-form="label"] [name="label"]')?.focus();}
    if(what==='look')return void changeLook(b.dataset.id);
    if(what==='account'){const a=(acctFor[lookId()]||[]).find(x=>x.id===b.dataset.id);if(!a||plan.account?.id===a.id)return;return void act('instagram.account',{account:a.id},'Now posts to '+a.name+'.');}
    if(what==='ptab'){tab=b.dataset.id;return paint();}
    if(what==='mv'){const to=sel+(+b.dataset.d);if(to<0||to>=frames().length)return;return void moveSlide(sel,to).catch(()=>{});}
    if(what==='lset'){lset=b.dataset.id;return paint();}
    if(what==='prev-layout')return step(-1);
    if(what==='next-layout')return step(1);
    if(what==='save-open'){saveOpen=!saveOpen;paint();if(saveOpen)root.querySelector('[data-sl-form="savet"] [name="name"]')?.focus();return;}
    if(what==='save-cancel'){saveOpen=false;return paint();}
    if(what==='use'){const t=tplOf(b.dataset.id);return t?void useLayout(t):null;}
    if(what==='slot'){slot=+b.dataset.n;return paint();}
    if(what==='photo')return void setPhoto(slot,b.dataset.id);
    if(what==='place'){const list=[...(frames()[sel].placed||[])];if(list.length>=12)return say('A slide holds up to twelve placed things.','warn');if(b.dataset.kind==='picture'&&!b.dataset.id)return say('This plan has no photographs to place yet.','warn');const p=newThing(b.dataset.kind,b.dataset.id);list.push(p);return void savePlaced(list,thingName(p)+' is on slide '+(sel+1)+'. Drag it where you want it.');}
    if(what==='size'||what==='unplace'){const i=+b.dataset.n,list=[...(frames()[sel].placed||[])],p=list[i];if(!p)return;
     if(what==='unplace'){list.splice(i,1);return void savePlaced(list,thingName(p)+': taken off the slide.');}
     list[i]=resized(p,+b.dataset.d>0?1.18:1/1.18);return void savePlaced(list,thingName(p)+': '+(+b.dataset.d>0?'bigger.':'smaller.'));}
    if(what==='accept'||what==='turn-down'){const t=proposals.find(x=>x.id===b.dataset.id);if(!t)return;
     return void templateCall('template.decide',{id:t.id,decision:what==='turn-down'?'turn-down':'accept',expectedRevision:t.revision,expectedHash:t.hash},r=>what==='accept'?'Accepted. "'+r.name+'" is '+r.code+' now, listed first under Yours. Say '+r.code+' to use it.':'Turned down. "'+r.name+'" is no longer offered.');}
   }
   function onKey(e){
    onPlacedKey(e);
    if(e.key!=='Enter'&&e.key!==' ')return;
    const th=e.target.closest?.('.sl-thumb');
    if(th&&e.target===th){e.preventDefault();sel=+th.dataset.n;saveOpen=false;return paint();}
    const t=e.target.closest?.('.sl-tile,.sl-photo');if(t&&e.target===t){e.preventDefault();t.click();}
   }
   function onSubmit(e){
    const form=e.target.closest('[data-sl-form]');if(!form)return;e.preventDefault();const k=form.dataset.slForm;
    if(k==='say')return void build(form.querySelector('[name="say"]').value);
    if(k==='label'){const text=form.querySelector('[name="label"]').value.trim();if(!text)return say('Type the label words first.','warn');const list=[...(frames()[sel].placed||[])];if(list.length>=12)return say('A slide holds up to twelve placed things.','warn');const p=newThing('label',null,text);list.push(p);return void savePlaced(list,thingName(p)+' is on slide '+(sel+1)+'. Drag it where you want it.');}
    if(k==='savet'){const f=new FormData(form),looks=f.get('looks')==='all'?'all':[lookId()];saveOpen=false;
     return void templateCall('instagram.template',{id:plan.id,format:FORMAT,slide:sel+1,name:String(f.get('name')||'').trim(),looks},r=>r.status==='kept'?'Saved as '+r.code+', "'+r.name+'". It is listed first under Yours. Say '+r.code+' to use it again.'+(r.leftOut?' '+r.leftOut:''):'Sent to Adrian as a proposal: "'+r.name+'". It gets its code when he accepts it.'+(r.leftOut?' '+r.leftOut:''));}
   }

   /* ---------- open ---------- */
   try{await loadAll();}
   catch(e){root.innerHTML='<header><h1>Slides</h1></header><p class="v2-msg" data-tone="bad"><span>'+esc(e.message||'The slides could not be read.')+'</span></p>';return;}
   if(gone)return;
   if(!plan.layouts?.[FORMAT]){
    const adv='/document-study/index.html?instagram='+encodeURIComponent(plan.id)+(v2.actor()&&!v2.isHuman()?'&reviewActor='+encodeURIComponent(v2.actor()):'');
    root.innerHTML='<div class="sl-empty" data-sl-empty><header><h1>Slides</h1><p>'+esc(plan.title||'This plan')+'</p></header>'
     +'<p>No slides have been laid out for this Carousel yet. An assistant lays them out once a story is chosen.</p>'
     +'<p class="sl-empty-go">'+(plan.subject?'<a class="v2-out" href="'+esc(v2.href('subject/:id',{id:plan.subject}))+'">Back to the subject</a>':'')+'<a class="v2-out" href="'+esc(adv)+'">Open in Advanced'+ic('out')+'</a></p></div>';
    ctx.setTitle('Slides');return;
   }
   if('IntersectionObserver' in window)io=new IntersectionObserver(es=>{for(const en of es)seen(en);},{rootMargin:'320px 0px'});
   ctx.setTitle('Carousel');if(plan.subject)ctx.setAdvanced({subject:plan.subject,section:'media'});
   v2.brand(lookId());
   root.innerHTML='<div class="sl-head" data-region="head"></div><div class="sl-work"><div class="sl-strip" data-region="strip" aria-label="Slides, in order"></div><div class="sl-stage" data-region="stage"></div><div class="sl-panel" data-region="panel"></div></div>';
   root.addEventListener('click',onClick);root.addEventListener('keydown',onKey);root.addEventListener('submit',onSubmit);
   root.addEventListener('input',e=>{if(e.target.matches('[name="say"]'))sayText=e.target.value;});
   window.addEventListener('resize',()=>{clearTimeout(rzTimer);rzTimer=setTimeout(paint,200);},{signal:ctx.signal});
   root.addEventListener('pointerdown',onPointerDown);root.addEventListener('pointermove',onPointerMove);root.addEventListener('pointerup',onPointerUp);root.addEventListener('pointercancel',onPointerUp);
   paint();
   ctx.on({kinds:['instagram*','template*','look*','account*']},()=>{clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{if(gone||busy||drag)return;try{await loadAll();v2.brand(lookId());paint();}catch{}},400);});
  }});
})(window.v2);
