/* Direction D, the slide studio and the looks. The layouts are Adrian's own Carousel layouts (slides-data.js, built
   from the catalogue AR Create keeps). Words and pictures on them are invented. A look is one brand's colours, type,
   logo and graphics; the same layout can be drawn in any look. */
(function(){
const {esc,icon}=K,T=window.IGL.T,ROWS=window.IGL.rows;
const WORDMARK='../../../runtime/public/ig-assets/teajia-wordmark.png';

/* ---------- looks: one per brand ---------- */
const TEA={ground:'#1a1714',box:'#2a2622',line:'#3a3530',head:'#f3eada',sup:'#cdc0a8',label:'#8d806b',gold:'#a8874d',lground:'#f4ece0',lbox:'#e6dbcc',lline:'#d5c8b4',ink:'#18130e',lsup:'#443a2c',llabel:'#9a8c78',lgold:'#8e6d2e'};
const LOOKS={
 tea:{name:'Teajiā',folder:'Tea',dir:'Teajia',account:'Teajiā',things:['logo','seal1','seal2','seal3','sprig','ridge','stamp'],own:'The three seals, the chapter characters and the vertical characters belong to this look alone.',c:TEA,head:'Caudex, Georgia, serif',body:"'EB Garamond', Georgia, serif",tint:'#a8874d',
  faces:[['Caudex','Headlines, labels, credits, links','Caudex, Georgia, serif','twenty days of shade'],['EB Garamond','Supporting lines and paragraphs',"'EB Garamond', Georgia, serif",'she handed me a cup and pointed at the bench.'],['Shippori Mincho, bold','All Chinese text',"'Shippori Mincho', serif",'茶山 寒露'],['Noto Serif TC, heavy','Only for photographs inside characters',"'Noto Serif TC', serif",'佳家嘉']],
  rules:['Every post is dark or light. Never pure black or pure white.','The wordmark sits on covers, closes and single posts only.','No italics. Labels are spaced capitals, never smaller than 30.','Photographs are real, cropped and never stretched.','Words sit only on calm parts of a photograph.','A small gold seal marks the pillar: 佳, 家 or 嘉.','No two neighbouring slides share a layout. One slide has no words.']},
 art:{name:'Art',folder:'Art',dir:'Art',mark:'the studio',account:'Studio',things:['logo','chisel','rings','gem','rays'],own:'No Chinese characters here. Its own marks: the chisel mark, the layered rings, the stone, the light.',c:{ground:'#201d1a',box:'#2b2723',line:'#3a352f',head:'#f2efe9',sup:'#d6cdbf',label:'#9a9083',gold:'#c4aa7c',lground:'#f2efe9',lbox:'#e6e0d5',lline:'#d3cabb',ink:'#201d1a',lsup:'#4a433a',llabel:'#8f8577',lgold:'#8f7443'},head:"'AR Cormorant', Georgia, serif",body:"'AR Lora', Georgia, serif",tint:'#b5714a',
  faces:[['Cormorant Garamond','Titles',"'AR Cormorant', Georgia, serif",'Gold leaf on driftwood'],['Lora','Spoken lines and paragraphs',"'AR Lora', Georgia, serif",'The wood decides where the gold stays.'],['Plus Jakarta Sans','Labels and credits',"'AR Plus Jakarta Sans', sans-serif",'STUDIO NOTES · 07']],
  rules:['Warm dark ground, cream words, one bronze accent.','No borders and no gradients.','Material first: name the wood, the layers, the light.','Photographs of the work, never stretched.']},
 mandala:{name:'Mandala',folder:'Mandala',dir:'Mandala',mark:'mandala',stand:true,account:'Studio',things:['logo','rosette','hexagram','enso','gate'],own:'No Chinese characters here. Its own marks: the rosette, the six lines, the brush circle, the gate number.',c:{ground:'#12141b',box:'#1d2029',line:'#2c303c',head:'#eeeae0',sup:'#c3c2c8',label:'#7f8291',gold:'#c9955c',lground:'#efece4',lbox:'#e0ddd3',lline:'#cfcbbf',ink:'#14151b',lsup:'#3d3f4a',llabel:'#8b8c96',lgold:'#9a5f2c'},head:"'AR Plus Jakarta Sans', sans-serif",body:"'AR Lora', Georgia, serif",tint:'#5f7ea3',
  faces:[['Plus Jakarta Sans','Titles and labels',"'AR Plus Jakarta Sans', sans-serif",'Gate 12, standing still'],['Lora','Lines and paragraphs',"'AR Lora', Georgia, serif",'Nothing needs to be understood to begin.']],
  rules:['Night ground, ivory words, one copper accent.','The card’s own name, never the system’s.','No names of teachers or books on a slide.']},
 journey:{name:'Journey',folder:'Journey',dir:'Journey',empty:true,account:'Studio',tint:'#73896a'}};
const lookOf=id=>LOOKS[id]&&!LOOKS[id].empty?LOOKS[id]:LOOKS.art;
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)).join(',');
function skin(h,lk){
 if(lk===LOOKS.tea)return h.replace(/__IG_LOGO__/g,WORDMARK);
 const c=lk.c,M={};Object.keys(TEA).forEach(k=>M[TEA[k]]=c[k]);M['#ede4d4']=c.lground;
 return h.replace(/<img src="__IG_LOGO__"[^>]*>/g,m=>`<div style="font-family:${lk.head};font-size:42px;letter-spacing:.14em;color:${/brightness\(0\)/.test(m)?c.ink:c.head};white-space:nowrap;flex-shrink:0">${esc(lk.mark)}</div>`)
  .replace(/#[0-9a-fA-F]{6}\b/g,x=>M[x.toLowerCase()]||x).replace(/rgba\(26,\s*23,\s*20/g,'rgba('+rgb(c.ground))
  .replace(/Caudex, Georgia, serif/g,lk.head).replace(/'EB Garamond', Georgia, serif/g,lk.body)
  .replace(/'Shippori Mincho', 'Noto Serif TC', serif/g,lk.head).replace(/(<div lang="zh-Hant"[^>]*>)([^<]*)(<\/div>)/g,(m,a,t,b)=>a+(t==='壹'?'01':'')+b).replace(/>JIĀ</g,'><').replace(/>(EXCELLENCE|HOME|CELEBRATION)</g,'><');}
const NEED='<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(128,120,104,.16) 0 18px,rgba(128,120,104,.07) 18px 36px);display:flex;align-items:center;justify-content:center;font:30px/1 Caudex,Georgia,serif;letter-spacing:.16em;color:#8d806b">PHOTOGRAPH NEEDED</div>';
function fill(id,s,lk){const t=T[id];if(!t)return '';const parts=String(s.text||'').split(/\n\s*\n/),part=i=>i===t.t-1?parts.slice(i).join('\n\n'):parts[i]||'',ph=s.ph||[];
 let h=t.h.replace(/<img\b[^>]*src="__IG_PHOTO_(\d+)__"[^>]*>/g,(m,n)=>ph[+n]?`<img src="${K.photoURI(ph[+n])}" alt="" draggable="false" style="${t.ps[+n]||'position:absolute;inset:0;width:100%;height:100%'};object-fit:cover">`:NEED)
  .replace(/__IG_BG_(\d+)__/g,(m,n)=>ph[+n]?`url(&quot;${K.photoURI(ph[+n])}&quot;)`:'none')
  .replace(/__IG_TEXT_(\d+)__/g,(m,n)=>esc(part(+n))).replace(/__IG_LABEL__/g,esc(s.label||'')).replace(/__IG_CREDIT__/g,esc(s.credit||''))
  .replace(/(<div lang="zh-Hant" style="[^"]*">)(<\/div>)/g,(m,a,b)=>a+(s.zh||(/vertical/.test(a)?'茶山':'寒露'))+b);
 return skin(h,lk);}

/* things that can be placed on a slide: logo, seals, graphics, an inset picture */
const SPRIG='<svg viewBox="0 0 120 160" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M60 156C58 110 62 60 60 8"/><path d="M60 120c-22-6-36-22-40-44 22 4 36 20 40 44ZM60 96c22-6 36-22 40-44-22 4-36 20-40 44ZM60 66c-18-6-28-20-30-38 18 4 28 18 30 38ZM60 44c14-6 22-16 24-30-14 4-22 14-24 30Z"/></svg>';
const ENSO='<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="currentColor" stroke-linecap="round"><path d="M150 38C104 4 34 30 26 96c-8 62 50 96 102 78 44-16 62-70 34-112" stroke-width="13"/><path d="M162 62c6 10 9 20 10 30" stroke-width="7" opacity=".6"/></svg>';
const RIDGE='<svg viewBox="0 0 300 90" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 80c40-8 60-52 88-52 20 0 26 22 44 22 24 0 34-44 62-44 30 0 48 60 98 72"/><path d="M40 84h220" opacity=".5"/></svg>';
const ROSETTE='<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3">'+[0,45,90,135,180,225,270,315].map(a=>`<ellipse cx="100" cy="52" rx="24" ry="46" transform="rotate(${a} 100 100)"/>`).join('')+'<circle cx="100" cy="100" r="94"/><circle cx="100" cy="100" r="14"/></svg>';
const HEX='<svg viewBox="0 0 160 160" width="100%" height="100%" fill="currentColor">'+[1,0,1,1,0,1].map((w,i)=>w?`<rect x="10" y="${12+i*25}" width="140" height="12"/>`:`<rect x="10" y="${12+i*25}" width="58" height="12"/><rect x="92" y="${12+i*25}" width="58" height="12"/>`).join('')+'</svg>';
const RINGS='<svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3"><path d="M100 8c50 0 92 40 92 92s-44 92-94 92S8 148 8 100 50 8 100 8Z"/><path d="M100 34c38 2 66 30 66 66s-30 66-68 66-64-32-64-66 30-68 66-66Z"/><path d="M100 60c24 0 40 18 40 40s-18 40-42 40-38-20-38-40 18-40 40-40Z"/><circle cx="100" cy="100" r="12"/></svg>';
const GEM='<svg viewBox="0 0 160 160" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M40 20h80l32 40-72 84L8 60ZM8 60h144M40 20l16 40 24 84 24-84 16-40M56 60l24-40 24 40"/></svg>';
const RAYS='<svg viewBox="0 0 240 130" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M40 124a80 80 0 0 1 160 0"/>'+[-70,-45,-20,0,20,45,70].map(a=>`<path d="M120 30V6" transform="rotate(${a} 120 124)"/>`).join('')+'</svg>';
const CHISEL='<svg viewBox="0 0 160 160" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><circle cx="80" cy="80" r="72"/><path d="M52 112 80 40l28 72M62 90h36"/></svg>';
const DRAW={sprig:[SPRIG,1.33],enso:[ENSO,1],ridge:[RIDGE,.3],rosette:[ROSETTE,1],hexagram:[HEX,1],rings:[RINGS,1],gem:[GEM,1],rays:[RAYS,.54],chisel:[CHISEL,1]};
const THINGS={logo:['Wordmark',260],seal1:['Seal 佳',96],seal2:['Seal 家',96],seal3:['Seal 嘉',96],label:['Small label',300],rule:['Rule',260],stamp:['Round stamp',200],sprig:['Leaf sprig',150],enso:['Brush circle',260],ridge:['Ridge line',340],inset:['Inset picture',300],rosette:['Rosette',240],hexagram:['Six lines',120],gate:['Gate number',130],rings:['Layered rings',240],gem:['The stone',130],rays:['The light',280],chisel:['Chisel mark',120]};
const GENERIC=['label','rule','inset'];
const inLook=(k,lk)=>{if(GENERIC.includes(k)||lk.things.includes(k))return k;const home=Object.values(LOOKS).find(l=>l.things&&l.things.includes(k));return lk.things[Math.min(home?home.things.indexOf(k):1,lk.things.length-1)];};
function thing(e,lk,i,live){const k0=inLook(e.k,lk);if(k0!==e.k)e={...e,k:k0,w:/^seal/.test(e.k)?Math.round(e.w*1.3):e.w};const c=lk.c,w=e.w,[n]=THINGS[e.k];let h='';
 if(e.k==='logo')h=lk===LOOKS.tea?`<img src="${WORDMARK}" alt="" draggable="false" style="width:${w}px;display:block">`:`<div style="font-family:${lk.head};font-size:${Math.round(w/5.4)}px;letter-spacing:.14em;color:${c.head};white-space:nowrap">${esc(lk.mark)}</div>`;
 else if(/^seal/.test(e.k))h=`<div style="width:${w}px;height:${w}px;background:${c.gold};color:${c.ground};font:800 ${Math.round(w*.68)}px/1 'Shippori Mincho',serif;display:flex;align-items:center;justify-content:center">${'佳家嘉'[+e.k[4]-1]}</div>`;
 else if(e.k==='gate')h=`<div style="width:${w}px;height:${w}px;border-radius:50%;border:3px solid ${c.gold};color:${c.head};display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:${lk.head};background:rgba(${rgb(c.ground)},.6)"><span style="font-size:${Math.round(w*.13)}px;letter-spacing:.16em;color:${c.gold}">GATE</span><span style="font-size:${Math.round(w*.44)}px;line-height:1">12</span></div>`;
 else if(e.k==='label')h=`<div style="font-family:${lk.head};font-size:30px;letter-spacing:.16em;color:${c.sup};white-space:nowrap;text-shadow:0 2px 12px rgba(0,0,0,.5)">${esc(e.v||'JOURNEY 04')}</div>`;
 else if(e.k==='rule')h=`<div style="width:${w}px;height:3px;background:${c.gold}"></div>`;
 else if(e.k==='stamp')h=`<div style="width:${w}px;height:${w}px;border-radius:50%;border:3px solid ${c.gold};color:${c.gold};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-family:${lk.head};letter-spacing:.16em;font-size:${Math.round(w*.11)}px;transform:rotate(-8deg);background:rgba(${rgb(c.ground)},.55)"><span>PICKED BY HAND</span><span style="font-size:${Math.round(w*.26)}px;letter-spacing:0">2026</span><span>SPRING</span></div>`;
 else if(e.k==='inset')h=`<div style="width:${w}px;height:${Math.round(w*1.2)}px;border:10px solid ${c.lground};box-shadow:0 20px 50px rgba(0,0,0,.4);overflow:hidden"><img src="${K.photoURI(e.v||'cup')}" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
 else h=`<div style="width:${w}px;height:${Math.round(w*DRAW[e.k][1])}px;color:${c.gold}">${DRAW[e.k][0]}</div>`;
 return `<div class="sx-thing${live&&K.state.ui.ex===i?' on':''}" ${live?`data-ex="${i}"`:''} style="position:absolute;left:${e.x}px;top:${e.y}px" title="${n}">${h}</div>`;}
function fill(id,s,lk,live){const t=T[id];if(!t)return '';const parts=String(s.text||'').split(/\n\s*\n/),part=i=>i===t.t-1?parts.slice(i).join('\n\n'):parts[i]||'',ph=s.ph||[];
 let h=t.h.replace(/<img\b[^>]*src="__IG_PHOTO_(\d+)__"[^>]*>/g,(m,n)=>ph[+n]?`<img src="${K.photoURI(ph[+n])}" alt="" draggable="false" style="${t.ps[+n]||'position:absolute;inset:0;width:100%;height:100%'};object-fit:cover">`:NEED)
  .replace(/__IG_BG_(\d+)__/g,(m,n)=>ph[+n]?`url(&quot;${K.photoURI(ph[+n])}&quot;)`:'none')
  .replace(/__IG_TEXT_(\d+)__/g,(m,n)=>esc(part(+n))).replace(/__IG_LABEL__/g,esc(s.label||'')).replace(/__IG_CREDIT__/g,esc(s.credit||''))
  .replace(/(<div lang="zh-Hant" style="[^"]*">)(<\/div>)/g,(m,a,b)=>a+(s.zh||(/vertical/.test(a)?'茶山':'寒露'))+b);
 return skin(h,lk)+(t.x||[]).map(e=>thing(e,lk,-1,false)).join('')+(s.x||[]).map((e,i)=>thing(e,lk,i,live)).join('');}
const box=(inner,cls='',attr='')=>`<div class="sx ${cls}" ${attr}><div class="sx-in">${inner}</div></div>`;

/* ---------- the Carousel being made (invented words and drawn pictures) ---------- */
const DECK=[
 {tpl:'P06',ph:['shade'],label:'JOURNEY 04',text:'twenty days of shade\n\na morning under the straw'},
 {tpl:'H1',ph:['hands'],text:'“first you watch,” she said.',label:'THE BENCH'},
 {tpl:'P04',ph:['ridge'],text:'the rows sit in a green dusk.'},
 {tpl:'N06',ph:[],need:true,text:'straw breathes. the net only takes the light away.',credit:'MRS. ODA'},
 {tpl:'F03',ph:['mill']},
 {tpl:'N09',ph:['kettle','cup'],text:'the cup she gave me first\n\nit was not her best tea. it was the one she drinks.'},
 {tpl:'M12',ph:[],zh:'壹',label:'PART ONE',text:'the straw\n\nwhy she still lays it by hand'},
 {tpl:'M14',ph:['shade'],label:'DAYS OF SHADE',text:'20\n\nsometimes twenty-two, if the nights stay cold.'},
 {tpl:'P10',ph:['cup'],label:'THE FULL STORY',text:'twenty days of shade',credit:'link in bio'}];
const YOURS=[];
const GEN={
 G1:{n:'Round window',k:'cover',p:1,t:2,ps:['width:100%;height:100%;display:block'],made:'ai',h:`<div style="width: 1080px; height: 1350px; box-sizing: border-box; background: #1a1714; color: #f3eada; font-family: 'EB Garamond', Georgia, serif; position: relative; overflow: hidden"><div style="position:absolute;left:150px;top:110px;width:780px;height:780px;border-radius:50%;overflow:hidden"><img src="__IG_PHOTO_0__" alt="" style=""></div><div style="position:absolute;left:150px;top:110px;width:774px;height:774px;border-radius:50%;border:3px solid #a8874d"></div><div style="position:absolute;left:90px;right:90px;top:960px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px"><div style="font-family: Caudex, Georgia, serif;font-size:30px;letter-spacing:.16em;color:#a8874d">__IG_LABEL__</div><div style="font-family: Caudex, Georgia, serif;font-size:68px;line-height:1.08">__IG_TEXT_0__</div><div style="font-size:34px;line-height:1.4;color:#cdc0a8">__IG_TEXT_1__</div></div></div>`},
 G2:{n:'Three rows',k:'inner',p:3,t:1,ps:['width:100%;height:100%;display:block','width:100%;height:100%;display:block','width:100%;height:100%;display:block'],made:'ai',h:`<div style="width: 1080px; height: 1350px; box-sizing: border-box; background: #f4ece0; color: #18130e; font-family: 'EB Garamond', Georgia, serif; position: relative; overflow: hidden">${[0,1,2].map(i=>`<div style="position:absolute;left:72px;top:${72+i*322}px;width:${[936,700,936][i]}px;height:300px;overflow:hidden"><img src="__IG_PHOTO_${i}__" alt="" style=""></div>`).join('')}<div style="position:absolute;left:800px;top:394px;width:208px;height:300px;display:flex;align-items:center;font-family: Caudex, Georgia, serif;font-size:30px;letter-spacing:.16em;color:#8e6d2e">__IG_LABEL__</div><div style="position:absolute;left:72px;right:72px;top:1070px;bottom:72px;display:flex;align-items:center;font-family: Caudex, Georgia, serif;font-size:56px;line-height:1.1">__IG_TEXT_0__</div></div>`},
 G3:{n:'Corner note',k:'inner',p:1,t:1,ps:['width:100%;height:100%;display:block'],made:'ai',h:`<div style="width: 1080px; height: 1350px; box-sizing: border-box; background: #1a1714; color: #f3eada; font-family: 'EB Garamond', Georgia, serif; position: relative; overflow: hidden"><div style="position:absolute;left:0;top:0;width:1080px;height:1350px;overflow:hidden"><img src="__IG_PHOTO_0__" alt="" style=""></div><div style="position:absolute;left:0;top:0;width:560px;background:#f4ece0;color:#18130e;padding:72px 56px 60px 72px;box-sizing:border-box;display:flex;flex-direction:column;gap:22px"><div style="font-family: Caudex, Georgia, serif;font-size:30px;letter-spacing:.16em;color:#8e6d2e">__IG_LABEL__</div><div style="font-family: Caudex, Georgia, serif;font-size:50px;line-height:1.12">__IG_TEXT_0__</div><div style="font-family: Caudex, Georgia, serif;font-size:30px;letter-spacing:.16em;color:#443a2c">__IG_CREDIT__</div></div><div style="position:absolute;right:72px;bottom:72px;width:96px;height:96px;background:#a8874d;color:#1a1714;font:800 64px/1 'Shippori Mincho',serif;display:flex;align-items:center;justify-content:center">家</div></div>`}};
const S=()=>K.state,ui=()=>K.state.ui;
const lk=()=>lookOf(ui().lk||'tea');
const needI=()=>DECK.findIndex(s=>s.need&&!s.ph[0]);
const sel=()=>{const u=ui();if(u.sl==null||!DECK[u.sl])u.sl=Math.max(0,needI());return +u.sl;};
const role=i=>i===0?'cover':i===DECK.length-1?'close':'inner';
const ROLE={cover:'Cover',inner:'Inner',close:'Close',single:'Single post'};
const OWN=/^(The three jiā|Earlier)/;
const allRows=()=>(YOURS.length?[['Yours',YOURS]]:[]).concat(lk()===LOOKS.tea?ROWS:ROWS.filter(([n])=>!OWN.test(n)));
const rowOf=id=>{const r=allRows().find(([n,ids])=>ids.includes(id));return r?r[0]:'Made with Claude';};
const count=l=>(l||lk())===LOOKS.tea?Object.keys(T).length:Object.keys(T).length-ROWS.filter(([n])=>OWN.test(n)).reduce((a,r)=>a+r[1].length,0);
function suits(i){const r=role(i),s=DECK[i],n=Math.max(1,(s.ph||[]).filter(Boolean).length),near=[DECK[i-1],DECK[i+1]].filter(Boolean).map(x=>x.tpl);
 const pool=allRows().filter(([row])=>!/^Earlier/.test(row)).flatMap(([row,ids])=>ids).filter(id=>lk()===LOOKS.tea||!/zh-Hant/.test(T[id].h)||id==='M12').filter(id=>{const t=T[id];return r==='inner'?(t.k==='inner'||t.k==='single'):(t.k===r||(r==='cover'&&t.k==='single'));});
 return pool.filter(id=>!near.includes(id)).sort((a,b)=>(T[b].mine?1:0)-(T[a].mine?1:0)||Math.abs(T[a].p-n)-Math.abs(T[b].p-n));}
function setTpl(i,id){const s=DECK[i],t=T[id];s.tpl=id;const pool=K.photos.map(p=>p[0]);
 if(s.need&&!s.ph[0]){s.ph=[];return;}
 while(s.ph.length<t.p)s.ph.push(pool.find(k=>!s.ph.includes(k))||'cup');}
const nm=i=>`${i+1} · ${ROLE[role(i)]}`;
const pv=(id,s)=>{const pool=K.photos.map(p=>p[0]),ph=(s.ph||[]).filter(Boolean);while(ph.length<Math.max(1,(T[id]||GEN[id]).p))ph.push(pool.find(k=>!ph.includes(k))||'cup');return {...s,ph,x:[]};};
const thumb=(i,cls='')=>box(fill(DECK[i].tpl,DECK[i],lk()),cls);
const lookChip=(id,act)=>{const l=LOOKS[id];return `<button class="d-lookchip" data-act="${act||'look:'+id}" style="--brc:${l.tint}"><i></i>${esc(l.name)} look</button>`;};

/* ---------- the step inside the subject: the strip, the one thing missing, a few layouts that suit ---------- */
function step(){const u=ui(),i=sel(),s=DECK[i],t=T[s.tpl],need=needI(),sug=suits(i).filter(id=>id!==s.tpl).slice(0,5);
 return `<div class="d-deckbar">${lookChip(u.lk||'tea')}<span>${DECK.length} slides · ${new Set(DECK.map(x=>x.tpl)).size} layouts, no two neighbours alike</span><span class="sp"></span><button class="btn" data-act="mix">Mix the layouts</button><button class="btn pri" data-act="go:slides">Open the slide studio${icon('right')}</button></div>
 <div class="d-strip">${DECK.map((x,j)=>`<button class="d-sl${j===i?' on':''}${j===need?' need':''}" data-act="set:sl:${j}" draggable="true" data-drag="slide:${j}" data-drop="slide:${j}">${thumb(j)}<small>${nm(j)}</small></button>`).join('')}</div>
 <div class="d-slpick"><div><p class="d-label">Slide ${i+1} · ${esc(t.n)}</p>${t.p?`<div class="d-tray pick">${K.photos.map(([k,l])=>`<button data-act="ph:0:${k}" aria-pressed="${s.ph[0]===k}" title="${esc(l)}">${K.pic(k,l)}</button>`).join('')}</div><p class="d-meta">${i===need?'Choose a photograph for this slide.':'Press a photograph to use it here.'}</p>`:'<p class="d-meta">This layout carries no photograph. One slide without words or without a picture lets the others breathe.</p>'}</div>
 <div><p class="d-label">Other layouts that suit slide ${i+1}</p><div class="d-sug5">${sug.map(id=>`<button data-act="tpl:${id}" title="${esc(T[id].n)}">${box(fill(id,pv(id,s),lk()))}</button>`).join('')}<button class="more" data-act="studio:layout"><b>${count()}</b>layouts${icon('right')}</button></div></div></div>`;}

/* ---------- the slide studio ---------- */
function gallery(i){const u=ui(),f=u.gf||'suits',s=DECK[i];
 const cell=id=>`<button class="st-cell" data-act="tpl:${id}" aria-pressed="${s.tpl===id}" title="${esc(T[id].n)}">${box(fill(id,pv(id,s),lk()))}<small>${T[id].made?`<i class="${T[id].made}" aria-hidden="true">${T[id].made==='ai'?'✦':'✎'}</i>`:''}${esc(T[id].n)}</small></button>`;
 const chips=[['suits','Suits this slide'],['all',`All ${count()}`]].concat(YOURS.length?[['yours',`Yours · ${YOURS.length}`]]:[]);
 const body=f==='suits'?`<div class="st-grid">${suits(i).concat(s.tpl).filter((x,j,a)=>a.indexOf(x)===j).sort((a,b)=>(b===s.tpl)-(a===s.tpl)).map(cell).join('')}</div>`
  :allRows().filter(([n])=>f==='all'||n==='Yours').map(([n,ids])=>`<h4>${esc(n)}<span>${ids.length}</span></h4><div class="st-grid">${ids.map(cell).join('')}</div>`).join('');
 return `<div class="d-chips">${chips.map(([k,l])=>`<button data-act="set:gf:${k}" aria-pressed="${f===k}">${l}</button>`).join('')}</div>${body}
 <button class="st-new" data-act="set:sheet:gen"><i aria-hidden="true">✦</i><span><b>Make a new layout</b><small>Describe it, or show a post you like. It is drawn in this look.</small></span></button>`;}
function photos(i){const s=DECK[i],t=T[s.tpl],slot=Math.min(+(ui().slot||0),Math.max(0,t.p-1));
 if(!t.p)return `<p class="d-meta">This layout carries no photograph. Choose another layout to add one, or place an inset picture from Add.</p>`;
 return `<p class="d-label">Places on this slide</p><div class="st-slots">${Array.from({length:t.p},(_,n)=>`<button data-act="set:slot:${n}" aria-pressed="${slot===n}">${s.ph[n]?K.pic(s.ph[n],''):'<span class="pic blank"></span>'}<small>${n+1}</small></button>`).join('')}</div>
 <p class="d-label">This subject’s photographs</p><div class="st-tray">${K.photos.map(([k,l])=>`<button data-act="ph:${slot}:${k}" aria-pressed="${s.ph[slot]===k}" title="${esc(l)}">${K.pic(k,l)}</button>`).join('')}</div>
 <div class="d-row"><button class="btn" data-act="noop">From the Library</button><button class="btn ghost" data-act="noop">Move the crop</button></div><p class="d-meta">The look asks for real photographs, cropped and never stretched.</p>`;}
function add(i){const s=DECK[i],x=s.x||[],l=lk(),tea=l===LOOKS.tea;
 const tile=k=>`<button data-act="thing:${k}"><span class="st-th ${k}">${k==='logo'?(tea?`<img src="${WORDMARK}" alt="">`:`<b style="font-family:${l.head}">${esc(l.mark)}</b>`):/^seal/.test(k)?`<b class="seal">${'佳家嘉'[+k[4]-1]}</b>`:k==='label'?'<b class="lab">LABEL</b>':k==='rule'?'<b class="rule"></b>':k==='stamp'?'<b class="stamp">2026</b>':k==='gate'?'<b class="stamp">12</b>':k==='inset'?K.pic('cup',''):DRAW[k][0]}</span><small>${THINGS[k][0]}</small></button>`;
 return `<p class="d-label">${esc(l.name)}’s logo, marks and graphics</p><div class="st-things" style="--g:${l.c.ground};--a:${l.c.gold};--h:${l.c.head}">${l.things.map(tile).join('')}<button class="up" data-act="noop">${icon('plus')}<small>Bring in a logo, icon or graphic</small></button></div><p class="d-meta">${esc(l.own)} Change the look and these change with it.</p>
 <p class="d-label">For any look</p><div class="st-things" style="--g:${l.c.ground};--a:${l.c.gold};--h:${l.c.head}">${['label','rule','inset'].map(tile).join('')}</div>
 <p class="d-label">On this slide</p>${x.length?`<ul class="st-on">${x.map((y,j)=>`<li class="${ui().ex===j?'on':''}"><button data-act="set:ex:${j}">${THINGS[inLook(y.k,l)][0]}</button><button class="btn ghost" data-act="exsize:${j}:-1" aria-label="Smaller">−</button><button class="btn ghost" data-act="exsize:${j}:1" aria-label="Bigger">+</button><button class="btn ghost" data-act="exdel:${j}" aria-label="Remove">${icon('x')}</button></li>`).join('')}</ul><p class="d-meta">Drag anything you placed to move it on the slide.</p>`:'<p class="d-meta">Nothing placed yet. Press a logo or graphic to put it on the slide, then drag it where you want it.</p>'}`;}
function words(i){const s=DECK[i],t=T[s.tpl],parts=String(s.text||'').split(/\n\s*\n/),n=String(s.text||'').trim().split(/\s+/).filter(Boolean).length;
 const f=(k,l,v)=>`<label class="st-f"><span>${l}</span><span class="d-field" contenteditable="true" data-word="${k}">${esc(v||'')}</span></label>`;
 return `${t.t?Array.from({length:t.t},(_,j)=>f('t'+j,t.t>1?(j===0?'Main line':'Second line'):'The line',parts[j])).join(''):'<p class="d-meta">This layout carries no words. The photograph speaks.</p>'}${/__IG_LABEL__/.test(t.h)?f('label','Small label',s.label):''}${/__IG_CREDIT__/.test(t.h)?f('credit','Who said it',s.credit):''}
 ${t.t?`<p class="d-meta ${n>15&&t.t===1?'warm':''}">${n} words. The look asks for one line of about 15 words, or a paragraph of 40 at most.</p>`:''}
 <div class="d-row"><button class="btn" data-act="noop">${icon('mic')}Say it</button><button class="btn" data-act="noop">Three other lines from the recording</button></div>`;}
function studio(Sx){const u=Sx.ui,i=sel(),s=DECK[i],t=T[s.tpl],tab=u.sp||'layout',need=needI();
 const TABS=[['layout','Layout'],['photos','Photographs'],['add','Add'],['words','Words']];
 return `<div class="d-bar st-bar"><button class="d-backto" data-act="go:subject" data-keep>${icon('back')}<span>The subject</span></button><b class="st-t">Carousel</b><span class="st-n">${DECK.length} slides · posts to Instagram, ${esc(lk().account)} account${need>=0?` · slide ${need+1} needs a photograph`:''}</span><span class="sp"></span>
 <div class="seg st-looks" role="group" aria-label="Look">${['tea','art','mandala'].map(k=>`<button data-act="set:lk:${k}" aria-pressed="${(u.lk||'tea')===k}" style="--brc:${LOOKS[k].tint}"><i></i>${esc(LOOKS[k].name)}</button>`).join('')}</div>
 <button class="btn" data-act="mix" data-keep>Mix the layouts</button><button class="btn pri" data-act="go:subject" data-keep>Done</button></div>
 <div class="st"><ol class="st-film">${DECK.map((x,j)=>`<li><button class="${j===i?'on':''}" data-act="set:sl:${j}" draggable="true" data-drag="slide:${j}" data-drop="slide:${j}" aria-label="Slide ${j+1}">${thumb(j)}<small>${j+1}</small></button></li>`).join('')}<li><button class="addsl" data-act="addslide" aria-label="Add a slide">${icon('plus')}</button></li></ol>
 <section class="st-stage"><div class="d-chips st-looks2">${['tea','art','mandala'].map(k=>`<button data-act="set:lk:${k}" aria-pressed="${(u.lk||'tea')===k}">${esc(LOOKS[k].name)} look</button>`).join('')}</div><div class="st-wrap">${box(fill(s.tpl,s,lk(),true),'stage','data-stage')}</div>
 <div class="st-cap"><span><b>${nm(i)}</b> · ${esc(t.n)}<small>${esc(rowOf(s.tpl))}</small></span><span class="sp"></span><button class="btn ghost" data-act="step:-1" aria-label="Previous layout">${icon('back')}</button><button class="btn ghost" data-act="step:1" aria-label="Next layout">${icon('right')}</button><button class="btn" data-act="set:sheet:gen"><i aria-hidden="true">✦ </i>Make a layout</button><button class="btn" data-act="set:sheet:save">Save as a template</button></div>
 ${u.note?`<p class="d-moved">${icon('check')}<span>${esc(u.note)}</span><button class="btn" data-act="set:note:">Fine</button></p>`:''}</section>
 <aside class="st-panel"><div class="st-tabs" role="tablist">${TABS.map(([k,l])=>`<button role="tab" data-act="set:sp:${k}" aria-selected="${tab===k}">${l}</button>`).join('')}</div>
 <div class="st-body">${tab==='photos'?photos(i):tab==='add'?add(i):tab==='words'?words(i):gallery(i)}</div></aside></div>${sheets(Sx)}`;}
function sheets(Sx){const u=Sx.ui,i=sel(),s=DECK[i],l=lk();
 if(u.sheet==='gen')return `<div class="scrim" data-act="set:sheet:"><div class="sheet st-gen" role="dialog" aria-label="Make a new layout" data-stop><h3>Make a new layout</h3>
 <p class="to">It is drawn inside the ${esc(l.name)} look: its colours, type, logo and rules. Any assistant can add one, because a template is one small file in the look’s folder.</p>
 <div class="d-chips"><button aria-pressed="true" data-act="noop">From words</button><button data-act="noop">From this slide</button><button data-act="noop">From a post I like</button></div>
 <span class="d-field tall" contenteditable="true">A cover with the photograph in a round window and the title under it. One with three wide pictures stacked. One with a small note in the corner and a seal.</span>
 ${u.gen?`<div class="st-made">${Object.keys(GEN).map(id=>`<div>${box(fill2(id,s,l))}<b>${esc(GEN[id].n)}</b><span class="d-row"><button class="btn pri" data-act="genuse:${id}">Use here</button><button class="btn" data-act="gensave:${id}">${T[id]&&YOURS.includes(id)?'Saved':'Save'}</button></span></div>`).join('')}</div><p class="to">Not right? Say what to change and it draws three more.</p><div class="d-row end"><button class="btn lg ghost" data-act="set:sheet:">Close</button><button class="btn lg" data-act="noop">Three more</button></div>`
  :`<div class="d-row end"><button class="btn lg ghost" data-act="set:sheet:">Cancel</button><button class="btn lg pri" data-act="set:gen:1"><i aria-hidden="true">✦ </i>Make three</button></div>`}</div></div>`;
 if(u.sheet==='save')return `<div class="scrim" data-act="set:sheet:"><div class="sheet st-save" role="dialog" aria-label="Save as a template" data-stop><h3>Save as a template</h3><div class="st-saverow">${box(fill(s.tpl,s,l))}<div><label class="to" for="tn">Name</label><span class="field lg" id="tn" contenteditable="true">${esc(T[s.tpl].n)}${(s.x||[]).length?', with '+THINGS[s.x[0].k][0].toLowerCase():', mine'}</span>
 <p class="to">Keeps the layout and anything you placed on it. Words and photographs stay with this Carousel.</p><p class="to">Save for</p><div class="d-chips"><button aria-pressed="true" data-act="noop">${esc(l.name)} only</button><button data-act="noop">Every look</button></div>
 <p class="d-path" title="This is a real folder on disk">Brands / ${esc(l.dir)} / Look / templates</p></div></div><div class="d-row end"><button class="btn lg ghost" data-act="set:sheet:">Cancel</button><button class="btn lg pri" data-act="savetpl">Save template</button></div></div></div>`;
 return '';}
const fill2=(id,s,l)=>{const keep=T[id];T[id]=GEN[id];const ph=(s.ph||[]).slice();const pool=K.photos.map(p=>p[0]);while(ph.length<GEN[id].p)ph.push(pool.find(k=>!ph.includes(k)));const h=fill(id,{...s,ph,label:s.label||'JOURNEY 04',text:s.text||'twenty days of shade',x:[]},l);if(keep)T[id]=keep;else delete T[id];return h;};

/* ---------- looks: one page per brand ---------- */
function look(Sx){const id=Sx.ui.look||'tea',l=LOOKS[id],c=l.c,tabs=`<div class="lk-tabs">${Object.keys(LOOKS).map(k=>`<button data-act="set:look:${k}" aria-pressed="${k===id}" style="--brc:${LOOKS[k].tint}"><i></i>${esc(LOOKS[k].name)}</button>`).join('')}<button class="add" data-act="noop">${icon('plus')}New look</button></div>`;
 const head=`<div class="d-head"><div><h1>Looks</h1><p>One look per brand: its colours, type, logo, graphics and slide templates. Every form in that brand’s folder picks it up by itself.</p></div></div>${tabs}`;
 if(l.empty)return `<main class="d-main lk">${head}<section class="lk-empty"><h2>${esc(l.name)} has no look yet</h2><p>Until it does, its slides borrow the Art look. Three ways to start one:</p><div class="d-ways"><button data-act="noop">${icon('ask')}<b>Answer five questions</b><span>Colours, type, logo, what it must never do.</span></button><button data-act="noop">${icon('photo')}<b>Show three posts you like</b><span>Claude reads the look off them and proposes one.</span></button><button data-act="noop">${icon('layers')}<b>Copy another look</b><span>Start from Teajiā or Art and change it.</span></button></div><p class="d-path" title="This is a real folder on disk">Brands / ${esc(l.dir)} / Look</p></section></main>`;
 const sw=(k,n)=>`<li><i style="background:${c[k]}"></i><span>${n}</span><small>${c[k]}</small></li>`;
 const demo={ph:['shade'],label:'JOURNEY 04',text:id==='tea'?'twenty days of shade':id==='art'?'gold leaf on driftwood':'gate 12, standing still',credit:''};
 const show=['P06','P02','N06','M12','N09','P10'];
 return `<main class="d-main lk">${head}
 <div class="lk-grid"><section class="lk-id"><div class="lk-marks"><div style="background:${c.ground}">${id==='tea'?`<img src="${WORDMARK}" alt="Teajiā wordmark">`:`<b style="font-family:${l.head};color:${c.head}">${esc(l.mark)}</b>`}</div><div style="background:${c.lground}">${id==='tea'?`<img src="${WORDMARK}" alt="" style="filter:brightness(0)">`:`<b style="font-family:${l.head};color:${c.ink}">${esc(l.mark)}</b>`}</div></div>
 <p class="d-path" title="This is a real folder on disk">Brands / ${esc(l.dir)} / Look</p>
 <ul class="lk-files"><li>${icon('note')}<span><b>look.md</b><small>Colours, type and rules, in plain words</small></span></li><li>${icon('photo')}<span><b>logo</b><small>${id==='tea'?'Wordmark, cream and ink':'Wordmark'}</small></span></li><li>${icon('layers')}<span><b>graphics</b><small>${l.things.length-1} marks and drawings</small></span></li><li>${icon('grid')}<span><b>templates</b><small>${id==='tea'?count(l)+' slide layouts':count(l)+' shared layouts, in this look'}</small></span></li></ul>
 <p class="lk-acct">${icon('share')}<span>Posts to <b>Instagram, ${esc(l.account)} account</b>${l.account==='Studio'?'<small>Art, Mandala and Journey share this account. Each keeps its own look.</small>':''}</span></p>
 <p class="d-meta">${l.stand?'A stand-in. Mandala has no look file yet, so these colours are a guess to show the idea.':id==='tea'?'From your Instagram guide and the canvas of 59 layouts.':'From the look your art site already uses.'}</p>
 <div class="d-row"><button class="btn" data-act="noop">${icon('mic')}Change it by talking</button><button class="btn ghost" data-act="noop">Open the folder</button></div>
 <div class="lk-tint"><p class="d-label">Inside ${esc(l.folder)}, the app carries this tint</p><div class="lk-bar"><i></i><b>${esc(l.name)}</b><span class="d-ring" style="--p:.6"></span><span>Create</span><em>${'<i class="s done"></i><i class="s done"></i><i class="s now"></i><i class="s"></i>'}</em></div></div></section>
 <div class="lk-body"><section><h2>Colour</h2><div class="lk-sw"><div><p class="d-label">Dark posts</p><ul>${sw('ground','Ground')}${sw('box','Boxes and bands')}${sw('head','Headlines')}${sw('sup','Supporting words')}${sw('gold','Accent')}</ul></div><div><p class="d-label">Light posts</p><ul>${sw('lground','Ground')}${sw('lbox','Boxes and bands')}${sw('ink','Headlines')}${sw('lsup','Supporting words')}${sw('lgold','Accent')}</ul></div></div></section>
 <section><h2>Type</h2><ul class="lk-type">${l.faces.map(([n,job,ff,eg])=>`<li><span style="font-family:${ff}">${eg}</span><small><b>${n}</b> · ${job}</small></li>`).join('')}</ul></section>
 <section><div class="d-sec-h"><h2>Logo, marks and graphics</h2><span>${l.things.length}</span><span class="sp"></span><button class="d-link" data-act="noop">${icon('plus')}Bring one in</button></div><div class="lk-assets" style="--g:${c.ground};--a:${c.gold};--h:${c.head}">${l.things.map(k=>`<figure><span>${k==='logo'?(id==='tea'?`<img src="${WORDMARK}" alt="">`:`<b style="font-family:${l.head}">${esc(l.mark)}</b>`):/^seal/.test(k)?`<b class="seal">${'佳家嘉'[+k[4]-1]}</b>`:k==='stamp'?'<b class="stamp">2026</b>':k==='gate'?'<b class="stamp">12</b>':DRAW[k][0]}</span><figcaption>${THINGS[k][0]}</figcaption></figure>`).join('')}</div><p class="d-meta">${esc(l.own)}${l.stand||id==='art'?' These drawings are stand-ins until your own are brought in.':' The drawings are stand-ins; the wordmark and seals are yours.'}</p></section>
 <section><h2>Rules Claude follows</h2><ul class="lk-rules">${l.rules.map(r=>`<li>${icon('check')}${r}</li>`).join('')}</ul></section>
 <section><div class="d-sec-h"><h2>Slide templates</h2><span>${count(l)}</span><span class="sp"></span><button class="d-link" data-act="studio:layout">Open them in the slide studio${icon('chev')}</button></div><div class="lk-tpl">${show.map(t=>`<figure>${box(fill(t,{...demo,ph:t==='N09'?['kettle','cup']:t==='M12'?[]:[id==='tea'?'shade':id==='art'?'clay':'spring'],zh:'壹',text:t==='M12'?'the straw\n\nwhy she still lays it by hand':demo.text},l))}<figcaption>${esc(T[t].n)}</figcaption></figure>`).join('')}</div>
 <p class="d-meta">The same layouts, drawn in this look’s colours and type. ${id==='tea'?'The three jiā and the earlier rows belong to Teajiā alone.':'Layouts made for one brand stay with that brand.'}</p></section>
 <section><h2>Used by</h2><div class="lk-used">${['Carousel','Post','Story','Reel cover','Article header','Newsletter'].map(x=>`<span>${x}</span>`).join('')}</div></section></div></div></main>`;}

/* ---------- actions ---------- */
let mixN=0;
K.on('tpl',id=>{setTpl(sel(),id);K.paint(true);});
K.on('ph',(slot,k)=>{const i=sel(),s=DECK[i];s.ph[+slot]=k;if(s.need)ui().pick=k;const t=T[s.tpl],pool=K.photos.map(p=>p[0]);while(s.ph.length<t.p)s.ph.push(pool.find(x=>!s.ph.includes(x))||'cup');K.paint(true);});
K.on('mix',()=>{mixN++;DECK.forEach((s,i)=>{if(i===0||i===DECK.length-1){if(mixN%2===0||i===0){const o=suits(i);setTpl(i,o[(mixN+i)%Math.min(o.length,4)]);}return;}const o=suits(i).slice(0,9);setTpl(i,o[(mixN*3+i*2)%o.length]);});ui().note='A different mix. Every layout is one of yours.';K.paint(true);});
K.on('step',d=>{const i=sel(),o=suits(i),s=DECK[i],at=o.indexOf(s.tpl);setTpl(i,o[(at+(+d)+o.length)%o.length]);K.paint(true);});
K.on('studio',tab=>{ui().sp=tab||'layout';if(tab==='layout')ui().gf='all';location.hash='slides';K.paint();});
K.on('thing',k=>{const i=sel(),s=DECK[i];s.x=s.x||[];const w=THINGS[k][1];const corner=/^seal|gate|chisel|gem|hexagram/.test(k);s.x.push({k,w,x:corner?1008-w-s.x.length*20:Math.round(540-w/2)+s.x.length*24,y:k==='logo'?1180:k==='rule'?900:corner?72+s.x.length*20:480+s.x.length*24});ui().ex=s.x.length-1;K.paint(true);});
K.on('exdel',j=>{DECK[sel()].x.splice(+j,1);ui().ex=null;K.paint(true);});
K.on('exsize',(j,d)=>{const e=DECK[sel()].x[+j];e.w=Math.max(48,Math.round(e.w*(+d>0?1.18:.85)));ui().ex=+j;K.paint(true);});
K.on('addslide',()=>{const i=DECK.length-1;DECK.splice(i,0,{tpl:suits(i)[2]||'F01',ph:['ridge'],text:'a new slide'});ui().sl=i;K.paint(true);});
K.on('genuse',id=>{T[id]=T[id]||GEN[id];setTpl(sel(),id);ui().sheet='';ui().note=`“${GEN[id].n}” is on slide ${sel()+1}. Save it to keep it as a template.`;K.paint(true);});
K.on('gensave',id=>{T[id]=T[id]||GEN[id];T[id].mine=true;if(!YOURS.includes(id))YOURS.unshift(id);K.paint(true);});
K.on('savetpl',()=>{const i=sel(),s=DECK[i],f=document.getElementById('tn'),id='Y'+(YOURS.length+1)+Date.now()%1000,n=(f&&f.textContent.trim())||T[s.tpl].n+', mine';
 T[id]={...T[s.tpl],n,mine:true,made:'you',x:(T[s.tpl].x||[]).concat((s.x||[]).map(e=>({...e})))};YOURS.unshift(id);s.tpl=id;s.x=[];ui().ex=null;ui().sheet='';ui().gf='yours';ui().sp='layout';ui().note=`Saved as “${n}” in Brands / ${lk().dir} / Look / templates. It now shows under Yours.`;K.paint(true);});
K.on('look',id=>{ui().look=id;location.hash='look';K.paint();});
document.addEventListener('focusout',e=>{const t=e.target.closest&&e.target.closest('[data-word]');if(!t)return;const s=DECK[sel()],k=t.dataset.word,v=t.textContent.trim();
 if(k==='label'||k==='credit')s[k]=v;else{const p=String(s.text||'').split(/\n\s*\n/);p[+k[1]]=v;s.text=p.join('\n\n');}K.paint(true);});
/* drag a placed thing on the big slide */
let mv=null;
document.addEventListener('pointerdown',e=>{const t=e.target.closest&&e.target.closest('.sx.stage [data-ex]');if(!t)return;const st=t.closest('.sx'),k=parseFloat(getComputedStyle(st).getPropertyValue('--k'))||.4,it=DECK[sel()].x[+t.dataset.ex];
 mv={t,k,it,sx:e.clientX,sy:e.clientY,x:it.x,y:it.y,i:+t.dataset.ex};t.setPointerCapture&&t.setPointerCapture(e.pointerId);e.preventDefault();});
document.addEventListener('pointermove',e=>{if(!mv)return;mv.it.x=Math.round(Math.max(-40,Math.min(1040,mv.x+(e.clientX-mv.sx)/mv.k)));mv.it.y=Math.round(Math.max(-40,Math.min(1300,mv.y+(e.clientY-mv.sy)/mv.k)));mv.t.style.left=mv.it.x+'px';mv.t.style.top=mv.it.y+'px';});
document.addEventListener('pointerup',()=>{if(!mv)return;const i=mv.i;mv=null;ui().ex=i;ui().sp='add';K.paint(true);});
function fit(){const st=document.querySelector('.sx.stage');if(!st)return;const wide=innerWidth>850,f=document.querySelector('.st-film'),p=document.querySelector('.st-panel'),w=wide?document.querySelector('.st').clientWidth-f.offsetWidth-p.offsetWidth-56:innerWidth-28,h=innerHeight-200,k=Math.max(.2,Math.min(.62,w/1080,wide?h/1350:1));st.style.setProperty('--k',k.toFixed(4));}
addEventListener('resize',fit);
const moveSlide=(from,to)=>{if(from===to)return;const cur=DECK[sel()],it=DECK.splice(from,1)[0];DECK.splice(to,0,it);ui().sl=DECK.indexOf(cur);};
window.SL={T,ROWS,LOOKS,lookOf,fill,box,DECK,step,studio,look,fit,moveSlide,lookChip,count,needI,note:()=>needI()>=0?`Slide ${needI()+1} needs a photograph`:`${DECK.length} of ${DECK.length} ready`};
})();
