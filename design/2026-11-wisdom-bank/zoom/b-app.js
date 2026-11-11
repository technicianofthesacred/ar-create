/* ---------- the map ---------- */
const T0=performance.now(),B=generate(),GEN_MS=performance.now()-T0;
const {T,L,W,cx,cy,ctr,cres,cpar,ckind,nLines,off,adj,ak,al,name:NM}=B;
const $=id=>document.getElementById(id),cv=$('cv'),ctx=cv.getContext('2d'),stage=$('stage'),panel=$('panel');
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])),fmt=n=>n.toLocaleString('en-GB');
const clamp=(v,a,b)=>v<a?a:v>b?b:v,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const NUGGET='https://claude.ai/artifact/KyUE9ZY9bvArEynznJ5p1L';
const KIN=[[PREP|REV,'Comes first'],[PREP,'Leads to'],[EXPL|REV,'Explains it'],[EXPL,'It explains'],[ECHO,'Echoes'],[CONTR,'Contrasts with'],[MINE,'Your line']];
const KNAME=['Lines you ride','Explains','Echoes','Contrasts','Your own lines'];

let Wd=0,Hd=0,dpr=1,ax=0,ay=0,padB=0,padR=0;
let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;for(const t of T){bx0=Math.min(bx0,t.cx-t.r*1.12);by0=Math.min(by0,t.cy-t.r*1.12);bx1=Math.max(bx1,t.cx+t.r*1.12);by1=Math.max(by1,t.cy+t.r*1.12)}
const BW=bx1-bx0,BH=by1-by0,BX=(bx0+bx1)/2,BY=(by0+by1)/2;
const cam={x:BX,y:BY,s:.02};
const voices=new Map();
let mode=0,focus=-1,focusW=-1,level=0,anim=null,vel=null,dirty=true,raf=0,knotOpen=false,pathFrom=-1,path=null,pathMark=null,mark=null,lastWork=-1;
const nar={trad:-1,line:-1,work:-1,minRes:1,kinds:[1,1,1,1,1]},backs=[],pulses=[];
let C={},LC=[];
const store={get(){try{return JSON.parse(localStorage.getItem('wbz1')||'null')}catch(e){return null}},set(v){try{localStorage.setItem('wbz1',JSON.stringify(v))}catch(e){}}};
const saved=store.get()||{},myRes=saved.res||{};for(const k in myRes)if(+k<B.NC)cres[+k]=myRes[k];
let stars=[];const restar=()=>{stars=[];for(let c=0;c<B.NC;c++)if(cres[c]>=5)stars.push(c)};restar();
const stats=window.__wb={gen:GEN_MS,frames:[],counts:{passages:B.NP,concepts:B.NC,works:B.NW,lines:L.length,traditions:B.NT},B,cam};

