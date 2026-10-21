/* AR Create — The Workbench, revision 4: Media at scale, and the Arrange photo picker.
   Reuses revision 3's browser engine (folder tree + one-line virtualised table) from scale.js
   through window.ARC_SCALE: Media is one more "domain" in that engine, and the Arrange picker
   is the same Media browser opened as a sheet over the work. All photos are invented SVG
   gradients held in memory; nothing is fetched and nothing is saved. */
(()=>{
'use strict';
const X=window.ARC,Z=window.ARC_SCALE;if(!X||!Z)return;
const {S,V,A,DR,P,PN,CAR,MEDIA,esc,ic}=X;
const {DOM,BS,BOPTS,HOOK,bstate,browserHTML,mount,paint,rerenderBrowser,fpath,popMenu,folderItems,addToFolder,selIds,rng,pick,cap,fmtDate,PIECES,PCE,KIND_L,KIND_IC,TPN,slideObj,POST,LISTING,st_dom}=Z;
const $=s=>document.querySelector(s);
Object.assign(X.I,{list:'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'});

/* ---------- folders: nested to any depth; an item can be linked into several ---------- */
const MF=[
 {id:'m_trips',name:'Trips',parent:null},
 {id:'m_wuyi',name:'Wuyi 2026',parent:'m_trips'},
 {id:'m_wuyi1',name:'Day 1 — arrival',parent:'m_wuyi'},
 {id:'m_wuyi2',name:'Day 2 — the cliffs',parent:'m_wuyi'},
 {id:'m_wuyi3',name:'Day 3 — roasting',parent:'m_wuyi'},
 {id:'m_ali',name:'Alishan 2025',parent:'m_trips'},
 {id:'m_ali1',name:'Gardens',parent:'m_ali'},
 {id:'m_ali2',name:'Tea houses',parent:'m_ali'},
 {id:'m_ipoh',name:'Ipoh 2026',parent:'m_trips'},
 {id:'m_studio',name:'Studio',parent:null},
 {id:'m_shoot',name:'Teaware shoot',parent:'m_studio'},
 {id:'m_kiln',name:'Kiln Day',parent:'m_studio'},
 {id:'m_kfire',name:'Firing',parent:'m_kiln'},
 {id:'m_kopen',name:'Opening the kiln',parent:'m_kiln'},
 {id:'m_bts',name:'Behind the scenes',parent:'m_studio'},
 {id:'m_prod',name:'Products',parent:null},
 {id:'m_poolong',name:'Spring Oolong',parent:'m_prod'},
 {id:'m_pware',name:'Teaware',parent:'m_prod'},
 {id:'m_gaiwan',name:'Gaiwans',parent:'m_pware'},
 {id:'m_pots',name:'Yixing pots',parent:'m_pware'},
 {id:'m_pdark',name:'Dark tea',parent:'m_prod'},
 {id:'m_proj',name:'Projects',parent:null},
 {id:'m_porc',name:'Porcelain and Tea',parent:'m_proj'},
 {id:'m_harb',name:'Harbour Night Market',parent:'m_proj'},
 {id:'m_ig',name:'Posted to Instagram',parent:null},
 {id:'m_ig25',name:'2025',parent:'m_ig'},
 {id:'m_ig26',name:'2026',parent:'m_ig'}
];
const MFD=id=>MF.find(f=>f.id===id);
/* the folder a project's photos live in: the Arrange picker opens here */
const PROJ_MF={porc:'m_porc',harb:'m_harb',kiln:'m_kiln',oolong:'m_poolong',ancha:'m_ipoh',wuyi:'m_wuyi',care:'m_pware'};

/* ---------- the sample: ~270 photos and videos, the same on every load ---------- */
const PLAN=[
 // folder, n, place, date from, days, video share, origin, project, captions
 ['m_wuyi1',22,'Wuyishan, Fujian','2026-04-11',1,.1,'you','wuyi',['Bus into the valley','Guesthouse courtyard','First cup at Mr. Huang’s','River bend at dusk','Bamboo raft dock','Tea shop row, evening','Dry leaf in a tray','Hands sorting leaf']],
 ['m_wuyi2',34,'Wuyishan, Fujian','2026-04-12',1,.15,'you','wuyi',['Cliffside garden at 7am','Picker’s basket','Rock wall, moss','Path above the stream','Da Hong Pao mother bushes','Mist off the ridge','Terrace steps','Leaf against stone','Pickers at the top terrace','Spring under the cliff']],
 ['m_wuyi3',26,'Wuyishan, Fujian','2026-04-13',1,.25,'claude','wuyi',['Charcoal pit, banked','Roasting baskets','Turning the leaf','Ash over coals','Roaster’s hands','Leaf cooling on bamboo','Smoke in the workshop','Night roast, second pass']],
 ['m_ali1',18,'Alishan, Taiwan','2025-04-19',3,.1,'drive','',['Garden rows in fog','Cypress above the tea','Withering racks','Morning pickers','Slope after rain','Leaf, two and a bud']],
 ['m_ali2',12,'Alishan, Taiwan','2025-04-21',2,.05,'drive','',['Tea house window','Host pouring','Cups on cedar','Old kettle','Tasting table']],
 ['m_ipoh',20,'Ipoh, Malaysia','2026-07-08',4,.15,'you','ancha',['An Cha baskets stacked','Shop shelves, Old Town','Basket weave, close','Owner weighing tea','Storeroom light','Aged basket, opened','Street outside the shop']],
 ['m_shoot',24,'Studio','2026-03-02',20,.1,'you','',['Gaiwan on linen','Three cups, side light','Pouring shot','Lid detail','Pitcher and tray','Teaware on slate','Steam over the bowl']],
 ['m_kfire',18,'Kiln yard','2026-10-12',3,.6,'you','kiln',['Feeding the firebox','Flame through the spy hole','Stacking wood','Night watch at the kiln','Ash on the shelf','Temperature check']],
 ['m_kopen',14,'Kiln yard','2026-10-15',1,.3,'you','kiln',['First bricks down','Pots in the ash','Lifting a jar','Shelf, still warm','Glaze run, close','Rows of cups after firing']],
 ['m_bts',10,'Studio','2026-05-10',120,.4,'you','',['Lights set up','Desk with notebooks','Packing parcels','Labels drying']],
 ['m_poolong',12,'Studio','2026-10-14',5,.1,'you','oolong',['Dry leaf on white','Brewed leaf','Liquor in glass','Bag and label','Leaf on the scale']],
 ['m_gaiwan',10,'Studio','2026-02-11',40,0,'you','',['White gaiwan, front','Gaiwan, lid tilted','Celadon gaiwan','Gaiwan set on tray']],
 ['m_pots',12,'Studio','2026-01-20',60,0,'you','care',['Zhuni pot, side','Pot after seasoning','Lid fit, close','Pot on the tea boat','Three pots in a row']],
 ['m_pdark',8,'Studio','2025-11-03',30,0,'you','',['Brick of dark tea','Pried leaf','Basket tea, unwrapped','Aged leaf in hand']],
 ['m_porc',8,'Mr. Lin’s studio','2026-10-02',1,.1,'you','porc',['Porcelain cups in rows','Shelf of seconds','Throwing a bowl','Mr. Lin’s hands','Bisque ware']],
 ['m_harb',6,'Harbour','2026-09-14',1,.2,'you','harb',['Lantern line','Stall at closing','Ferry wake','Cart wheels']],
 [null,9,'Phone','2026-08-01',70,.2,'you','',['Screenshot of a label','Receipt, tea fair','Whiteboard notes','Sky over the studio','Car park at the fair']]
];
const VARIANT=['',' — wide',' — close',' — detail',' — second take',''];
const TONES=['#4b3e30','#3d3a2e','#33302a','#2e3638','#5a4532','#4a4d3a','#45382c','#3f2e24','#55564f','#5b3b2b','#4f4b44','#3a4040','#504230'];
function addDays(d,n){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);}
const ORIENT_WH={portrait:[3024,4032],landscape:[4032,3024],square:[3024,3024]};
let seq=4800;
function makeMedia(r,[fid,n,place,from,days,vshare,origin,proj,caps],i,idp){
 const video=r()<vshare;const tone=pick(r,TONES);
 const orient=video?(r()<.7?'landscape':'portrait'):(r()<.58?'portrait':r()<.75?'landscape':'square');
 const title=pick(r,caps)+pick(r,VARIANT);const date=addDays(from,Math.floor(r()*days));
 const folders=fid?[fid]:[];
 const file=(video?'VID_':'IMG_')+(seq++)+(video?'.mov':'.jpg');
 return {id:idp+i,title,file,kind:video?'video':'photo',dur:video?`0:${String(4+Math.floor(r()*50)).padStart(2,'0')}`:'',date,place,orient,tone,
  folders,p:proj||null,origin,by:origin==='claude'?'Claude imported':origin==='drive'?'Drive sync':'You',tags:[],used:[],seed:Math.floor(r()*1e6)};
}
/* the revision-2 assets keep their ids, so the bench, Write and the carousel still point at them */
const OLD={
 h1:['m_harb','2026-10-21','portrait','IMG_9101.jpg'],h2:['m_harb','2026-10-21','portrait','IMG_9102.jpg'],h3:['m_harb','2026-10-21','square','IMG_9103.jpg'],h4:['m_harb','2026-10-21','landscape','IMG_9104.jpg'],h5:['m_harb','2026-10-21','landscape','IMG_9105.jpg'],h6:['m_harb','2026-10-21','portrait','IMG_9106.jpg'],
 hv:['m_harb','2026-09-14','portrait','VID_9020.mov'],c1:['m_porc','2026-10-02','portrait','IMG_8811.jpg'],c2:['m_porc','2026-10-02','portrait','IMG_8814.jpg'],c3:['m_porc','2026-10-03','landscape','IMG_8840.jpg'],
 c4:['m_porc','2026-10-02','portrait','IMG_8820.jpg'],cv:['m_porc','2026-10-02','landscape','VID_8822.mov'],k1:['m_kfire','2026-10-13','landscape','VID_8990.mov'],k2:['m_kfire','2026-10-13','landscape','VID_8991.mov'],o1:['m_poolong','2026-10-19','square','IMG_9050.jpg']
};
MEDIA.forEach((m,i)=>{const o=OLD[m.id]||['m_proj','2026-10-01','portrait','IMG_'+(8000+i)+'.jpg'];
 Object.assign(m,{title:m.cap,file:o[3],date:o[1],orient:o[2],folders:[o[0]],place:m.p==='harb'?'Harbour':m.p==='kiln'?'Kiln yard':m.p==='porc'?'Mr. Lin’s studio':'Studio',
  origin:/Claude/.test(m.by)?'claude':'you',tags:[],seed:i*131+7,dur:m.dur||''});
 /* carousel uses are now worked out from the slides themselves (see slotUses), not stored twice */
 m.used=m.used.filter(u=>u.tool!=='arrange').map(u=>Object.assign({p:m.p},u));
});
MEDIA.find(m=>m.id==='c1').folders.push('m_kopen');   /* one photo linked into two folders */
MEDIA.find(m=>m.id==='cv').folders.push('m_kopen');
MEDIA.find(m=>m.id==='o1').folders.push('m_ig26');
(()=>{const r=rng(20261021);let k=0;PLAN.forEach(pl=>{for(let i=0;i<pl[1];i++)MEDIA.push(makeMedia(r,pl,k++,'M'));});
 /* a few photos are also linked into other folders, and some were posted */
 const r2=rng(77);MEDIA.forEach(m=>{if(!/^M/.test(m.id))return;
  if(m.folders[0]==='m_wuyi2'&&r2()<.15)m.folders.push('m_poolong');
  if(m.folders[0]==='m_shoot'&&r2()<.25)m.folders.push(r2()<.5?'m_gaiwan':'m_pots');
  if(m.kind==='photo'&&m.folders.length&&r2()<.07){const y=m.date<'2026'?'25':'26';m.folders.push('m_ig'+y);m.used.push({l:`Instagram post · ${fmtDate(m.date).replace(/^\d+ /,'')}`,tool:'posted'});}
  if(m.p==='oolong'&&r2()<.3)m.used.push({l:'Spring Oolong listing · shop page',tool:'arrange',p:'oolong',mode:'listing',x:null,static:1});
 });})();
let MX=null,MXn=-1;const byId=id=>{if(MXn!==MEDIA.length){MX=new Map(MEDIA.map(m=>[m.id,m]));MXn=MEDIA.length;}return MX.get(id);};
let mstressed=false;
/* stress: 2,000 older photos into a deeper Archive › year › quarter branch, so the sample folders stay as they are */
function mstress(){if(mstressed)return;mstressed=true;const r=rng(4242);
 MF.push({id:'m_arch',name:'Archive',parent:null});
 for(let y=2019;y<=2025;y++){MF.push({id:'m_a'+y,name:String(y),parent:'m_arch'});for(let q=1;q<=4;q++)MF.push({id:`m_a${y}q${q}`,name:`Q${q} · ${['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec'][q-1]}`,parent:'m_a'+y});}
 const caps=['Archive frame','Old phone photo','Contact sheet frame','Fair booth','Studio wall','Leaf study','Cup study','Kiln shelf','Street, evening','Garden row'];
 for(let i=0;i<2000;i++){const y=2019+Math.floor(r()*7),q=1+Math.floor(r()*4);const from=`${y}-${String(q*3-2).padStart(2,'0')}-01`;
  const it=makeMedia(r,[r()<.9?`m_a${y}q${q}`:null,1,'Archive',from,88,.12,r()<.2?'claude':'drive','',caps],i,'X');MEDIA.push(it);}}
try{if(/[?&]mstress=1/.test(location.search))mstress();}catch(e){}

/* ---------- where a photo is used: stored uses + the slots of every slide, post and listing ---------- */
let SLOT=null;
function nslots(o){const t=TPN[o.tpl];return t?t.photos:(o.photos||[]).length;}
function slotUses(){
 if(SLOT)return SLOT;SLOT=new Map();queueMicrotask(()=>{SLOT=null;});
 const add=(id,u)=>{if(!id)return;if(!SLOT.has(id))SLOT.set(id,[]);SLOT.get(id).push(u);};
 Object.keys(CAR).forEach(p=>CAR[p].slides.forEach((s,i)=>{const n=nslots(s);(s.photos||[]).slice(0,n).forEach((id,j)=>add(id,{l:`Carousel slide ${i+1}${n>1?` · photo ${j+1}`:''}`,tool:'arrange',p,mode:'car',x:s.id}));}));
 Object.keys(POST).forEach(p=>{const o=POST[p];(o.photos||[]).slice(0,nslots(o)).forEach((id,j)=>add(id,{l:`Post${nslots(o)>1?' · photo '+(j+1):''}`,tool:'arrange',p,mode:'post',x:null}));});
 Object.keys(LISTING).forEach(p=>{const o=LISTING[p];(o.photos||[]).slice(0,nslots(o)).forEach((id,j)=>add(id,{l:'Product listing image',tool:'arrange',p,mode:'listing',x:null}));});
 return SLOT;
}
const usedOf=m=>m.used.concat(slotUses().get(m.id)||[]);
/* the sample carousel starts with the photos revision 2 gave it */
CAR.porc.slides.forEach(s=>{if(!s.photos)s.photos=s.img?[s.img]:[];});
POST.porc.photos=[MEDIA.find(m=>/^M/.test(m.id)&&m.folders[0]==='m_porc'&&m.kind==='photo').id];
LISTING.oolong.photos=['o1'];

/* ---------- invented images: a gradient thumbnail for rows, an SVG "photo" for previews and templates ---------- */
const shade=(hex,d)=>'#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.substr(i,2),16)+d)).toString(16).padStart(2,'0')).join('');
function thumbBg(m){const r=rng(m.seed+1);const x=Math.floor(20+r()*60),y=Math.floor(25+r()*50);
 return `background:radial-gradient(circle at ${x}% ${y}%,${shade(m.tone,38)} 0,transparent 46%),linear-gradient(${m.orient==='landscape'?'180deg':'135deg'},${shade(m.tone,14)},${shade(m.tone,-26)})`;}
const b64=s=>btoa(unescape(encodeURIComponent(s)));
const IMG={};
function mimg(m){if(IMG[m.id])return IMG[m.id];const r=rng(m.seed+3);const [w,h]=m.orient==='landscape'?[1350,1012]:m.orient==='square'?[1080,1080]:[1080,1350];
 const blobs=Array.from({length:5},()=>`<ellipse cx="${(r()*w).toFixed(0)}" cy="${(r()*h).toFixed(0)}" rx="${(60+r()*w/3).toFixed(0)}" ry="${(50+r()*h/4).toFixed(0)}" fill="#fff" opacity="${(.03+r()*.08).toFixed(2)}"/>`).join('');
 const hz=(h*(.45+r()*.3)).toFixed(0);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="${m.orient==='landscape'?0:1}" y2="1"><stop offset="0" stop-color="${shade(m.tone,22)}"/><stop offset="1" stop-color="${shade(m.tone,-30)}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect y="${hz}" width="${w}" height="${h-hz}" fill="#000" opacity=".16"/>${blobs}<rect x="${(w*.3+r()*w*.2).toFixed(0)}" y="${(h*.5).toFixed(0)}" width="${(w*.2+r()*w*.15).toFixed(0)}" height="${(h*.16).toFixed(0)}" rx="26" fill="#000" opacity=".2"/><text x="36" y="${h-36}" font-family="sans-serif" font-size="30" fill="#fff" opacity=".5">Sample ${m.kind==='video'?'video still':'photo'} · ${esc(m.file)}</text></svg>`;
 return IMG[m.id]='data:image/svg+xml;base64,'+b64(svg);}

/* ---------- Media as a domain of the shared browser ---------- */
const NOW='2026-10-21',D30='2026-09-21';
const topOf=fid=>{const p=fpath(MF,fid);return p.length?p[0].id:null;};
const dateBucket=d=>d>=D30?'recent':d>='2026'?'y2026':d>='2025'?'y2025':'older';
const leafName=m=>{if(!m.folders.length)return 'Unsorted';const f=MFD(m.folders[0]);return f?f.name:'';};
const kindL=m=>m.kind==='video'?`Video · ${m.dur}`:'Photo';
const mtog=key=>{const st=BS[key];const g=st.mode==='grid';return `<span class="mtog" role="group" aria-label="Show as"><button class="${g?'':'on'}" data-act="mmode" data-k="${key}" data-m="list" aria-pressed="${!g}">${ic('list','sm')} List</button><button class="${g?'on':''}" data-act="mmode" data-k="${key}" data-m="grid" aria-pressed="${g}">${ic('grid','sm')} Grid</button></span>`;};
DOM.med={
 noun:'photos and videos',items:()=>MEDIA,folders:MF,cls:'med',
 allLabel:'All media',allIcon:'media',rootLabel:'Media',searchPh:'Search media — caption, file name, place, tag',
 treeHint:'Drag photos onto a folder to link them there too — a photo can sit in several folders. Drag a folder onto another to nest it.',
 stressHTML:key=>key==='med'?`<button class="lnk" data-act="mstress" style="opacity:.75">${mstressed?`Stress test loaded · ${MEDIA.length.toLocaleString()} items`:'Stress test: load 2,000 more'}</button>`:'',
 facets:[
  {k:'kind',label:'Kind',val:m=>m.kind,fmt:v=>v==='video'?'Video':'Photo'},
  {k:'top',label:'Folder',val:m=>[...new Set(m.folders.map(topOf).filter(Boolean))],fmt:v=>(MFD(v)||{name:v}).name},
  {k:'date',label:'Date',val:m=>dateBucket(m.date),fmt:v=>({recent:'Last 30 days',y2026:'Earlier in 2026',y2025:'2025',older:'2024 and before'}[v])},
  {k:'used',label:'Used',val:m=>usedOf(m).length?'used':'unused',fmt:v=>v==='used'?'Used somewhere':'Not used yet'},
  {k:'orient',label:'Orientation',val:m=>m.orient,fmt:v=>cap(v)},
  {k:'proj',label:'Project',val:m=>m.p||'none',fmt:v=>v==='none'?'No project':PN(v)},
  {k:'origin',label:'Added by',val:m=>m.origin,fmt:v=>({claude:'Claude’s import',you:'You',drive:'Drive sync'}[v])}
 ],
 views:[
  {id:'all',label:'All',set:st=>{st.folder='all';st.f={};st.q='';}},
  {id:'unused',label:'Unused',set:st=>{st.folder='all';st.f={used:'unused'};st.q='';}},
  {id:'videos',label:'Videos',set:st=>{st.folder='all';st.f={kind:'video'};st.q='';}},
  {id:'claude',label:'From Claude’s import',set:st=>{st.folder='all';st.f={origin:'claude'};st.q='';}}
 ],
 sorts:[['date','Date'],['title','Title'],['used','Used in'],['kind','Kind']],
 sortGet:{date:m=>m.date,title:m=>m.title.toLowerCase(),used:m=>usedOf(m).length,kind:m=>m.kind},
 cols:['Title','Kind','Date','Folder','Used in'],colSort:['title','kind','date',null,'used'],
 text:m=>(m.title+' '+m.file+' '+m.place+' '+m.tags.join(' ')+' '+m.kind+' '+leafName(m)).toLowerCase(),
 row:m=>{const u=usedOf(m).length;const pth=m.folders.map(f=>fpath(MF,f).map(x=>x.name).join(' › ')).join('\n');
  return `<span class="tyi mth" style="${thumbBg(m)}" aria-hidden="true">${m.kind==='video'?ic('play','sm'):''}</span><button class="ti" data-act="bopen" data-id="${m.id}" title="${esc(m.title)} · ${esc(m.file)}">${esc(m.title)}${m.isNew?' <span class="nw">New</span>':''} <span class="fn">${esc(m.file)}</span></button><span class="c">${kindL(m)}</span><span class="c num">${fmtDate(m.date)}</span><span class="c" title="${esc(pth)}">${esc(leafName(m))}${m.folders.length>1?` <span class="dim">+${m.folders.length-1}</span>`:''}</span><span class="c num ${u?'':'dim'}">${u?'Used in '+u:'—'}</span><span class="c2">${kindL(m)} · ${fmtDate(m.date)} · ${esc(leafName(m))} · ${u?'used in '+u:'unused'}</span>`;},
 tile:m=>{const u=usedOf(m).length;
  return `<button class="mt-img" data-act="bopen" data-id="${m.id}" style="${thumbBg(m)}" aria-label="${esc(m.title)}">${m.kind==='video'?`<span class="vd">${ic('play','sm')} ${m.dur}</span>`:''}${m.isNew?'<span class="nw">New</span>':''}</button><button class="mt-t" data-act="bopen" data-id="${m.id}" title="${esc(m.title)}">${esc(m.title)}</button><span class="mt-m">${fmtDate(m.date)} · ${u?'Used in '+u:'unused'}</span>`;},
 open:m=>X.openDrawer('mpreview',{id:m.id}),
 bulkHTML:key=>key==='mpick'?'':`<button class="btn" data-act="bulk" data-op="mlink" data-k="${key}">Link to folder</button><button class="btn" data-act="bulk" data-op="mmove" data-k="${key}">Move to folder</button><button class="btn" data-act="bulk" data-op="mtag" data-k="${key}">Tag</button><button class="btn" data-act="bulk" data-op="mpiece" data-k="${key}">Add to piece</button>`,
 bulk:(op,el,key,ids)=>{
  const done=msg=>{BS[key].sel.clear();X.toast(msg+' Prototype, nothing is saved');rerenderBrowser(key,true);if(S.drawer&&S.drawer.k==='mpreview')X.renderDrawer();};
  if(op==='mlink')popMenu(el,`Link ${ids.length} into…`,folderItems(MF),x=>{const n=addToFolder(key,ids,x.id);done(`Linked ${n} into ${x.label} — they stay in their other folders.`);});
  if(op==='mmove')popMenu(el,`Move ${ids.length} to…`,folderItems(MF),x=>{ids.forEach(id=>{const m=byId(id);if(m)m.folders=[x.id];});done(`Moved ${ids.length} to ${x.label} — taken out of their other folders.`);});
  if(op==='mtag'){const tags=['cover candidate','needs crop','hands','detail','people','night','for the shop'];popMenu(el,`Tag ${ids.length} with…`,tags.map(t=>({id:t,label:t})),x=>{ids.forEach(id=>{const m=byId(id);if(m&&!m.tags.includes(x.id))m.tags.push(x.id);});done(`Tagged ${ids.length} “${x.id}”.`);});}
  if(op==='mpiece')popMenu(el,`Use ${ids.length} in…`,PIECES.map(pc=>({id:pc.id,label:pc.title,path:KIND_L[pc.kind],icon:KIND_IC[pc.kind]})),x=>{ids.forEach(id=>{const m=byId(id);if(m&&!m.used.some(u=>u.pid===x.id))m.used.push({l:x.label,tool:'piece',pid:x.id});});done(`${ids.length} added to ${x.label}.`);});
 }
};
BOPTS.med=()=>({lineRight:mtog('med')});

/* ---------- the Media screen ---------- */
V.media=()=>{
 bstate('med',{sort:'date'});const st=BS.med;
 /* a project in scope (or a next move into one) opens that project's folder */
 const want=S.scope!=='all'?S.scope:(S.toolProj&&S.toolProj.media)||null;
 if(st.seen!==want){st.seen=want;if(want&&PROJ_MF[want]){st.folder=PROJ_MF[want];st.view='';fpath(MF,st.folder).forEach(f=>st.open.add(f.id));}else if(!want){st.folder='all';st.view='all';}}
 if(S.target&&byId(S.target)){st.cur=S.target;}
 const nw=MEDIA.filter(m=>m.isNew).length;
 queueMicrotask(()=>{mount('med',true);if(st.cur&&S.view==='media'){const i=st.rows.findIndex(r=>r.id===st.cur);const vt=document.getElementById('vt-med');if(i>=0&&vt&&st.mode!=='grid'){vt.scrollTop=Math.max(0,i*36-vt.clientHeight/2);paint('med');}}});
 return `<div class="wrap full">${X.head('media','all',`<span class="tag" title="Invented photos and videos — none of your files were read">Sample media</span>${nw?`<button class="btn" data-act="mview" data-v="claude">${nw} new from Claude’s import</button>`:''}`)}
 ${browserHTML('med',BOPTS.med())}</div>`;
};
X.DR_TITLE.mpreview='Preview';X.NOTABS.mpreview=1;X.DR_SUB.mpreview=()=>{const m=byId(S.drawer.id);return m?(m.kind==='video'?'Video':'Photo'):'Media';};
DR.mpreview=()=>{
 const m=byId(S.drawer.id);if(!m)return '<p class="dim">This item is no longer here.</p>';
 const us=usedOf(m);const [w,h]=ORIENT_WH[m.orient];
 const fl=m.folders.map(f=>{const pth=fpath(MF,f).map(x=>x.name).join(' › ');return `<li>${ic('folder','sm')}<span class="grow" title="${esc(pth)}">${esc(pth)}</span><button class="x" data-act="munfile" data-id="${m.id}" data-f="${f}" aria-label="Take out of ${esc(MFD(f).name)}">${ic('close','sm')}</button></li>`;}).join('');
 const ul=us.map((u,i)=>`<li>${ic(u.tool==='arrange'?'arrange':u.tool==='write'?'write':u.tool==='piece'?'pieces':'image','sm')}<span class="grow" title="${esc(u.l)}">${esc(u.l)}${u.p?` <span class="dim">· ${esc(PN(u.p))}</span>`:''}</span>${u.tool==='posted'?'<span class="dim">Published</span>':`<button class="lnk" data-act="mopenuse" data-id="${m.id}" data-i="${i}">Open</button>`}</li>`).join('');
 return `<div class="mpv ${m.orient}"><img src="${mimg(m)}" alt="${esc(m.title)} (sample image)">${m.kind==='video'?`<span class="vd">${ic('play','sm')} ${m.dur} · playback isn’t connected</span>`:''}</div>
 <div class="pvh" style="margin-top:10px"><h3 style="flex:1;min-width:0">${esc(m.title)}</h3></div>
 <dl class="kv"><dt>File</dt><dd>${esc(m.file)}</dd><dt>Kind</dt><dd>${kindL(m)}</dd><dt>Date</dt><dd>${fmtDate(m.date)}</dd><dt>Place</dt><dd>${esc(m.place)}</dd><dt>Size</dt><dd>${w} × ${h} · ${m.orient}</dd><dt>Added by</dt><dd>${esc(m.by)}</dd><dt>Project</dt><dd>${m.p?esc(PN(m.p)):'None'}</dd>${m.tags.length?`<dt>Tags</dt><dd>${esc(m.tags.join(', '))}</dd>`:''}</dl>
 ${m.isNew?`<div class="pvacts"><button class="btn primary" data-act="keepasset" data-id="${m.id}">Keep</button><button class="btn" data-act="setaside" data-id="${m.id}">Set aside</button><span class="dim small" style="align-self:center">New from Claude’s import</span></div>`:''}
 <div class="pvacts"><button class="btn" data-act="mpvlink" data-id="${m.id}">Link to folder…</button><button class="btn" data-act="mpvpiece" data-id="${m.id}">Add to piece…</button></div>
 <h4 class="lab" style="margin:14px 0 4px">Used in ${us.length} place${us.length===1?'':'s'}</h4>${ul?`<ul class="ol">${ul}</ul>`:'<p class="dim small">Not used yet. Choose it for a slide’s photo in Arrange.</p>'}
 <h4 class="lab" style="margin:14px 0 4px">In ${m.folders.length} folder${m.folders.length===1?'':'s'}</h4>${fl?`<ul class="ol">${fl}</ul>`:'<p class="dim small">Unsorted — in no folder yet.</p>'}
 <p class="foot-note">Sample image, drawn in the page. Opening the original file isn’t connected. Prototype — nothing is saved.</p>`;
};
DR.used=DR.mpreview;X.DR_TITLE.used='Preview';

/* ---------- Arrange: photo slots in the real template renders, chosen from Media ---------- */
HOOK.slot=(o,n)=>{const id=o.photos&&o.photos[n];const m=id&&byId(id);return m?mimg(m):null;};
HOOK.slots=(o,t,sid,label)=>{const n=t?t.photos:0;
 if(!t)return '';
 if(!n)return `<div class="slots"><span class="dim small">No photo in this template</span></div>`;
 const ph=o.photos||[];
 const chips=Array.from({length:n},(_,j)=>{const m=ph[j]&&byId(ph[j]);return `<button class="sl ${m?'':'vacant'}" data-act="mslot" data-sid="${sid}" data-n="${j}" title="${m?`Photo ${j+1}: ${esc(m.title)} — choose another`:`Photo ${j+1}: choose a photo`}" aria-label="${m?`Photo ${j+1}, ${esc(m.title)}. Choose another`:`Choose photo ${j+1}`}" ${m?`style="${thumbBg(m)}"`:''}>${m?'':j+1}</button>`;}).join('');
 const one=n===1&&ph[0]&&byId(ph[0]);
 return `<div class="slots">${chips}<button class="lnk sln" data-act="mslot" data-sid="${sid}" data-n="${Math.max(0,Math.min(n-1,ph.slice(0,n).findIndex(x=>!x)))}">${one?esc(one.title):n>1?`Choose photos · ${ph.slice(0,n).filter(Boolean).length} of ${n}`:'Choose photo'}</button></div>`;};
const MP={sid:null,n:0,p:null};
function mpOpts(){const k=BS.mpick.sel.size;const left=MP.slots-MP.n;
 return {pickerFoot:MP.slots>1?`<button class="btn primary" data-act="mpfill">Fill ${Math.min(k,left)} slot${Math.min(k,left)===1?'':'s'} in order from photo ${MP.n+1}</button>`:'',lineRight:mtog('mpick')};}
BOPTS.mpick=mpOpts;
function mpHead(){const o=slideObj(MP.sid);const ph=o.photos||[];
 const tabs=MP.slots>1?`<span class="mptabs" role="group" aria-label="Photo slots">${Array.from({length:MP.slots},(_,j)=>{const m=ph[j]&&byId(ph[j]);return `<button class="${j===MP.n?'on':''}" data-act="mpslot" data-n="${j}"><span class="sl" ${m?`style="${thumbBg(m)}"`:''}>${m?'':j+1}</span>Photo ${j+1}${m?'':' · empty'}</button>`;}).join('')}</span>`:'';
 return `<div class="pkh"><h2>Choose ${MP.slots>1?`photo ${MP.n+1} of ${MP.slots}`:'a photo'} for ${esc(MP.label)}</h2>${tabs}<span class="dim small">Starts in ${esc((MFD(BS.mpick.start)||{name:'all media'}).name)} — pick another folder to look wider. Click a photo to place it.</span><button class="tbtn" data-act="closempicker" aria-label="Close">${ic('close','sm')}</button></div>`;}
function openMPicker(sid,n,label){
 const p=X.resolveProj('arrange');const o=slideObj(sid);if(!o)return;const t=TPN[o.tpl];
 Object.assign(MP,{sid,n:+n||0,p,slots:t?Math.max(1,t.photos):1,label:label||'this slide'});
 const prev=BS.mpick;const start=PROJ_MF[p]||'all';
 BS.mpick=null;bstate('mpick',{dom:'med',folder:start,start,f:{kind:'photo'},mode:prev?prev.mode:'grid',tree:!X.isPhone(),onPick:pickInto});
 fpath(MF,start).forEach(f=>BS.mpick.open.add(f.id));
 if(S.drawer)X.closeDrawer();
 let pk=$('#mpicker');
 if(!pk){pk=document.createElement('div');pk.id='mpicker';pk.setAttribute('role','dialog');pk.setAttribute('aria-modal','true');document.body.appendChild(pk);}
 pk.setAttribute('aria-label','Choose a photo');
 pk.innerHTML=mpHead()+browserHTML('mpick',mpOpts());pk.classList.add('on');mount('mpick');
 setTimeout(()=>{const q=document.getElementById('bq-mpick');if(q&&!X.isPhone())q.focus();},30);
}
function refreshMPHead(){const pk=$('#mpicker');if(!pk)return;const h=pk.querySelector('.pkh');if(h){const t=document.createElement('div');t.innerHTML=mpHead();h.replaceWith(t.firstElementChild);}}
function closeMPicker(){const pk=$('#mpicker');if(pk){pk.classList.remove('on');pk.innerHTML='';}BS.mpick&&(BS.mpick.onPick=null);}
function setSlot(id,j){const o=slideObj(MP.sid);o.photos=o.photos||[];o.photos[j]=id;SLOT=null;}
function pickInto(m){
 if(m.kind!=='photo'){X.toast('A template slot takes a photo, not a video');return;}
 setSlot(m.id,MP.n);const u=usedOf(m).length;
 const more=MP.slots>1&&MP.n<MP.slots-1;
 X.toast(`“${m.title}” placed in ${MP.label}${MP.slots>1?` · photo ${MP.n+1}`:''} — now used in ${u} place${u===1?'':'s'}. Prototype, nothing is saved`);
 if(more){MP.n++;X.render(true);refreshMPHead();rerenderBrowser('mpick',true);return;}
 closeMPicker();X.render(true);
}

Object.assign(A,{
 mmode:el=>{const st=BS[el.dataset.k];st.mode=el.dataset.m;rerenderBrowser(el.dataset.k);},
 mstress:()=>{if(!mstressed){mstress();X.toast('Loaded 2,000 more invented photos and videos for the stress test');}rerenderBrowser('med');},
 mview:el=>{const st=BS.med;const v=DOM.med.views.find(x=>x.id===el.dataset.v);v.set(st);st.view=v.id;rerenderBrowser('med');},
 munfile:el=>{const m=byId(el.dataset.id);m.folders=m.folders.filter(f=>f!==el.dataset.f);X.renderDrawer();if(S.view==='media')rerenderBrowser('med',true);},
 mpvlink:el=>{const m=byId(el.dataset.id);popMenu(el,'Link into folder…',folderItems(MF),x=>{if(!m.folders.includes(x.id))m.folders.push(x.id);X.renderDrawer();if(S.view==='media')rerenderBrowser('med',true);X.toast(`Linked into ${x.label}. Prototype, nothing is saved`);});},
 mpvpiece:el=>{const m=byId(el.dataset.id);popMenu(el,'Add to piece…',PIECES.map(pc=>({id:pc.id,label:pc.title,path:KIND_L[pc.kind],icon:KIND_IC[pc.kind]})),x=>{if(!m.used.some(u=>u.pid===x.id))m.used.push({l:x.label,tool:'piece',pid:x.id});X.renderDrawer();if(S.view==='media')rerenderBrowser('med',true);X.toast(`Added to ${x.label}. Prototype, nothing is saved`);});},
 mopenuse:el=>{const m=byId(el.dataset.id);const u=usedOf(m)[+el.dataset.i];if(!u)return;
  if(u.tool==='piece'){const pc=PCE(u.pid);if(pc)DOM.pce.open(pc);return;}
  if(u.tool==='arrange'){S.arrangeMode[u.p]=u.mode;X.go('arrange',u.p,u.x||null);return;}
  X.go(u.tool,u.p,u.x||null);},
 mslot:el=>{const sid=el.dataset.sid;const lbl=sid==='__post'?'the post':sid==='__listing'?'the listing image':(()=>{const c=el.closest('.slide2');return c?'slide '+(+c.dataset.idx+1):'this slide';})();openMPicker(sid,el.dataset.n,lbl);},
 mpslot:el=>{MP.n=+el.dataset.n;refreshMPHead();rerenderBrowser('mpick',true);},
 mpfill:()=>{const ids=selIds('mpick').filter(id=>{const m=byId(id);return m&&m.kind==='photo';});let j=MP.n;ids.forEach(id=>{if(j<MP.slots)setSlot(id,j++);});
  X.toast(`Filled ${j-MP.n} photo slot${j-MP.n===1?'':'s'} in ${MP.label}. Prototype, nothing is saved`);closeMPicker();X.render(true);},
 closempicker:()=>closeMPicker(),
 keepasset:el=>{const m=byId(el.dataset.id);if(m){m.isNew=0;m.by+=' · kept by you';}X.render(true);},
 setaside:el=>{const m=byId(el.dataset.id);if(m){m.isNew=0;m.folders=m.folders.filter(f=>f!==PROJ_MF[m.p]);m.p=null;m.by+=' · set aside';}X.toast('Set aside — still in Media, taken out of the project folder. Prototype, nothing is saved');X.render(true);}
});
/* clicking a slide's render opens the picker at its first empty photo slot */
document.addEventListener('click',e=>{const r=e.target.closest&&e.target.closest('.slide2 .tplr[data-rsid],.postwrap .tplr[data-rsid]');if(!r)return;
 const sid=r.dataset.rsid;const o=slideObj(sid);const t=o&&TPN[o.tpl];if(!t||!t.photos){X.toast('This template has no photo');return;}
 const ph=o.photos||[];let j=ph.slice(0,t.photos).findIndex(x=>!x);if(j<0)j=0;
 const card=r.closest('.slide2');openMPicker(sid,j,sid==='__post'?'the post':sid==='__listing'?'the listing image':'slide '+(+card.dataset.idx+1));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#mpicker.on')&&!($('#pop')&&$('#pop').classList.contains('on'))&&!($('#lsheet')&&$('#lsheet').classList.contains('on'))){closeMPicker();e.stopImmediatePropagation();}},true);
/* a changed template can change how many slots a slide has: re-count uses */
const oldApply=A.tpapply;A.tpapply=el=>{SLOT=null;oldApply(el);};

X.render(true);
window.ARC_MEDIA={MEDIA,MF,MFD,PROJ_MF,usedOf,mstress,openMPicker,byId,thumbBg,mimg};
})();


/* ================================================================
   Revision 5 — rail and section panel.
   The rail (index.html) picks a section. Sections with something to
   navigate get one panel attached to the rail (folders, recordings,
   points, outputs by kind). The work takes every other pixel: one
   title line (section › folder path + count), search + Filters, a
   small row of saved views, then the list. Opening an item shows it
   in the work area; Back or Esc returns to the same scroll and row.
   ================================================================ */
(()=>{
'use strict';
const X=window.ARC,Z=window.ARC_SCALE,M=window.ARC_MEDIA;if(!X||!Z||!M)return;
const {S,V,A,DR,P,PN,RES,MAT,OUT,SRC,COUNT,PANEL,esc,ic}=X;
const {treeHTML,BS,BOPTS,DOM,bstate,mount,paint,rerenderBrowser,fpath,FD,PROJ_COLL,projPiece,LIB,F,PCE,KIND_L,KIND_IC}=Z;
const {MEDIA,MF,MFD,byId}=M;
const $=s=>document.querySelector(s);
const INWORK={lib:'library',med:'media',pce:'pieces'};
const SEC={lib:'Library',med:'Media',pce:'Pieces'};

/* Library carries Material's count now (Material is its Inbox) */
COUNT.library=p=>COUNT.material(p);

/* ---------- title line: section › folder path, plus the count ---------- */
function crumbSegs(key){
 const D=DOM[key==='lib'?'lib':key==='med'?'med':'pce'];const st=BS[key];
 if(key==='lib'&&S.libInbox)return [{label:'Inbox'}];
 if(st.folder==='all')return [];
 if(st.folder==='unsorted')return [{label:'Unsorted'}];
 return fpath(D.folders,st.folder).map(f=>({label:f.name,f:f.id,q:f.q}));
}
function titleLine(key,segs,count,right,item){
 const root=`<button class="crr" data-act="${item?'oback':'tpick'}" data-k="${key}" data-f="all">${SEC[key]}</button>`;
 const parts=segs.map((g,i)=>{const last=i===segs.length-1&&!item;return `<span class="crs" aria-hidden="true">›</span>${g.f&&!last?`<button class="crp" data-act="${item?'oback':'tpick'}" data-k="${key}" data-f="${g.f}">${esc(g.label)}</button>`:`<span class="crp ${last?'last':''}">${esc(g.label)}</span>`}`;}).join('');
 const it=item?`<span class="crs" aria-hidden="true">›</span><span class="crp last">${esc(item)}</span>`:'';
 return `<div class="thead t5">${item?`<button class="btn quiet back5" data-act="oback" title="Back to the list (Esc)">${ic('chev','sm flip')} Back</button>`:''}<h1 class="crumb5">${root}${parts}${it}</h1>${count!=null?`<span class="tcount">${count}</span>`:''}<span class="sp"></span>${right||''}${X.panelBtn()}</div>`;
}
const qLine=segs=>{const g=segs[segs.length-1];return g&&g.q?`<p class="qline"><span class="qm" title="This folder carries a question">?</span>${esc(g.q)}</p>`:'';};
const countTxt=(rows,total,nf)=>nf?`${rows.length.toLocaleString()} of ${total.toLocaleString()}`:rows.length.toLocaleString();

BOPTS.lib=()=>({compact:1,title:(rows,total,nf)=>{const segs=crumbSegs('lib');const st=BS.lib;
 const right=`<span class="tag" title="Invented sources — no real library was read">Sample library</span>${st.folder==='unsorted'?`<button class="btn" data-act="libsuggest">Suggest sorting</button>`:''}`;
 return titleLine('lib',segs,countTxt(rows,total,nf),right)+qLine(segs);}});
BOPTS.pce=()=>({compact:1,title:(rows,total,nf)=>{const segs=crumbSegs('pce');return titleLine('pce',segs,countTxt(rows,total,nf),'')+qLine(segs);}});
const oldMedOpts=BOPTS.med;
BOPTS.med=()=>({compact:1,lineRight:oldMedOpts().lineRight,title:(rows,total,nf)=>{const segs=crumbSegs('med');const nw=MEDIA.filter(m=>m.isNew).length;
 const right=`<span class="tag" title="Invented photos and videos — none of your files were read">Sample media</span>${nw?`<button class="btn" data-act="mview" data-v="claude">${nw} new from Claude’s import</button>`:''}`;
 return titleLine('med',segs,countTxt(rows,total,nf),right);}});

/* ---------- opening an item: in the work area, full width ---------- */
function withDrawer(k,id,fn){const save=S.drawer;S.drawer={k,id};try{return fn();}finally{S.drawer=save;}}
function detail(key){
 const id=S.open.id;const segs=crumbSegs(key);let title='',body='';
 if(key==='lib'){const it=LIB.find(i=>i.id===id);if(!it){S.open=null;return null;}title=it.title;
  body=`<div class="odet k-lib">${withDrawer('preview',id,DR.preview)}</div>`;}
 else if(key==='med'){const m=byId(id);if(!m){S.open=null;return null;}title=m.title;
  const h=withDrawer('mpreview',id,DR.mpreview);const cut=h.indexOf('</div>')+6;
  body=`<div class="odet k-med"><div class="ol5">${h.slice(0,cut)}</div><div class="or5">${h.slice(cut)}</div></div>`;}
 else {const pc=PCE(id);if(!pc){S.open=null;return null;}title=pc.title;
  body=`<div class="odet k-pce">${withDrawer('piece',id,DR.piece)}</div>`;}
 return `<div class="wrap full det5">${titleLine(key,segs,null,'',title)}<div class="dscroll">${body}</div></div>`;
}
const directPiece=pc=>(pc.p&&projPiece(pc.p)===pc.id&&(X.DOCS[pc.p]||pc.kind==='listing'))||pc.id==='pc_porcc'||pc.id==='pc_porcp';

V.library=()=>{
 bstate('lib');
 if(S.open&&S.open.key==='lib'){const d=detail('lib');if(d)return d;}
 if(S.libInbox){
  const n=MAT.filter(m=>m.state==='new'&&(S.scope==='all'||m.p===S.scope)).length;
  const h=oldMaterial();
  return h.replace(/<div class="thead">[\s\S]*?<\/div>/,titleLine('lib',[{label:'Inbox'}],n?`${n} new`:'',`<button class="btn" data-act="pickfile">Choose files</button>`));
 }
 queueMicrotask(()=>{mount('lib',true);focusCur('lib');});
 return `<div class="wrap full">${Z.browserHTML('lib',BOPTS.lib())}</div>`;
};
const oldMaterial=V.material;
V.material=()=>{S.libInbox=true;return V.library();};
V.pieces=()=>{
 bstate('pce',{sort:'upd'});
 if(S.open&&S.open.key==='pce'){const d=detail('pce');if(d)return d;}
 queueMicrotask(()=>{mount('pce',true);focusCur('pce');});
 return `<div class="wrap full">${Z.browserHTML('pce',BOPTS.pce())}</div>`;
};
const oldMedia=V.media;
V.media=()=>{
 if(S.open&&S.open.key==='med'){bstate('med');const d=detail('med');if(d)return d;}
 const h=oldMedia();
 queueMicrotask(()=>focusCur('med'));
 return h.replace(/<div class="thead">[\s\S]*?<\/div>/,'');
};
let refocus=null;
function focusCur(key){if(refocus!==key)return;refocus=null;const el=document.querySelector(`.lb[data-bkey="${key}"] .vrow.cur .ti, .lb[data-bkey="${key}"] .vtile.cur .mt-t`);if(el)el.focus({preventScroll:true});}

const getKey=el=>el.dataset.k||((el.closest('[data-bkey]')||{}).dataset||{}).bkey||'lib';
const oldBopen=A.bopen;
A.bopen=(el,e)=>{
 const key=getKey(el);const st=BS[key];
 if(INWORK[key]&&!(st&&st.onPick)){
  const D=DOM[key==='pce'?'pce':key];const it=D.items().find(x=>x.id===el.dataset.id);if(!it)return;
  if(key==='pce'&&directPiece(it)){oldBopen(el,e);return;}
  if(S.view===INWORK[key]){if(st)st.cur=it.id;S.open={key,id:it.id};X.render();return;}
  /* a piece named inside another item's "Used in" opens in Pieces, not in a side pop-out */
  if(key==='pce'&&(S.view==='library'||S.view==='media')){bstate('pce',{sort:'upd'});X.go('pieces');BS.pce.cur=it.id;S.open={key:'pce',id:it.id};X.render();return;}
 }
 oldBopen(el,e);
};
function back(){if(!S.open)return;const k=S.open.key;S.open=null;refocus=k;X.render();}
A.oback=el=>{const f=el&&el.dataset.f;const k=S.open&&S.open.key;back();if(k&&f&&f!=='all'&&BS[k]&&BS[k].folder!==f){}};
/* a folder anywhere (panel, title line) shows that folder's list and leaves any opened item */
const oldTpick=A.tpick;A.tpick=el=>{const key=el.dataset.k;if(S.open&&S.open.key===key)S.open=null;if(key==='lib')S.libInbox=false;if(INWORK[key]&&S.view!==INWORK[key]&&!(BS[key]&&BS[key].onPick)){bstate(key);BS[key].folder=el.dataset.f;BS[key].view=el.dataset.f==='all'?'all':'';X.go(INWORK[key]);return;}oldTpick(el);if(!document.querySelector(`.lb[data-bkey="${key}"]`))X.render(true);};
const oldBview=A.bview;A.bview=el=>{if(el.dataset.k==='lib')S.libInbox=false;oldBview(el);};
const oldOpencoll=A.opencoll;A.opencoll=el=>{S.libInbox=false;oldOpencoll(el);};
const oldLibsearch=A.libsearch;A.libsearch=el=>{S.libInbox=false;oldLibsearch(el);};
A.libinbox=()=>{S.libInbox=true;S.open=null;if(S.view!=='library')X.go('material');else X.render();};
A.libsuggest=()=>{X.go('collections');A.suggest();};
A.fopen=el=>{const st=BS[el.dataset.k];st.fopen=!st.fopen;rerenderBrowser(el.dataset.k,true);};
A.fchipx=el=>{const st=BS[el.dataset.k];delete st.f[el.dataset.facet];st.view='';rerenderBrowser(el.dataset.k);};
/* the active rail item, clicked again, opens or closes its panel (or returns from an opened item) */
const oldGo=A.go;A.go=el=>{
 if(el.dataset.rail&&el.dataset.tool===X.railId()&&!(X.T(el.dataset.tool)||{}).pull){
  if(S.open){back();return;}
  if(el.dataset.tool==='library'&&S.view!=='library'){oldGo(el);return;}
  if(PANEL[el.dataset.tool]){A.ptog();return;}
 }
 oldGo(el);
};
/* actions inside an opened item re-draw the item, not a drawer */
const oldRD=X.renderDrawer;X.renderDrawer=()=>{oldRD();if(S.open)X.render(true);};
['keepasset','setaside'].forEach(k=>{const o=A[k];A[k]=el=>{o(el);if(S.open)X.render(true);};});
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||!S.open||S.drawer)return;
 if(document.querySelector('#pop.on,#lsheet.on,#psheet.on,#picker.on,#mpicker.on,#finder.on'))return;
 if(e.target&&e.target.closest&&e.target.closest('input,textarea,[contenteditable="true"]'))return;
 e.stopImmediatePropagation();back();
},true);

