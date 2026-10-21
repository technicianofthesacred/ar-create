/* AR Create — The Workbench, revision 3: scale, research, templates.
   Extends the revision-2 page through window.ARC. Everything here is invented sample
   content held in memory; nothing is fetched except ./ig-layouts.json (Adrian's own
   template file, read-only) and nothing is saved. */
(()=>{
'use strict';
const X=window.ARC;if(!X)return;
const {S,V,A,DR,TOOLS,I,P,PN,T,HAS,COUNT,CROSS,DOCS,CAR,RES,U,MEDIA,esc,ic}=X;
const $=s=>document.querySelector(s);

/* ---------- icons ---------- */
Object.assign(I,{
 library:'M4 4h4v16H4zM10 4h4v16h-4zM16 5l3.5-1 2.5 15.5-3.5 1z',
 collections:'M3 7h7l2 2h9v10H3zM3 7V5h6l2 2',
 pieces:'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
 folder:'M3 7h7l2 2h9v10H3z',
 coll:'M3 7h7l2 2h9v10H3zM10 14h6M13 11v6',
 article:'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
 youtube:'M3 7c0-1.5 1-2.5 2.5-2.5h13C20 4.5 21 5.5 21 7v10c0 1.5-1 2.5-2.5 2.5h-13C4 19.5 3 18.5 3 17zM10 9v6l5-3z',
 recording:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
 pdf:'M6 3h9l4 4v14H6zM15 3v4h4M8 13h2.5a1.5 1.5 0 0 0 0-3H8v6',
 note:'M5 4h14v12l-4 4H5zM15 20v-4h4',
 photoset:'M3 7h14v12H3zM7 3h14v12',
 terminal:'M4 5h16v14H4zM7 9l3 3-3 3M12 15h5',
 tpl:'M4 4h16v16H4zM4 9h16M9 9v11',
 filter:'M4 5h16l-6 7v6l-4 2v-8z'
});

/* ---------- seeded generator (deterministic) ---------- */
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,a)=>a[Math.floor(r()*a.length)];

/* ---------- folders: nested, any depth; a collection is a folder with a question ---------- */
const F=[
 {id:'f_tea',name:'Tea',parent:null},
 {id:'f_oolong',name:'Oolong',parent:'f_tea'},
 {id:'c_oolong',name:'Spring Oolong',parent:'f_oolong',q:'Who is this spring’s oolong for, and what makes this harvest different?',topics:['oolong','harvest','tasting']},
 {id:'c_wuyi',name:'Wuyi rock tea',parent:'f_oolong',q:'What is the “rock rhyme” actually tasting of?',topics:['wuyi','roasting','terroir']},
 {id:'f_roast',name:'Roasting',parent:'f_oolong',topics:['roasting']},
 {id:'f_dark',name:'Dark tea',parent:'f_tea'},
 {id:'c_ancha',name:'An Cha',parent:'f_dark',q:'Where did basket tea come from, and why did it travel south?',topics:['an cha','trade','mining','history']},
 {id:'f_puer',name:'Puer',parent:'f_dark',topics:['puer']},
 {id:'f_water',name:'Water & brewing',parent:'f_tea',topics:['water','brewing']},
 {id:'f_cer',name:'Ceramics',parent:null},
 {id:'c_porc',name:'Porcelain and Tea',parent:'f_cer',q:'What does a vessel keep — and what does it give back?',topics:['porcelain','glaze','gaiwan']},
 {id:'f_yixing',name:'Yixing clay',parent:'f_cer',topics:['yixing','clay']},
 {id:'f_kilns',name:'Kilns & firing',parent:'f_cer',topics:['kiln','firing']},
 {id:'c_kiln',name:'Kiln Day',parent:'f_kilns',q:'What does a firing decide that the potter can’t?',topics:['kiln','firing','wood']},
 {id:'f_places',name:'Places',parent:null},
 {id:'c_harb',name:'Harbour Night Market',parent:'f_places',q:'What does a market that opens with the ferry run on?',topics:['market','street food','ferry']},
 {id:'f_taiwan',name:'Taiwan',parent:'f_places',topics:['taiwan']},
 {id:'f_alishan',name:'Alishan 2025',parent:'f_taiwan',topics:['alishan','harvest']},
 {id:'f_biz',name:'Business',parent:null},
 {id:'f_shop',name:'Shop listings',parent:'f_biz',topics:['shop','pricing']},
 {id:'f_ig',name:'Instagram ideas',parent:'f_biz',topics:['instagram']},
 {id:'f_later',name:'To read later',parent:null}
];
const FD=id=>F.find(f=>f.id===id);
const PROJ_COLL={porc:'c_porc',oolong:'c_oolong',ancha:'c_ancha',kiln:'c_kiln',harb:'c_harb',wuyi:'c_wuyi',care:'f_yixing'};

/* ---------- the Library: sources, each once ---------- */
const SUBJ={
 oolong:['spring oolong','high-mountain oolong','oxidation levels','rolled oolong','the third steep','floral oolong'],
 harvest:['the April harvest','picking by hand','rain during harvest','a harvest week'],
 tasting:['tasting notes','cupping at origin','a blind tasting'],
 wuyi:['Wuyi rock tea','the rock rhyme','cliffside gardens','Da Hong Pao'],
 roasting:['charcoal roasting','re-roasting old oolong','roast levels','a roaster’s calendar'],
 terroir:['mineral terroir','soil and slope','mountain microclimates'],
 'an cha':['An Cha baskets','basket-pressed tea','An Cha in Ipoh','aged basket tea'],
 trade:['the southern tea routes','tea in tin-mining towns','shipping dark tea'],
 mining:['tin-mining towns','miners’ remedies'],
 history:['a history of dark tea','tea merchants of the 1930s'],
 puer:['raw puer','storage humidity','puer cakes'],
 water:['water hardness','spring water for tea','boiling points'],
 brewing:['gongfu brewing','brewing ratios','steeping times'],
 porcelain:['porcelain gaiwans','eggshell porcelain','white porcelain'],
 glaze:['celadon glaze','glaze crazing','clear glazes'],
 gaiwan:['the gaiwan','pouring from a gaiwan'],
 yixing:['Yixing pots','zisha clay','seasoning a clay pot','one pot, one tea'],
 clay:['unglazed clay','clay porosity'],
 kiln:['wood-fired kilns','the anagama kiln','kiln shelves','opening the kiln','kiln ash'],
 firing:['a three-day firing','reduction firing','cooling the kiln','firing logs'],
 wood:['splitting kiln wood','pine for firing'],
 market:['night markets','the ferry crowd','market stalls after nine'],
 'street food':['dumpling stalls','tea carts','thermos tea'],
 ferry:['the ferry terminal','harbour ferries'],
 taiwan:['Taiwan tea farms','Taipei tea houses'],
 alishan:['Alishan gardens','Alishan in spring'],
 shop:['product photos','listing copy','restock notes'],
 pricing:['pricing tea by the gram','small-batch pricing'],
 instagram:['carousel hooks','caption length','posting rhythm']
};
const PAT={
 article:['Notes on %s','Why %s matters more than it looks','%S — a field report','The slow economics of %s','What %s teaches about patience','A short guide to %s','Against easy answers about %s','%S, revisited'],
 youtube:['%S explained','A day of %s','%S — full process, no talking','I tried %s for a month','%S: what nobody shows you','Inside %s'],
 recording:['Voice memo — %s','Interview: %s','Walk-through: %s'],
 pdf:['%S (survey)','Handbook chapter: %s','%S — supplier sheet'],
 note:['Note: %s','Question about %s','Idea: %s'],
 photos:['Photo set — %s','Contact sheet: %s']
};
const PUBS=['Leaf Quarterly','The Steeped Review','Clay & Fire Journal','Harbour Daily','Tea Trade Weekly','Kiln Notes Review','Southern Tea Archive','Slow Cup Letters'];
const CHANNELS=['Mountain Tea Notes','Kiln Diaries','Pour Slowly','Teahouse Walks','Firebox Weekly','Gongfu at Home'];
const TYPES=[['article','Article'],['youtube','YouTube'],['recording','Recording'],['pdf','PDF / book'],['note','Note'],['photos','Photo set']];
const TYPE_L=Object.fromEntries(TYPES);
const PIECES=[];
const LIB=[];let libVer=0;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
function makeItem(r,i,folderPool){
 const tw=r();const type=tw<.38?'article':tw<.62?'youtube':tw<.74?'recording':tw<.84?'pdf':tw<.95?'note':'photos';
 const home=r()<.7?pick(r,folderPool):null;
 let tps=home?(FD(home).topics||[]).slice():[];
 if(!tps.length||r()<.5)tps.push(pick(r,Object.keys(SUBJ)));
 tps=[...new Set(tps)].slice(0,3);
 const s=pick(r,SUBJ[tps[0]]);
 const title=pick(r,PAT[type]).replace('%S',cap(s)).replace('%s',s);
 const y=2023+Math.floor(r()*4);const mo=1+Math.floor(r()*12);const d=1+Math.floor(r()*28);
 const m2=y===2026?Math.min(mo,10):mo;const d2=y===2026&&m2===10?Math.min(d,20):d;const date=`${y}-${String(m2).padStart(2,'0')}-${String(d2).padStart(2,'0')}`;
 const src=type==='article'?pick(r,PUBS):type==='youtube'?pick(r,CHANNELS):type==='recording'?'You recorded':type==='pdf'?pick(r,['Oolong Growers Cooperative','University press (invented)','Supplier']):type==='note'?(r()<.25?'Claude added':'You'):'You';
 const len=type==='article'?`${4+Math.floor(r()*14)} min read`:type==='youtube'?`${3+Math.floor(r()*40)}:${String(Math.floor(r()*60)).padStart(2,'0')}`:type==='recording'?`${2+Math.floor(r()*60)} min`:type==='pdf'?`${2+Math.floor(r()*240)} pages`:type==='note'?`${40+Math.floor(r()*600)} words`:`${4+Math.floor(r()*30)} photos`;
 const st=r();const status=st<.4?'new':st<.8?'read':'annotated';
 const folders=home?[home]:[];
 if(home&&r()<.18){const o=pick(r,folderPool);if(o!==home)folders.push(o);}
 if(r()<.06)folders.push('f_later');
 return {id:'L'+String(i).padStart(4,'0'),type,title,src,date,topics:tps,len,status,folders,pieces:[],tone:pick(r,['#4b3e30','#3d3a2e','#33302a','#2e3638','#5a4532','#4a4d3a','#45382c','#3f2e24'])};
}
function seedLibrary(n,seed,start){
 const r=rng(seed);const pool=F.filter(f=>f.topics).map(f=>f.id);
 for(let i=0;i<n;i++)LIB.push(makeItem(r,start+i,pool));
}
seedLibrary(214,20261021,1);
/* "used in": items in a project's collection are cited by that project's main piece */
const MAINPIECE={c_porc:'pc_porc',c_oolong:'pc_oolong',c_ancha:'pc_ancha2',c_kiln:'pc_kiln',c_harb:'pc_harb'};
(()=>{const r=rng(7);LIB.forEach(it=>{it.folders.forEach(f=>{if(MAINPIECE[f]&&r()<.35)it.pieces.push(MAINPIECE[f]);});});})();
let stressed=false;
function stress(){if(stressed)return;stressed=true;seedLibrary(5000,99,1000);libVer++;}
try{if(/[?&]stress=1/.test(location.search))stress();}catch(e){}

/* ---------- Pieces: every piece across projects, also foldered ---------- */
const PF=[
 {id:'pf_active',name:'In progress',parent:null},
 {id:'pf_porc',name:'Porcelain and Tea',parent:'pf_active'},
 {id:'pf_ancha',name:'An Cha — three parts',parent:'pf_active'},
 {id:'pf_other',name:'Other projects',parent:'pf_active'},
 {id:'pf_ideas',name:'Ideas',parent:null},
 {id:'pf_ig',name:'Instagram',parent:'pf_ideas'},
 {id:'pf_mag',name:'Magazine',parent:'pf_ideas'},
 {id:'pf_pub',name:'Published',parent:null},
 {id:'pf_2026',name:'2026',parent:'pf_pub'},
 {id:'pf_2025',name:'2025',parent:'pf_pub'}
];
const KINDS=[['article','Article'],['carousel','Carousel'],['post','Post'],['listing','Product listing'],['script','Script'],['note','Shared note']];
const KIND_L=Object.fromEntries(KINDS);
const KIND_IC={article:'article',carousel:'arrange',post:'image',listing:'doc',script:'video',note:'note'};
[
 ['pc_porc','Porcelain and Tea','article','porc','draft','Yesterday',['pf_porc']],
 ['pc_porcc','Porcelain and Tea — carousel','carousel','porc','draft','Yesterday',['pf_porc','pf_ig']],
 ['pc_porcp','Porcelain and Tea — post','post','porc','idea','Oct 3',['pf_porc']],
 ['pc_lin','Shared note for Mr. Lin','note','porc','draft','Oct 4',['pf_porc']],
 ['pc_oolong','Spring Oolong listing','listing','oolong','idea','Mon',['pf_other']],
 ['pc_ancha1','An Cha, part one','article','ancha','published','Sep 28',['pf_ancha','pf_2026']],
 ['pc_ancha2','An Cha, part two: the journey','article','ancha','draft','Sun',['pf_ancha']],
 ['pc_ancha3','An Cha, part three','article','ancha','idea','Sun',['pf_ancha']],
 ['pc_kiln','Kiln Day — reel script','script','kiln','ready','Last week',['pf_other']],
 ['pc_harb','Harbour Night Market — magazine story','article','harb','idea','Today',['pf_other']],
 ['pc_care','Teaware care sheet','note','care','ready','Sep 30',['pf_other']]
].forEach(([id,title,kind,p,status,upd,folders])=>PIECES.push({id,title,kind,p,status,upd,folders}));
(()=>{const r=rng(31);const ideas=['Why I stopped buying sets','Five cups, one tea','The cart after nine','What rain does to a market','Notes from a re-roast','The pot that tastes of nothing','A gaiwan for beginners','Water before leaf','Kiln shelves, close up','Small-batch pricing, honestly','A tea for people who dislike tea','Three winters in a basket','The ferry crowd','Buying clay online','Seasoning a pot in a week','Charcoal or electric?','Mineral, not smoky','How long a tea should wait','A shop restock diary','Cups drying on boards'];
 ideas.forEach((t,i)=>{const kind=pick(r,['article','carousel','post','script','carousel','article']);const pub=r()<.35;
  PIECES.push({id:'pg'+i,title:t,kind,p:null,status:pub?'published':pick(r,['idea','idea','draft']),upd:pub?pick(r,['Mar 2025','Jun 2025','Nov 2025','Feb 2026','Jul 2026']):pick(r,['2 weeks ago','Last month','Aug 12','Jul 30']),folders:[pub?(r()<.5?'pf_2025':'pf_2026'):(kind==='article'?'pf_mag':'pf_ig')]});});})();
const PCE=id=>PIECES.find(x=>x.id===id);
const projPiece=p=>({porc:'pc_porc',oolong:'pc_oolong',ancha:'pc_ancha2',kiln:'pc_kiln',harb:'pc_harb',care:'pc_care'}[p]);

/* ---------- generic browser: folder tree + one-line virtualised table ---------- */
const BS={};const BOPTS={};const HOOK={};
function bstate(key,init){return BS[key]||(BS[key]=Object.assign({folder:'all',q:'',f:{},sort:'date',dir:-1,view:'all',sel:new Set(),anchor:null,open:new Set(),cur:null,top:0,tree:true},init||{}));}
const subCache={};
function subtree(folders,fid){const k=fid+':'+folders.length;if(subCache[k])return subCache[k];const out=new Set([fid]);let grew=true;while(grew){grew=false;folders.forEach(f=>{if(f.parent&&out.has(f.parent)&&!out.has(f.id)){out.add(f.id);grew=true;}});}subCache[k]=out;return out;}
function clearSub(){for(const k in subCache)delete subCache[k];}
const fpath=(folders,id)=>{const a=[];let f=folders.find(x=>x.id===id);while(f){a.unshift(f);f=folders.find(x=>x.id===f.parent);}return a;};

const DOM={
 lib:{
  noun:'sources',items:()=>LIB,folders:F,
  facets:[
   {k:'type',label:'Type',val:it=>it.type,fmt:v=>TYPE_L[v]},
   {k:'topic',label:'Topic',val:it=>it.topics,fmt:v=>cap(v)},
   {k:'status',label:'Status',val:it=>it.status,fmt:v=>({new:'New / not watched',read:'Read',annotated:'Annotated'}[v])},
   {k:'used',label:'Used',val:it=>it.pieces.length?'used':'unused',fmt:v=>v==='used'?'Used in a piece':'Not used yet'}
  ],
  views:[
   {id:'all',label:'All',set:st=>{st.folder='all';st.f={};st.q='';}},
   {id:'unsorted',label:'Unsorted',set:st=>{st.folder='unsorted';st.f={};st.q='';}},
   {id:'ytnew',label:'YouTube not yet watched',set:st=>{st.folder='all';st.f={type:'youtube',status:'new'};st.q='';}},
   {id:'usedoolong',label:'Used in Spring Oolong',set:st=>{st.folder='c_oolong';st.f={used:'used'};st.q='';}},
   {id:'later',label:'To read later',set:st=>{st.folder='f_later';st.f={};st.q='';}}
  ],
  sorts:[['date','Date'],['title','Title'],['src','Source'],['used','Used in'],['status','Status']],
  cols:['Title','Source','Date','Topics','Used in','Status'],
  text:it=>(it.title+' '+it.src+' '+it.topics.join(' ')+' '+TYPE_L[it.type]).toLowerCase(),
  row:it=>{const u=it.pieces.length;const stl={new:it.type==='youtube'?'Not watched':'New',read:it.type==='youtube'?'Watched':'Read',annotated:'Annotated'}[it.status];
   return `<span class="tyi" title="${TYPE_L[it.type]}">${ic(it.type==='youtube'?'youtube':it.type,'sm')}</span><button class="ti" data-act="bopen" data-id="${it.id}" title="${esc(it.title)}">${esc(it.title)}</button><span class="c">${esc(it.src)}</span><span class="c num">${fmtDate(it.date)}</span><span class="c c-topics">${esc(it.topics.slice(0,2).join(', '))}</span><span class="c num">${u?u+' piece'+(u>1?'s':''):'—'}</span><span class="c st-${it.status}">${stl}</span><span class="c2">${esc(it.src)} · ${fmtDate(it.date)} · ${u?'used in '+u:'unused'} · ${stl}</span>`;},
  open:it=>X.openDrawer('preview',{id:it.id})
 },
 pce:{
  noun:'pieces',items:()=>PIECES,folders:PF,
  facets:[
   {k:'kind',label:'Kind',val:it=>it.kind,fmt:v=>KIND_L[v]},
   {k:'status',label:'Status',val:it=>it.status,fmt:v=>cap(v)},
   {k:'proj',label:'Project',val:it=>it.p||'none',fmt:v=>v==='none'?'No project':PN(v)}
  ],
  views:[
   {id:'all',label:'All',set:st=>{st.folder='all';st.f={};st.q='';}},
   {id:'drafts',label:'Drafts',set:st=>{st.folder='all';st.f={status:'draft'};st.q='';}},
   {id:'ready',label:'Ready to ship',set:st=>{st.folder='all';st.f={status:'ready'};st.q='';}},
   {id:'igideas',label:'Instagram ideas',set:st=>{st.folder='pf_ig';st.f={status:'idea'};st.q='';}}
  ],
  sorts:[['upd','Updated'],['title','Title'],['kind','Kind'],['status','Status']],
  cols:['Title','Kind','Updated','Project','Sources','Status'],
  text:it=>(it.title+' '+KIND_L[it.kind]+' '+(it.p?PN(it.p):'')+' '+it.status).toLowerCase(),
  row:it=>{const n=LIB.filter(x=>x.pieces.includes(it.id)).length;
   return `<span class="tyi" title="${KIND_L[it.kind]}">${ic(KIND_IC[it.kind],'sm')}</span><button class="ti" data-act="bopen" data-id="${it.id}" title="${esc(it.title)}">${esc(it.title)}</button><span class="c">${KIND_L[it.kind]}</span><span class="c">${esc(it.upd)}</span><span class="c c-topics">${it.p?esc(PN(it.p)):'—'}</span><span class="c num">${n||'—'}</span><span class="c">${cap(it.status)}</span><span class="c2">${KIND_L[it.kind]} · ${esc(it.upd)} · ${cap(it.status)}${it.p?' · '+esc(PN(it.p)):''}</span>`;},
  open:it=>{if(it.p&&projPiece(it.p)===it.id&&(DOCS[it.p]||it.kind==='listing')){X.go(DOCS[it.p]?'write':'arrange',it.p);return;}
   if(it.id==='pc_porcc'||it.id==='pc_porcp'){S.arrangeMode.porc=it.id==='pc_porcc'?'car':'post';X.go('arrange','porc');return;}
   X.openDrawer('piece',{id:it.id});}
 }
};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(d){const [y,m,dd]=d.split('-');return `${+dd} ${MON[+m-1]} ${y}`;}

function inFolder(D,st,it){
 if(st.folder==='all')return true;
 if(st.folder==='unsorted')return !it.folders.length;
 const sub=subtree(D.folders,st.folder);return it.folders.some(f=>sub.has(f));
}
function filterRows(key,except){
 const D=DOM[st_dom(key)];const st=BS[key];const q=st.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return D.items().filter(it=>{
  if(st.lock&&!it.folders.some(f=>st.lock.has(f)))return false;
  if(!inFolder(D,st,it))return false;
  for(const fc of D.facets){if(fc.k===except)continue;const want=st.f[fc.k];if(!want)continue;const v=fc.val(it);if(Array.isArray(v)?!v.includes(want):v!==want)return false;}
  if(q.length){const t=D.text(it);for(const w of q)if(!t.includes(w))return false;}
  return true;
 });
}
const st_dom=key=>BS[key].dom||key;
function sortRows(key,rows){
 const st=BS[key];const k=st.sort,d=st.dir;
 const D0=DOM[st_dom(key)];const g=(D0.sortGet&&D0.sortGet[k])||{date:x=>x.date,title:x=>x.title.toLowerCase(),src:x=>x.src,used:x=>x.pieces?x.pieces.length:0,status:x=>x.status,upd:x=>PIECES.indexOf(x),kind:x=>x.kind}[k]||(x=>x.title);
 return rows.sort((a,b)=>{const A1=g(a),B1=g(b);return (A1<B1?-1:A1>B1?1:0)*(k==='upd'?1:d);});
}
function folderCount(key,fid){
 const D=DOM[st_dom(key)];const items=D.items();
 if(fid==='all')return items.length;
 if(fid==='unsorted')return items.filter(it=>!it.folders.length).length;
 const sub=subtree(D.folders,fid);let n=0;for(const it of items)if(it.folders.some(f=>sub.has(f)))n++;return n;
}
function treeHTML(key){
 const D=DOM[st_dom(key)];const st=BS[key];
 const kids=pid=>D.folders.filter(f=>f.parent===pid);
 const node=(f,depth)=>{const ch=kids(f.id);const open=st.open.has(f.id);
  return `<li><div class="tn ${st.folder===f.id?'on':''}" data-drop="${f.id}" data-fdrag="${f.id}" draggable="true" style="padding-left:${depth*14}px">
   ${ch.length?`<button class="tw ${open?'open':''}" data-act="ttog" data-k="${key}" data-f="${f.id}" aria-label="${open?'Collapse':'Expand'} ${esc(f.name)}" aria-expanded="${open}">${ic('chev')}</button>`:'<span class="tw"></span>'}
   <button class="tl" data-act="tpick" data-k="${key}" data-f="${f.id}" title="${f.q?esc(f.name+' — '+f.q):esc(f.name)}">${ic(f.q?'coll':'folder',`sm ${f.q?'coll':''}`)}<span>${esc(f.name)}</span></button><span class="tc">${folderCount(key,f.id)}</span></div>
   ${ch.length&&open?`<ul>${ch.map(c=>node(c,depth+1)).join('')}</ul>`:''}</li>`;};
 const special=(id,label,icn)=>`<div class="tn ${st.folder===id?'on':''}" ${id==='unsorted'?'data-drop="unsorted"':''}><span class="tw"></span><button class="tl" data-act="tpick" data-k="${key}" data-f="${id}">${ic(icn,'sm')}<span>${label}</span></button><span class="tc">${folderCount(key,id)}</span></div>`;
 return `${special('all',D.allLabel||(key==='pce'?'All pieces':'All sources'),D.allIcon||(key==='pce'?'pieces':'library'))}${D.unsorted!==false&&key!=='pce'?special('unsorted','Unsorted','material'):''}<div class="tsep"></div><ul>${kids(null).map(f=>node(f,0)).join('')}</ul>
 <div class="tfoot"><button class="lnk" data-act="newfolder" data-k="${key}">+ New folder${st.folder!=='all'&&st.folder!=='unsorted'?' inside '+esc((D.folders.find(f=>f.id===st.folder)||{}).name||''):''}</button>
 <span class="dim">${D.treeHint||'Drag rows onto a folder to add them. Drag a folder onto another to nest it. An item can sit in several folders.'}</span>
 ${D.stressHTML?D.stressHTML(key):key==='lib'?`<button class="lnk" data-act="stress" style="opacity:.75">${stressed?'Stress test loaded · 5,214 sources':'Stress test: load 5,000 more'}</button>`:''}</div>`;
}
function crumbs(key){
 const D=DOM[st_dom(key)];const st=BS[key];
 const root=`<button class="cr ${st.folder==='all'?'last':''}" data-act="tpick" data-k="${key}" data-f="all">${D.rootLabel||(key==='pce'?'All pieces':'Library')}</button>`;
 let h=`<button class="tbtn" data-act="ttree" data-k="${key}" title="${st.tree?'Hide':'Show'} folders" aria-label="${st.tree?'Hide':'Show'} folders">${ic('panelL','sm')}</button><button class="tbtn mob" data-act="lsheet" data-k="${key}" title="Folders and filters">${ic('filter','sm')}</button>`+root;
 if(st.folder==='unsorted')h+=` › <span class="cr last">Unsorted</span>`;
 else if(st.folder!=='all'){const pth=fpath(D.folders,st.folder);pth.forEach((f,i)=>{h+=` › <button class="cr ${i===pth.length-1?'last':''}" data-act="tpick" data-k="${key}" data-f="${f.id}">${esc(f.name)}</button>`;});
  const f=pth[pth.length-1];if(f&&f.q)h+=`<span class="q" title="${esc(f.q)}">· ${esc(f.q)}</span>`;}
 return `<div class="crumbs">${h}</div>`;
}
function facetSelects(key){
 const D=DOM[st_dom(key)];const st=BS[key];
 return D.facets.map(fc=>{const rows=filterRows(key,fc.k);const cnt={};rows.forEach(it=>{const v=fc.val(it);(Array.isArray(v)?v:[v]).forEach(x=>cnt[x]=(cnt[x]||0)+1);});
  const opts=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);if(st.f[fc.k]&&!cnt[st.f[fc.k]])opts.unshift(st.f[fc.k]);
  return `<select class="fsel" data-facet="${fc.k}" data-k="${key}" aria-label="${fc.label}"><option value="">${fc.label}: any</option>${opts.map(v=>`<option value="${esc(v)}" ${st.f[fc.k]===v?'selected':''}>${esc(fc.fmt(v))} (${cnt[v]||0})</option>`).join('')}</select>`;}).join('')+
  `<select class="fsel" data-sort="1" data-k="${key}" aria-label="Sort">${D.sorts.map(([v,l])=>`<option value="${v}" ${st.sort===v?'selected':''}>Sort: ${l}</option>`).join('')}</select>`;
}
function browserHTML(key,opts){
 opts=opts||{};const D=DOM[st_dom(key)];const st=BS[key];
 const rows=sortRows(key,filterRows(key));st.rows=rows;
 const total=D.items().length;const nsel=st.sel.size;
 const allSel=rows.length&&rows.every(r=>st.sel.has(r.id));const someSel=!allSel&&rows.some(r=>st.sel.has(r.id));
 const fl=Object.keys(st.f).filter(k=>st.f[k]).length+(st.q?1:0);
 const line=nsel?`<div class="cline bulk" role="toolbar" aria-label="Selection"><span><b>${nsel.toLocaleString()}</b> selected</span>
   ${D.bulkHTML?D.bulkHTML(key):key==='pce'?`<button class="btn" data-act="bulk" data-op="folder" data-k="${key}">Add to folder</button><button class="btn" data-act="bulk" data-op="status" data-k="${key}">Set status</button>`:
   `<button class="btn" data-act="bulk" data-op="folder" data-k="${key}">Add to collection or folder</button><button class="btn" data-act="bulk" data-op="piece" data-k="${key}">Add to piece</button><button class="btn" data-act="bulk" data-op="topic" data-k="${key}">Tag topic</button><button class="btn" data-act="bulkread" data-k="${key}">Mark read</button>`}
   ${opts.pickerFoot||''}<button class="btn quiet" data-act="bclear" data-k="${key}">Clear</button></div>`:
  `<div class="cline"><span><b>${rows.length.toLocaleString()}</b> shown of <b>${total.toLocaleString()}</b> ${D.noun}${fl?` · ${fl} filter${fl>1?'s':''} <button class="lnk" data-act="bfclear" data-k="${key}">clear</button>`:''}</span>${opts.lineRight||''}</div>`;
 const sh=(c,i)=>{const sk=D.colSort?D.colSort[i]:key==='pce'?['title','kind','upd',null,null,'status'][i]:['title','src','date',null,'used','status'][i];return `<button class="h-${c.toLowerCase().replace(/\s/g,'')} ${st.sort===sk?'on':''}" ${sk?`data-act="bsort" data-k="${key}" data-s="${sk}"`:''}>${c}${st.sort===sk?(st.dir<0&&sk!=='upd'?' ↓':' ↑'):''}</button>`;};
 const grid=st.mode==='grid'&&D.tile;
 return `<div class="lb k-${st_dom(key)} ${grid?'mode-grid':''} ${st.tree?'':'notree'}" data-bkey="${key}">
  <aside class="tree" aria-label="Folders">${treeHTML(key)}</aside>
  <section class="lbm">
   ${crumbs(key)}
   <div class="fstrip"><label class="fsearch">${ic('search','sm')}<input id="bq-${key}" data-bq="${key}" value="${esc(st.q)}" placeholder="${D.searchPh||'Search '+D.noun+' — title, source, topic'}" aria-label="Search ${D.noun}"></label>${facetSelects(key)}</div>
   <nav class="views" aria-label="Saved views"><span class="vl">Saved views</span>${D.views.map(v=>`<button class="${st.view===v.id?'on':''}" data-act="bview" data-k="${key}" data-v="${v.id}">${esc(v.label)}${v.id==='unsorted'?` · ${folderCount(key,'unsorted')}`:''}</button>`).join('')}</nav>
   ${line}
   <div class="vhead" role="row"><span class="cbw"><button class="cb ${allSel?'on':someSel?'part':''}" data-act="bselall" data-k="${key}" role="checkbox" aria-checked="${allSel?'true':someSel?'mixed':'false'}" aria-label="Select all ${rows.length} matching"></button></span>${grid?`<span class="gsel">Select all ${rows.length.toLocaleString()} matching</span><span class="gsort">${D.cols.map(sh).join('')}</span>`:'<span></span>'+D.cols.map(sh).join('')}</div>
   <div class="vt" id="vt-${key}" role="grid" aria-rowcount="${rows.length}"><div class="vt-sp"></div>${rows.length?'':`<div class="vempty">Nothing matches here. ${fl?'<button class="lnk" data-act="bfclear" data-k="'+key+'">Clear the filters</button>':''}</div>`}</div>
  </section></div>`;
}
const rowH=()=>X.isPhone()?56:36;
/* grid mode: the same rows as tiles, virtualised by tile-row */
function gridGeom(vt){const W=vt.clientWidth-16;const ph=X.isPhone();const min=ph?104:132;const gap=ph?8:10;const cols=Math.max(2,Math.floor((W+gap)/(min+gap)));const tw=Math.floor((W-gap*(cols-1))/cols);return {cols,tw,th:tw+(ph?40:44),gap};}
function paintGrid(key,st,D,vt,sp){
 const g=gridGeom(vt);const n=st.rows.length;const nr=Math.ceil(n/g.cols);const rh=g.th+g.gap;sp.style.height=nr*rh+8+'px';
 const h=vt.clientHeight||600;const a=Math.max(0,Math.floor(vt.scrollTop/rh)-2),b=Math.min(nr,Math.ceil((vt.scrollTop+h)/rh)+2);
 let out='';for(let r=a;r<b;r++)for(let c=0;c<g.cols;c++){const i=r*g.cols+c;if(i>=n)break;const it=st.rows[i];const on=st.sel.has(it.id);
  out+=`<div class="vtile ${on?'sel':''} ${st.cur===it.id?'cur':''}" role="row" aria-rowindex="${i+1}" style="top:${r*rh+8}px;left:${8+c*(g.tw+g.gap)}px;width:${g.tw}px;height:${g.th}px" data-id="${it.id}" data-k="${key}" draggable="true"><span class="cbw"><button class="cb ${on?'on':''}" data-act="bsel" data-k="${key}" data-id="${it.id}" role="checkbox" aria-checked="${on}" aria-label="Select ${esc(it.title)}"></button></span>${D.tile(it,g.tw)}</div>`;}
 sp.innerHTML=out;st.top=vt.scrollTop;
}
function paint(key){
 const st=BS[key];const vt=document.getElementById('vt-'+key);if(!vt||!st||!st.rows)return;
 const D=DOM[st_dom(key)];const sp=vt.firstElementChild;
 if(st.mode==='grid'&&D.tile){paintGrid(key,st,D,vt,sp);return;}
 const rh=rowH();const n=st.rows.length;
 sp.style.height=n*rh+'px';
 const h=vt.clientHeight||600;const a=Math.max(0,Math.floor(vt.scrollTop/rh)-6),b=Math.min(n,Math.ceil((vt.scrollTop+h)/rh)+6);
 let out='';for(let i=a;i<b;i++){const it=st.rows[i];const on=st.sel.has(it.id);
  out+=`<div class="vrow ${on?'sel':''} ${st.cur===it.id?'cur':''}" role="row" aria-rowindex="${i+1}" style="top:${i*rh}px" data-id="${it.id}" data-k="${key}" draggable="true"><span class="cbw"><button class="cb ${on?'on':''}" data-act="bsel" data-k="${key}" data-id="${it.id}" role="checkbox" aria-checked="${on}" aria-label="Select ${esc(it.title)}"></button></span>${D.row(it)}</div>`;}
 sp.innerHTML=out;st.top=vt.scrollTop;
}
function mount(key,keepTop){
 const vt=document.getElementById('vt-'+key);if(!vt)return;const st=BS[key];
 vt.scrollTop=keepTop?st.top:0;paint(key);
 let raf=0;vt.addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;paint(key);});},{passive:true});
}
function rerenderBrowser(key,keepTop){
 const host=document.querySelector(`.lb[data-bkey="${key}"]`);if(!host){X.render(true);return;}
 const opts=BOPTS[key]?BOPTS[key]():key==='pick'?pickerOpts():{lineRight:key==='lib'?libLineRight():''};
 const tmp=document.createElement('div');tmp.innerHTML=browserHTML(key,opts);host.replaceWith(tmp.firstElementChild);mount(key,keepTop);
 const sh=$('#lsheet');if(sh&&sh.classList.contains('on')&&sh.dataset.k===key)fillSheet(key);
}
const libLineRight=()=>'';