/* colours come from the page's own tokens, so both themes hold */
function hex(h){h=h.trim();if(h.length===4)h='#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]}
const mix=(a,b,t)=>'rgb('+a.map((v,i)=>Math.round(v*t+b[i]*(1-t))).join(',')+')',rgba=(a,o)=>'rgba('+a.join(',')+','+o+')';
function theme(){const cs=getComputedStyle(document.documentElement),g=k=>hex(cs.getPropertyValue('--'+k));
 C={bg:g('bg'),paper:g('paper'),ink:g('ink'),dim:g('dim'),line:g('line'),line2:g('line2'),warm:g('warm'),ink2:g('ink2')};LC=[0,1,2,3,4,5,6,7].map(i=>g('l'+i));
 C.dot=[0,1,2,3,4].map(r=>mix(C.ink,C.bg,.12+r*.176));C.dot[5]=mix(C.warm,C.bg,1);draw.now()}
const FONT=(w,px)=>w+' '+px+'px "Plus Jakarta Sans",system-ui,sans-serif';

/* ---------- camera ---------- */
const wide=()=>innerWidth>=900,fw=card=>Wd-(card&&wide()?420:0),fh=card=>card&&!wide()?Hd*.56:Hd;
const sAll=()=>Math.min(Wd/(BW*1.02),Hd/(BH*1.02)),sTrad=t=>Math.min(Wd,Hd)/(2*t.r*1.1);
const tradAt=(x,y)=>{for(const t of T)if(Math.hypot(x-t.cx,y-t.cy)<t.r*1.06)return t;return null};
const dotGap=()=>{const t=tradAt(cam.x,cam.y);return(t?t.unit:24)*1.6};
const sF=()=>mode?110/dotGap():2.2;                 // the scale at which one concept is in front of you
const LV=[0,1.02,1.5,2.15];                           // glance, medium, full, as multiples of that scale
const sMax=()=>sF()*2.7;
function sx(x){return(x-cam.x)*cam.s+ax}function sy(y){return(y-cam.y)*cam.s+ay}
function limit(){cam.s=clamp(cam.s,sAll()*.7,sMax());cam.x=clamp(cam.x,bx0,bx1);cam.y=clamp(cam.y,by0,by1)}
function zoomAt(px,py,f){const wx=cam.x+(px-ax)/cam.s,wy=cam.y+(py-ay)/cam.s;cam.s=clamp(cam.s*f,sAll()*.7,sMax());cam.x=wx-(px-ax)/cam.s;cam.y=wy-(py-ay)/cam.s;changed()}
function here(){return{m:mode,x:cam.x,y:cam.y,s:cam.s,line:nar.line,work:nar.work}}
function remember(){backs.push(here());if(backs.length>20)backs.shift();$('back').hidden=false}
function fly(x,y,s,o={}){if(o.jump!==false)remember();s=clamp(s,sAll()*.7,o.max||sMax());const f={x:cam.x,y:cam.y,s:cam.s},far=Math.hypot(x-f.x,y-f.y)*Math.min(f.s,s)/Math.min(Wd,Hd);
 if(reduced||o.instant){cam.x=x;cam.y=y;cam.s=s;if(o.pulse)pulses.push({x,y,t:performance.now()});changed();return}
 anim={t0:performance.now(),dur:420+Math.min(950,far*110+Math.abs(Math.log(s/f.s))*95),f,to:{x,y,s},bump:clamp(Math.log(far+.25)*.5,0,2),pulse:o.pulse};kick()}
function fitBox(x0,y0,x1,y1,o){const s=Math.min((fw(1)-60)/Math.max(x1-x0,1),(fh(1)-70)/Math.max(y1-y0,1));fly((x0+x1)/2,(y0+y1)/2,Math.min(s,sF()*.9),o)}
function goConcept(c,o={}){if(mode){const w=o.w!==undefined?o.w:workFor(c),p=posIn(w,c);lastWork=w;const A=T[W[w].t];fly(p[0],p[1],110/(A.unit*1.6)*(o.lv||LV[1])*1.03,{pulse:true,max:1e3,...o})}else fly(cx[c],cy[c],2.2*(o.lv||LV[1])*1.03,{pulse:true,...o})}
function workFor(c){if(lastWork>=0)for(let i=B.cwOff[c];i<B.cwOff[c+1];i++)if(B.cwWork[i]===lastWork)return lastWork;let b=B.cwWork[B.cwOff[c]],bc=0;for(let i=B.cwOff[c];i<B.cwOff[c+1];i++)if(B.cwCnt[i]>bc){bc=B.cwCnt[i];b=B.cwWork[i]}return b}

/* a work's own map: parts as districts, concepts inside them. Laid out the first time it comes into view. */
const lay=new Map();
function layout(w){let o=lay.get(w);if(o)return o;const ch=B.chap[w],n=ch.length-1,o0=B.wOff[w],A=T[W[w].t],ord=[...Array(n).keys()].sort((a,b)=>(ch[b+1]-ch[b])-(ch[a+1]-ch[a]));
 const pk=pack(ord.map(i=>Math.sqrt(ch[i+1]-ch[i])+.5)),sc=Math.min(A.unit,W[w].r*.93/pk.ext),X_=new Float32Array(n),Y_=new Float32Array(n),R_=new Float32Array(n),px=new Float32Array(W[w].n),py=new Float32Array(W[w].n),idx=new Map();
 ord.forEach((i,k)=>{X_[i]=W[w].x+pk.x[k]*sc;Y_[i]=W[w].y+pk.y[k]*sc;R_[i]=(Math.sqrt(ch[i+1]-ch[i])+.5)*sc*.95;const m=ch[i+1]-ch[i];
  for(let j=0;j<m;j++){const rho=Math.sqrt((j+.5)/m)*R_[i]*.8,a=j*2.39996+i;px[ch[i]+j]=X_[i]+rho*Math.cos(a);py[ch[i]+j]=Y_[i]+rho*Math.sin(a);idx.set(B.wConc[o0+ch[i]+j],ch[i]+j)}});
 o={X:X_,Y:Y_,R:R_,px,py,idx};lay.set(w,o);if(lay.size>400)lay.delete(lay.keys().next().value);return o}
function posIn(w,c){const o=layout(w),k=o.idx.get(c);return[o.px[k],o.py[k]]}
function chapOf(w,c){const k=layout(w).idx.get(c),ch=B.chap[w];for(let i=0;i<ch.length-1;i++)if(k<ch[i+1])return i;return 0}

/* ---------- drawing: only what is in view, and less of it the further away you are ---------- */
let vis=new Int32Array(8192),nv=0,placed=[],hits=[],edgeHits=[],knotAt=null;
const isDim=c=>(nar.trad>=0&&ctr[c]!==nar.trad)||cres[c]<nar.minRes||(mark&&!mark[c])||(pathMark&&!pathMark[c]);
function label(txt,x,y,font,col,o={}){ctx.font=font;const w=ctx.measureText(txt).width,h=o.h||16;let lx=o.center?x-w/2:x;if(o.fit)lx=clamp(lx,8,Math.max(8,Wd-padR-w-8));const r=[lx-4,y-h/2-1,lx+w+4,y+h/2+1];
 if(r[0]<2||r[2]>Wd-padR-2)if(!o.force)return false;
 if(!o.force)for(const p of placed)if(r[0]<p[2]&&r[2]>p[0]&&r[1]<p[3]&&r[3]>p[1])return false;
 placed.push(r);if(o.pill!==false){ctx.fillStyle=rgba(C.bg,o.pill||.78);ctx.fillRect(r[0],r[1],r[2]-r[0],r[3]-r[1])}
 ctx.fillStyle=col;ctx.textBaseline='middle';ctx.fillText(txt,lx,y+.5);return true}
const world=()=>ctx.setTransform(dpr*cam.s,0,0,dpr*cam.s,dpr*(ax-cam.x*cam.s),dpr*(ay-cam.y*cam.s)),screen=()=>ctx.setTransform(dpr,0,0,dpr,0,0);
function draw(){const t0=performance.now();dirty=false;const s=cam.s,x0=cam.x-ax/s,x1=cam.x+(Wd-ax)/s,y0=cam.y-ay/s,y1=cam.y+(Hd-ay)/s;
 screen();ctx.fillStyle=mix(C.bg,C.bg,1);ctx.fillRect(0,0,Wd,Hd);placed=[];hits=[];edgeHits=[];knotAt=null;nv=0;
 const far=1-smooth(sAll()*1.6,sAll()*3.2,s);
 // traditions: regions
 world();for(const t of T){if(t.cx+t.r*1.2<x0||t.cx-t.r*1.2>x1||t.cy+t.r*1.2<y0||t.cy-t.r*1.2>y1)continue;const d=nar.trad>=0&&nar.trad!==t.id;
  ctx.globalAlpha=d?.25:1;ctx.fillStyle=mix(C.paper,C.bg,.35+.65*far);ctx.fill(t.path);ctx.lineWidth=1.2/s;ctx.strokeStyle=mix(C.line2,C.bg,1);ctx.stroke(t.path)}
 ctx.globalAlpha=1;
 if(mode)drawWorks(s,x0,y0,x1,y1,far);else drawConcepts(s,x0,y0,x1,y1,far);
 // far away: names and counts, nothing else
 screen();if(far>.02){ctx.globalAlpha=far;for(const t of T){const X_=sx(t.cx),Y_=sy(t.cy),d=nar.trad>=0&&nar.trad!==t.id;ctx.globalAlpha=far*(d?.3:1);
   label(t.name,X_,Y_-9,FONT(600,13),mix(C.ink,C.bg,1),{center:true,pill:false,force:true});
   label(mode?fmt(t.nW)+' works':fmt(t.nC)+' concepts',X_,Y_+8,FONT(400,11),mix(C.dim,C.bg,1),{center:true,pill:false,force:true});
   if(t.r*s>52)label(mode?fmt(t.nC)+' concepts':t.lines.length+' lines',X_,Y_+22,FONT(400,11),mix(C.dim,C.bg,1),{center:true,pill:false,force:true})}ctx.globalAlpha=1}
 const now=performance.now();for(let i=pulses.length-1;i>=0;i--){const p=pulses[i],k=(now-p.t)/650;if(k>=1){pulses.splice(i,1);continue}
  ctx.beginPath();ctx.arc(p.sx!==undefined?p.sx:sx(p.x),p.sy!==undefined?p.sy:sy(p.y),(p.sx!==undefined?4:10)+k*(p.sx!==undefined?26:44),0,6.283);ctx.strokeStyle=rgba(C.warm,(1-k)*.8);ctx.lineWidth=2;ctx.stroke()}
 const dt=performance.now()-t0;stats.frames.push(dt);if(stats.frames.length>4000)stats.frames.shift();stats.last={ms:dt,drawn:nv,s}}
draw.now=()=>{dirty=true;kick()};

function gather(x0,y0,x1,y1,keep){const {CELL,gc,gr,gOff,gIt}=B,a0=clamp((x0/CELL|0),0,gc-1),a1=clamp((x1/CELL|0)+2,0,gc-1),b0=clamp((y0/CELL|0),0,gr-1),b1=clamp((y1/CELL|0)+2,0,gr-1);
 for(let b=b0;b<=b1;b++)for(let a=a0;a<=a1;a++){const k=a+b*gc;for(let i=gOff[k];i<gOff[k+1];i++){const c=gIt[i];if(keep(c)&&cx[c]>=x0&&cx[c]<=x1&&cy[c]>=y0&&cy[c]<=y1){if(nv>=vis.length){const v=new Int32Array(vis.length*2);v.set(vis);vis=v}vis[nv++]=c}}}}
function drawConcepts(s,x0,y0,x1,y1,far){
 const aL=smooth(sAll()*1.7,sAll()*3,s),aStop=smooth(.15,.26,s),aSat=smooth(.36,.55,s),aSp=smooth(.7,1.05,s),close=smooth(1.5,2.1,s);
 // lines: research topics. A line you narrowed to stays; the rest fade.
 if(aL>0){world();ctx.lineJoin='round';ctx.lineCap='round';
  for(const l of L){const b=l.box;if(b[2]<x0-50||b[0]>x1+50||b[3]<y0-50||b[1]>y1+50)continue;
   const on=nar.line===l.id,d=(nar.line>=0&&!on)||(nar.trad>=0&&l.t!==nar.trad&&l.t2!==nar.trad)||l.res<nar.minRes||!nar.kinds[0]||(nar.work>=0)||pathMark;
   ctx.globalAlpha=aL*(d?.13:(.34+.132*l.res)*(1-close*.35));ctx.strokeStyle=mix(LC[l.col],C.bg,1);ctx.lineWidth=(on?4.5:1.6+l.res*.36)/s*Math.min(1.6,Math.max(1,s*1.4));ctx.setLineDash([]);ctx.stroke(l.path);
   if(l.gapPath){ctx.setLineDash([5/s,6/s]);ctx.stroke(l.gapPath);ctx.setLineDash([])}}
  ctx.globalAlpha=1}
 // the path between two concepts
 if(path&&path.length>1){world();ctx.beginPath();ctx.moveTo(cx[path[0]],cy[path[0]]);for(const c of path)ctx.lineTo(cx[c],cy[c]);ctx.strokeStyle=mix(C.warm,C.bg,1);ctx.lineWidth=5/s;ctx.lineJoin='round';ctx.stroke()}
 screen();
 if(aStop<1){ // far and middle distance: only the brightest points, and where lines cross
  const a=1-aStop;ctx.fillStyle=rgba(C.warm,.85*a);for(const c of stars){if(cx[c]<x0||cx[c]>x1||cy[c]<y0||cy[c]>y1)continue;const z=isDim(c)?1:s<.03?1.6:2.6;ctx.globalAlpha=isDim(c)?.2:1;ctx.fillRect(sx(cx[c])-z/2,sy(cy[c])-z/2,z,z)}ctx.globalAlpha=1;
  if(aL>.5&&s>.035){ctx.strokeStyle=rgba(C.ink,.8*a);ctx.fillStyle=rgba(C.bg,a);ctx.lineWidth=1.3;ctx.beginPath();for(const c of B.isect){if(cx[c]<x0||cx[c]>x1||cy[c]<y0||cy[c]>y1||isDim(c))continue;const X_=sx(cx[c]),Y_=sy(cy[c]);ctx.moveTo(X_+2.6,Y_);ctx.arc(X_,Y_,2.6,0,6.283)}ctx.fill();ctx.stroke()}}
 if(aStop>0){gather(x0-60/s,y0-60/s,x1+60/s,y1+60/s,aSat>0?(()=>true):(c=>cpar[c]<0));
  // spokes: how the gathered concepts hold to their stop. Solid explains, dotted echoes, dashed contrasts.
  if(aSp>0){for(const k of[EXPL,ECHO,CONTR]){ctx.beginPath();for(let i=0;i<nv;i++){const c=vis[i];if(cpar[c]<0||ckind[c]!==k||isDim(c))continue;ctx.moveTo(sx(cx[c]),sy(cy[c]));ctx.lineTo(sx(cx[cpar[c]]),sy(cy[cpar[c]]))}
    ctx.strokeStyle=rgba(C.ink2,aSp*(nar.kinds[k]?.42:.08));ctx.lineWidth=k===ECHO?1.6:1;ctx.setLineDash(k===ECHO?[1.5,4]:k===CONTR?[6,4]:[]);ctx.lineCap=k===ECHO?'round':'butt';ctx.stroke()}ctx.setLineDash([])}
  const zs=clamp(.55+s*.45,.7,1.9);
  for(let r=1;r<=5;r++){ctx.beginPath();for(let i=0;i<nv;i++){const c=vis[i];if(cpar[c]<0||cres[c]!==r||isDim(c))continue;const X_=sx(cx[c]),Y_=sy(cy[c]),q=(1.5+r*.55)*zs;ctx.moveTo(X_+q,Y_);ctx.arc(X_,Y_,q,0,6.283)}ctx.globalAlpha=aSat;ctx.fillStyle=C.dot[r];ctx.fill()}
  ctx.globalAlpha=aSat*.16;ctx.beginPath();for(let i=0;i<nv;i++){const c=vis[i];if(cpar[c]<0||!isDim(c))continue;const X_=sx(cx[c]),Y_=sy(cy[c]);ctx.moveTo(X_+2,Y_);ctx.arc(X_,Y_,2,0,6.283)}ctx.fillStyle=C.dot[2];ctx.fill();
  // stops: rings on the line. Brighter is larger and warmer; an intersection wears a second ring.
  for(const pass of[0,1,2]){ctx.beginPath();for(let i=0;i<nv;i++){const c=vis[i];if(cpar[c]>=0)continue;const d=isDim(c),five=cres[c]>=5;if(pass===0?!d:pass===1?(d||five):(d||!five))continue;const X_=sx(cx[c]),Y_=sy(cy[c]),q=(2.4+cres[c]*.62+(nLines[c]>1?1.2:0))*zs;ctx.moveTo(X_+q,Y_);ctx.arc(X_,Y_,q,0,6.283);if(nLines[c]>1&&s>.5&&!d){ctx.moveTo(X_+q+3.2,Y_);ctx.arc(X_,Y_,q+3.2,0,6.283)}}
   ctx.globalAlpha=aStop*(pass===0?.2:1);ctx.fillStyle=pass===2?C.dot[5]:mix(C.bg,C.bg,1);ctx.fill();ctx.strokeStyle=pass===2?C.dot[5]:mix(C.ink,C.bg,pass===0?.4:.9);ctx.lineWidth=1.6*Math.min(1.3,zs);ctx.stroke()}
  ctx.globalAlpha=1}
 if(focus>=0)drawFocus(s);
 if(path)for(const c of path){ctx.beginPath();ctx.arc(sx(cx[c]),sy(cy[c]),7,0,6.283);ctx.strokeStyle=mix(C.warm,C.bg,1);ctx.lineWidth=2;ctx.stroke()}
 // names: the brightest first, and never one on top of another
 if(aL>.6&&aStop<.9&&s>.03){const ls=[];for(const l of L){const m=l.stops[l.stops.length>>1];if(cx[m]<x0||cx[m]>x1||cy[m]<y0||cy[m]>y1)continue;if(nar.line>=0&&nar.line!==l.id)continue;if(nar.trad>=0&&l.t!==nar.trad)continue;if(l.res<nar.minRes)continue;ls.push(l)}
  ls.sort((a,b)=>b.res-a.res||a.id-b.id);let k=0;ctx.globalAlpha=1-aStop;for(const l of ls){if(k>=(Wd>700?16:7))break;const m=l.stops[l.stops.length>>1];if(label(l.name,sx(cx[m])+8,sy(cy[m]),FONT(l.res>3?600:500,12),mix(LC[l.col],C.bg,1)))k++}ctx.globalAlpha=1}
 if(aStop>.3){const budget=Wd>700?70:26;let k=0,tries=0;if(focus>=0)label(NM[focus],sx(cx[focus]),sy(cy[focus])+24,FONT(600,14),mix(C.ink,C.bg,1),{force:true,pill:.9,center:true,fit:true});
  if(path)for(const c of path)label(NM[c],sx(cx[c])+11,sy(cy[c]),FONT(600,12),mix(C.ink,C.bg,1));
  outer:for(let r=5;r>=1;r--)for(const st of[1,0]){if(!st&&s<1.25)continue;for(let i=0;i<nv;i++){const c=vis[i];if(cres[c]!==r||(cpar[c]<0)!==!!st||c===focus||isDim(c))continue;if(k>=budget||tries++>budget*7)break outer;
   const X_=sx(cx[c]),Y_=sy(cy[c]);if(X_<0||X_>Wd-padR||Y_<0||Y_>Hd-padB)continue;const q=st?9:7,f=FONT(r>=4?600:st?500:400,12),col=mix(r>=5?C.warm:C.ink,C.bg,r>=5?1:.5+r*.12);
   if(label(NM[c],X_+q,Y_,f,col)||label(NM[c],X_,Y_+q+7,f,col,{center:true}))k++}}}}
function drawFocus(s){const c=focus,X_=sx(cx[c]),Y_=sy(cy[c]);let rays=0,kn=-1;
 for(let i=off[c];i<off[c+1];i++){const b=adj[i],k=ak[i]&7,bx=sx(cx[b]),by=sy(cy[b]),on=bx>-40&&bx<Wd-padR+40&&by>-40&&by<Hd-padB+40;
  ctx.setLineDash(k===ECHO?[1.5,5]:k===CONTR||k===MINE?[7,5]:[]);ctx.lineCap=k===ECHO?'round':'butt';ctx.strokeStyle=k===PREP?mix(LC[L[al[i]].col],C.bg,1):k===MINE?mix(C.warm,C.bg,1):mix(C.ink2,C.bg,.9);ctx.lineWidth=k===PREP?4:2;ctx.globalAlpha=nar.kinds[k]?1:.2;
  if(on){ctx.beginPath();ctx.moveTo(X_,Y_);ctx.lineTo(bx,by);ctx.stroke();if(kn<0&&k===PREP)kn=i}
  else if(rays<5){const a=Math.atan2(by-Y_,bx-X_),len=Math.min((Wd-padR)/2-70,(Hd-padB)/2-40)*(.74+.07*rays),ex=X_+Math.cos(a)*len,ey=Y_+Math.sin(a)*len;ctx.beginPath();ctx.moveTo(X_,Y_);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
   if(label(NM[b]+' ›',ex,ey,FONT(500,12),mix(C.ink,C.bg,.85),{center:true,pill:.92,fit:true})){const q=placed[placed.length-1];edgeHits.push({x:(q[0]+q[2])/2,y:ey,c:b})}rays++}}
 ctx.setLineDash([]);ctx.globalAlpha=1;
 ctx.beginPath();ctx.arc(X_,Y_,17,0,6.283);ctx.fillStyle=rgba(C.warm,.2);ctx.fill();ctx.beginPath();ctx.arc(X_,Y_,7.5,0,6.283);ctx.fillStyle=cres[c]>=5?C.dot[5]:mix(C.bg,C.bg,1);ctx.fill();ctx.strokeStyle=mix(C.warm,C.bg,1);ctx.lineWidth=2.5;ctx.stroke();
 if(kn>=0){const b=adj[kn],kx=(X_+sx(cx[b]))/2,ky=(Y_+sy(cy[b]))/2;ctx.save();ctx.translate(kx,ky);ctx.rotate(.785);ctx.fillStyle=mix(C.bg,C.bg,1);ctx.fillRect(-6,-6,12,12);ctx.strokeStyle=mix(C.warm,C.bg,1);ctx.lineWidth=2;ctx.strokeRect(-6,-6,12,12);ctx.restore();knotAt={x:kx,y:ky,i:kn}}}

let seenW=[];
function drawWorks(s,x0,y0,x1,y1,far){screen();const minD=Math.min(Wd-padR,Hd-padB);seenW=[];
 const names=[];
 for(const A of T){if(A.cx+A.r<x0||A.cx-A.r>x1||A.cy+A.r<y0||A.cy-A.r>y1)continue;const td=nar.trad>=0&&nar.trad!==A.id;
  for(let r=1;r<=5;r++){ctx.beginPath();let any=false;for(const i of A.works){const w=W[i];if(w.res!==r||w.x+w.r<x0||w.x-w.r>x1||w.y+w.r<y0||w.y-w.r>y1)continue;const rs=w.r*s,X_=sx(w.x),Y_=sy(w.y);if(rs<2.5){const q=Math.max(1,rs*.8);ctx.rect(X_-q,Y_-q,q*2,q*2)}else{ctx.moveTo(X_+rs,Y_);ctx.arc(X_,Y_,rs,0,6.283)}any=true;seenW.push(i)}
   if(!any)continue;const d=td||r<nar.minRes;ctx.globalAlpha=d?.18:1;ctx.fillStyle=mix(C.paper,C.bg,far>.5?.3:1);ctx.fill();ctx.strokeStyle=r>=5?C.dot[5]:mix(C.ink,C.bg,.16+r*.15);ctx.lineWidth=r>=4?1.8:1.1;ctx.stroke()}}
 ctx.globalAlpha=1;
 for(const i of seenW){const w=W[i],rs=w.r*s,X_=sx(w.x),Y_=sy(w.y),d=(nar.trad>=0&&nar.trad!==w.t)||w.res<nar.minRes;
  if(rs>=60){const o=layout(i),ch=B.chap[i],o0=B.wOff[i],gap=T[w.t].unit*1.6*s;
   ctx.beginPath();for(let k=0;k<ch.length-1;k++){const q=o.R[k]*s;ctx.moveTo(sx(o.X[k])+q,sy(o.Y[k]));ctx.arc(sx(o.X[k]),sy(o.Y[k]),q,0,6.283)}ctx.fillStyle=mix(C.bg,C.paper,.55);ctx.globalAlpha=d?.2:1;ctx.fill();ctx.strokeStyle=mix(C.line2,C.bg,1);ctx.lineWidth=1;ctx.stroke();
   if(gap>7){for(let r=1;r<=5;r++){ctx.beginPath();for(let k=0;k<w.n;k++){const c=B.wConc[o0+k];if(cres[c]!==r)continue;const X2=sx(o.px[k]),Y2=sy(o.py[k]);if(X2<-20||X2>Wd+20||Y2<-20||Y2>Hd+20)continue;const q=clamp(gap*.1,1.6,3+r);ctx.moveTo(X2+q,Y2);ctx.arc(X2,Y2,q,0,6.283);if(r===1)hits.push({c,w:i,x:X2,y:Y2})}ctx.fillStyle=C.dot[r];ctx.fill();
      if(r>1)for(let k=0;k<w.n;k++){const c=B.wConc[o0+k];if(cres[c]===r){const X2=sx(o.px[k]),Y2=sy(o.py[k]);if(X2>-20&&X2<Wd+20&&Y2>-20&&Y2<Hd+20)hits.push({c,w:i,x:X2,y:Y2})}}}
    // a concept other works also hold wears a ring: that is where this map touches theirs
    if(gap>16){ctx.beginPath();for(const h of hits){if(h.w!==i)continue;if(B.cwOff[h.c+1]-B.cwOff[h.c]>1){const q=clamp(gap*.1,1.6,8)+3.5;ctx.moveTo(h.x+q,h.y);ctx.arc(h.x,h.y,q,0,6.283)}}ctx.strokeStyle=rgba(C.ink2,.55);ctx.lineWidth=1;ctx.stroke()}}
   ctx.globalAlpha=1;
   for(let k=0;k<ch.length-1;k++){const q=o.R[k]*s;if(q>46&&q<minD*.7)names.push([4,'Part '+(k+1)+' · '+NM[B.wConc[o0+ch[k]]],sx(o.X[k]),sy(o.Y[k])-q-9,FONT(500,12),mix(C.dim,C.bg,1)])}}
  if(rs>=20&&!d)names.push([rs>=60?6:w.res,w.name,X_,rs>=60?Y_-rs-11:Y_,FONT(w.res>=4||rs>=60?600:500,12),mix(w.res>=5?C.warm:C.ink,C.bg,rs>=60?1:.55+w.res*.1)])}
 if(focusW>=0&&focus<0)drawJoins(s);
 if(focus>=0&&focusW>=0){const p=posIn(focusW,focus),X_=sx(p[0]),Y_=sy(p[1]);ctx.beginPath();ctx.arc(X_,Y_,17,0,6.283);ctx.fillStyle=rgba(C.warm,.2);ctx.fill();ctx.beginPath();ctx.arc(X_,Y_,7.5,0,6.283);ctx.fillStyle=cres[focus]>=5?C.dot[5]:mix(C.bg,C.bg,1);ctx.fill();ctx.strokeStyle=mix(C.warm,C.bg,1);ctx.lineWidth=2.5;ctx.stroke();
  label(NM[focus],X_,Y_+24,FONT(600,14),mix(C.ink,C.bg,1),{force:true,pill:.9,center:true,fit:true})}
 names.sort((a,b)=>b[0]-a[0]);let k=0;for(const n of names){if(k>(Wd>700?60:22))break;if(label(n[1],n[2],n[3],n[4],n[5],{center:true}))k++}
 if(hits.length&&hits.length<900){const gap=dotGap()*s;if(gap>52){const hs=hits.slice().sort((a,b)=>cres[b.c]-cres[a.c]);let q=0;for(const h of hs){if(q>(Wd>700?50:20))break;if(h.c===focus)continue;if(label(NM[h.c],h.x+8,h.y,FONT(cres[h.c]>=4?600:400,12),mix(cres[h.c]>=5?C.warm:C.ink,C.bg,cres[h.c]>=5?1:.5+cres[h.c]*.12)))q++}}}
 nv=seenW.length+hits.length}
function shares(w){const m=new Map();for(let i=B.wOff[w];i<B.wOff[w+1];i++){const c=B.wConc[i];for(let j=B.cwOff[c];j<B.cwOff[c+1];j++){const o=B.cwWork[j];if(o!==w)m.set(o,(m.get(o)||0)+1)}}return[...m].sort((a,b)=>b[1]-a[1])}
function drawJoins(s){const w=W[focusW],X_=sx(w.x),Y_=sy(w.y),sh=shares(focusW).slice(0,7);ctx.strokeStyle=rgba(C.ink2,.6);ctx.lineWidth=1.4;ctx.setLineDash([2,5]);ctx.lineCap='round';
 sh.forEach(([o,n],k)=>{const v=W[o],a=Math.atan2(v.y-w.y,v.x-w.x),bx=sx(v.x),by=sy(v.y),on=bx>30&&bx<Wd-padR-30&&by>30&&by<Hd-padB-30,r0=w.r*s+4;
  const len=on?Math.hypot(bx-X_,by-Y_)-v.r*s:Math.max(r0+18,Math.min(((Wd-padR)/2-12)/Math.abs(Math.cos(a)||1e-6),((Hd-padB)/2-16)/Math.abs(Math.sin(a)||1e-6))-Math.hypot(X_-ax,Y_-ay)),ex=X_+Math.cos(a)*len,ey=clamp(Y_+Math.sin(a)*len,14,Hd-padB-14);
  ctx.beginPath();ctx.moveTo(X_+Math.cos(a)*r0,Y_+Math.sin(a)*r0);ctx.lineTo(ex,ey);ctx.stroke();
  if(!on){ctx.setLineDash([]);if(label(v.name+' · '+n+' ›',ex,ey,FONT(500,12),mix(C.ink,C.bg,.85),{center:true,pill:.92,fit:true})){const q=placed[placed.length-1];edgeHits.push({x:(q[0]+q[2])/2,y:ey,w:o})};ctx.setLineDash([2,5])}});ctx.setLineDash([])}

/* ---------- the loop: draws only when something moved ---------- */
function kick(){if(!raf)raf=requestAnimationFrame(tick)}
function tick(now){raf=0;let again=false;
 if(anim){const t=clamp((now-anim.t0)/anim.dur,0,1),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,f=anim.f,to=anim.to;
  const s=Math.exp(Math.log(f.s)+(Math.log(to.s)-Math.log(f.s))*e-anim.bump*Math.sin(Math.PI*t)),k=(1-e)*(f.s/Math.max(f.s,s));cam.s=s;cam.x=to.x+(f.x-to.x)*k;cam.y=to.y+(f.y-to.y)*k;
  if(t>=1){if(anim.pulse)pulses.push({x:to.x,y:to.y,t:now});anim=null}again=true;dirty=true;derive()}
 if(vel){cam.x-=vel.x/cam.s;cam.y-=vel.y/cam.s;vel.x*=.93;vel.y*=.93;limit();if(Math.abs(vel.x)+Math.abs(vel.y)<.25)vel=null;again=true;dirty=true;derive()}
 if(pulses.length){again=true;dirty=true}
 if(dirty)draw();if(again||dirty)kick()}
let saveT=0;function changed(){limit();derive();dirty=true;kick();clearTimeout(saveT);saveT=setTimeout(()=>store.set({...here(),res:myRes}),400)}

/* ---------- where am I: worked out from the camera, never kept by hand ---------- */
function nearest(){const R_=140/cam.s;let b=-1,bd=R_*R_;const {CELL,gc,gr,gOff,gIt}=B,a0=clamp(((cam.x-R_)/CELL|0)+1,0,gc-1),a1=clamp(((cam.x+R_)/CELL|0)+1,0,gc-1),b0=clamp(((cam.y-R_)/CELL|0)+1,0,gr-1),b1=clamp(((cam.y+R_)/CELL|0)+1,0,gr-1);
 for(let j=b0;j<=b1;j++)for(let a=a0;a<=a1;a++){const k=a+j*gc;for(let i=gOff[k];i<gOff[k+1];i++){const c=gIt[i],d=(cx[c]-cam.x)**2+(cy[c]-cam.y)**2;if(d<bd){bd=d;b=c}}}
 if(focus>=0&&b!==focus){const dc=(cx[focus]-cam.x)**2+(cy[focus]-cam.y)**2;if(dc<R_*R_&&bd>dc*.5)return focus}return b}
let sig='';
function derive(){const f=sF(),s=cam.s;let nf=-1,nw=-1,lv=0;
 if(mode){const A=tradAt(cam.x,cam.y);if(A){let bd=1e30;for(const i of A.works){const w=W[i],d=Math.hypot(w.x-cam.x,w.y-cam.y);if(d<w.r*1.15&&d<bd&&w.r*s>=64){bd=d;nw=i}}}
  if(nw>=0&&s>=f){const o=layout(nw),o0=B.wOff[nw];let bd=(150/s)**2;for(let k=0;k<W[nw].n;k++){const d=(o.px[k]-cam.x)**2+(o.py[k]-cam.y)**2;if(d<bd){bd=d;nf=B.wConc[o0+k]}}}}
 else if(s>=f)nf=nearest();
 if(nf>=0)lv=s>=f*LV[3]?3:s>=f*LV[2]?2:1;
 const A=tradAt(cam.x,cam.y),inT=A&&s>=sTrad(A)*.55?A.id:-1;
 const ns=[mode,nf,nw,lv,inT,nar.line,nar.trad,nar.work,nar.minRes,nar.kinds.join(''),pathFrom,path?path.length:0,knotOpen,s<sAll()*1.5].join('|');
 if(nf!==focus)knotOpen=false;focus=nf;focusW=nw;level=lv;if(nw>=0)lastWork=nw;
 if(ns!==sig){sig=ns;renderTrail(inT);renderPanel();$('shape').hidden=!(s<sAll()*1.5)||!panel.hidden}}
function lineOf(c){if(nar.line>=0)return nar.line;for(let i=off[c];i<off[c+1];i++)if(al[i]>=0)return al[i];return cpar[c]>=0?lineOf(cpar[c]):-1}
function renderTrail(inT){const a=[['bank','Bank']];if(inT>=0)a.push(['t:'+inT,T[inT].name]);
 if(mode){if(focusW>=0){a.push(['w:'+focusW,W[focusW].name]);if(focus>=0){const k=chapOf(focusW,focus);if(B.chap[focusW].length>2)a.push(['ch:'+focusW+':'+k,'Part '+(k+1)]);a.push(['c:'+focus,NM[focus]])}}}
 else{const l=focus>=0?lineOf(focus):nar.line;if(l>=0)a.push(['l:'+l,L[l].name]);if(focus>=0)a.push(['c:'+focus,NM[focus]])}
 let h=a.map((x,i)=>(i?'<i>›</i>':'')+'<button data-go="'+x[0]+'"'+(i===a.length-1?' aria-current="location"':'')+'>'+esc(x[1])+'</button>').join('');
 if(nar.trad>=0)h+='<button class="chip" data-clear="trad">'+esc(T[nar.trad].name)+' only<b>×</b></button>';
 if(nar.line>=0)h+='<button class="chip" data-clear="line">This line only<b>×</b></button>';
 if(nar.work>=0)h+='<button class="chip" data-clear="work">'+esc(W[nar.work].name)+'<b>×</b></button>';
 if(nar.minRes>1)h+='<button class="chip" data-clear="res">Brightness '+nar.minRes+' and up<b>×</b></button>';
 if(nar.kinds.includes(0))h+='<button class="chip" data-clear="kinds">'+nar.kinds.filter(x=>x).length+' kinds of line<b>×</b></button>';
 $('trail').innerHTML=h}

/* ---------- the reading panel ---------- */
function groups(c){const g=new Map();for(let i=off[c];i<off[c+1];i++){let k=ak[i];if((k&7)>=ECHO)k&=7;(g.get(k)||g.set(k,[]).get(k)).push(i)}return g}
const resDots=(v,id)=>'<span class="res" role="group" aria-label="Brightness">'+[1,2,3,4,5].map(i=>'<button data-res="'+i+'" data-id="'+id+'" class="'+(i<=v?'f':'')+'" aria-label="Brightness '+i+'"></button>').join('')+'</span>';
const goRow=(go,nm,sm,r)=>'<button class="go" data-go="'+go+'">'+(r?'<i class="dot" data-r="'+r+'" style="--r:'+r+'"></i>':'')+'<span>'+esc(nm)+'</span>'+(sm?'<small>'+esc(sm)+'</small>':'')+'</button>';
const whereAt=p=>{const w=W[B.pW[p]];return(w.kind==='Book'||w.kind==='Letters'?'page ':'minute ')+B.pAt[p]};
const quote=p=>'<blockquote class="say">'+esc(passage(B,p))+'</blockquote><p class="who">'+esc(W[B.pW[p]].who)+' · '+esc(W[B.pW[p]].name)+' · '+whereAt(p)+'</p>';
function renderPanel(){let h='';const st=panel.scrollTop,was=panel.dataset.key;
 if(focus>=0&&knotOpen&&knotI()>=0)h=knotHTML();
 else if(focus>=0)h=conceptHTML(focus);
 else if(path)h=pathHTML();
 else if(pathFrom>=0)h='<header><div><h2>Path from here</h2><p class="meta">'+esc(NM[pathFrom])+', to the next concept you touch or find</p></div><button class="x" data-act="pathclear" aria-label="Stop">×</button></header>';
 else if(!mode&&nar.line>=0)h=lineHTML(nar.line);
 else if(mode&&focusW>=0)h=workHTML(focusW);
 const key=h?(focus>=0?'c'+focus+(knotOpen?'k':''):path?'p':'o'+nar.line+focusW):'';
 panel.hidden=!h;panel.dataset.level=focus>=0?level:1;panel.dataset.key=key;panel.innerHTML=h;panel.scrollTop=key===was?st:0;measure()}
function conceptHTML(c){const g=groups(c),nb={},np=B.cpOff[c+1]-B.cpOff[c],nw=B.cwOff[c+1]-B.cwOff[c];
 if(g.has(PREP|REV))nb.before=adj[g.get(PREP|REV)[0]];if(g.has(PREP))nb.after=adj[g.get(PREP)[0]];if(g.has(CONTR))nb.against=adj[g.get(CONTR)[0]];
 const d=distil(B,c,nb),l=nar.line>=0&&!mode?L[nar.line].stops:null,at=l?l.indexOf(c):-1;
 let h='<header><div><h2>'+esc(NM[c])+'</h2><p class="meta">'+fmt(np)+' passages in '+nw+(nw>1?' works':' work')+' · '+esc(T[ctr[c]].name)+'</p></div>'+resDots(cres[c],c)+'</header>';
 if(at>=0)h+='<div class="acts" style="margin-top:10px">'+(at>0?'<button class="btn" data-go="c:'+l[at-1]+'">‹ Previous stop</button>':'')+(at<l.length-1?'<button class="btn" data-go="c:'+l[at+1]+'">Next stop ›</button>':'')+'</div>';
 h+='<div class="depth" role="group" aria-label="Depth of the distillation">'+['Glance','Medium','Full'].map((n,i)=>'<button data-lv="'+(i+1)+'" aria-pressed="'+(level===i+1)+'">'+n+'</button>').join('')+'</div>';
 const ps=[];if(mode&&focusW>=0){for(let p=B.cpOff[c];p<B.cpOff[c+1];p++)if(B.pW[p]===focusW)ps.push(p)}else{const seen=new Set();for(let p=B.cpOff[c];p<B.cpOff[c+1]&&ps.length<6;p++)if(!seen.has(B.pW[p])){seen.add(B.pW[p]);ps.push(p)}}
 const mine=k=>(voices.get(c+':'+k)||[]).map(v=>'<p class="mine">'+esc(v)+'<small>You · 11 November</small></p>').join('')+'<button class="voice" data-act="voice" data-sec="'+k+'">Add your voice here</button>';
 h+='<p class="lab">Distillation · '+['Glance','Medium','Full'][level-1]+'</p>';
 if(level===1)h+='<div class="dist"><p>'+esc(d.glance)+'</p></div>';
 else if(level===2)h+='<div class="dist">'+d.medium.map(t=>'<p>'+esc(t)+'</p>').join('')+'</div>'+mine(9);
 else h+=d.full.map((sec,k)=>'<div class="dist sec"><h3>'+sec[0]+'</h3><p>'+esc(sec[1])+'</p></div>'+(k%2===0&&ps[k/2]!==undefined?quote(ps[k/2]):'')+mine(k)).join('');
 if(level>=2){const rest=level===2?ps.slice(0,1):ps.slice(3);if(rest.length)h+='<p class="lab">'+(level===2?'Their words':'More of their words')+'</p>'+rest.map(quote).join('');
  if(level===3&&np>ps.length)h+='<p class="meta">'+fmt(np)+' passages in all, each in its exact words</p>';
  let ki=knotI();for(const[k,title]of KIN){const rows=g.get(k);if(!rows)continue;const kk=k&7,col=kk===PREP?'style="--lc:var(--l'+L[al[rows[0]]].col+')"':'';
   h+='<div class="kin"><p class="kinh"><i class="mk" data-k="'+kk+'" '+col+'></i>'+title+'</p>'+rows.slice(0,level===3?8:4).map(i=>{const b=adj[i],row=goRow('c:'+b,NM[b],ctr[b]!==ctr[c]?T[ctr[b]].name:'',cres[b]);
    return(i===ki?'<div class="gorow">'+row+'<button class="knot" data-act="knot" aria-label="Open this connection"></button></div>':row)+(level===3?'<p class="why">'+esc(k&REV?why(B,b,c,kk):why(B,c,b,kk))+'</p>':'')}).join('')+(rows.length>(level===3?8:4)?'<p class="meta" style="padding:8px 0">and '+(rows.length-(level===3?8:4))+' more</p>':'')+'</div>'}}
 if(level===3){h+='<div class="kin"><p class="kinh">'+(mode?'Also in':'In these works')+'</p>';for(let i=B.cwOff[c],k=0;i<B.cwOff[c+1]&&k<8;i++){const w=B.cwWork[i];if(mode&&w===focusW)continue;h+=goRow('wc:'+w+':'+c,W[w].name,B.cwCnt[i]+(B.cwCnt[i]>1?' passages':' passage'));k++}h+='</div>'}
 h+='<div class="acts"><button class="btn" data-act="respond">Respond</button><button class="btn" data-act="addline">Add to a line</button><button class="btn" data-act="pathfrom" aria-pressed="'+(pathFrom===c)+'">Path from here</button>'+
  (mode?'<button class="btn" data-act="tomap">On the concept map</button>':'<button class="btn" data-act="toworks">In '+(nw>1?'its '+nw+' works':'its work')+'</button>')+(level===3?'<a class="btn" href="'+NUGGET+'" target="_blank" rel="noopener">Open the full reading</a>':'')+'</div><div id="slot"></div>';
 return h}
function knotI(){if(focus<0||mode)return-1;for(let i=off[focus];i<off[focus+1];i++)if((ak[i]&7)===PREP)return i;return-1}
function knotHTML(){const i=knotI(),c=focus,b=adj[i],rev=ak[i]&REV,a1=rev?b:c,b1=rev?c:b,r=rng(c*97+b),l=L[Math.floor(r()*L.length)],k=Math.floor(r()*(l.stops.length-1)),p=l.stops[k],q=l.stops[k+1];
 return'<header><div><p class="kinh"><i class="mk" data-k="0" style="--lc:var(--l'+L[al[i]].col+')"></i>A connection</p><h2 style="margin-top:6px">'+esc(NM[a1])+'</h2><p class="meta" style="margin:4px 0">comes before</p><h2>'+esc(NM[b1])+'</h2></div><button class="x" data-act="knotclose" aria-label="Close">×</button></header>'+
 '<p class="lab">Why</p><p>'+esc(why(B,a1,b1,PREP))+'</p><p class="lab">Your words on it</p><input class="field" id="knotwords" aria-label="Your words on this connection">'+
 '<p class="lab">The same pattern elsewhere</p><div class="kin" style="margin-top:8px">'+goRow('c:'+p,NM[p]+', then: '+NM[q],T[ctr[p]].name)+'</div>'}
function lineHTML(id){const l=L[id],cr=new Map();for(const c of l.stops)for(let i=off[c];i<off[c+1];i++)if(al[i]>=0&&al[i]!==id)cr.set(al[i],c);
 let h='<header><div><p class="kinh"><i class="mk" data-k="0" style="--lc:var(--l'+l.col+')"></i>Research topic</p><h2 style="margin-top:6px">'+esc(l.name)+'</h2><p class="meta">'+l.stops.length+' stops · '+esc(T[l.t].name)+(l.t2>=0?' to '+esc(T[l.t2].name):'')+'</p></div>'+resDots(l.res,'l'+id)+'</header>';
 h+='<div class="acts"><button class="btn main" data-go="c:'+l.stops[0]+'">Ride from the first stop</button><button class="btn" data-clear="line">Show every line</button></div>';
 if(l.gap>=0)h+='<div class="kin"><p class="kinh"><i class="mk" data-k="3"></i>A missing step</p>'+goRow('c:'+l.stops[l.gap],'Between \u201c'+NM[l.stops[l.gap]]+'\u201d and \u201c'+NM[l.stops[l.gap+1]]+'\u201d','')+'<div class="acts" style="margin-top:10px"><button class="btn" data-act="question">Make it a question</button></div></div>';
 if(cr.size){h+='<div class="kin"><p class="kinh">Crosses</p>';let k=0;for(const[o,c]of cr){if(k++>=6)break;h+='<button class="go" data-go="l:'+o+'"><i class="mk" data-k="0" style="--lc:var(--l'+L[o].col+')"></i><span>'+esc(L[o].name)+'</span><small>at '+esc(NM[c])+'</small></button>'}h+='</div>'}
 return h}
function workHTML(w){const o=W[w],np=(()=>{let s=0;for(let i=B.wOff[w];i<B.wOff[w+1];i++)s+=B.wCnt[i];return s})(),sh=shares(w),parts=B.chap[w].length-1;
 let h='<header><div><p class="kinh">'+o.kind+'</p><h2 style="margin-top:4px">'+esc(o.name)+'</h2><p class="meta">'+esc(o.who)+' · '+o.n+' concepts'+(parts>1?' in '+parts+' parts':'')+' · '+fmt(np)+' passages</p></div></header>';
 h+='<div class="acts"><button class="btn main" data-act="workonmap">Its concepts on the concept map</button></div>';
 if(sh.length){h+='<div class="kin"><p class="kinh"><i class="mk" data-k="2"></i>Shares concepts with</p>'+sh.slice(0,5).map(([i,n])=>goRow('w:'+i,W[i].name,n+' shared',W[i].res)).join('')+'</div>'}
 return h}
function pathHTML(){let h='<header><div><h2>A path of '+(path.length-1)+' steps</h2></div><button class="x" data-act="pathclear" aria-label="Clear the path">×</button></header><div class="kin">';
 path.forEach((c,k)=>{let kk=-1,col='';if(k)for(let i=off[c];i<off[c+1];i++)if(adj[i]===path[k-1]){kk=ak[i]&7;if(kk===PREP)col='style="--lc:var(--l'+L[al[i]].col+')"'}
  h+='<button class="go" data-go="c:'+c+'">'+(k?'<i class="mk" data-k="'+kk+'" '+col+'></i>':'<i class="dot" data-r="5" style="--r:5"></i>')+'<span>'+esc(NM[c])+'</span><small>'+esc(T[ctr[c]].name)+'</small></button>'});
 return h+'</div>'}
function findPath(a,b){const prev=new Int32Array(B.NC).fill(-1),q=new Int32Array(B.NC);let h=0,t=0;q[t++]=a;prev[a]=a;while(h<t){const c=q[h++];if(c===b)break;for(let i=off[c];i<off[c+1];i++){const n=adj[i];if(prev[n]<0){prev[n]=c;q[t++]=n}}}
 if(prev[b]<0)return null;const p=[b];while(p[0]!==a)p.unshift(prev[p[0]]);return p}
function setPath(b){const p=findPath(pathFrom,b);pathFrom=-1;if(!p){path=null;pathMark=null;toast('No path between them yet');sig='';changed();return}
 path=p;pathMark=new Uint8Array(B.NC);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const c of p){pathMark[c]=1;x0=Math.min(x0,cx[c]);y0=Math.min(y0,cy[c]);x1=Math.max(x1,cx[c]);y1=Math.max(y1,cy[c])}
 if(mode)setMode(0,true);sig='';fitBox(x0-150,y0-150,x1+150,y1+150)}