/* ---------- the section panels ---------- */
const libPanel=()=>{const n=COUNT.material(S.scope==='all'?null:S.scope);const nn=S.scope==='all'?P.reduce((a,p)=>a+COUNT.material(p.id),0):n;
 return `<div class="tn ${S.libInbox&&S.view==='library'?'on':''}"><span class="tw"></span><button class="tl" data-act="libinbox">${ic('material','sm')}<span>Inbox</span></button>${nn?`<span class="cnt">${nn}</span>`:''}</div>`+treeHTML('lib',S.libInbox);};
PANEL.library={btn:'Folders',html:()=>{bstate('lib');return `<div class="tree t5">${libPanel()}</div>`;}};
PANEL.media={btn:'Folders',html:()=>{bstate('med',{sort:'date'});return `<div class="tree t5">${treeHTML('med')}</div>`;}};
PANEL.pieces={btn:'Folders',html:()=>{bstate('pce',{sort:'upd'});return `<div class="tree t5">${treeHTML('pce')}</div>`;}};
const inScope=id=>S.scope==='all'||S.scope===id;
PANEL.source={btn:'Recordings',html:()=>{const cur=X.resolveProj('source');
 const recs=Object.keys(SRC).filter(inScope).map(p=>{const s=SRC[p];const u=s.lines.filter(l=>l.unclear&&!l.fixed).length;
  return `<button class="pi ${p===cur?'on':''}" data-act="toolproj" data-p="${p}" ${p===cur?'aria-current="true"':''}>${ic('recording','sm')}<span class="pt"><span class="pn">${esc(s.file)}</span><span class="ps">${esc(PN(p))} · ${s.dur}</span></span>${u?`<span class="cnt" title="${u} unclear lines">${u}</span>`:''}</button>`;}).join('');
 const raw=MAT.filter(m=>m.kind==='audio'&&inScope(m.p)&&!SRC[m.p]).map(m=>`<button class="pi" data-act="go" data-tool="material" data-x="${m.id}">${ic('recording','sm')}<span class="pt"><span class="pn">${esc(m.name)}</span><span class="ps">${esc(PN(m.p))} · not transcribed · in Inbox</span></span></button>`).join('');
 return `<div class="plist5">${recs||'<p class="pe">No recordings in this project.</p>'}${raw}</div>`;}};