/* ---------- views: Library, Collections, Pieces ---------- */
TOOLS.unshift({id:'collections',label:'Collections',g:'Gather'});
TOOLS.unshift({id:'library',label:'Library',g:'Gather'});
const mi=TOOLS.findIndex(t=>t.id==='write');TOOLS.splice(mi,0,{id:'pieces',label:'Pieces',g:'Make'});
HAS.library=()=>true;HAS.collections=()=>true;HAS.pieces=()=>true;
CROSS.library=1;CROSS.collections=1;CROSS.pieces=1;
HAS.arrange=p=>!!CAR[p]||!!DOCS[p]||p==='oolong';

V.library=()=>{
 bstate('lib');const st=BS.lib;
 queueMicrotask(()=>mount('lib',true));
 return `<div class="wrap full">${X.head('library','all',`<span class="tag" title="Invented sources — no real library was read">Sample library</span><button class="btn" data-act="go" data-tool="collections">${ic('collections','sm')} Collections</button><button class="btn" data-act="go" data-tool="material">${ic('material','sm')} Material inbox</button>`)}
 ${browserHTML('lib',{lineRight:''})}</div>`;
};
V.pieces=()=>{
 bstate('pce',{sort:'upd'});
 queueMicrotask(()=>mount('pce',true));
 return `<div class="wrap full">${X.head('pieces','all',`<span class="dim small">Every article, carousel, post, listing and script — click one to open it</span>`)}${browserHTML('pce')}</div>`;
};