function toast(t){const s=$('shape');s.textContent=t;s.hidden=false;setTimeout(shape,2200)}
function shape(){$('shape').textContent=fmt(B.NT)+' traditions · '+fmt(L.length)+' lines · '+fmt(B.NC)+' concepts · '+fmt(B.NW)+' works · '+fmt(B.NP)+' passages'}

/* ---------- narrowing: the rest fades, it never vanishes ---------- */
function setMark(){mark=null;if(nar.line>=0){mark=new Uint8Array(B.NC);for(const c of L[nar.line].stops){mark[c]=1;for(let i=off[c];i<off[c+1];i++)if(cpar[adj[i]]===c)mark[adj[i]]=1}}
 else if(nar.work>=0){mark=new Uint8Array(B.NC);for(let i=B.wOff[nar.work];i<B.wOff[nar.work+1];i++)mark[B.wConc[i]]=1}}
function narrowLine(id,o){nar.line=id;nar.work=-1;setMark();sig='';const b=L[id].box;fitBox(b[0]-120,b[1]-120,b[2]+120,b[3]+120,o)}
function clearNar(k){if(k==='trad')nar.trad=-1;if(k==='line')nar.line=-1;if(k==='work')nar.work=-1;if(k==='res')nar.minRes=1;if(k==='kinds')nar.kinds=[1,1,1,1,1];setMark();sig='';renderNarrow();changed()}
function renderNarrow(){const el=$('narrow');if(el.hidden)return;
 el.innerHTML='<p class="lab">Brightness, from</p>'+resDots(nar.minRes,'min')+'<p class="lab">Kinds of line</p>'+KNAME.map((n,k)=>'<button class="tog" data-kind="'+k+'" aria-pressed="'+!!nar.kinds[k]+'"><i class="mk" data-k="'+k+'"></i>'+n+'</button>').join('')+
 '<p class="lab">Tradition</p><div class="chips">'+T.map(t=>'<button data-trad="'+t.id+'" aria-pressed="'+(nar.trad===t.id)+'">'+esc(t.name)+'</button>').join('')+'</div>'+
 (nar.line>=0?'<p class="lab">Line</p><div class="chips"><button data-clear="line" aria-pressed="true">'+esc(L[nar.line].name)+' ×</button></div>':'<p class="lab">Line</p><p class="meta">Touch a line on the map</p>')}
