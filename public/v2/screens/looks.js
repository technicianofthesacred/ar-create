/* Looks: one tab per look (looks), and for the chosen one its logo, colours, type, logo and marks (look.assets,
   look.asset.add), its rules, the accounts that post it (accounts, account.save) and its templates, plus Import a look
   from a DESIGN.md (look.import, then look.save). Every read and write is a registry command. */
(function(v2){
 'use strict';
 const esc=v2.ui.esc,ic=v2.ui.icon;
 const ROLES=[['ground','Ground'],['box','Boxes and bands'],['line','Lines'],['headline','Headlines'],['supporting','Supporting words'],['label','Labels'],['accent','Accent']];
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
  render:()=>'<div class="v2-page lk"><header><div><h1>Looks</h1><p>One look per brand: its colours, type, logo, marks and slide templates. A slide is drawn in the look you choose.</p></div></header><div class="lk-body"><p class="lk-dim" role="status">Opening the looks.</p></div></div>',
  async mount(el,ctx){
   const root=el.querySelector('.lk-body');
   let looks=[],accounts=[],cat=[],proposals=[],plans=[],sel=null,rec=null,assets=[],busy=false,gone=false,addAcct=false,addAsset=false,imp=null,acctError='';
   ctx.signal.addEventListener('abort',()=>{gone=true;});
   const say=(t,tone)=>v2.ui.say(t,{tone:tone||'info'});
   const call=(n,i)=>v2.call(n,i);

   async function loadList(){
    const [l,a,t,p,pl]=await Promise.all([call('looks'),call('accounts').catch(()=>({accounts:[]})),call('instagram.templates').catch(()=>({templates:[]})),call('templates',{status:'proposed'}).catch(()=>({templates:[]})),call('instagram.plans').catch(()=>({plans:[]}))]);
    looks=l.looks||[];accounts=a.accounts||[];cat=t.templates||[];proposals=p.templates||[];plans=pl.plans||[];
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
   function pillsHTML(){
    return '<div class="lk-pills" role="group" aria-label="Looks">'+looks.map(l=>'<button type="button" data-lk="look" data-id="'+esc(l.id)+'" aria-pressed="'+(!imp&&l.id===sel)+'">'+esc(l.name||lookName(l.id))+'</button>').join('')
     +'<button type="button" data-lk="import" aria-pressed="'+(!!imp)+'">'+ic('plus')+' Import a look from a DESIGN.md</button></div>';
   }
   function swatch(c,label,value){return '<li><i class="lk-sw"'+(hex(c)?' style="background:'+c+'"':'')+'></i><span>'+esc(label)+'</span><code>'+esc(hex(c)||value||'')+'</code></li>';}
   function logoBox(r,theme){
    const t=r?.[theme],path=r?.logo?.[theme],mark=String(r?.logo?.wordmark||'');
    const ff=family(r?.fonts?.headline?.family);
    return '<div class="lk-logo" style="background:'+(hex(t?.ground)||'transparent')+';color:'+(hex(t?.headline)||'inherit')+'">'
     +(path&&/^\//.test(path)?'<img'+(theme==='light'&&path===r?.logo?.dark?' class="lk-print"':'')+' src="'+esc(path)+'" alt="'+esc(lookName(rec.id))+' logo on '+theme+' posts">':'<b style="'+(ff?'font-family:\''+ff+'\',serif':'')+'">'+esc(mark||rec.name||lookName(rec.id))+'</b>')+'<span>'+(theme==='dark'?'On dark posts':'On light posts')+'</span></div>';
   }
   function colourHTML(r){
    const col=th=>'<div><h3>'+(th==='dark'?'Dark posts':'Light posts')+'</h3><ul class="lk-sws">'+ROLES.map(([k,n])=>swatch(r?.[th]?.[k],n)).join('')+'</ul></div>';
    return '<section><h2>Colour</h2><div class="lk-two">'+col('dark')+col('light')+'</div></section>';
   }
   const SHIPPED=new Set(['Caudex','Cormorant Garamond','Lora','EB Garamond','Shippori Mincho','Noto Serif TC']);
   function typeHTML(r){
    const fm=front(rec.text),list=fm.type.length?fm.type.map(t=>({job:jobOf(t.key),family:t.family,weight:t.weight})):Object.entries(r?.fonts||{}).map(([k,f])=>({job:jobOf(k),family:f.family,weight:400}));
    const wanted=rec.wanted||[];
    return '<section><h2>Type</h2><ul class="lk-faces">'+list.map(t=>{const f=family(t.family),w=wanted.find(x=>family(x.wanted)===f),shown=w?family(w.drawnIn):f,can=SHIPPED.has(shown);
     const zh=/chinese|character/i.test(t.job);
     return '<li><p class="lk-specimen" style="'+(can?'font-family:\''+esc(shown)+'\',serif;':'')+'font-weight:'+(t.weight||400)+'">'+(zh?'茶山 寒露 佳家嘉':'Aa Bb Cc Dd Ee Ff 0123456789')+'</p><p class="lk-dim"><b>'+esc(f||'Not named')+'</b>'+(t.weight&&t.weight!==400?', '+t.weight:'')+' · '+esc(t.job)
      +(w?' · The app has no font file for '+esc(w.wanted)+' yet. Slides are drawn in '+esc(w.drawnIn)+' until it is added.':(!can?' · This screen cannot show it in its own face.':''))+'</p></li>';}).join('')+'</ul></section>';
   }
   function assetHTML(){
    const tile=a=>{const r=rec.roles?.dark,g=hex(r?.ground),ac=hex(r?.accent),hd=hex(r?.headline);
     const face=a.src?'<img src="'+esc(a.src)+'" alt="">':a.kind==='mark'&&a.text?'<b class="lk-seal"'+(g&&ac?' style="background:'+ac+';color:'+g+'"':'')+'>'+esc(a.text)+'</b>':'<b class="lk-word"'+(hd?' style="color:'+hd+'"':'')+'>'+esc(rec.roles?.logo?.wordmark||rec.name)+'</b>';
     return '<li><span class="lk-face"'+(g?' style="background:'+g+'"':'')+'>'+face+'</span><span class="lk-tn">'+esc(a.name)+'</span><span class="lk-dim">'+esc(({logo:'Logo',mark:'Mark',graphic:'Graphic'})[a.kind]||a.kind)+'</span></li>';};
    return '<section><div class="lk-sechead"><h2>Logo, marks and graphics <span class="lk-dim">'+assets.length+'</span></h2><button type="button" data-lk="asset-open" aria-expanded="'+addAsset+'">Bring one in</button></div>'
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
    return '<section><h2>Rules</h2>'+(r.length?'<ul class="lk-rules">'+r.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'<p class="lk-dim">Its DESIGN.md has no rules written as a list yet.</p>')+'<p class="lk-dim">From the prose of its DESIGN.md.</p></section>';
   }
   function accountsHTML(){
    const mine=accounts.filter(a=>(a.looks||[]).includes(rec.id));
    return '<section><div class="lk-sechead"><h2>Posts to</h2><button type="button" data-lk="acct-open" aria-expanded="'+addAcct+'">Add an account</button></div>'
     +(mine.length?'<ul class="lk-accts">'+mine.map(a=>'<li><b>'+esc(a.name)+'</b><span class="lk-dim">'+esc(a.service||'instagram')+(a.handle?' · '+esc(a.handle):'')+(a.looks.length>1?' · also posts '+esc(a.looks.filter(x=>x!==rec.id).map(lookName).join(', ')):'')+'</span></li>').join('')+'</ul>':'<p class="lk-dim">No account posts this look yet.</p>')
     +(addAcct?'<form class="lk-form" data-lk-form="acct"><label><span class="lk-lab">Account name</span><input name="name" maxlength="80" required></label><label><span class="lk-lab">Handle (optional)</span><input name="handle" maxlength="80" placeholder="@"></label><label><span class="lk-lab">Link (optional): the account\'s web address. It is kept as text and never opened.</span><input name="link" maxlength="300" inputmode="url" autocomplete="off" placeholder="https://"></label>'
      +'<fieldset class="lk-checks"><legend class="lk-lab">Looks that post here</legend>'+looks.map(l=>'<label><input type="checkbox" name="looks" value="'+esc(l.id)+'"'+(l.id===rec.id?' checked':'')+'> '+esc(l.name||lookName(l.id))+'</label>').join('')+'</fieldset>'
      +(acctError?'<p class="lk-bad" role="alert">'+esc(acctError)+'</p>':'')+'<div class="lk-row"><button type="submit" class="pri">Save account</button><button type="button" data-lk="acct-open">Cancel</button></div></form>':'')+'</section>';
   }
   function templatesHTML(){
    const id=rec.id,seen=new Set();
    const shipped=cat.filter(t=>!t.owner&&t.code&&(!t.onlyIn||t.onlyIn===id)&&!seen.has(t.code)&&seen.add(t.code)).length;
    const yours=cat.filter(t=>t.owner&&(!t.status||t.status==='kept')&&(!Array.isArray(t.looks)||t.looks.includes(id))).length;
    const props=proposals.filter(t=>!Array.isArray(t.looks)||t.looks.includes(id)).length;
    const plan=plans.find(p=>p.drawnIn?.id===id&&(p.layouts||[]).includes('carousel'))||plans.find(p=>(p.layouts||[]).includes('carousel'));
    return '<section><h2>Templates</h2><p><b>'+shipped+'</b> shipped layouts, <b>'+yours+'</b> of yours, <b>'+props+'</b> proposed by assistants.</p>'
     +(plan?'<a class="lk-open" href="'+esc(v2.href('slides/:id',{id:plan.id}))+'">Open the slide studio'+ic('chev')+'</a><p class="lk-dim">On '+esc(plan.title||'a Carousel')+'. Choose this look there to draw it in this look.</p>':'<p class="lk-dim">The slide studio opens from a Carousel. Make one from a subject first.</p>')+'</section>';
   }
   function tintHTML(){
    const d=hex(rec.roles?.dark?.accent),l=hex(rec.roles?.light?.accent);
    if(!d&&!l)return '';
    return '<section><h2>How the app tints</h2><div class="lk-tint" style="'+(d?'--lk-a-dark:'+d+';':'')+(l?'--lk-a-light:'+l+';':'')+'"><span class="lk-tintline"></span><span class="lk-tintrow">'+v2.ui.ring(.6)+'<span>Progress rings</span><i class="lk-cur"></i><span>The current place</span></span></div><p class="lk-dim">Inside '+esc(rec.name||lookName(rec.id))+', the top bar line, progress rings and the current marker take the look\'s accent, a little softened.</p></section>';
   }
   function filesHTML(){
    const logo=rec.roles?.logo?.dark||rec.roles?.logo?.light;
    return '<section><h2>Its files</h2><ul class="lk-files"><li><b>DESIGN.md</b><span class="lk-dim">Colours, type and rules, in plain words.</span></li>'
     +'<li><b>Logo</b><span class="lk-dim">'+(logo?esc(String(logo).split('/').pop()):'The name set in its headline type.')+'</span></li>'
     +'<li><b>Marks and graphics</b><span class="lk-dim">'+assets.length+' kept with the look.</span></li></ul>'
     +'<p class="lk-dim">'+(rec.source==='home'?'Your copy, kept in your home. It wins over any copy shipped with the app.':'Shipped with the app. Saving a change keeps your own copy in your home, and that copy wins.')+(rec.description?' '+esc(rec.description):'')+'</p></section>';
   }
   function lookHTML(){
    const r=rec.roles;
    if(!r)return '<section class="lk-empty"><h2>'+esc(rec.name||lookName(rec.id))+'</h2><p>Nothing is set for this look yet: no colours, type or logo.</p><button type="button" class="pri" data-lk="import">Import a look from a DESIGN.md</button></section>';
    return '<div class="lk-grid"><div class="lk-side"><div class="lk-logos">'+logoBox(r,'dark')+logoBox(r,'light')+'</div>'+filesHTML()+accountsHTML()+tintHTML()+'</div>'
     +'<div class="lk-main">'+colourHTML(r)+typeHTML(r)+assetHTML()+rulesHTML()+templatesHTML()+'</div></div>';
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
     +(exists?'<label class="lk-inline"><input type="checkbox" name="replace"> A look called '+esc(exists.name||lookName(exists.id))+' already exists. Replace it with this one. Your copy is kept in your home and wins over the shipped one.</label>':'')
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
    const clash=looks.find(l=>l.id!==id&&String(l.name||lookName(l.id)).trim().toLowerCase()===name.toLowerCase());
    if(clash){imp.error='Another look is already called "'+(clash.name||lookName(clash.id))+'". Give this one its own name.';return paint();}
    if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)){imp.error='A folder name uses lower-case letters, digits and dashes.';imp.saveId=id;return paint();}
    imp.saveId=id;const exists=looks.find(l=>l.id===id);
    if(exists&&!f.get('replace')){imp.error='Tick the box to replace the look that already has this name, or choose another name.';return paint();}
    let body={id,text:imp.draft.replace(/^name:.*$/m,'name: '+JSON.stringify(name))};
    try{if(exists)body={...body,...v2.expect(await call('look',{id}))};
     const out=await call('look.save',body);await loadList();const to=out?.id||id;imp=null;await show(to);say('Saved the '+(looks.find(l=>l.id===to)?.name||lookName(to))+' look.','good');}
    catch(e){imp.error=e.message;paint();}
   }
   function onClick(e){
    const b=e.target.closest('[data-lk]');if(!b||b.disabled||b.tagName==='INPUT')return;const w=b.dataset.lk;
    if(w==='look'){imp=null;return void show(b.dataset.id);}
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