/* Collections: folders with a question. One line each (name · count), the question on line two. */
let SUG=null;
V.collections=()=>{
 bstate('lib');
 const colls=F.filter(f=>f.q);const un=folderCount('lib','unsorted');
 const row=f=>{const pth=fpath(F,f.id).slice(0,-1).map(x=>x.name).join(' › ');return `<li><button class="corow" data-act="opencoll" data-f="${f.id}" data-drop="${f.id}">${ic('coll','sm')}<span class="nm"><b>${esc(f.name)}</b> <span class="dim small">${esc(pth)}</span></span><span class="n">${folderCount('lib',f.id)} sources</span><span class="q">${esc(f.q)}</span></button></li>`;};
 return `<div class="wrap">${X.head('collections','all',`<button class="btn primary" data-act="suggest">Suggest sorting</button><button class="btn" data-act="newcoll">New collection</button>`)}
 <p class="dim small" style="margin:-8px 0 14px;max-width:var(--measure)">A collection is a folder that carries a question. It lives in the same folder tree as the Library, so sources can sit in several collections at once.</p>
 <ul class="colist">
  <li><button class="corow" data-act="opencoll" data-f="unsorted" data-drop="unsorted">${ic('material','sm')}<span class="nm"><b>Unsorted</b></span><span class="n warm">${un} sources</span><span class="q">In the Library but in no folder or collection yet</span></button></li>
  ${colls.map(row).join('')}
 </ul>
 ${SUG?suggHTML():''}
 </div>`;
};
function makeSuggestions(){
 /* local word matching only: an unsorted source is proposed for a collection when its topics or
    title share words with the collection's topics. Clearly a sample, not AI sorting. */
 const colls=F.filter(f=>f.q);const groups={};
 LIB.filter(it=>!it.folders.length).forEach(it=>{
  let best=null,score=0;
  colls.forEach(c=>{const ws=c.topics;let s=0;ws.forEach(w=>{if(it.topics.includes(w))s+=2;else if(it.title.toLowerCase().includes(w))s+=1;});if(s>score){score=s;best=c;}});
  if(best&&score>=1){(groups[best.id]=groups[best.id]||[]).push({id:it.id,score,st:null});}
 });
 Object.values(groups).forEach(g=>g.sort((a,b)=>b.score-a.score));
 return groups;
}
function suggHTML(){
 const ids=Object.keys(SUG);const total=ids.reduce((a,k)=>a+SUG[k].length,0);
 const lvl=s=>s>=4?'strong':s>=2?'fair':'weak';
 return `<section class="sugg" id="sugg" aria-label="Suggested sorting">
  <div class="sh"><b>${total} proposed assignments in ${ids.length} collections</b><span class="tag">Sample suggestions — sorting isn’t connected yet</span><button class="btn quiet" data-act="closesugg">Close</button></div>
  <p class="dim small" style="padding:8px 12px;margin:0;border-bottom:1px solid var(--line)">Made in this page by matching topic words — not by Claude. Accepting moves the source into the collection here only. Prototype — nothing is saved.</p>
  ${ids.map(k=>{const f=FD(k);const g=SUG[k];const open=g.filter(x=>!x.st).length;return `<div class="sgrp"><div class="gh">${ic('coll','sm')}<span class="t">${esc(f.name)} <span class="dim small">· ${g.length} proposed · ${open} undecided</span></span>
   <button class="btn" data-act="sgall" data-g="${k}" data-v="acc" ${open?'':'disabled'}>Accept ${open}</button><button class="btn quiet" data-act="sgall" data-g="${k}" data-v="rej" ${open?'':'disabled'}>Reject all</button></div>
   ${g.slice(0,40).map(x=>{const it=LIB.find(i=>i.id===x.id);return `<div class="srow ${x.st||''}">${ic(it.type==='youtube'?'youtube':it.type,'sm')}<button class="ti" data-act="bopen" data-k="lib" data-id="${it.id}" style="text-align:left">${esc(it.title)} <span class="dim small">· ${esc(it.src)}</span></button><span class="why" title="How many topic words matched">${lvl(x.score)} match</span><span class="ab">${x.st?`<span class="dim small">${x.st==='acc'?'Accepted':'Rejected'}</span>`:`<button data-act="sgone" data-g="${k}" data-id="${it.id}" data-v="acc">Accept</button><button data-act="sgone" data-g="${k}" data-id="${it.id}" data-v="rej">Reject</button>`}</span></div>`;}).join('')}
   ${g.length>40?`<div class="srow"><span></span><span class="dim small">and ${g.length-40} more — “Accept ${open}” covers them all</span></div>`:''}</div>`;}).join('')}
 </section>`;
}
function applySug(g,id,v){const x=SUG[g].find(y=>y.id===id);if(!x||x.st)return;x.st=v;if(v==='acc'){const it=LIB.find(i=>i.id===id);if(!it.folders.includes(g))it.folders.push(g);libVer++;}}