$('narrowBtn').onclick=()=>{const el=$('narrow');el.hidden=!el.hidden;$('narrowBtn').setAttribute('aria-expanded',!el.hidden);$('results').hidden=true;renderNarrow()};
$('narrow').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.res){nar.minRes=+b.dataset.res===nar.minRes?1:+b.dataset.res}else if(b.dataset.kind){nar.kinds[+b.dataset.kind]^=1}else if(b.dataset.trad){const t=+b.dataset.trad;nar.trad=nar.trad===t?-1:t;if(nar.trad>=0){const A=T[t];fly(A.cx,A.cy,sTrad(A))}}else if(b.dataset.clear){clearNar(b.dataset.clear);return}
 sig='';renderNarrow();changed()};

/* ---------- honing in: a feeling or a name, and the map flies there ---------- */
const STOP=new Set('is the a an of and to in on i it my me that this are be how what why with for'.split(' '));
function search(q){const tk=q.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>1&&!STOP.has(w)).map(w=>w.length>5?w.slice(0,w.length-2):w);if(!tk.length)return null;
 const sc=s=>{let m=0;for(const t of tk)if(s.includes(t))m++;return m},top=(n,arr)=>arr.sort((a,b)=>b[0]-a[0]).slice(0,n);
 const cs=[],low=B.low;for(let c=0;c<B.NC;c++){const m=sc(low[c]);if(m)cs.push([m*10+cres[c]-low[c].length*.02,c])}
 const ls=[];for(const l of L){const m=sc(l.name.toLowerCase());if(m)ls.push([m*10+l.res,l.id])}
 const ws=[];for(const w of W){const m=sc(w.name.toLowerCase());if(m)ws.push([m*10+w.res+w.n*.01,w.id])}
 const ts=[];for(const t of T){const m=sc(t.name.toLowerCase());if(m)ts.push([m,t.id])}
 return{c:top(6,cs),l:top(3,ls),w:top(3,ws),t:ts,n:cs.length}}