const LVLN={settled:'Sure',unsure:'Unsure',disputed:'Disputed',likely:'Unsure'};
PANEL.research={btn:'Points',html:()=>{const cur=X.resolveProj('research');
 return `<div class="plist5">${P.filter(x=>RES[x.id]&&inScope(x.id)).map(x=>{const on=x.id===cur;const pts=RES[x.id];const c=PROJ_COLL[x.id];const f=c&&FD(c);const open=pts.filter(r=>r.level==='unsure'||r.level==='disputed').length;
  const head=`<button class="pgh ${on?'on':''}" data-act="toolproj" data-p="${x.id}" aria-expanded="${on}">${ic(f&&f.q?'coll':'folder','sm')}<span class="pn">${esc(f?f.name:PN(x.id))}</span>${f&&f.q?'<span class="qm" title="This collection carries a question">?</span>':''}${open?`<span class="cnt">${open}</span>`:''}</button>`;
  if(!on)return head;
  return head+`<div class="pps">${pts.map((r,i)=>`<button class="pp ${S.research[x.id]===r.id?'on':''}" data-act="rpset" data-id="${r.id}" title="${esc(r.claim)}"><span class="n">${i+1}</span><span class="lv ${r.level}" title="${LVLN[r.level]}"></span><span class="pn">${esc(r.claim)}</span></button>`).join('')}</div>`;}).join('')}</div>`;}};