/* ---------- preview drawer: one item ---------- */
X.DR_TITLE.preview='Preview';X.NOTABS.preview=1;X.DR_SUB.preview=()=>{const it=LIB.find(i=>i.id===S.drawer.id);return it?TYPE_L[it.type]:'';};
X.DR_TITLE.piece='Piece';X.NOTABS.piece=1;X.DR_SUB.piece=()=>'Pieces';
function excerpt(it){const r=rng(parseInt(it.id.slice(1),10));const s=it.topics[0];
 const lines=[`The first thing to say about ${s} is that most descriptions of it are borrowed.`,`Everyone who works with ${s} for long enough ends up with one rule they cannot fully explain.`,`What changes ${s} is rarely the dramatic step; it is the waiting either side of it.`,`Ask three people about ${s} and you will get four answers and one long silence.`];
 return pick(r,lines)+' '+pick(r,lines);}
DR.preview=()=>{
 const it=LIB.find(i=>i.id===S.drawer.id);if(!it)return '<p class="dim">This source is no longer here.</p>';
 const r=rng(parseInt(it.id.slice(1),10)+3);
 let body='';
 if(it.type==='youtube'){const [m,s]=it.len.split(':').map(Number);const tot=m*60+s;const ch=['Intro','Setting up','The main part','What went wrong','Tasting','Last thoughts'].slice(0,3+Math.floor(r()*3));
  body=`<div class="pvthumb" style="background:${it.tone}"><span class="tag">Sample thumbnail</span>${ic('play')}<span class="dur">${it.len}</span></div>
  <h4 class="lab" style="margin:8px 0 4px">Chapters <span class="tag">Sample</span></h4><ul class="ol">${ch.map((c,i)=>{const t=Math.floor(tot*i/ch.length);return `<li><span class="chap">${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}</span><span class="grow">${c}</span></li>`;}).join('')}</ul>`;}
 else if(it.type==='recording'){body=`<h4 class="lab" style="margin:0 0 6px">Transcript snippet <span class="tag">Sample</span></h4><p class="quote" style="margin:0 0 6px">“${esc(excerpt(it))}”</p><p class="dim small">Transcript only — playback isn’t connected.</p>`;}
 else if(it.type==='photos'){body=`<div class="pvthumb" style="background:${it.tone}"><span class="tag">Sample</span>${ic('photos')}<span class="dur">${it.len}</span></div>`;}
 else body=`<h4 class="lab" style="margin:0 0 6px">${it.type==='note'?'Note':'Excerpt'} <span class="tag">Sample</span></h4><p style="margin:0">${esc(excerpt(it))}</p>`;
 const fl=it.folders.map(f=>{const pth=fpath(F,f).map(x=>x.name).join(' › ');return `<li>${ic(FD(f).q?'coll':'folder','sm')}<span class="grow" title="${esc(pth)}">${esc(pth)}</span><button class="x" data-act="unfile" data-id="${it.id}" data-f="${f}" aria-label="Remove from ${esc(FD(f).name)}">${ic('close','sm')}</button></li>`;}).join('');
 const pl=it.pieces.map(pid=>{const pc=PCE(pid);return `<li>${ic(KIND_IC[pc.kind],'sm')}<span class="grow">${esc(pc.title)}</span><button class="lnk" data-act="bopen" data-k="pce" data-id="${pid}">Open</button></li>`;}).join('');
 return `<div class="pvh">${ic(it.type==='youtube'?'youtube':it.type)}<h3 style="flex:1;min-width:0">${esc(it.title)}</h3></div>
 <dl class="kv"><dt>Source</dt><dd>${esc(it.src)}</dd><dt>Date</dt><dd>${fmtDate(it.date)}</dd><dt>Length</dt><dd>${esc(it.len)}</dd><dt>Topics</dt><dd>${esc(it.topics.join(', '))}</dd><dt>Status</dt><dd>${it.status}</dd><dt>Id</dt><dd>${it.id}</dd></dl>
 ${body}
 <div class="pvacts"><button class="btn primary" data-act="pvpiece" data-id="${it.id}">Use in piece…</button><button class="btn" data-act="pvfolder" data-id="${it.id}">Add to collection…</button>${it.status==='new'?`<button class="btn quiet" data-act="pvread" data-id="${it.id}">Mark ${it.type==='youtube'?'watched':'read'}</button>`:''}</div>
 <h4 class="lab" style="margin:14px 0 4px">In ${it.folders.length} folder${it.folders.length===1?'':'s'}</h4>${fl?`<ul class="ol">${fl}</ul>`:'<p class="dim small">Unsorted — in no folder yet.</p>'}
 <h4 class="lab" style="margin:14px 0 4px">Used in ${it.pieces.length} piece${it.pieces.length===1?'':'s'}</h4>${pl?`<ul class="ol">${pl}</ul>`:'<p class="dim small">Not used yet.</p>'}
 <p class="foot-note">Sample source. Opening the original isn’t connected. Prototype — nothing is saved.</p>`;
};
DR.piece=()=>{const pc=PCE(S.drawer.id);if(!pc)return '';const n=LIB.filter(x=>x.pieces.includes(pc.id));
 return `<div class="pvh">${ic(KIND_IC[pc.kind])}<h3 style="flex:1">${esc(pc.title)}</h3></div><dl class="kv"><dt>Kind</dt><dd>${KIND_L[pc.kind]}</dd><dt>Status</dt><dd>${cap(pc.status)}</dd><dt>Updated</dt><dd>${esc(pc.upd)}</dd><dt>Project</dt><dd>${pc.p?esc(PN(pc.p)):'None'}</dd><dt>Sources</dt><dd>${n.length}</dd></dl>
 <div class="status"><h3>Not editable in this prototype</h3><p>Only the pieces of the seven sample projects open in Write or Arrange here. This one is a title in the list, to show the list at size.</p></div>`;};

/* ---------- Write: Sources tab in the drawer + citation chips ---------- */
X.DR_TABS.push(['sources','Sources']);X.DR_TITLE.sources='Sources';
DR.sources=p=>{
 const pid=projPiece(p);const coll=PROJ_COLL[p];const cited=LIB.filter(x=>x.pieces.includes(pid));
 const inColl=coll?LIB.filter(x=>x.folders.some(f=>subtree(F,coll).has(f))&&!x.pieces.includes(pid)):[];
 const li=(it,c)=>`<li draggable="true" data-cite="${it.id}" title="Drag into the text to cite">${ic(it.type==='youtube'?'youtube':it.type,'sm')}<span class="grow">${esc(it.title)} <span class="dim">· ${esc(it.src)}</span></span>${c?'':`<button class="x" data-act="bopen" data-k="lib" data-id="${it.id}" aria-label="Preview">${ic('chev','sm')}</button>`}</li>`;
 return `${coll?`<div class="lab" style="margin-bottom:4px">Linked collection</div><ul class="ol" style="margin-bottom:12px"><li>${ic(FD(coll).q?'coll':'folder','sm')}<span class="grow">${esc(FD(coll).name)} <span class="dim">· ${folderCount('lib',coll)} sources</span></span><button class="lnk" data-act="opencoll" data-f="${coll}">Library</button></li></ul>`:'<p class="dim small">No collection linked to this piece.</p>'}
  <div class="pvacts" style="margin-top:0"><button class="btn primary" data-act="addsources">Add sources</button></div>
  <div class="lab" style="margin:8px 0 4px">Cited in this piece · ${cited.length}</div>
  ${cited.length?`<ul class="ol">${cited.map(it=>li(it,1)).join('')}</ul>`:'<p class="dim small">Nothing cited yet.</p>'}
  <div class="lab" style="margin:14px 0 4px">In the collection, not cited · ${inColl.length}</div>
  ${inColl.length?`<ul class="ol">${inColl.slice(0,60).map(it=>li(it,0)).join('')}</ul>${inColl.length>60?`<p class="dim small">and ${inColl.length-60} more — use Add sources to search them.</p>`:''}`:'<p class="dim small">None.</p>'}
  <p class="foot-note">Drag a source into the text to insert a citation. Prototype — nothing is saved.</p>`;
};
const oldWrite=V.write;
const chip=id=>{const it=LIB.find(x=>x.id===id);return `<span class="cite" contenteditable="false" data-cid="${id}" data-act="bopen" data-k="lib" data-id="${id}" title="${it?esc(it.title):id}">${it?esc(it.src)+', '+it.date.slice(0,4):id}</span>`;};
V.write=()=>{let h=oldWrite();
 h=h.replace(/⟦(L\d+)⟧/g,(m,id)=>chip(id));
 h=h.replace('<button class="btn quiet" data-act="go" data-tool="read">',`<button class="btn" data-act="drawer" data-k="sources" title="Pull out this piece’s sources">${ic('library','sm')} Sources</button><button class="btn quiet" data-act="go" data-tool="read">`);
 return h;};