let found=null;
$('q').oninput=()=>{const q=$('q').value,el=$('results');found=search(q);$('narrow').hidden=true;$('narrowBtn').setAttribute('aria-expanded',false);
 if(!found||!(found.c.length+found.l.length+found.w.length+found.t.length)){el.hidden=!q.trim();el.innerHTML=q.trim()?'<p class="rh meta">Nothing by that name yet</p>':'';return}
 let h='';if(found.t.length)h+=found.t.map(x=>'<button class="row" data-go="t:'+x[1]+'"><span>'+esc(T[x[1]].name)+'</span><small>Tradition</small></button>').join('');
 if(found.c.length)h+='<p class="rh lab">Concepts · '+fmt(found.n)+'</p>'+found.c.map(x=>'<button class="row" data-go="c:'+x[1]+'"><i class="dot" data-r="'+cres[x[1]]+'" style="--r:'+cres[x[1]]+'"></i><span>'+esc(NM[x[1]])+'</span><small>'+esc(T[ctr[x[1]]].name)+'</small></button>').join('');
 if(found.l.length)h+='<p class="rh lab">Lines</p>'+found.l.map(x=>'<button class="row" data-go="l:'+x[1]+'"><i class="mk" data-k="0" style="--lc:var(--l'+L[x[1]].col+')"></i><span>'+esc(L[x[1]].name)+'</span><small>'+L[x[1]].stops.length+' stops</small></button>').join('');
 if(found.w.length)h+='<p class="rh lab">Works</p>'+found.w.map(x=>'<button class="row" data-go="w:'+x[1]+'"><span>'+esc(W[x[1]].name)+'</span><small>'+W[x[1]].n+' concepts</small></button>').join('');
 el.innerHTML=h;el.hidden=false};
