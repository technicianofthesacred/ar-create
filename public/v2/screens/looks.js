/* Looks: one tab per look (looks), and for the chosen one its logo, colours, type, logo and marks (look.assets,
   look.asset.add), its rules, the accounts that post it (accounts, account.save) and its templates, plus Import a look
   from a DESIGN.md (look.import, then look.save). Every read and write is a registry command. */
(function(v2){
 'use strict';
 const esc=v2.ui.esc,ic=v2.ui.icon;
 const ROLES=[['ground','Ground'],['box','Boxes and bands'],['line','Lines'],['headline','Headlines'],['supporting','Supporting words'],['label','Labels'],['accent','Accent']];
 const BRANDS=['teajia','art','mandala-codes'];
 const hex=v=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:'';
 const lookName=id=>String(id||'').split('-').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
 const slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40);
 const family=f=>String(f||'').split(',')[0].replace(/["']/g,'').trim().replace(/[^\w \-]/g,'');
 const JOB={headline:'Headlines',display:'Headlines',supporting:'Supporting lines and paragraphs',body:'Supporting lines and paragraphs',label:'Labels, credits and links',chinese:'All Chinese text','photo-character':'Only for photographs set inside characters'};
 const jobOf=k=>JOB[k]||(String(k).charAt(0).toUpperCase()+String(k).slice(1).replace(/-/g,' '));

 /* ---- reading a DESIGN.md: only for showing it; the app's own import does the real reading ---- */
 function front(text){
  const m=/^---\n([\s\S]*?)\n---/.exec(String(text||''));const body=m?String(text).slice(m[0].length):String(text||'');
  const colors={},type=[];let sec='',cur=null;
  for(const line of (m?m[1]:'').split('\n')){
   if(/^\S/.test(line)){sec=/^(\w[\w-]*):/.exec(line)?.[1]||'';cur=null;continue;}
   if(sec==='colors'){const c=/^  ([\w-]+):\s*["']?([^"'\s]+)["']?/.exec(line);if(c)colors[c[1]]=c[2];}
   if(sec==='typography'){
    const k=/^  ([\w-]+):\s*$/.exec(line);if(k){cur={key:k[1],family:'',weight:400};type.push(cur);continue;}
    const f=/^    fontFamily:\s*["']?([^"'\n]+?)["']?\s*$/.exec(line);if(f&&cur)cur.family=f[1];
    const w=/^    fontWeight:\s*["']?(\d+)/.exec(line);if(w&&cur)cur.weight=+w[1];
   }
  }
  return {colors,type,body};
 }
 const plain=s=>String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/`([^`]*)`/g,'$1').replace(/\{(?:colors|typography)\.([\w-]+)\}/g,'$1').replace(/\s+/g,' ').trim();
 /** The short list of rules: the bullets under its Do's and Don'ts (or Rules) heading; else the first bullets it has. */
 function rulesOf(text){
  const {body}=front(text),parts=body.split(/^##\s+/m).slice(1).map(x=>{const k=x.indexOf('\n');return {title:x.slice(0,k).trim(),text:x.slice(k+1)};});
  const items=t=>t.split('\n').filter(l=>/^\s*[-*]\s+/.test(l)).map(l=>plain(l.replace(/^\s*[-*]\s+/,'')));
  const prose=t=>t.split('\n').map(l=>plain(l.replace(/^#+\s*/,''))).filter(Boolean);
  const named=parts.find(p=>/do'?s|rules|principles|guidelines/i.test(p.title));
  const pick=named||parts.find(p=>items(p.text).length);
  if(!pick)return [];
  const list=items(pick.text);
  return (list.length?list:named?prose(pick.text):[]).slice(0,10);
 }
 /** Set one guessed value in the slides block of a DESIGN.md text: "dark.ground" or "fonts.body" or "link". */
 function setSlideValue(text,role,value){
  const lines=String(text).split('\n'),at=lines.findIndex(l=>/^slides:\s*$/.test(l));if(at<0)return text;
  const path=role.split('.');let sec='';
  for(let i=at+1;i<lines.length;i++){
   const l=lines[i];if(/^\S/.test(l)&&!/^#/.test(l))break;
   const s=/^  ([\w-]+):\s*(.*)$/.exec(l);
   if(s){if(path.length===1&&s[1]===path[0]&&s[2]!==''){lines[i]='  '+path[0]+': '+JSON.stringify(value);return lines.join('\n');}sec=s[2]===''?s[1]:'';continue;}
   const k=/^    ([\w-]+):\s*(.*)$/.exec(l);
   if(k&&path.length===2&&sec===path[0]&&k[1]===path[1]){lines[i]='    '+path[1]+': '+JSON.stringify(value);return lines.join('\n');}
  }
  return text;
 }
 const guessLabel=r=>{const [a,b]=String(r).split('.');const n=ROLES.find(x=>x[0]===b)?.[1]||b;
  if(a==='dark'||a==='light')return (a==='dark'?'Dark':'Light')+' posts, '+n.toLowerCase();
  if(a==='fonts')return 'Typeface for '+({headline:'headlines',body:'supporting words',label:'labels'}[b]||b);
  if(a==='logo')return b?'Logo on '+b+' posts':'Logo';
  return r;};

 v2.screen({id:'looks',title:'Looks',route:'looks',brand:ctx=>ctx.query?.look||null,
  render:()=>'<div class="v2-page lk"><header><div><h1>Looks</h1><p>One look per brand: its colours, type, logo, graphics and slide templates. Every form in that brand\u2019s folder picks it up by itself.</p></div></header><div class="lk-body"><p class="lk-dim" role="status">Opening the looks.</p></div></div>',
  async mount(el,ctx){
   const root=el.querySelector('.lk-body');
   let looks=[],accounts=[],cat=[],proposals=[],plans=[],sel=null,rec=null,assets=[],busy=false,gone=false,addAcct=false,addAsset=false,imp=null,acctError='',tints={},fmts={};
   ctx.signal.addEventListener('abort',()=>{gone=true;});
   const say=(t,tone)=>v2.ui.say(t,{tone:tone||'info'});
   const call=(n,i)=>v2.call(n,i);

   async function loadList(){
    const [l,a,t,p,pl]=await Promise.all([call('looks'),call('accounts').catch(()=>({accounts:[]})),call('instagram.templates').catch(()=>({templates:[]})),call('templates',{status:'proposed'}).catch(()=>({templates:[]})),call('instagram.plans').catch(()=>({plans:[]}))]);
    looks=(l.looks||[]).slice().sort((x,y)=>{const o=i=>{const k=BRANDS.indexOf(i);return k<0?BRANDS.length:k;};return o(x.id)-o(y.id)||String(x.id).localeCompare(y.id);});fmts=t.formats||{};accounts=a.accounts||[];cat=t.templates||[];
    await Promise.all(looks.map(x=>tints[x.id]?0:call('look',{id:x.id}).then(r=>{const c=r.roles?.dark?.accent;tints[x.id]=hex(c)||'-';}).catch(()=>{tints[x.id]='-';})));
    proposals=p.templates||[];plans=pl.plans||[];
   }
   async function loadLook(id){
    rec=null;assets=[];if(!id)return;
    [rec,assets]=await Promise.all([call('look',{id}),call('look.assets',{id}).then(r=>r.assets||[]).catch(()=>[])]);
   }
   function choose(id){
    sel=id;try{history.replaceState(null,'','#/looks'+(id?'?look='+encodeURIComponent(id):''));}catch{}
    v2.brand(id);
   }

   /* ---------- pieces ---------- */
   const svg=d=>'<svg class="v2-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+d+'"/></svg>';
   const ICON={note:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',photo:'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a1 1 0 1 0 .01 0',layers:'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',share:'M12 3v12M8 7l4-4 4 4M5 13v7h14v-7'};
   function pillsHTML(){
    const dot=id=>'<i'+(hex(tints[id])?' style="--brc:'+tints[id]+'"':'')+'></i>';
    return '<div class="lk-pills" role="group" aria-label="Looks">'+looks.map(l=>'<button type="button" data-lk="look" data-id="'+esc(l.id)+'" aria-pressed="'+(!imp&&l.id===sel)+'">'+dot(l.id)+esc(lookName(l.id))+'</button>').join('')
     +'<button type="button" class="lk-add" data-lk="import" aria-pressed="'+(!!imp)+'" title="Make a look from a DESIGN.md">'+ic('plus')+' New look</button></div>';
   }
   function swatch(c,label,value){return '<li><i class="lk-sw"'+(hex(c)?' style="background:'+c+'"':'')+'></i><span>'+esc(label)+'</span><code>'+esc(hex(c)||value||'')+'</code></li>';}
   function logoBox(r,theme){
    const t=r?.[theme],path=r?.logo?.[theme],mark=String(r?.logo?.wordmark||'');
    const ff=family(r?.fonts?.headline?.family);
    return '<div class="lk-logo" style="background:'+(hex(t?.ground)||'transparent')+';color:'+(hex(t?.headline)||'inherit')+'">'
     +(path&&/^\//.test(path)?'<img'+(theme==='light'&&path===r?.logo?.dark?' class="lk-print"':'')+' src="'+esc(path)+'" alt="'+esc(lookName(rec.id))+' logo on '+theme+' posts">':'<b role="img" aria-label="'+esc(lookName(rec.id))+' logo on '+theme+' posts" style="'+(ff?'font-family:\''+ff+'\',serif':'')+'">'+esc(mark||lookName(rec.id))+'</b>')+'</div>';
   }
   const ROWS5=[['ground','Ground'],['box','Boxes and bands'],['headline','Headlines'],['supporting','Supporting words'],['accent','Accent']];
   function colourHTML(r){
    const col=th=>'<div><h3>'+(th==='dark'?'Dark posts':'Light posts')+'</h3><ul class="lk-sws">'+ROWS5.map(([k,n])=>swatch(r?.[th]?.[k],n)).join('')+'</ul></div>';
    return '<section><h2>Colour</h2><div class="lk-two">'+col('dark')+col('light')+'</div></section>';
   }
   const SHIPPED=new Set(['Caudex','Cormorant Garamond','Lora','EB Garamond','Shippori Mincho','Noto Serif TC']);
   function typeHTML(r){
    const fm=front(rec.text),list=fm.type.length?fm.type.map(t=>({job:jobOf(t.key),family:t.family,weight:t.weight})):Object.entries(r?.fonts||{}).map(([k,f])=>({job:jobOf(k),family:f.family,weight:400}));
    const wanted=rec.wanted||[],plan=plans.find(p=>p.drawnIn?.id===rec.id&&p.title),name=lookName(rec.id);
    const sent=String(rec.description||'').split(/(?<=[.!?:])\s/)[0].replace(/[.:]$/,''),first=sent.length>60?sent.slice(0,sent.lastIndexOf(' ',58))+'\u2026':sent;
    return '<section><h2>Type</h2><ul class="lk-faces">'+list.map(t=>{const f=family(t.family),w=wanted.find(x=>family(x.wanted)===f),shown=w?family(w.drawnIn):f,can=SHIPPED.has(shown);
     const zh=/chinese|character/i.test(t.job),lab=/label|credit/i.test(t.job),body=/support|paragraph|body/i.test(t.job);
     const line=zh?'茶山 寒露 佳家嘉':lab?name.toUpperCase():body&&first?first:(plan?.title||rec.roles?.logo?.wordmark||name);
     return '<li><p class="lk-specimen" style="'+(can?'font-family:\''+esc(shown)+'\',serif;':'')+'font-weight:'+(t.weight||400)+'">'+esc(line)+'</p><p class="lk-dim"><b>'+esc(f||'Not named')+'</b>'+(t.weight&&t.weight!==400?', '+t.weight:'')+' · '+esc(t.job)
      +(w?' · The app has no font file for '+esc(w.wanted)+' yet. Slides are drawn in '+esc(w.drawnIn)+' until it is added.':(!can?' · This screen cannot show it in its own face.':''))+'</p></li>';}).join('')+'</ul></section>';
   }
   function assetHTML(){
    const tile=a=>{const r=rec.roles?.dark,g=hex(r?.ground),ac=hex(r?.accent),hd=hex(r?.headline);
     const face=a.src?'<img src="'+esc(a.src)+'" alt="">':a.kind==='mark'&&a.text?'<b class="lk-seal"'+(g&&ac?' style="background:'+ac+';color:'+g+'"':'')+'>'+esc(a.text)+'</b>':'<b class="lk-word"'+(hd?' style="color:'+hd+'"':'')+'>'+esc(rec.roles?.logo?.wordmark||rec.name)+'</b>';
     return '<li><span class="lk-face"'+(g?' style="background:'+g+'"':'')+'>'+face+'</span><span class="lk-tn">'+esc(a.name)+'</span></li>';};
    return '<section><div class="lk-sechead"><h2>Logo, marks and graphics</h2><span class="lk-dim">'+assets.length+'</span><span class="lk-sp"></span><button type="button" class="v2-ghost" data-lk="asset-open" aria-expanded="'+addAsset+'">'+ic('plus')+' Bring one in</button></div>'
     +(addAsset?assetForm():'')
     +(assets.length?'<ul class="lk-assets">'+assets.map(tile).join('')+'</ul>':'<p class="lk-dim">This look has no logo, marks or graphics yet.</p>')+'</section>';
   }
   function assetForm(){
    return '<form class="lk-form" data-lk-form="asset"><label><span class="lk-lab">Name</span><input name="name" maxlength="60" required placeholder="Leaf sprig"></label>'
     +'<label><span class="lk-lab">What it is</span><select name="kind"><option value="graphic">Graphic</option><option value="mark">Mark</option><option value="logo">Logo</option></select></label>'
     +'<label><span class="lk-lab">A PNG or SVG file</span><input type="file" name="file" accept=".png,.svg,image/png,image/svg+xml"></label>'
     +'<label><span class="lk-lab">Or, for a mark: one to four characters set as a seal</span><input name="text" maxlength="4" placeholder="佳"></label>'
     +'<div class="lk-row"><button type="submit" class="pri">Add to this look</button><button type="button" data-lk="asset-open">Cancel</button></div></form>';
   }
   function rulesHTML(){
    const r=rulesOf(rec.text);
    return '<section><h2>Rules Claude follows</h2>'+(r.length?'<ul class="lk-rules">'+r.map(x=>'<li>'+ic('check')+'<span>'+esc(x)+'</span></li>').join('')+'</ul>':'<p class="lk-dim">Its DESIGN.md has no rules written as a list yet.</p>')+'</section>';
   }
   function accountsHTML(){
    const mine=accounts.filter(a=>(a.looks||[]).includes(rec.id));
    return '<div class="lk-acct">'+svg(ICON.share)+'<div><span>Posts to</span><div class="lk-accts">'+mine.map(a=>'<b title="'+esc((a.service||'instagram')+(a.handle?' · '+a.handle:''))+'">'+esc(a.name)+'</b>').join('')+(mine.length?'':'<span class="lk-dim">No account posts this look yet.</span>')+'<button type="button" class="lk-link" data-lk="acct-open" aria-expanded="'+addAcct+'">'+ic('plus')+'Account</button></div><small>'+(mine.length>1?'You choose the account each time you post. ':'')+'An account is separate from a look, so one look can post to several and new accounts can be added.</small></div></div>'
     +(addAcct?'<form class="lk-form" data-lk-form="acct"><label><span class="lk-lab">Account name</span><input name="name" maxlength="80" required></label><label><span class="lk-lab">Handle (optional)</span><input name="handle" maxlength="80" placeholder="@"></label><label><span class="lk-lab">Link (optional): the account\'s web address. It is kept as text and never opened.</span><input name="link" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://"></label>'
      +'<fieldset class="lk-checks"><legend class="lk-lab">Looks that post here</legend>'+looks.map(l=>'<label><input type="checkbox" name="looks" value="'+esc(l.id)+'"'+(l.id===rec.id?' checked':'')+'> '+esc(lookName(l.id))+'</label>').join('')+'</fieldset>'
      +(acctError?'<p class="lk-bad" role="alert">'+esc(acctError)+'</p>':'')+'<div class="lk-row"><button type="submit" class="pri">Save account</button><button type="button" data-lk="acct-open">Cancel</button></div></form>':'');
   }
   const offeredFor=id=>{const seen=new Set();return cat.filter(t=>!t.owner&&t.code&&(!t.onlyIn||t.onlyIn===id)&&!seen.has(t.code)&&seen.add(t.code));};
   const yoursFor=id=>cat.filter(t=>t.owner&&(!t.status||t.status==='kept')&&(!Array.isArray(t.looks)||t.looks.includes(id)));
   const FR=(src,cw,label)=>'<span class="lk-fr" style="--cw:'+cw+'px;--s:'+(cw/1080).toFixed(5)+'"><iframe title="'+esc(label)+'" src="'+esc(src)+'" tabindex="-1" loading="lazy"></iframe></span>';
   function templatesHTML(){
    const id=rec.id,shipped=offeredFor(id),yours=yoursFor(id),n=shipped.length+yours.length;
    const plan=plans.find(p=>p.drawnIn?.id===id&&(p.layouts||[]).includes('carousel'));
    const any=plans.find(p=>(p.layouts||[]).includes('carousel'));
    const picks=[];const rows=new Set();for(const t of [...yours,...shipped]){const k=t.rowLetter||t.code;if(!rows.has(k)){rows.add(k);picks.push(t);}}
    const show=picks.slice(0,6);
    const link=(plan||any)?'<a class="lk-link" href="'+esc(v2.href('slides/:id',{id:(plan||any).id}))+'">Open them in the slide studio'+ic('chev')+'</a>':'';
    return '<section><div class="lk-sechead"><h2>Slide templates</h2><span class="lk-dim">'+n+'</span><span class="lk-sp"></span>'+link+'</div>'
     +(plan&&show.length?'<div class="lk-tpl">'+show.map(t=>'<figure>'+FR('/api/instagram/preview?'+new URLSearchParams({id:plan.id,format:'carousel',frame:'0',layout:t.id,plain:'1'}),116,t.code+' '+t.name)+'<figcaption><b>'+esc(t.code)+'</b> '+esc(t.name)+'</figcaption></figure>').join('')+'</div><p class="lk-dim">The same layouts, drawn in this look’s colours and type, on the words of '+esc(plan.title||'a Carousel')+'.</p>'
      :'<p class="lk-dim">'+(any?'Previews appear here once a Carousel is drawn in this look. Open the slide studio and choose this look there.':'The slide studio opens from a Carousel. Make one from a subject first.')+' '+shipped.length+' shipped layouts'+(yours.length?', '+yours.length+' of yours':'')+'.</p>')+'</section>';
   }
   function likeHTML(){
    return '<section><div class="lk-sechead"><h2>What Claude knows you like</h2><span class="lk-sp"></span><button type="button" class="lk-link" data-lk="tell">'+ic('ask')+'Tell it more</button></div><p class="lk-dim">Favourite layouts and the habits Claude has noticed are not built yet, so nothing is shown here. You can always name the layout codes yourself in the slide studio.</p></section>';
   }
   function usedHTML(){
    const set=new Set();for(const t of [...offeredFor(rec.id),...yoursFor(rec.id)])for(const f of t.formats||[])set.add(f);
    const name=f=>fmts[f]?.label||({post:'Post',carousel:'Carousel',story:'Story',reel:'Reel cover'})[f]||f;
    const order=['carousel','post','story','reel'],list=[...set].sort((a,b)=>(order.indexOf(a)<0?9:order.indexOf(a))-(order.indexOf(b)<0?9:order.indexOf(b)));
    return '<section><h2>Used by</h2>'+(list.length?'<div class="lk-used">'+list.map(f=>'<span>'+esc(name(f))+'</span>').join('')+'</div>':'<p class="lk-dim">No form draws this look yet.</p>')+'</section>';
   }
   function tintHTML(){
    const d=hex(rec.roles?.dark?.accent),l=hex(rec.roles?.light?.accent);
    if(!d&&!l)return '';
    return '<div class="lk-tint" style="'+(d?'--lk-a-dark:'+d+';':'')+(l?'--lk-a-light:'+l+';':'')+'"><p class="lk-label">Inside '+esc(lookName(rec.id))+', the app carries this tint</p><div class="lk-bar"><i></i><b>'+esc(lookName(rec.id))+'</b>'+v2.ui.ring(.6)+'<span>Create</span><em><i class="s done"></i><i class="s done"></i><i class="s now"></i><i class="s"></i></em></div></div>';
   }
   function filesHTML(){
    const logo=rec.roles?.logo?.dark||rec.roles?.logo?.light,marks=assets.filter(a=>a.kind!=='logo').length,n=offeredFor(rec.id).length+yoursFor(rec.id).length;
    const li=(ic_,b,small)=>'<li>'+svg(ICON[ic_])+'<span><b>'+b+'</b><small>'+small+'</small></span></li>';
    return '<ul class="lk-files">'+li('note','DESIGN.md','Colours, type and rules, in plain words')+li('photo','Logo',logo?esc(String(logo).split('/').pop()):'The name set in its headline type')+li('layers','Graphics',marks+' mark'+(marks===1?'':'s')+' and drawing'+(marks===1?'':'s'))+li('grid','Templates',n+' slide layouts')+'</ul>';
   }
   function lookHTML(){
    const r=rec.roles;
    if(!r)return '<section class="lk-empty"><h2>'+esc(lookName(rec.id))+'</h2><p>Nothing is set for this look yet: no colours, type or logo.</p><button type="button" class="pri" data-lk="import">Import a look from a DESIGN.md</button></section>';
    return '<div class="lk-grid"><section class="lk-id"><div class="lk-logos">'+logoBox(r,'dark')+logoBox(r,'light')+'</div>'+filesHTML()+accountsHTML()
     +'<p class="lk-dim">'+(rec.source==='home'?'Your copy, kept in your home. It wins over any copy shipped with the app.':'Shipped with the app. Saving a change keeps your own copy in your home, and that copy wins.')+(rec.description?' '+esc(rec.description):'')+'</p>'
     +'<div class="lk-row"><button type="button" data-lk="talk">'+ic('ask')+'Change it by talking</button><button type="button" class="v2-ghost" data-lk="folder">Open the folder</button></div>'+tintHTML()+'</section>'
     +'<div class="lk-main">'+colourHTML(r)+typeHTML(r)+assetHTML()+rulesHTML()+templatesHTML()+likeHTML()+usedHTML()+'</div></div>';
   }

   /* ---------- the import ---------- */
   function importHTML(){
    const s=imp;
    const inputs='<label><span class="lk-lab">Paste the text of a DESIGN.md</span><textarea name="text" rows="10" spellcheck="false" placeholder="---\nname: Your brand\ncolors:\n  ...">'+esc(s.input)+'</textarea></label>'
     +'<label><span class="lk-lab">A short name for its folder (optional): lower-case letters, digits and dashes</span><input name="id" maxlength="40" value="'+esc(s.idIn)+'"></label>';
    if(!s.result)return '<section class="lk-import"><h2>Import a look from a DESIGN.md</h2><p class="lk-dim">The app reads the colours, type and logo it finds, says where it had to guess, and lets you correct each guess before anything is saved.</p><form class="lk-form" data-lk-form="read">'+inputs
     +(s.error?'<p class="lk-bad" role="alert">'+esc(s.error)+'</p>':'')+'<div class="lk-row"><button type="submit" class="pri">Read it</button><button type="button" data-lk="import-cancel">Cancel</button></div></form></section>';
    const r=s.result,colors=front(s.draft).colors,resolve=v=>{const m=/^\{colors\.([\w-]+)\}$/.exec(v||'');return hex(m?colors[m[1]]:v);};
    const exists=looks.find(l=>l.id===s.saveId);
    return '<section class="lk-import"><h2>What the app read from it</h2><p>The look is called <b>'+esc(r.name||'(no name)')+'</b>.'+(r.keptOwnSlides?' Its own slides block was kept as written, so nothing was guessed.':'')+'</p>'
     +(r.guesses?.length?'<h3>Where it guessed <span class="lk-dim">'+r.guesses.length+'</span></h3><p class="lk-dim">Change any value you disagree with. A colour is a hex like #1a1714 or a token like {colors.ground}.</p><ul class="lk-guesses">'+r.guesses.map((g,i)=>'<li><i class="lk-sw" data-sw="'+i+'"'+(resolve(s.values[i])?' style="background:'+resolve(s.values[i])+'"':'')+'></i><div><label><span class="lk-gl">'+esc(guessLabel(g.role))+'</span><input data-lk="guess" data-i="'+i+'" value="'+esc(s.values[i])+'" maxlength="80"></label><p class="lk-dim">'+esc(g.why)+'</p></div></li>').join('')+'</ul>':'')
     +'<form class="lk-form" data-lk-form="save"><label><span class="lk-lab">Name of this look. It must differ from the other looks.</span><input name="name" maxlength="80" required value="'+esc(s.name)+'"></label><label><span class="lk-lab">Folder name for this look</span><input name="id" maxlength="40" value="'+esc(s.saveId)+'" required></label>'
     +(exists?'<label class="lk-inline"><input type="checkbox" name="replace"> A look called '+esc(lookName(exists.id))+' already exists. Replace it with this one. Your copy is kept in your home and wins over the shipped one.</label>':'')
     +(s.error?'<p class="lk-bad" role="alert">'+esc(s.error)+'</p>':'')
     +'<div class="lk-row"><button type="submit" class="pri">Save this look</button><button type="button" data-lk="import-back">Back to the text</button><button type="button" data-lk="import-cancel">Cancel</button></div></form></section>';
   }

   /* ---------- drawing ---------- */
   function paint(){
    if(gone||!root.isConnected)return;
    const had=root.contains(document.activeElement)?document.activeElement.dataset:null;
    root.innerHTML=pillsHTML()+(imp?importHTML():rec?lookHTML():'<p class="lk-dim">No looks yet. Import one from a DESIGN.md.</p>');
    if(had?.lk){const a=root.querySelector('[data-lk="'+CSS.escape(had.lk)+'"]'+(had.id?'[data-id="'+CSS.escape(had.id)+'"]':''));a?.focus?.({preventScroll:true});}
   }
   async function show(id){
    try{await loadLook(id);}catch(e){say(e.message,'bad');}
    addAcct=false;addAsset=false;choose(id);paint();
   }

   /* ---------- actions ---------- */
   const fileText=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result));r.onerror=()=>no(new Error('The file could not be read.'));r.readAsDataURL(f);});
   async function addAssetNow(form){
    const f=new FormData(form),name=String(f.get('name')||'').trim(),kind=String(f.get('kind')||'graphic'),text=String(f.get('text')||'').trim(),file=f.get('file');
    if(!name)return say('Give it a name first.','warn');
    let asset;
    if(file&&file.size){
     const ext=/\.svg$/i.test(file.name)||file.type==='image/svg+xml'?'svg':/\.png$/i.test(file.name)||file.type==='image/png'?'png':'';
     if(!ext)return say('Only a PNG or an SVG file can be brought in.','warn');
     const base64=(await fileText(file)).replace(/^data:[^,]*,/,'');
     asset={id:slug(name)||'asset',name,kind,file:(slug(name)||'asset')+'.'+ext,base64};
    }else if(kind==='mark'&&text)asset={id:slug(name)||'mark',name,kind:'mark',text};
    else return say('Choose a PNG or SVG file, or type the characters for a mark.','warn');
    busy=true;
    try{await call('look.asset.add',{id:rec.id,...v2.expect(rec),asset});await loadLook(rec.id);addAsset=false;paint();say('"'+name+'" is now part of '+(rec.name||lookName(rec.id))+'.','good');}
    catch(e){if(e.kind==='stale'){try{await loadLook(rec.id);}catch{}paint();}say(e.message,'bad');}finally{busy=false;}
   }
   async function addAccountNow(form){
    const f=new FormData(form),name=String(f.get('name')||'').trim(),lk=f.getAll('looks').map(String);
    if(!name)return say('Give the account a name first.','warn');
    if(!lk.length)return say('Choose at least one look that posts to it.','warn');
    acctError='';
    try{await call('account.save',{name,service:'instagram',handle:String(f.get('handle')||'').trim(),link:String(f.get('link')||'').trim(),looks:lk});
     const a=await call('accounts');accounts=a.accounts||[];addAcct=false;paint();say('"'+name+'" will post '+lk.map(lookName).join(', ')+'.','good');}
    catch(e){acctError=e.message;paint();}
   }
   async function readImport(form){
    const text=form.querySelector('[name=text]').value,idIn=form.querySelector('[name=id]').value.trim();
    imp.input=text;imp.idIn=idIn;imp.error='';
    if(!text.trim()){imp.error='Paste the text of a DESIGN.md first.';return paint();}
    try{const r=await call('look.import',{text,...(idIn?{id:idIn}:{})});
     imp.result=r;imp.draft=r.text;imp.values=(r.guesses||[]).map(g=>g.value);imp.saveId=r.id||idIn;imp.name=r.name||'';imp.error='';}
    catch(e){imp.error=e.message;}
    paint();
   }
   async function saveImport(form){
    const f=new FormData(form),id=String(f.get('id')||'').trim(),name=String(f.get('name')||'').trim();
    imp.name=name;imp.saveId=id;
    if(!name){imp.error='Give the look a name.';return paint();}
    const clash=looks.find(l=>l.id!==id&&String(lookName(l.id)).trim().toLowerCase()===name.toLowerCase());
    if(clash){imp.error='Another look is already called "'+lookName(clash.id)+'". Give this one its own name.';return paint();}
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)){imp.error='A folder name uses lower-case letters, digits and dashes.';imp.saveId=id;return paint();}
    imp.saveId=id;const exists=looks.find(l=>l.id===id);
    if(exists&&!f.get('replace')){imp.error='Tick the box to replace the look that already has this name, or choose another name.';return paint();}
    let body={id,text:imp.draft.replace(/^name:.*$/m,'name: '+JSON.stringify(name))};
    try{if(exists)body={...body,...v2.expect(await call('look',{id}))};
     const out=await call('look.save',body);await loadList();const to=out?.id||id;imp=null;await show(to);say('Saved the '+lookName(to)+' look.','good');}
    catch(e){imp.error=e.message;paint();}
   }
   function onClick(e){
    const b=e.target.closest('[data-lk]');if(!b||b.disabled||b.tagName==='INPUT')return;const w=b.dataset.lk;
    if(w==='look'){imp=null;return void show(b.dataset.id);}
    if(w==='talk')return say('Changing a look by talking is not built yet. Ask an assistant to change its DESIGN.md, or bring in a changed one with New look.');
    if(w==='folder')return say('Opening the look\u2019s folder from here is not built yet.');
    if(w==='tell')return say('What Claude knows you like is not built yet.');
    if(w==='import'){if(!imp)imp={input:'',idIn:'',result:null,draft:'',values:[],saveId:'',name:'',error:''};paint();return void root.querySelector('[name=text]')?.focus();}
    if(w==='import-cancel'){imp=null;return paint();}
    if(w==='import-back'){imp.result=null;imp.error='';return paint();}
    if(w==='asset-open'){addAsset=!addAsset;paint();return void root.querySelector('[data-lk-form="asset"] [name=name]')?.focus();}
    if(w==='acct-open'){addAcct=!addAcct;acctError='';paint();return void root.querySelector('[data-lk-form="acct"] [name=name]')?.focus();}
   }
   root.addEventListener('click',onClick);
   root.addEventListener('input',e=>{
    const g=e.target.closest?.('[data-lk="guess"]');if(!g||!imp?.result)return;const i=+g.dataset.i,role=imp.result.guesses[i].role;
    imp.values[i]=g.value;imp.draft=setSlideValue(imp.draft,role,g.value);
    const colors=front(imp.draft).colors,m=/^\{colors\.([\w-]+)\}$/.exec(g.value),c=hex(m?colors[m[1]]:g.value),sw=root.querySelector('[data-sw="'+i+'"]');if(sw)sw.style.background=c||'';
   });
   root.addEventListener('submit',e=>{
    const f=e.target.closest('[data-lk-form]');if(!f)return;e.preventDefault();if(busy)return;
    const k=f.dataset.lkForm;
    if(k==='asset')return void addAssetNow(f);if(k==='acct')return void addAccountNow(f);if(k==='read')return void readImport(f);if(k==='save')return void saveImport(f);
   });

   /* ---------- open ---------- */
   try{await loadList();}catch(e){root.innerHTML='<p class="v2-msg" data-tone="bad"><span>'+esc(e.message||'The looks could not be read.')+'</span></p>';return;}
   if(gone)return;
   const want=ctx.query?.look,first=looks.find(l=>l.id===want)||looks[0];
   if(first){try{await loadLook(first.id);}catch(e){say(e.message,'bad');}choose(first.id);}
   paint();
   ctx.on({kinds:['look*','account*','template*','instagram*']},()=>{if(busy||imp||addAcct||addAsset)return;(async()=>{try{await loadList();if(sel)await loadLook(sel);paint();}catch{}})();});
  }});
})(window.v2);