A.rpset=el=>{const p=X.resolveProj('research');S.research[p]=el.dataset.id;X.render(true);};
const OKIND=k=>/^(Article|Part |Magazine)/.test(k)?'Articles':/Carousel/.test(k)?'Carousels':/caption/i.test(k)?'Captions':/note/i.test(k)?'Shared notes':/script/i.test(k)?'Scripts':'Other';
PANEL.outputs={btn:'Outputs by kind',html:()=>{const cur=X.resolveProj('outputs');const g={};
 Object.keys(OUT).filter(inScope).forEach(p=>OUT[p].items.forEach(it=>{(g[OKIND(it.k)]=g[OKIND(it.k)]||[]).push({p,k:it.k});}));
 return `<div class="plist5">${['Articles','Carousels','Captions','Scripts','Shared notes','Other'].filter(k=>g[k]).map(k=>`<div class="pkh">${k} · ${g[k].length}</div>${g[k].map(x=>`<button class="pi ${x.p===cur?'on':''}" data-act="toolproj" data-p="${x.p}"><span class="pt"><span class="pn">${esc(x.k)}</span><span class="ps">${esc(PN(x.p))}</span></span></button>`).join('')}`).join('')}</div>`;}};
/* Research: with the panel open the points live there, and the work shows the open point + console */
const oldResearch=V.research;
V.research=()=>{const p=X.resolveProj('research');const pts=RES[p]||[];
 if(X.hasPanel()&&X.panelOpen('research')&&pts.length&&!pts.some(r=>r.id===S.research[p]))S.research[p]=(pts.find(r=>r.level==='unsure'||r.level==='disputed')||pts[0]).id;
 return oldResearch();};

X.render(true);
window.ARC_R5={detail,back,PANEL};
})();