$('askf').onsubmit=e=>{e.preventDefault();const b=$('results').querySelector('[data-go]');if(b)go(b.dataset.go,true)};
$('results').onclick=e=>{const b=e.target.closest('[data-go]');if(b)go(b.dataset.go,true)};
function closeSearch(){$('results').hidden=true;$('q').value='';$('q').blur()}

/* ---------- going places ---------- */
function setMode(m,quiet){if(mode===m)return;mode=m;for(const b of $('mode').children)b.setAttribute('aria-pressed',+b.dataset.m===m);sig='';if(!quiet){cv.classList.add('swap');setTimeout(()=>cv.classList.remove('swap'),140)}}
function go(g,fromSearch){const[k,a,b]=g.split(':'),id=+a;if(fromSearch)closeSearch();
 if(k==='bank'){nar.line=-1;nar.work=-1;setMark();fly(BX,BY,sAll())}
 else if(k==='t'){nar.line=-1;nar.work=-1;setMark();sig='';const A=T[id];fly(A.cx,A.cy,sTrad(A))}
 else if(k==='l'){if(mode)setMode(0);narrowLine(id)}
 else if(k==='w'){if(!mode)setMode(1);const w=W[id];lastWork=id;fly(w.x,w.y,Math.min(fw(1),fh(1))/(2*w.r*1.22),{pulse:true,max:1e3})}
 else if(k==='ch'){const o=layout(id),i=+b;fly(o.X[i],o.Y[i],Math.min(fw(1),fh(1))/(2*o.R[i]*1.3),{max:1e3})}
 else if(k==='wc'){if(!mode)setMode(1);lastWork=id;goConcept(+b,{w:id})}
 else if(k==='c'){if(pathFrom>=0&&pathFrom!==id){setPath(id);return}if(id===focus&&!fromSearch){knotOpen=false;sig='';derive();return}if(!mode&&mark&&!mark[id]){nar.line=-1;nar.work=-1;setMark();sig=''}goConcept(id,{lv:level>1?LV[level]:0})}}