const oldRead=V.read;V.read=()=>oldRead().replace(/⟦(L\d+)⟧/g,(m,id)=>{const it=LIB.find(x=>x.id===id);return it?`<span class="cite">${esc(it.src)}, ${it.date.slice(0,4)}</span>`:'';});
function syncPara(el){
 const p=X.resolveProj('write');const x=DOCS[p]&&DOCS[p].paras.find(q=>q.id===el.dataset.pid);if(!x)return;
 const c=el.cloneNode(true);c.querySelectorAll('.cite').forEach(s=>s.replaceWith(document.createTextNode('⟦'+s.dataset.cid+'⟧')));
 c.querySelectorAll('mark').forEach(m=>m.replaceWith(document.createTextNode(m.textContent)));
 x.text=c.textContent.replace(/\n+$/,'');
}
document.addEventListener('input',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.pid&&t.querySelector&&t.querySelector('.cite'))syncPara(t);});

/* ---------- picker: the same table, filtered to the piece's collections ---------- */
function pickerOpts(){return {pickerFoot:`<button class="btn primary" data-act="pickadd">Add ${BS.pick.sel.size} to this piece</button>`,lineRight:''};}
function openPicker(){
 const p=X.resolveProj('write');const coll=PROJ_COLL[p];
 BS.pick=null;bstate('pick',{dom:'lib',folder:coll||'all',tree:!X.isPhone()});
 let pk=$('#picker');
 if(!pk){pk=document.createElement('div');pk.id='picker';pk.setAttribute('role','dialog');pk.setAttribute('aria-label','Add sources');document.body.appendChild(pk);const sc=document.createElement('div');sc.className='scrim k';sc.dataset.act='closepicker';document.body.appendChild(sc);}
 pk.innerHTML=`<div class="pkh"><h2>Add sources to ${esc(DOCS[p]?DOCS[p].title:PN(p))}</h2><span class="dim small">Starts in ${coll?esc(FD(coll).name):'the whole Library'} — pick another folder to look wider</span><button class="tbtn" data-act="closepicker" aria-label="Close">${ic('close','sm')}</button></div>${browserHTML('pick',pickerOpts())}`;
 pk.classList.add('on');$('.scrim.k').classList.add('on');mount('pick');
}
function closePicker(){const pk=$('#picker');if(pk)pk.classList.remove('on');const s=$('.scrim.k');if(s)s.classList.remove('on');}

/* ---------- research: points + console ---------- */
RES.porc.forEach(r=>{if(r.level==='likely')r.level='unsure';});
Object.values(RES).forEach(a=>a.forEach(r=>{if(r.level==='likely')r.level='unsure';}));
const LVL=[['settled','Sure'],['unsure','Unsure'],['disputed','Disputed']];
const LOG={};const HIST=[];let hi=-1;
function clog(p){return LOG[p]||(LOG[p]=[{c:'out',t:'Type /help for commands. /search runs over the Library in this page. Claude isn’t connected here yet.'}]);}
V.research=()=>{
 const p=X.resolveProj('research');const pts=RES[p]||[];const coll=PROJ_COLL[p];
 const sel=pts.find(x=>x.id===S.research[p])||null;
 queueMicrotask(()=>{const l=$('#clog');if(l)l.scrollTop=l.scrollHeight;});
 const det=x=>`<div class="rpd"><div class="seg" role="group" aria-label="How sure">${LVL.map(([l,n])=>`<button class="${x.level===l?'on':''}" data-act="level" data-id="${x.id}" data-l="${l}">${n}</button>`).join('')}</div>
  <ul class="ev">${x.evidence.map(e=>`<li><q class="quote">${esc(e.q)}</q><div class="src"><span>${esc(e.src)}</span><span class="${e.agent?'warm':''}">${esc(e.by)}${e.agent?' <span class="tag">Sample</span>':''}</span></div></li>`).join('')}</ul>
  <div class="acts"><button class="btn primary" data-act="discussin" data-n="${pts.indexOf(x)+1}">${ic('terminal','sm')} Discuss in console</button></div></div>`;
 return `<div class="wrap full">${X.head('research',p,`${coll?`<button class="btn" data-act="opencoll" data-f="${coll}">${ic('coll','sm')} ${esc(FD(coll).name)} · ${folderCount('lib',coll)} sources</button>`:''}`)}
 <div class="rsplit">
  <div class="rpts"><div class="rh"><span style="flex:1">${pts.length} point${pts.length===1?'':'s'}${coll?' · '+esc(FD(coll).q):''}</span></div>
   ${pts.length?pts.map((x,i)=>`<button class="rp ${sel&&sel.id===x.id?'on':''}" data-act="rpoint" data-id="${x.id}" aria-expanded="${!!(sel&&sel.id===x.id)}"><span class="n">${i+1}</span><span class="lv ${x.level}" title="${LVL.find(l=>l[0]===x.level)[1]}"></span><span class="cl">${esc(x.claim)} <span class="dim small">· ${LVL.find(l=>l[0]===x.level)[1]} · ${x.evidence.length} evidence</span></span></button>${sel&&sel.id===x.id?det(x):''}`).join(''):'<p class="dim" style="padding:12px">No points yet. Mark a claim in Source or Write, or use /cite in the console.</p>'}
  </div>
  <div class="cons" aria-label="Research console">
   <div class="ch">${ic('terminal','sm')}<b>Research console</b><span>· ${esc(PN(p))}</span><span class="tag">Claude not connected · local search works</span></div>
   <div class="hints">${['/search kiln','/collection','/point 1','/cite L0001','/compare L0001 L0002','/help'].map(h=>`<button data-act="chint" data-h="${h}">${h}</button>`).join('')}</div>
   <div class="clog" id="clog" role="log" aria-live="polite">${clog(p).map(lineHTML).join('')}</div>
   <div class="cin"><label for="cinput">research ›</label><input id="cinput" autocomplete="off" spellcheck="false" placeholder="/search words, /point 2, or ask a question"></div>
  </div>
 </div></div>`;
};
function lineHTML(l){
 if(l.c==='res'){const it=LIB.find(x=>x.id===l.id);if(!it)return '';return `<div class="res"><button class="id" data-act="bopen" data-k="lib" data-id="${it.id}" title="Preview">${it.id}</button><span class="tx">${esc(it.title)}</span><span class="m">${esc(it.src)} · ${it.date.slice(0,4)}</span><button class="ci" data-act="ccite" data-id="${it.id}" title="Cite in the open point">/cite</button></div>`;}
 if(l.c==='btn')return `<div class="out"><button class="lnk" data-act="${l.act}" data-q="${esc(l.q||'')}">${esc(l.t)}</button></div>`;
 return `<div class="${l.c}">${esc(l.t)}</div>`;
}
function search(q){const ws=q.toLowerCase().split(/\s+/).filter(Boolean);if(!ws.length)return [];
 const r=[];for(const it of LIB){const t=DOM.lib.text(it);if(ws.every(w=>t.includes(w))){let s=0;ws.forEach(w=>{if(it.title.toLowerCase().includes(w))s+=2;});r.push([s,it]);}}
 return r.sort((a,b)=>b[0]-a[0]||(a[1].date<b[1].date?1:-1)).map(x=>x[1]);}
function printResults(L,res,q){
 res.slice(0,12).forEach(it=>L.push({c:'res',id:it.id}));
 if(res.length>12)L.push({c:'btn',act:'libsearch',q,t:`and ${res.length-12} more — open all ${res.length} in the Library`});
}
function runCmd(raw){
 const p=X.resolveProj('research');const L=clog(p);const pts=RES[p]||[];const v=raw.trim();if(!v)return;
 HIST.push(v);hi=HIST.length;L.push({c:'in',t:v});
 const [cmd,...rest]=v.split(/\s+/);const arg=rest.join(' ');
 const cur=()=>pts.find(x=>x.id===S.research[p]);
 if(cmd==='/help'){L.push({c:'out',t:'/search <words>   search the Library in this page\n/collection       this project’s collection: question, size, types\n/point <n>        open point n and show its evidence\n/cite <id>        add a source to the open point as evidence\n/compare <id> <id> show what the Library knows about two sources\n/clear            clear this log\nAnything else is kept as a question in this collection’s research log.'});}
 else if(cmd==='/clear'){L.length=0;}
 else if(cmd==='/search'){if(!arg)L.push({c:'out',t:'Usage: /search <words>'});else{const res=search(arg);L.push({c:'ok',t:`Local search over ${LIB.length.toLocaleString()} sources: ${res.length} match “${arg}”.`});printResults(L,res,arg);}}
 else if(cmd==='/collection'){const c=PROJ_COLL[p];if(!c)L.push({c:'out',t:'No collection is linked to this project.'});else{const f=FD(c);const its=LIB.filter(x=>x.folders.some(g=>subtree(F,c).has(g)));const by={};its.forEach(x=>by[x.type]=(by[x.type]||0)+1);const tp={};its.forEach(x=>x.topics.forEach(t=>tp[t]=(tp[t]||0)+1));
  L.push({c:'out',t:`${f.name}  (${fpath(F,c).map(x=>x.name).join(' › ')})\nQuestion: ${f.q||'—'}\n${its.length} sources: ${Object.entries(by).map(([k,n])=>n+' '+TYPE_L[k]).join(', ')}\nTop topics: ${Object.entries(tp).sort((a,b)=>b[1]-a[1]).slice(0,5).map(x=>x[0]+' ('+x[1]+')').join(', ')}\nUsed in this piece: ${its.filter(x=>x.pieces.includes(projPiece(p))).length}`});}}
 else if(cmd==='/point'){const n=parseInt(arg,10);const x=pts[n-1];if(!x)L.push({c:'out',t:pts.length?`There are ${pts.length} points. Try /point 1.`:'This project has no research points yet.'});else{S.research[p]=x.id;L.push({c:'out',t:`Point ${n} · ${LVL.find(l=>l[0]===x.level)[1]}\n${x.claim}\n`+x.evidence.map((e,i)=>`  ${i+1}. “${e.q}” — ${e.src} (${e.by})`).join('\n')});L.push({c:'hon',t:'Discussing this point with Claude isn’t connected yet — anything you type next is kept with it.'});}}
 else if(cmd==='/cite'){const it=LIB.find(x=>x.id===arg.toUpperCase());const x=cur();if(!it)L.push({c:'out',t:`No source with id “${arg}”. Ids look like L0042 — /search shows them.`});else if(!x)L.push({c:'out',t:'Open a point first with /point <n>, then /cite.'});else{x.evidence.push({q:it.title,src:`Library ${it.id} · ${it.src}`,by:'You cited · just now'});L.push({c:'ok',t:`Cited ${it.id} as evidence for point ${pts.indexOf(x)+1}. Prototype — nothing is saved.`});}}
 else if(cmd==='/compare'){const ids=rest.map(s=>s.toUpperCase());const a=LIB.find(x=>x.id===ids[0]),b=LIB.find(x=>x.id===ids[1]);if(!a||!b)L.push({c:'out',t:'Usage: /compare L0001 L0002'});else{const sh=a.topics.filter(t=>b.topics.includes(t));L.push({c:'out',t:`${a.id}  ${a.title}\n      ${TYPE_L[a.type]} · ${a.src} · ${a.date} · ${a.topics.join(', ')}\n${b.id}  ${b.title}\n      ${TYPE_L[b.type]} · ${b.src} · ${b.date} · ${b.topics.join(', ')}\nShared topics: ${sh.join(', ')||'none'} · shared folders: ${a.folders.filter(f=>b.folders.includes(f)).map(f=>FD(f).name).join(', ')||'none'}`});L.push({c:'hon',t:'Comparing what the two sources actually say needs Claude, which isn’t connected here yet.'});}}
 else if(cmd.startsWith('/')){L.push({c:'out',t:`Unknown command ${cmd}. Type /help.`});}
 else{const x=cur();if(x)x.thread.push({who:'you',text:v,when:'just now'});
  const words=v.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,' ').split(/\s+/).filter(w=>w.length>3&&!['what','which','where','when','does','have','that','this','with','from','about','there','their','would','should','could'].includes(w));
  let res=[];for(const w of words){const r=search(w);r.forEach(it=>{if(!res.includes(it))res.push(it);});if(res.length>60)break;}
  L.push({c:'hon',t:`Claude isn’t connected here yet — your question is saved to this collection’s research log${x?` and to point ${pts.indexOf(x)+1}`:''}. Local search found ${res.length} item${res.length===1?'':'s'}:`});
  printResults(L,res,words.join(' '));}
 X.render(true);setTimeout(()=>{const i=$('#cinput');if(i)i.focus();const l=$('#clog');if(l)l.scrollTop=l.scrollHeight;},0);
}