function toggleMode(m){if(m===mode)return;remember();const c=focus,w=focusW,lv=level;setMode(m);
 if(c>=0)goConcept(c,{jump:false,instant:true,lv:LV[lv],w:m?workFor(c):undefined});
 else if(!m&&w>=0){nar.work=w;nar.line=-1;setMark();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=B.wOff[w];i<B.wOff[w+1];i++){const k=B.wConc[i];if(ctr[k]!==W[w].t)continue;x0=Math.min(x0,cx[k]);y0=Math.min(y0,cy[k]);x1=Math.max(x1,cx[k]);y1=Math.max(y1,cy[k])}fitBox(x0-100,y0-100,x1+100,y1+100,{jump:false,instant:true})}
 else{nar.work=-1;if(m)nar.line=-1;setMark();cam.s=Math.min(cam.s,sF()*.9);changed()}}
$('mode').onclick=e=>{const b=e.target.closest('button');if(b)toggleMode(+b.dataset.m)};
$('trail').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.clear)clearNar(b.dataset.clear);else if(b.hasAttribute('aria-current')&&b.dataset.go[0]==='c')return;else go(b.dataset.go)};
$('back').onclick=()=>{const p=backs.pop();if(!p)return;$('back').hidden=!backs.length;setMode(p.m);nar.line=p.line;nar.work=p.work;setMark();sig='';fly(p.x,p.y,p.s,{jump:false,max:1e3})};
$('zin').onclick=()=>fly(cam.x,cam.y,cam.s*1.9,{jump:false});$('zout').onclick=()=>fly(cam.x,cam.y,cam.s/1.9,{jump:false});
panel.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.go){go(d.go);return}if(d.clear){clearNar(d.clear);return}
 if(d.lv){fly(cam.x,cam.y,sF()*LV[+d.lv]*1.03,{jump:false});return}
 if(d.res){const v=+d.res;if(d.id[0]==='l'){L[+d.id.slice(1)].res=v}else{cres[+d.id]=v;myRes[d.id]=v;restar()}pulses.push({sx:ax,sy:ay,t:performance.now()});sig='';changed();return}
 const slot=$('slot');
 if(d.act==='respond')slot.innerHTML='<p class="lab" style="margin-top:20px">Your response</p><textarea id="resp" aria-label="Your response" style="margin-top:8px"></textarea><div class="acts" style="margin-top:10px"><button class="btn main" data-act="keep">Keep</button></div>',$('resp').focus();
 else if(d.act==='keep'){const c=focus;cres[c]=Math.min(5,cres[c]+1);myRes[c]=cres[c];restar();slot.innerHTML='<p class="good" style="margin-top:14px">Kept. It shines a little brighter.</p>';dirty=true;kick()}
 else if(d.act==='addline'){const ls=new Set();for(let i=off[focus];i<off[focus+1];i++){const n=adj[i];for(let j=off[n];j<off[n+1];j++)if(al[j]>=0)ls.add(al[j])}
  slot.innerHTML='<div class="kin">'+[...ls].slice(0,3).map(l=>'<button class="go" data-act="added"><i class="mk" data-k="0" style="--lc:var(--l'+L[l].col+')"></i><span>'+esc(L[l].name)+'</span></button>').join('')+'<button class="go" data-act="added"><span>A new line</span></button></div>'}
 else if(d.act==='voice'){const k=d.sec;b.outerHTML='<form class="vf" data-sec="'+k+'"><input class="field" id="voice'+k+'" aria-label="Your voice" placeholder="Say or type it"><button class="btn main">Keep</button></form>';$('voice'+k).focus()}
 else if(d.act==='added')slot.innerHTML='<p class="good" style="margin-top:14px">Added to '+esc(b.textContent)+'</p>';
 else if(d.act==='question')b.outerHTML='<p class="good">Kept as a question</p>';
 else if(d.act==='pathfrom'){path=null;pathMark=null;pathFrom=pathFrom===focus?-1:focus;sig='';if(pathFrom>=0)fly(cam.x,cam.y,cam.s*.45,{jump:false});else changed()}
 else if(d.act==='pathclear'){path=null;pathMark=null;pathFrom=-1;sig='';changed()}
 else if(d.act==='toworks')toggleMode(1);else if(d.act==='tomap')toggleMode(0);else if(d.act==='workonmap')toggleMode(0);
 else if(d.act==='knot'){knotOpen=true;sig='';derive()}else if(d.act==='knotclose'){knotOpen=false;sig='';derive()}
 measure()};

panel.addEventListener('submit',e=>{e.preventDefault();const f=e.target,v=f.querySelector('input').value.trim();if(!v||!f.dataset.sec)return;const k=focus+':'+f.dataset.sec;voices.set(k,(voices.get(k)||[]).concat(v));renderPanel()});
/* ---------- touch: drag, pinch, wheel, momentum, and an answer to every tap ---------- */
const pts=new Map();let moved=0,downT=0,lastTap=0,samples=[],pinch=0;
function ptDown(e){if(e.target===cv)cv.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});anim=null;vel=null;if(pts.size===1){moved=0;downT=e.timeStamp;samples=[]}else pinch=0;$('results').hidden=true;if(document.activeElement===$('q'))$('q').blur()}
function ptMove(e){const p=pts.get(e.pointerId);if(!p)return;const r=cv.getBoundingClientRect(),dx=e.clientX-p.x,dy=e.clientY-p.y;
 if(pts.size===1&&e.target===cv){moved+=Math.abs(dx)+Math.abs(dy);cam.x-=dx/cam.s;cam.y-=dy/cam.s;samples.push([e.timeStamp,dx,dy]);if(samples.length>6)samples.shift();p.x=e.clientX;p.y=e.clientY;changed()}
 else if(pts.size===2){p.x=e.clientX;p.y=e.clientY;const[a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;moved=99;
  if(pinch){if(e.target===cv){cam.x-=(mx-pinch.mx)/cam.s;cam.y-=(my-pinch.my)/cam.s;zoomAt(mx,my,d/pinch.d)}else zoomAt(ax,ay,d/pinch.d)}pinch={d,mx,my}}}
function ptUp(e){const p=pts.get(e.pointerId);if(!p)return;const n=pts.size;pts.delete(e.pointerId);pinch=0;if(n!==1||e.target!==cv)return;const r=cv.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 if(moved<9&&e.timeStamp-downT<400){if(e.timeStamp-lastTap<300){lastTap=0;anim=null;const wx=cam.x+(x-ax)/cam.s,wy=cam.y+(y-ay)/cam.s;fly(wx,wy,cam.s*2.4,{jump:false})}else{lastTap=e.timeStamp;tap(x,y)}return}
 const rec=samples.filter(s=>e.timeStamp-s[0]<90);if(rec.length>1&&!reduced){let vx=0,vy=0;for(const s of rec){vx+=s[1];vy+=s[2]}const dt=Math.max(16,rec[rec.length-1][0]-rec[0][0]+8);vel={x:vx/dt*16,y:vy/dt*16};kick()}}
cv.addEventListener('pointerdown',ptDown);cv.addEventListener('pointermove',ptMove);cv.addEventListener('pointerup',ptUp);cv.addEventListener('pointercancel',e=>{pts.delete(e.pointerId);pinch=0});
panel.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){pts.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0}});panel.addEventListener('pointermove',e=>{if(pts.size===2)ptMove(e)});for(const t of['pointerup','pointercancel','pointerleave'])panel.addEventListener(t,e=>{pts.delete(e.pointerId);pinch=0});
stage.addEventListener('wheel',e=>{if(e.target!==cv)return;e.preventDefault();anim=null;vel=null;const r=cv.getBoundingClientRect();zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*(e.ctrlKey?.012:.0016)))},{passive:false});
addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const k=e.key,st=80/cam.s;if(k==='+'||k==='=')$('zin').click();else if(k==='-')$('zout').click();else if(k==='ArrowLeft'){cam.x-=st;changed()}else if(k==='ArrowRight'){cam.x+=st;changed()}else if(k==='ArrowUp'){cam.y-=st;changed()}else if(k==='ArrowDown'){cam.y+=st;changed()}
 else if(k==='Escape'){const b=$('trail').querySelectorAll('button[data-go]');if(b.length>1)b[b.length-2].click()}});
function tap(x,y){pulses.push({sx:x,sy:y,t:performance.now()});kick();const wx=cam.x+(x-ax)/cam.s,wy=cam.y+(y-ay)/cam.s,s=cam.s;
 for(const h of edgeHits)if(Math.abs(h.x-x)<70&&Math.abs(h.y-y)<16){if(h.w!==undefined)go('w:'+h.w);else go('c:'+h.c);return}
 if(knotAt&&Math.hypot(knotAt.x-x,knotAt.y-y)<20){knotOpen=true;sig='';derive();return}
 if(mode){let b=null,bd=24*24;for(const h of hits){const d=(h.x-x)**2+(h.y-y)**2;if(d<bd){bd=d;b=h}}if(b){lastWork=b.w;go('wc:'+b.w+':'+b.c);return}
  for(const i of seenW){const w=W[i];if(Math.hypot(w.x-wx,w.y-wy)<Math.max(w.r,10/s)){if(w.r*s<Math.min(Wd-padR,Hd-padB)*.3){go('w:'+i);return}
    const o=layout(i);for(let k=0;k<o.R.length;k++)if(Math.hypot(o.X[k]-wx,o.Y[k]-wy)<o.R[k]&&o.R[k]*s<Math.min(Wd-padR,Hd-padB)*.3){go('ch:'+i+':'+k);return}return}}}
 else{if(s>.2){let b=-1,bd=24*24;for(let i=0;i<nv;i++){const c=vis[i],d=(sx(cx[c])-x)**2+(sy(cy[c])-y)**2;if(d<bd&&(cpar[c]<0||s>.5)){bd=d;b=c}}if(b>=0){go('c:'+b);return}}
  if(s>sAll()*2.4){let b=-1,bd=14/s;for(const l of L){const q=l.box;if(wx<q[0]-bd||wx>q[2]+bd||wy<q[1]-bd||wy>q[3]+bd)continue;for(let k=1;k<l.stops.length;k++){const a=l.stops[k-1],c=l.stops[k],d=segD(wx,wy,cx[a],cy[a],cx[c],cy[c]);if(d<bd){bd=d;b=l.id}}}
   if(b>=0){if(nar.line===b){fly(wx,wy,Math.max(s*2,.5),{jump:false})}else narrowLine(b);return}}}
 const A=tradAt(wx,wy);if(A&&s<sTrad(A)*.7)go('t:'+A.id)}
function segD(px,py,ax_,ay_,bx,by){const dx=bx-ax_,dy=by-ay_,t=clamp(((px-ax_)*dx+(py-ay_)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-ax_-dx*t,py-ay_-dy*t)}

/* ---------- size, start ---------- */
function measure(){const wd=wide(),nb=panel.hidden||wd?0:panel.offsetHeight,nr=!panel.hidden&&wd?420:0;if(nb!==padB||nr!==padR){padB=nb;padR=nr;ax=(Wd-padR)/2;ay=(Hd-padB)/2;dirty=true;kick()}
 $('back').style.bottom=(padB+14)+'px'}
function resize(){const r=stage.getBoundingClientRect();Wd=r.width;Hd=r.height;dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(Wd*dpr);cv.height=Math.round(Hd*dpr);ax=(Wd-padR)/2;ay=(Hd-padB)/2;measure();changed()}
for(const t of T){const p=new Path2D();for(let k=0;k<=48;k++){const a=k/48*6.2832,r=t.r*(1.05+.035*Math.sin(a*3+t.ph)+.025*Math.sin(a*5+t.ph2));k?p.lineTo(t.cx+Math.cos(a)*r,t.cy+Math.sin(a)*r):p.moveTo(t.cx+Math.cos(a)*r,t.cy+Math.sin(a)*r)}p.closePath();t.path=p}
for(const l of L){const p=new Path2D();l.stops.forEach((c,k)=>{if(!k||k-1===l.gap)p.moveTo(cx[c],cy[c]);else p.lineTo(cx[c],cy[c])});l.path=p;if(l.gap>=0){const g=new Path2D();g.moveTo(cx[l.stops[l.gap]],cy[l.stops[l.gap]]);g.lineTo(cx[l.stops[l.gap+1]],cy[l.stops[l.gap+1]]);l.gapPath=g}}
new ResizeObserver(measure).observe(panel);addEventListener('resize',resize);
new MutationObserver(theme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});matchMedia('(prefers-color-scheme:dark)').addEventListener('change',theme);
shape();theme();
{const r=stage.getBoundingClientRect();Wd=r.width;Hd=r.height;ax=Wd/2;ay=Hd/2}
if(saved.s){if(saved.m)setMode(1,true);cam.x=saved.x;cam.y=saved.y;cam.s=saved.s;if(saved.line>=0&&saved.line<L.length){nar.line=saved.line;setMark()}}
else{let b=B.isect[0];for(const c of B.isect)if(nLines[c]*10+cres[c]>nLines[b]*10+cres[b])b=c;cam.x=cx[b];cam.y=cy[b];cam.s=.95}
resize();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw.now);