/* ---------- templates (Adrian's ig-layouts.json) ---------- */
let TPL=null,TPLERR=null;const TPN={};
fetch('./ig-layouts.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}).then(j=>{TPL=Object.entries(j).map(([id,v])=>Object.assign({id},v));TPL.forEach(t=>TPN[t.name]=t);if(S.view==='arrange')X.render(true);}).catch(e=>{TPLERR=String(e.message||e);if(S.view==='arrange')X.render(true);});
const b64=s=>btoa(unescape(encodeURIComponent(s)));
const photoCache={};
function photo(tone,seed){const k=tone+seed;if(photoCache[k])return photoCache[k];const r=rng(seed*97+7);
 const c2='#'+[1,3,5].map(i=>Math.max(0,parseInt(tone.substr(i,2),16)-30).toString(16).padStart(2,'0')).join('');
 const blobs=Array.from({length:4},()=>`<ellipse cx="${200+r()*700}" cy="${300+r()*800}" rx="${80+r()*260}" ry="${60+r()*200}" fill="#fff" opacity="${(.04+r()*.08).toFixed(2)}"/>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tone}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/>${blobs}<rect x="${300+r()*200}" y="${700+r()*200}" width="${200+r()*200}" height="${160+r()*120}" rx="30" fill="#000" opacity=".18"/><text x="40" y="1310" font-family="sans-serif" font-size="34" fill="#fff" opacity=".45">Sample photo</text></svg>`;
 return photoCache[k]='data:image/svg+xml;base64,'+b64(svg);}
const LOGO='data:image/svg+xml;base64,'+b64('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="88" viewBox="0 0 220 88"><text x="110" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="56" fill="#e9dfcc">teajiā</text></svg>');
function tplHTML(t,sl,proj){
 const tones=(sl.tones&&sl.tones.length?sl.tones:['#5a4532','#55564f','#5b3b2b','#4f4b44']);
 const parts=[sl.text||'',sl.sub||'',sl.p2||'Porcelain',sl.p3||'Tea'];
 let h=t.html.replace(/__IG_TEXT_(\d)__/g,(m,n)=>esc(parts[+n]||''))
  .replace(/__IG_LABEL__/g,esc(sl.label||'PORCELAIN AND TEA'))
  .replace(/__IG_CREDIT__/g,'@teajia')
  .replace(/__IG_LOGO__/g,LOGO)
  .replace(/__IG_STYLE_(\d)__/g,(m,n)=>(t.photoStyles&&t.photoStyles[+n]?t.photoStyles[+n].style:'width:100%;height:100%;object-fit:cover;display:block'))
  .replace(/__IG_PHOTO_(\d)__/g,(m,n)=>(HOOK.slot&&HOOK.slot(sl,+n))||photo(tones[+n%tones.length],+n+1+(sl.seed||0)))
  .replace(/__IG_BG_(\d)__/g,(m,n)=>`url(${(HOOK.slot&&HOOK.slot(sl,+n))||photo(tones[+n%tones.length],+n+11+(sl.seed||0))})`);
 return h;
}
function render1080(t,sl,w,attrs){const sc=w/1080;return `<div class="tplr" style="width:${w}px;height:${Math.round(w*1.25)}px" ${attrs||''}><div class="tpli" style="transform:scale(${sc})">${tplHTML(t,sl)}</div></div>`;}
/* default templates for the sample carousel and post */
const DEF={s1:'Cover Teajia Dark',s2:'H1 Teajia Dark',s3:'Full Quote',s4:'Chapter',s5:'Diptych',s6:'Close Teajia Dark'};
const SUBS={s1:'Porcelain and Tea',s2:'A season of one oolong',s3:'Mr. Lin, 31 years at the kiln',s4:'The real question',s5:'For the mornings',s6:'Read the full story'};
const TONES={s1:['#55564f'],s2:['#5b3b2b'],s3:['#5a4532'],s5:['#4f4b44','#55564f'],s6:['#5a4532','#5b3b2b','#4f4b44']};
CAR.porc.slides.forEach((s,i)=>{s.tpl=s.tpl||DEF[s.id]||'H1 Teajia Dark';s.sub=s.sub||SUBS[s.id]||'';s.tones=s.tones||TONES[s.id]||['#4f4b44'];s.seed=i;});
const POST={porc:{tpl:'Gallery Mat',text:'What do you want your cup to remember?',sub:'Porcelain shows you the tea. Clay keeps a little for itself.',label:'TEAJIA · NOTES',tones:['#55564f'],seed:40}};
const LISTING={oolong:{tpl:'Plate White',text:'Spring Oolong',sub:'1,100 m · picked 18–24 April · lightly oxidised',label:'TEAJIA SHOP',tones:['#4a4d3a'],seed:50}};
const TP={sel:null,open:false,group:'All',role:'',photos:''};
function tpicker(cur,target){
 if(!TPL)return '';
 let list=TPL.slice();if(TP.group!=='All')list=list.filter(t=>t.group===TP.group);if(TP.role)list=list.filter(t=>t.roles.includes(TP.role));if(TP.photos!=='')list=list.filter(t=>String(t.photos)===TP.photos);
 const groups=['All',...new Set(TPL.map(t=>t.group))];const gc=g=>g==='All'?TPL.length:TPL.filter(t=>t.group===g).length;
 return `<section class="tpick" id="tpick" aria-label="Templates"><div class="tph"><b>Templates · ${TPL.length} <span class="sub">— applying to ${esc(target)}</span></b>
  <select class="fsel" data-tpf="role" aria-label="Role"><option value="">Role: any</option>${['cover','hook','inner','close'].map(r=>`<option value="${r}" ${TP.role===r?'selected':''}>${cap(r)} (${TPL.filter(t=>t.roles.includes(r)).length})</option>`).join('')}</select>
  <select class="fsel" data-tpf="photos" aria-label="Photos"><option value="">Photos: any</option>${[0,1,2,3,4].map(n=>`<option value="${n}" ${TP.photos===String(n)?'selected':''}>${n} photo${n===1?'':'s'} (${TPL.filter(t=>t.photos===n).length})</option>`).join('')}</select>
  <button class="tbtn" data-act="tpclose" aria-label="Close templates">${ic('close','sm')}</button></div>
  <nav class="views" aria-label="Template groups">${groups.map(g=>`<button class="${TP.group===g?'on':''}" data-act="tpgroup" data-g="${esc(g)}">${esc(g)} · ${gc(g)}</button>`).join('')}</nav>
  <div class="tgrid">${list.map(t=>`<button class="tcard ${cur.tpl===t.name?'on':''}" data-act="tpapply" data-t="${esc(t.name)}" title="${esc(t.name)} — ${esc(t.group)}">${render1080(t,cur,112)}<span class="nm">${esc(t.name)}</span><span class="m">${t.roles.join(', ')} · ${t.photos} photo${t.photos===1?'':'s'} · ${t.textParts} text</span></button>`).join('')||'<p class="dim">No template matches these filters.</p>'}</div></section>`;
}
const tplFallback=()=>`<div class="tnote"><b>Templates couldn’t load.</b> This page reads ./ig-layouts.json, which browsers block when the file is opened directly. Serve the folder (for example <code>python3 -m http.server</code>) to see the real renders. ${TPLERR?`<span class="dim">(${esc(TPLERR)})</span>`:''}</div>`;
V.arrange=()=>{
 const p=X.resolveProj('arrange');const c=CAR[p],d=DOCS[p];
 const modes=[];if(c)modes.push(['car','Carousel']);if(POST[p])modes.push(['post','Post']);if(LISTING[p])modes.push(['listing','Product listing']);if(d)modes.push(['art',d.kind+' layout']);
 if(!modes.length)return `<div class="wrap">${X.emptyFor('arrange',p,'Nothing to arrange yet','Arrange composes a piece: slides, sections, images.')}</div>`;
 let mode=S.arrangeMode[p];if(!modes.some(m=>m[0]===mode))mode=modes[0][0];
 const tabs=`<div class="filt">${modes.map(([m,l])=>`<button class="${mode===m?'on':''}" data-act="amode" data-m="${m}">${esc(l)}</button>`).join('')}</div>`;
 let body='';
 if(mode==='car'){
  const selId=TP.sel&&c.slides.some(s=>s.id===TP.sel)?TP.sel:null;
  body=`<p class="dim small" style="margin:0 0 10px">The whole carousel, rendered with your templates at 1080 × 1350. Edit the words under each slide; click a slide’s template name to change it; drag the grip to reorder.</p>
  ${TPL?'':tplFallback()}
  <div class="tseq" data-sortable="car">${c.slides.map((s,i)=>{const t=TPL&&(TPN[s.tpl]||TPL[0]);return `<div class="slide2 ${selId===s.id?'on':''} ${s.draft?'draft':''}" data-idx="${i}" id="sl-${s.id}">
   <div class="sh2"><span class="handle" data-handle="1" title="Drag to reorder" aria-label="Drag slide ${i+1}">${ic('grip','sm')}</span><span>${i+1}</span><button class="tn2" data-act="tpfor" data-sid="${s.id}" title="Change template">${ic('tpl','sm')} ${esc(s.tpl)}</button></div>
   ${t?render1080(t,s,198,`data-rsid="${s.id}"`):`<div class="tplr" style="width:198px;height:248px;display:grid;place-items:center;color:var(--dim)">${ic('image')}</div>`}
   ${HOOK.slots?HOOK.slots(s,t,s.id,'slide '+(i+1)):''}
   <div class="tx2" contenteditable="true" data-tsid="${s.id}" data-part="text" aria-label="Slide ${i+1} text">${esc(s.text)}</div>
   ${t&&t.textParts>1?`<div class="tx2 second" contenteditable="true" data-tsid="${s.id}" data-part="sub" aria-label="Slide ${i+1} second line">${esc(s.sub)}</div>`:''}
   ${s.draft?`<div class="df">${esc(s.draft)} drafted · not accepted<button class="btn primary" data-act="accept" data-id="${s.id}">Accept</button><button class="btn" data-act="discard" data-id="${s.id}">Discard</button></div>`:''}
  </div>`;}).join('')}
  </div><p style="margin:0 0 6px"><button class="btn" data-act="addslide">${ic('plus','sm')} Add a slide</button></p>
  ${selId&&TPL?tpicker(c.slides.find(s=>s.id===selId),'slide '+(c.slides.findIndex(s=>s.id===selId)+1)):(TPL?`<p class="dim small">Click a template name above to browse all ${TPL.length} templates for that slide.</p>`:'')}`;
 } else if(mode==='post'||mode==='listing'){
  const o=(mode==='post'?POST:LISTING)[p];const t=TPL&&(TPN[o.tpl]||TPL[0]);
  body=`${TPL?'':tplFallback()}<div class="postwrap">${t?render1080(t,o,320,`data-rsid="__${mode}"`):''}<div class="side">
   <div class="lab">${mode==='post'?'Single post · 1080 × 1350':'Listing image · 1080 × 1350, for the shop and Instagram'}</div>
   ${HOOK.slots?HOOK.slots(o,t,'__'+mode,mode==='post'?'the post':'the listing image'):''}
   <button class="btn" data-act="tpfor" data-sid="__${mode}" style="justify-self:start">${ic('tpl','sm')} Template: ${esc(o.tpl)}</button>
   <div class="tx2" contenteditable="true" data-tsid="__${mode}" data-part="text" aria-label="Headline">${esc(o.text)}</div>
   <div class="tx2" contenteditable="true" data-tsid="__${mode}" data-part="sub" aria-label="Second line">${esc(o.sub)}</div>
   ${mode==='listing'?'<p class="dim small">The shop’s product page itself uses the shop’s own product layout, not these templates. Only the listing image does.</p>':'<p class="dim small">The caption is written in Write (Outputs → Post caption).</p>'}
  </div></div>${TP.sel==='__'+mode&&TPL?tpicker(o,mode==='post'?'the post':'the listing image'):''}`;
 } else {
  body=`<p class="dim small" style="margin:0 0 12px">Section order for the ${esc(d.kind.toLowerCase())}. Drag to reorder; the text is edited in Write.</p>
  <div class="lblocks" data-sortable="art">${d.paras.map((x,i)=>`<div class="lblock" data-idx="${i}"><span class="handle" data-handle="1" aria-label="Drag section ${i+1}">${ic('grip','sm')}</span><div><span class="x">¶${i+1}</span> ${esc(x.text.replace(/⟦L\d+⟧/g,'').slice(0,120))}${x.text.length>120?'…':''}</div></div>`).join('')}</div>
  <div class="tnote">${d.kind==='Script'?'<b>Scripts have no template system yet.</b> Captions are plain text in Write; on-screen caption styling would need its own templates.':'<b>Articles use the magazine layout, not the Instagram templates.</b> A carousel or post cut from this article uses the templates (see the Carousel and Post tabs when a project has them).'}</div>`;
 }
 return `<div class="wrap" style="max-width:none">${X.head('arrange',p,tabs+`<button class="btn" data-act="go" data-tool="audience">${ic('audience','sm')} See it as a reader</button>`)}${body}</div>`;
};
function slideObj(sid){const p=X.resolveProj('arrange');if(sid==='__post')return POST[p];if(sid==='__listing')return LISTING[p];return CAR[p]&&CAR[p].slides.find(s=>s.id===sid);}
function repaintSlide(sid){const o=slideObj(sid);const el=document.querySelector(`[data-rsid="${sid}"]`);if(!o||!el||!TPL)return;const t=TPN[o.tpl];el.firstElementChild.innerHTML=tplHTML(t,o);
 document.querySelectorAll('#tpick .tcard').forEach(card=>{const tt=TPN[card.dataset.t];const r=card.querySelector('.tpli');if(tt&&r)r.innerHTML=tplHTML(tt,o);});}
document.addEventListener('input',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.tsid){const o=slideObj(t.dataset.tsid);if(!o)return;o[t.dataset.part]=t.innerText.replace(/\n+$/,'');clearTimeout(t._r);t._r=setTimeout(()=>repaintSlide(t.dataset.tsid),120);}});

/* ---------- finder: pinned + recent first, the full list behind ---------- */
const PINNED=['porc','harb'];const RECENT=['oolong','ancha'];

/* ---------- actions ---------- */
const getKey=el=>el.dataset.k||(el.closest('[data-bkey]')||{}).dataset?.bkey||'lib';
function popMenu(anchor,title,items,onPick){
 let pop=$('#pop');if(!pop){pop=document.createElement('div');pop.id='pop';pop.setAttribute('role','dialog');document.body.appendChild(pop);}
 const draw=q=>{const f=items.filter(x=>!q||x.label.toLowerCase().includes(q)||(x.path||'').toLowerCase().includes(q));
  pop.querySelector('ul').innerHTML=f.map((x,i)=>`<li><button data-i="${items.indexOf(x)}" style="padding-left:${8+(x.depth||0)*14}px">${x.icon?ic(x.icon,'sm'):''}<span>${esc(x.label)}</span>${x.path?`<span class="pth">· ${esc(x.path)}</span>`:''}</button></li>`).join('')||'<li class="dim" style="padding:10px">Nothing matches.</li>';};
 pop.innerHTML=`<div class="ph2">${esc(title)}</div><input placeholder="Filter…" aria-label="Filter"><ul></ul>`;draw('');
 const r=anchor.getBoundingClientRect();pop.style.left=Math.max(12,Math.min(innerWidth-332,r.left))+'px';
 const below=r.bottom+6;pop.style.top=(below+300>innerHeight?Math.max(12,r.top-306):below)+'px';
 pop.classList.add('on');const inp=pop.querySelector('input');inp.focus();
 inp.oninput=()=>draw(inp.value.trim().toLowerCase());
 pop.querySelector('ul').onclick=e=>{const b=e.target.closest('button[data-i]');if(!b)return;closePop();onPick(items[+b.dataset.i]);};
}
function closePop(){const p=$('#pop');if(p)p.classList.remove('on');}
document.addEventListener('mousedown',e=>{const p=$('#pop');if(p&&p.classList.contains('on')&&!p.contains(e.target)&&!e.target.closest('[data-act=bulk],[data-act=pvpiece],[data-act=pvfolder]'))closePop();});
const folderItems=folders=>{const out=[];const walk=(pid,d)=>folders.filter(f=>f.parent===pid).forEach(f=>{out.push({id:f.id,label:f.name,depth:d,icon:f.q?'coll':'folder'});walk(f.id,d+1);});walk(null,0);return out;};
function addToFolder(key,ids,fid){const D=DOM[st_dom(key)];let n=0;ids.forEach(id=>{const it=D.items().find(x=>x.id===id);if(it&&!it.folders.includes(fid)){it.folders.push(fid);n++;}});libVer++;return n;}
const selIds=key=>[...BS[key].sel];

Object.assign(A,{
 bopen:el=>{const key=el.dataset.k||getKey(el);const D=DOM[BS[key]?st_dom(key):key];const it=D.items().find(x=>x.id===el.dataset.id);if(!it)return;if(BS[key]){BS[key].cur=it.id;if(BS[key].onPick){BS[key].onPick(it);return;}}
  if(key==='pick'||key==='lib'||D===DOM.lib){X.openDrawer('preview',{id:it.id});paint(key);}else{D.open(it);paint(key);}},
 bsel:(el,e)=>{const key=el.dataset.k;const st=BS[key];const id=el.dataset.id;
  if(e&&e.shiftKey&&st.anchor){const ids=st.rows.map(r=>r.id);const a=ids.indexOf(st.anchor),b=ids.indexOf(id);if(a>=0&&b>=0){const [x,y]=a<b?[a,b]:[b,a];for(let i=x;i<=y;i++)st.sel.add(ids[i]);}}
  else{st.sel.has(id)?st.sel.delete(id):st.sel.add(id);st.anchor=id;}
  rerenderBrowser(key,true);},
 bselall:el=>{const key=el.dataset.k;const st=BS[key];const all=st.rows.length&&st.rows.every(r=>st.sel.has(r.id));if(all)st.rows.forEach(r=>st.sel.delete(r.id));else st.rows.forEach(r=>st.sel.add(r.id));rerenderBrowser(key,true);},
 bclear:el=>{BS[el.dataset.k].sel.clear();rerenderBrowser(el.dataset.k,true);},
 bfclear:el=>{const st=BS[el.dataset.k];st.f={};st.q='';st.view='';rerenderBrowser(el.dataset.k);},
 bsort:el=>{const st=BS[el.dataset.k];if(st.sort===el.dataset.s)st.dir*=-1;else{st.sort=el.dataset.s;st.dir=el.dataset.s==='title'||el.dataset.s==='src'?1:-1;}rerenderBrowser(el.dataset.k);},
 bview:el=>{const key=el.dataset.k;const D=DOM[st_dom(key)];const v=D.views.find(x=>x.id===el.dataset.v);const st=BS[key];v.set(st);st.view=v.id;if(st.folder!=='all'&&st.folder!=='unsorted')fpath(D.folders,st.folder).forEach(f=>st.open.add(f.id));rerenderBrowser(key);},
 ttog:el=>{const st=BS[el.dataset.k];const f=el.dataset.f;st.open.has(f)?st.open.delete(f):st.open.add(f);rerenderBrowser(el.dataset.k,true);},
 tpick:el=>{const key=el.dataset.k;const st=BS[key];st.folder=el.dataset.f;st.view=el.dataset.f==='all'?'all':el.dataset.f==='unsorted'?'unsorted':'';if(st.folder!=='all'&&st.folder!=='unsorted')fpath(DOM[st_dom(key)].folders,st.folder).forEach(f=>st.open.add(f.id));rerenderBrowser(key);},
 ttree:el=>{const st=BS[el.dataset.k];st.tree=!st.tree;rerenderBrowser(el.dataset.k,true);},
 lsheet:el=>openSheet(el.dataset.k),
 closesheet:()=>closeSheet(),
 newfolder:el=>{const key=el.dataset.k;const st=BS[key];const D=DOM[st_dom(key)];const parent=st.folder!=='all'&&st.folder!=='unsorted'?st.folder:null;const id='f_new'+Date.now();D.folders.push({id,name:'New folder',parent});clearSub();if(parent)st.open.add(parent);st.folder=id;rerenderBrowser(key);
  const lbl=document.querySelector(`.tn [data-f="${id}"].tl span`);if(lbl){lbl.contentEditable='true';lbl.focus();document.execCommand&&document.execCommand('selectAll');lbl.onblur=()=>{const f=D.folders.find(x=>x.id===id);f.name=lbl.textContent.trim()||'New folder';rerenderBrowser(key,true);};lbl.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();lbl.blur();}};}
  X.toast('Folder made — type its name. Prototype, nothing is saved');},
 stress:()=>{if(!stressed){stress();clearSub();X.toast('Loaded 5,000 more invented sources for the stress test');}rerenderBrowser('lib');},
 bulk:el=>{const key=el.dataset.k;const ids=selIds(key);const op=el.dataset.op;const D=DOM[st_dom(key)];if(D.bulk){D.bulk(op,el,key,ids);return;}
  if(op==='folder')popMenu(el,`Add ${ids.length} to…`,folderItems(D.folders),x=>{const n=addToFolder(key,ids,x.id);X.toast(`Added ${n} to ${x.label} — they stay in their other folders. Prototype, nothing is saved`);BS[key].sel.clear();X.render(true);});
  if(op==='piece')popMenu(el,`Use ${ids.length} in…`,PIECES.map(pc=>({id:pc.id,label:pc.title,path:KIND_L[pc.kind],icon:KIND_IC[pc.kind]})),x=>{ids.forEach(id=>{const it=LIB.find(i=>i.id===id);if(it&&!it.pieces.includes(x.id))it.pieces.push(x.id);});X.toast(`${ids.length} linked to ${x.label} as sources. Prototype, nothing is saved`);BS[key].sel.clear();X.render(true);});
  if(op==='topic'){const tps=[...new Set(LIB.flatMap(i=>i.topics))].sort();popMenu(el,`Tag ${ids.length} with topic…`,tps.map(t=>({id:t,label:t})),x=>{ids.forEach(id=>{const it=LIB.find(i=>i.id===id);if(it&&!it.topics.includes(x.id))it.topics.push(x.id);});X.toast(`Tagged ${ids.length} “${x.id}”. Prototype, nothing is saved`);rerenderBrowser(key,true);});}
  if(op==='status')popMenu(el,`Set status of ${ids.length}…`,['idea','draft','ready','published'].map(s=>({id:s,label:cap(s)})),x=>{ids.forEach(id=>{const pc=PCE(id);if(pc)pc.status=x.id;});BS[key].sel.clear();rerenderBrowser(key,true);});},
 bulkread:el=>{const key=el.dataset.k;selIds(key).forEach(id=>{const it=LIB.find(i=>i.id===id);if(it&&it.status==='new')it.status='read';});BS[key].sel.clear();rerenderBrowser(key,true);},
 opencoll:el=>{bstate('lib');const st=BS.lib;st.folder=el.dataset.f;st.f={};st.q='';st.view=el.dataset.f==='unsorted'?'unsorted':'';if(st.folder!=='unsorted')fpath(F,st.folder).forEach(f=>st.open.add(f.id));closePicker();X.go('library');},
 suggest:()=>{SUG=makeSuggestions();X.render(true);setTimeout(()=>{const s=$('#sugg');s&&s.scrollIntoView({block:'start',behavior:'smooth'});},30);},
 closesugg:()=>{SUG=null;X.render(true);},
 sgall:el=>{const g=el.dataset.g;const n=SUG[g].filter(x=>!x.st).length;SUG[g].forEach(x=>{if(!x.st)applySug(g,x.id,el.dataset.v);});if(el.dataset.v==='acc')X.toast(`Moved ${n} into ${FD(g).name} — local only. Prototype, nothing is saved`);X.render(true);},
 sgone:el=>{applySug(el.dataset.g,el.dataset.id,el.dataset.v);X.render(true);},
 newcoll:()=>{const id='c_new'+Date.now();F.push({id,name:'New collection',parent:null,q:'What is the question?',topics:[]});clearSub();X.render(true);X.toast('Collection made at the top level. Prototype — nothing is saved');},
 unfile:el=>{const it=LIB.find(i=>i.id===el.dataset.id);it.folders=it.folders.filter(f=>f!==el.dataset.f);libVer++;X.renderDrawer();if(S.view==='library')rerenderBrowser('lib',true);},
 pvread:el=>{const it=LIB.find(i=>i.id===el.dataset.id);it.status='read';X.renderDrawer();if(S.view==='library')rerenderBrowser('lib',true);},
 pvpiece:el=>{const it=LIB.find(i=>i.id===el.dataset.id);popMenu(el,'Use in piece…',PIECES.map(pc=>({id:pc.id,label:pc.title,path:KIND_L[pc.kind],icon:KIND_IC[pc.kind]})),x=>{if(!it.pieces.includes(x.id))it.pieces.push(x.id);X.renderDrawer();X.toast(`Linked to ${x.label}. Prototype, nothing is saved`);if(S.view==='library')rerenderBrowser('lib',true);});},
 pvfolder:el=>{const it=LIB.find(i=>i.id===el.dataset.id);popMenu(el,'Add to collection or folder…',folderItems(F),x=>{if(!it.folders.includes(x.id))it.folders.push(x.id);libVer++;X.renderDrawer();if(S.view==='library')rerenderBrowser('lib',true);X.toast(`Added to ${x.label}. Prototype, nothing is saved`);});},
 addsources:()=>openPicker(),
 closepicker:()=>closePicker(),
 pickadd:()=>{const p=X.resolveProj('write');const pid=projPiece(p);const ids=selIds('pick');ids.forEach(id=>{const it=LIB.find(i=>i.id===id);if(it&&!it.pieces.includes(pid))it.pieces.push(pid);});closePicker();X.toast(`${ids.length} added to this piece’s sources. Prototype, nothing is saved`);X.openDrawer('sources');},
 discussin:el=>{const i=$('#cinput');if(i){i.value='/point '+el.dataset.n;i.focus();}},
 chint:el=>{const i=$('#cinput');if(i){i.value=el.dataset.h;i.focus();}},
 ccite:el=>runCmd('/cite '+el.dataset.id),
 libsearch:el=>{bstate('lib');const st=BS.lib;st.folder='all';st.f={};st.q=el.dataset.q;st.view='';X.go('library');},
 tpfor:el=>{TP.sel=TP.sel===el.dataset.sid?null:el.dataset.sid;X.render(true);setTimeout(()=>{const t=$('#tpick');t&&t.scrollIntoView({block:'nearest',behavior:'smooth'});},20);},
 tpclose:()=>{TP.sel=null;X.render(true);},
 tpgroup:el=>{TP.group=el.dataset.g;X.render(true);},
 tpapply:el=>{const o=slideObj(TP.sel);if(!o)return;o.tpl=el.dataset.t;X.render(true);X.toast(`${el.dataset.t} applied. Prototype — nothing is saved`);}
});
const oldAdd=A.addslide;A.addslide=()=>{oldAdd();const c=CAR[X.resolveProj('arrange')];const s=c.slides[c.slides.length-1];s.tpl='H1 Teajia Dark';s.sub='';s.tones=['#4f4b44'];s.seed=c.slides.length;X.render(true);};
/* the existing level action expects RES; keep using it. rpoint toggles open/closed */
A.rpoint=el=>{const p=X.resolveProj('research');S.research[p]=S.research[p]===el.dataset.id?null:el.dataset.id;X.render(true);};

/* phone: folders + filters in a sheet */
function openSheet(key){let sh=$('#lsheet');if(!sh){sh=document.createElement('div');sh.id='lsheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-label','Folders and filters');document.body.appendChild(sh);const sc=document.createElement('div');sc.className='scrim l';sc.dataset.act='closesheet';document.body.appendChild(sc);}
 sh.dataset.k=key;fillSheet(key);sh.classList.add('on');$('.scrim.l').classList.add('on');}
function fillSheet(key){const sh=$('#lsheet');const D=DOM[st_dom(key)];const st=BS[key];sh.innerHTML=`<div class="shh"><h2>Folders and filters</h2><button class="btn primary" data-act="closesheet">Show ${st.rows?st.rows.length:''}</button></div><div class="shb">
  <div class="views" style="display:flex;border:0;padding:0;flex-wrap:wrap">${D.views.map(v=>`<button class="${st.view===v.id?'on':''}" data-act="bview" data-k="${key}" data-v="${v.id}">${esc(v.label)}</button>`).join('')}</div>
  ${facetSelects(key)}<aside class="tree">${treeHTML(key)}</aside></div>`;}
function closeSheet(){const s=$('#lsheet');if(s)s.classList.remove('on');const c=$('.scrim.l');if(c)c.classList.remove('on');}

/* inputs, selects, keys */
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.bq){const key=t.dataset.bq;BS[key].q=t.value;BS[key].view='';const pos=t.selectionStart;rerenderBrowser(key);const n=document.getElementById('bq-'+key);if(n){n.focus();n.setSelectionRange(pos,pos);}}});
document.addEventListener('change',e=>{const t=e.target;
 if(t.dataset&&t.dataset.facet){const key=t.dataset.k;BS[key].f[t.dataset.facet]=t.value;BS[key].view='';rerenderBrowser(key);}
 else if(t.dataset&&t.dataset.sort){const key=t.dataset.k;BS[key].sort=t.value;BS[key].dir=t.value==='title'||t.value==='src'?1:-1;rerenderBrowser(key);}
 else if(t.dataset&&t.dataset.tpf){TP[t.dataset.tpf]=t.value;X.render(true);}
});
document.addEventListener('keydown',e=>{
 if(e.target.id==='cinput'){
  if(e.key==='Enter'){e.preventDefault();const v=e.target.value;e.target.value='';runCmd(v);}
  else if(e.key==='ArrowUp'){e.preventDefault();if(HIST.length){hi=Math.max(0,hi-1);e.target.value=HIST[hi];}}
  else if(e.key==='ArrowDown'){e.preventDefault();hi=Math.min(HIST.length,hi+1);e.target.value=HIST[hi]||'';}
  return;}
 if(e.key==='Escape'){if($('#pop')&&$('#pop').classList.contains('on')){closePop();e.stopImmediatePropagation();return;}if($('#picker')&&$('#picker').classList.contains('on')){closePicker();e.stopImmediatePropagation();return;}if($('#lsheet')&&$('#lsheet').classList.contains('on')){closeSheet();e.stopImmediatePropagation();}}
},true);
let rz=0;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>Object.keys(BS).forEach(k=>paint(k)),120);});

/* drag: rows → folders (link), folders → folders (nest), sources → text (cite) */
let DRAG=null;
document.addEventListener('dragstart',e=>{
 const row=e.target.closest&&e.target.closest('.vrow,.vtile');
 if(row){const key=row.dataset.k;const st=BS[key];const ids=st.sel.has(row.dataset.id)?[...st.sel]:[row.dataset.id];DRAG={kind:'rows',key,ids};e.dataTransfer.setData('text/plain',ids.length+' items');e.dataTransfer.effectAllowed='link';row.classList.add('dragging');
  if(ids.length>1){const g=document.createElement('div');g.textContent=ids.length+' '+DOM[st_dom(key)].noun;g.style.cssText='position:fixed;top:-100px;padding:4px 10px;background:#c9a874;color:#141310;border-radius:6px;font:500 13px sans-serif';document.body.appendChild(g);e.dataTransfer.setDragImage(g,10,10);setTimeout(()=>g.remove(),0);}return;}
 const fn=e.target.closest&&e.target.closest('[data-fdrag]');
 if(fn){DRAG={kind:'folder',key:getKey(fn),id:fn.dataset.fdrag};e.dataTransfer.setData('text/plain','folder');return;}
 const ci=e.target.closest&&e.target.closest('[data-cite]');
 if(ci){DRAG={kind:'cite',id:ci.dataset.cite};e.dataTransfer.setData('text/plain','⟦'+ci.dataset.cite+'⟧');e.dataTransfer.effectAllowed='copy';}
});
document.addEventListener('dragend',()=>{document.querySelectorAll('.dragging,.over,.dropok').forEach(x=>x.classList.remove('dragging','over','dropok'));DRAG=null;});
document.addEventListener('dragover',e=>{if(!DRAG)return;
 if(DRAG.kind==='cite'){const p=e.target.closest&&e.target.closest('.para[contenteditable]');if(p){e.preventDefault();document.querySelectorAll('.dropok').forEach(x=>x!==p&&x.classList.remove('dropok'));p.classList.add('dropok');}return;}
 const t=e.target.closest&&e.target.closest('[data-drop]');document.querySelectorAll('.over').forEach(x=>x!==t&&x.classList.remove('over'));
 if(t&&!(DRAG.kind==='folder'&&(t.dataset.drop==='unsorted'||subtree(DOM[st_dom(DRAG.key)].folders,DRAG.id).has(t.dataset.drop)))){e.preventDefault();t.classList.add('over');}
});
document.addEventListener('drop',e=>{if(!DRAG)return;const d=DRAG;
 if(d.kind==='cite'){const para=e.target.closest&&e.target.closest('.para[contenteditable]');if(!para)return;e.preventDefault();
  let r=null;if(document.caretRangeFromPoint)r=document.caretRangeFromPoint(e.clientX,e.clientY);else if(document.caretPositionFromPoint){const c=document.caretPositionFromPoint(e.clientX,e.clientY);if(c){r=document.createRange();r.setStart(c.offsetNode,c.offset);}}
  const tmp=document.createElement('span');tmp.innerHTML=' '+chip(d.id);const node=tmp.lastElementChild;
  if(r&&para.contains(r.startContainer)){r.insertNode(node);node.before(document.createTextNode(' '));}else para.appendChild(node);
  syncPara(para);para.classList.remove('dropok');const p=X.resolveProj('write');const it=LIB.find(x=>x.id===d.id);if(it&&!it.pieces.includes(projPiece(p)))it.pieces.push(projPiece(p));X.renderDrawer();X.toast('Citation added. Prototype — nothing is saved');DRAG=null;return;}
 const t=e.target.closest&&e.target.closest('[data-drop]');if(!t)return;e.preventDefault();const fid=t.dataset.drop;
 if(d.kind==='rows'){
  if(fid==='unsorted'){d.ids.forEach(id=>{const it=DOM[st_dom(d.key)].items().find(x=>x.id===id);if(it)it.folders=[];});X.toast(`${d.ids.length} moved back to Unsorted`);}
  else{const D=DOM[st_dom(d.key)];const n=addToFolder(d.key,d.ids,fid);X.toast(`Added ${n} to ${(D.folders.find(f=>f.id===fid)||{}).name} — still in their other folders. Prototype, nothing is saved`);}
  BS[d.key]&&BS[d.key].sel.clear();}
 if(d.kind==='folder'){const D=DOM[st_dom(d.key)];const f=D.folders.find(x=>x.id===d.id);if(f&&f.id!==fid){f.parent=fid;clearSub();BS[d.key].open.add(fid);X.toast(`${f.name} is now inside ${(D.folders.find(x=>x.id===fid)||{}).name}`);}}
 DRAG=null;X.render(true);
});

/* Material is the intake inbox that feeds the Library */
const oldMat=V.material;V.material=()=>oldMat().replace('<div class="drop" id="drop">',`<p class="dim small" style="margin:-8px 0 14px">Material is the inbox. Processed items land in the <button class="lnk" data-act="opencoll" data-f="unsorted">Library → Unsorted (${LIB.filter(i=>!i.folders.length).length})</button>, where you file them into folders and collections.</p><div class="drop" id="drop">`);


X.render();
window.ARC_SCALE={LIB,F,PIECES,BS,search,runCmd,stress,get TPL(){return TPL;},
 /* the shared browser engine (folder tree + virtualised one-line table/grid), reused by media.js */
 DOM,BOPTS,HOOK,bstate,browserHTML,mount,paint,rerenderBrowser,filterRows,folderCount,fpath,subtree,clearSub,popMenu,closePop,folderItems,addToFolder,selIds,rng,pick,cap,fmtDate,PCE,KIND_L,KIND_IC,TPN,tplHTML,photo,slideObj,repaintSlide,POST,LISTING,openSheet,closeSheet,st_dom};
})();
