'use strict';
/* ---------- the invented bank, generated from a fixed seed ---------- */
const X=Math.max(1,+(new URLSearchParams(location.search).get('x'))||1); // ?x=10 grows the bank ten times, for measuring only
function rng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const PREP=0,EXPL=1,ECHO=2,CONTR=3,MINE=4,REV=8,G=100;
const TRADS=['Stillwater','Ember Path','Hollow Reed','Northlight','Salt Road','Open Hand','Lantern','Riverstone','Quiet Orchard','Windward','Deep Field','Ashgrove'];
const WA='Resting Borrowed Open Quiet Unfinished Ordinary Returning Listening Unguarded Patient Small Honest Wordless Shared Steady Bare Slow Given Unforced Tender Wide Plain Inner Empty Whole Loosened Remembered Forgotten Hidden Daily First Last Clear Warm Fierce Soft Unbroken Passing Lasting Falling Rising Waiting Carried Unnamed Welcomed Unhurried Undivided Simple Secret Common Living Still Moving Near Late Early Humble Bright Perfect'.split(' ');
const WB='attention,breath,silence,effort,longing,doubt,refuge,grief,joy,fear,rest,practice,welcome,surrender,discipline,devotion,emptiness,presence,wholeness,habit,desire,anger,kindness,trust,patience,courage,wonder,shame,pride,hunger,stillness,gratitude,release,listening,speech,work,play,sleep,solitude,company,belonging,perfection,honesty,tenderness,forgiveness,humility,generosity,restlessness,boredom,envy,loneliness,comfort,pain,pleasure,memory,hope,despair,curiosity,clarity,confusion,strength,weakness,freedom,duty,love,loss,peace,struggle,acceptance,resistance,faith,certainty,ambition,contentment,sorrow,laughter,prayer,study,service,ritual,routine,change,beginning,ending,waiting,letting go,holding on,forgetting,remembering,giving,receiving,asking,knowing,not knowing,feeling,thinking,willpower,softness,steadiness,openness'.split(',');
/* a concept is named as a plain statement a person would say */
const PAT=['{A} comes before {b}','{A} is not {b}','{A} without {b}','{A} grows from {b}','{A} and {b} are not the same','{A} can be welcomed','Start with {a}','{A} is already here','You cannot force {a}','Let {a} be seen'];
const HAND=['Everything is perfect as it is','You are already whole','Nothing needs to be added','Kindness comes first','Feeling everything is the way through','The body knows before the mind','Rest is not laziness','You cannot think your way there','What you resist stays','Ordinary life is the practice','Being seen is part of healing','Love does not need a reason'];
const PLACES='Harrowmere,Tessel Bay,Oldwick,Sennet Hill,Varrow,Calder Fen,Ilmont,Brask,Orrin Cross,Lowen,Pell Harbour,Quillon,Marrow Field,Eastling,Thornby Lake,Usk Hollow'.split(',');
const ROLES='The elder,The gardener,The cook,The ferryman,The night teacher,The visiting teacher,The letter writer,The bell ringer,The old student,The translator,The doorkeeper,The weaver'.split(',');
const cap=s=>s[0].toUpperCase()+s.slice(1), lc=s=>s[0].toLowerCase()+s.slice(1);

function generate(){
 const R=rng(20261111),ri=n=>Math.floor(R()*n),pick=a=>a[ri(a.length)];
 const NT=12,NL=300*X,NC=20000*X,NW=2000*X,RB=3000*Math.sqrt(X),SP=RB*2.5;
 const B={X,NT,NL,NC,NW,RB,SP};
 // traditions: regions of unequal size on a staggered three by four field
 let w=[],sum=0;for(let i=0;i<NT;i++){w[i]=.55+R()*1.1;sum+=w[i]}
 const T=B.T=[];let accC=0,accL=0;
 for(let i=0;i<NT;i++){const sh=w[i]/sum,col=i%3,row=i/3|0;
  const nC=i<NT-1?Math.round(NC*sh):NC-accC,nL=i<NT-1?Math.round(NL*sh):NL-accL;accC+=nC;accL+=nL;
  T.push({id:i,name:TRADS[i],sh,nC,nL,r:RB*Math.sqrt(sh*NT),cx:Math.round(((col+.5+(row%2?.13:-.13))*SP+(R()-.5)*RB*.2)/G)*G,cy:Math.round(((row+.5)*SP*.95+(R()-.5)*RB*.2)/G)*G,ph:R()*6.28,ph2:R()*6.28,stops:[],lines:[],works:[],nW:0,nStops:0})}
 B.w=3*SP;B.h=4*SP*.95;
 const cx=B.cx=new Float32Array(NC),cy=B.cy=new Float32Array(NC),ctr=B.ctr=new Uint8Array(NC),cres=B.cres=new Uint8Array(NC),cpar=B.cpar=new Int32Array(NC).fill(-1),nLines=B.nLines=new Uint8Array(NC);
 let n=0;const made=new Int32Array(NT);
 const mk=(x,y,t)=>{cx[n]=x;cy[n]=y;ctr[n]=t;made[t]++;return n++};
 // research topics: lines that walk a grid in eight directions; a grid point two lines visit is an intersection
 const DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1],stopAt=new Map();
 const toward=(x,y,t)=>{let b=0,bd=1e30;for(let d=0;d<8;d++){const q=Math.hypot(x+DX[d]*G-t.cx,y+DY[d]*G-t.cy);if(q<bd){bd=q;b=d}}return b};
 const L=B.L=[],ea=[],eb=[],ek=[],el=[];
 for(const A of T)for(let j=0;j<A.nL;j++){
  const cross=R()<.14;let home=A,x,y,dir,Bt=null,ang=0,jumped=false,px=0,py=0;
  if(cross){const c=A.id%3,r=A.id/3|0,opts=[];if(c>0)opts.push(A.id-1);if(c<2)opts.push(A.id+1);if(r>0)opts.push(A.id-3);if(r<3)opts.push(A.id+3);
   Bt=T[pick(opts)];ang=Math.atan2(Bt.cy-A.cy,Bt.cx-A.cx);const off=(R()-.5)*.5;px=-Math.sin(ang)*off;py=Math.cos(ang)*off;const d0=.45+R()*.2;
   x=A.cx+Math.cos(ang)*A.r*d0+px*A.r;y=A.cy+Math.sin(ang)*A.r*d0+py*A.r;dir=(Math.round(ang/(Math.PI/4))+8)%8}
  else if(A.stops.length&&R()<.8){const c=pick(A.stops);x=cx[c];y=cy[c];dir=ri(8)}
  else{const a=R()*6.28,rr=Math.sqrt(R())*.7*A.r;x=A.cx+Math.cos(a)*rr;y=A.cy+Math.sin(a)*rr;dir=ri(8)}
  x=Math.round(x/G)*G;y=Math.round(y/G)*G;
  const len=8+Math.floor(Math.pow(R(),1.5)*17),stops=[],own=new Set();
  for(let k=0;k<len;k++){
   const key=(x/G)*100000+(y/G);if(own.has(key))break;
   let c=stopAt.get(key);if(c===undefined){c=mk(x,y,home.id);stopAt.set(key,c);home.stops.push(c)}
   own.add(key);stops.push(c);
   if(cross&&!jumped){if(Math.hypot(x-A.cx,y-A.cy)>A.r*.86){x=Math.round((Bt.cx-Math.cos(ang)*Bt.r*.86+px*Bt.r)/G)*G;y=Math.round((Bt.cy-Math.sin(ang)*Bt.r*.86+py*Bt.r)/G)*G;home=Bt;jumped=true;continue}}
   else{if(R()<.28)dir=(dir+(R()<.5?1:7))%8;if(Math.hypot(x+DX[dir]*G-home.cx,y+DY[dir]*G-home.cy)>home.r*.9)dir=toward(x,y,home)}
   x+=DX[dir]*G;y+=DY[dir]*G}
  if(stops.length<2)continue;
  const id=L.length,u=R();let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(let k=0;k<stops.length;k++){const c=stops[k];nLines[c]++;x0=Math.min(x0,cx[c]);y0=Math.min(y0,cy[c]);x1=Math.max(x1,cx[c]);y1=Math.max(y1,cy[c]);if(k){ea.push(stops[k-1]);eb.push(c);ek.push(PREP);el.push(id)}}
  L.push({id,stops,t:A.id,t2:jumped?Bt.id:-1,col:(A.lines.length+A.id*3)%8,res:u<.4?1:u<.68?2:u<.85?3:u<.95?4:5,box:[x0,y0,x1,y1],gap:R()<.07&&stops.length>5?2+ri(stops.length-4):-1,name:''});
  A.lines.push(id);if(jumped)Bt.lines.push(id)}
 // the other concepts gather round the stops they explain, echo or contrast with
 const ckind=B.ckind=new Uint8Array(NC);
 for(const A of T){const S=A.stops,cnt=new Uint8Array(S.length),ph=new Float32Array(S.length);A.nStops=S.length;for(let j=0;j<S.length;j++)ph[j]=R()*6.28;
  const need=Math.max(0,Math.min(A.nC-made[A.id],S.length*14));
  for(let m=0;m<need&&n<NC;m++){let j=Math.floor(Math.pow(R(),1.7)*S.length),g=0;while(cnt[j]>=14&&g++<S.length)j=(j+1)%S.length;const k=cnt[j]++;
   const rad=k<5?.27*G:.44*G,a=ph[j]+(k<5?k*6.283/5:(k-5)*6.283/9),c=mk(cx[S[j]]+Math.cos(a)*rad,cy[S[j]]+Math.sin(a)*rad,A.id);
   cpar[c]=S[j];const u=R();ckind[c]=u<.55?EXPL:u<.8?ECHO:CONTR;ea.push(c);eb.push(S[j]);ek.push(ckind[c]);el.push(-1)}}
 while(n<NC){const A=T[ri(NT)],p=pick(A.stops),a=R()*6.28,c=mk(cx[p]+Math.cos(a)*.36*G,cy[p]+Math.sin(a)*.36*G,A.id);cpar[c]=p;ckind[c]=EXPL;ea.push(c);eb.push(p);ek.push(EXPL);el.push(-1)}
 for(let c=0;c<NC;c++){const u=R();cres[c]=Math.min(5,(u<.45?1:u<.73?2:u<.88?3:u<.96?4:5)+(nLines[c]>1?1:0))}
 // long links between traditions: echoes, contrasts and a few of his own
 const NE=Math.round(NC*.15);for(let i=0;i<NE;i++){const a=ri(NC);let b=ri(NC),g=0;while(ctr[b]===ctr[a]&&g++<8)b=ri(NC);if(a===b)continue;const u=R();ea.push(a);eb.push(b);ek.push(u<.62?ECHO:u<.93?CONTR:MINE);el.push(-1)}
 // neighbours of every concept, packed
 const E=ea.length,off=B.off=new Int32Array(NC+1);for(let i=0;i<E;i++){off[ea[i]+1]++;off[eb[i]+1]++}for(let c=0;c<NC;c++)off[c+1]+=off[c];
 const adj=B.adj=new Int32Array(2*E),ak=B.ak=new Uint8Array(2*E),al=B.al=new Int32Array(2*E),fill=off.slice(0,NC);
 for(let i=0;i<E;i++){let p=fill[ea[i]]++;adj[p]=eb[i];ak[p]=ek[i];al[p]=el[i];p=fill[eb[i]]++;adj[p]=ea[i];ak[p]=ek[i]|REV;al[p]=el[i]}
 B.E=E;
 // plain invented names
 const used=new Set(),nm=B.name=new Array(NC),b=()=>pick(WB),a=()=>pick(WA),cpat=B.cpat=new Uint8Array(NC),cA=B.cA=new Uint8Array(NC),cB=B.cB=new Uint8Array(NC);
 for(let c=0;c<NC;c++){let s,g=0,p,i,j;do{p=R()<.86?ri(5):5+ri(5);i=ri(WB.length);j=ri(WB.length);if(j===i)j=(j+1)%WB.length;s=PAT[p].replace('{A}',cap(WB[i])).replace('{a}',WB[i]).replace('{b}',WB[j]);if(g>5)s+=' and '+pick(WB);g++}while(used.has(s));used.add(s);nm[c]=s;cpat[c]=p;cA[c]=i;cB[c]=j}
 for(const t of T){let best=-1;for(const c of t.stops)if(nLines[c]>1&&(best<0||nLines[c]*10+cres[c]>nLines[best]*10+cres[best]))best=c;if(best>=0){nm[best]=HAND[t.id];cpat[best]=255;cres[best]=5}}
 B.low=nm.map(s=>s.toLowerCase());
 for(const l of L){const u=R();l.name=u<.3?'From '+b()+' to '+b():u<.5?'How '+b()+' ripens':u<.7?'On '+b()+' and '+b():u<.85?'Why '+b()+' comes first':'The way of '+lc(a())+' '+b()}
 // works: each walks stretches of lines, taking the stops and most of what gathers round them, in its own order
 const cum=[];let cs=0;for(const t of T){cs+=t.sh;cum.push(cs)}
 const lists=[],starts=[],W=B.W=[],first=new Int32Array(NC).fill(-1),nHuge=Math.max(6,Math.round(NW*.012));
 for(let wi=0;wi<NW;wi++){const u0=R();let t=0;while(cum[t]<u0&&t<NT-1)t++;const A=T[t],u=R();
  const want=wi<nHuge?100+ri(41):u<.09?40+ri(50):6+Math.floor(Math.pow(R(),1.4)*40),list=[],seen=new Set(),st=new Set();
  const add=c=>{if(!seen.has(c)){seen.add(c);list.push(c);if(first[c]<0)first[c]=wi}};
  let li=A.lines[A.nW%A.lines.length],g=0,pos=ri(Math.max(1,L[li].stops.length-3));
  while(list.length<want&&g++<80){const S=L[li].stops;st.add(S[pos]);
   for(let k=pos;k<S.length&&list.length<want;k++){const s=S[k];add(s);for(let i=off[s];i<off[s+1];i++)if(al[i]<0&&cpar[adj[i]]===s&&R()<.6)add(adj[i])}
   li=R()<.15?ri(L.length):pick(A.lines);pos=ri(Math.max(1,L[li].stops.length>>1))}
  const kind=wi<nHuge?'Book':R()<.6?'Talk':pick(['Book','Retreat talk','Letters']),pl=pick(PLACES),k2=R();
  const name=kind==='Book'?(k2<.5?'The book of '+lc(a())+' '+b():'A year of '+lc(a())+' '+b()):kind==='Letters'?'Letters on '+b()+' and '+b():kind==='Retreat talk'?pl+' retreat, day '+(1+ri(9)):(k2<.5?'Talk on '+b()+' and '+b():'Evenings at '+pl+', '+(1+ri(40)));
  A.works.push(wi);A.nW++;lists.push(list);starts.push(st);W.push({id:wi,t,kind,name,who:pick(ROLES)+' of '+pl,x:0,y:0,r:0,res:1,n:0})}
 for(let c=0;c<NC;c++)if(first[c]<0){const p=cpar[c]>=0?cpar[c]:adj[off[c]];let wi=p!==undefined&&p>=0?first[p]:-1;if(wi<0)wi=pick(T[ctr[c]].works);const l=lists[wi],at=l.indexOf(p);if(at>=0)l.splice(at+1,0,c);else l.push(c);first[c]=wi}
 let NP2=0;for(const l of lists)NP2+=l.length;
 const wOff=B.wOff=new Int32Array(NW+1),wConc=B.wConc=new Int32Array(NP2),wCnt=B.wCnt=new Uint8Array(NP2),chap=B.chap=new Array(NW);
 let q=0,NP=0;for(let wi=0;wi<NW;wi++){const l=lists[wi],st=starts[wi],ch=[0];let rs=0;
  for(let k=0;k<l.length;k++){if(k&&k-ch[ch.length-1]>=3&&(st.has(l[k])||k-ch[ch.length-1]>=12))ch.push(k);wConc[q]=l[k];const pc=1+Math.floor(Math.pow(R(),1.5)*8);wCnt[q++]=pc;NP+=pc;rs+=cres[l[k]]}
  if(ch.length>1&&l.length-ch[ch.length-1]<3)ch.pop();ch.push(l.length);chap[wi]=ch;wOff[wi+1]=q;
  const o=W[wi];o.n=l.length;o.res=Math.max(1,Math.min(5,Math.round(2+(rs/l.length-2.1)/(1.1/Math.sqrt(l.length))*1.1)))}
 // every passage is a record: its concept, its work, its place in the work
 const cwOff=B.cwOff=new Int32Array(NC+1);for(let i=0;i<NP2;i++)cwOff[wConc[i]+1]++;for(let c=0;c<NC;c++)cwOff[c+1]+=cwOff[c];
 const cwWork=B.cwWork=new Int32Array(NP2),cwCnt=B.cwCnt=new Uint8Array(NP2),f2=cwOff.slice(0,NC);
 for(let wi=0;wi<NW;wi++)for(let i=wOff[wi];i<wOff[wi+1];i++){const p=f2[wConc[i]]++;cwWork[p]=wi;cwCnt[p]=wCnt[i]}
 const pC=B.pC=new Int32Array(NP),pW=B.pW=new Int32Array(NP),pAt=B.pAt=new Uint16Array(NP),cpOff=B.cpOff=new Int32Array(NC+1);
 let p=0;for(let c=0;c<NC;c++){cpOff[c]=p;for(let i=cwOff[c];i<cwOff[c+1];i++)for(let k=0;k<cwCnt[i];k++){pC[p]=c;pW[p]=cwWork[i];pAt[p]=1+((c*31+k*47+cwWork[i]*7)%240);p++}}cpOff[NC]=p;B.NP=NP;
 // works as regions inside their tradition: a spiral of circles sized by how many concepts each holds
 for(const A of T){const ws=A.works.slice().sort((p,q)=>W[q].n-W[p].n),pk=pack(ws.map(i=>Math.sqrt(W[i].n)+.8));A.unit=.9*A.r/pk.ext;
  ws.forEach((i,k)=>{const o=W[i];o.x=A.cx+pk.x[k]*A.unit;o.y=A.cy+pk.y[k]*A.unit;o.r=(Math.sqrt(o.n)+.8)*A.unit*.94})}
 // a coarse grid so that only what is in view is ever visited
 const CELL=B.CELL=400,gc=B.gc=Math.ceil((B.w+RB)/CELL)+4,gr=B.gr=Math.ceil((B.h+RB)/CELL)+4,cell=c=>Math.max(0,Math.min(gc-1,(cx[c]/CELL|0)+1))+Math.max(0,Math.min(gr-1,(cy[c]/CELL|0)+1))*gc;
 const gOff=B.gOff=new Int32Array(gc*gr+1);for(let c=0;c<NC;c++)gOff[cell(c)+1]++;for(let i=0;i<gc*gr;i++)gOff[i+1]+=gOff[i];
 const gIt=B.gIt=new Int32Array(NC),f3=gOff.slice(0,gc*gr);for(let c=0;c<NC;c++)gIt[f3[cell(c)]++]=c;
 B.isect=[];for(let c=0;c<NC;c++)if(nLines[c]>1)B.isect.push(c);
 return B}
function pack(rs){const n=rs.length,x=new Float32Array(n),y=new Float32Array(n),cell=(rs[0]||1)*2,H=new Map(),a=(rs[n>>1]||1)*1.7/6.283;let th=0,ext=rs[0]||1;
 const hit=(px,py,r)=>{const gx=Math.floor(px/cell),gy=Math.floor(py/cell);for(let i=-1;i<2;i++)for(let j=-1;j<2;j++){const l=H.get((gx+i)*4096+gy+j);if(l)for(const k of l)if(Math.hypot(x[k]-px,y[k]-py)<rs[k]+r)return true}return false};
 for(let i=0;i<n;i++){let px=0,py=0;if(i)for(;;){const rho=a*th;px=rho*Math.cos(th);py=rho*Math.sin(th);if(!hit(px,py,rs[i]))break;th+=Math.max(.02,rs[i]*.4/Math.max(rho,rs[i]))}
  x[i]=px;y[i]=py;ext=Math.max(ext,Math.hypot(px,py)+rs[i]);const k=Math.floor(px/cell)*4096+Math.floor(py/cell);(H.get(k)||H.set(k,[]).get(k)).push(i)}
 return{x,y,ext}}

/* words for a concept, made when it is opened. All invented. */
const SAY=['You keep asking how to reach {n}. Sit down. You are standing on it.','I spent eleven years trying to earn {n}, and one afternoon I noticed it had never been withheld.','When {b} comes, do not send it away. That is where {n} is learned.','Nobody can hand you {n}. They can only stop standing in front of it.','We speak of {n} as if it were far off. It is closer than the cup in your hand.','First {b}. Then, and only then, {n}. Do not skip the first.','If {n} needs you to feel a certain way, it is not {n} yet.','My own teacher never explained {n}. She washed the bowls and let us watch.','There is a false version of {n} that is only tiredness. Learn to tell them apart.','Ask the body about {n}. It answers before the mind has finished its sentence.','{N} is not a reward for the good days. It is what holds the bad ones.','You will forget {n} by the time you reach the gate. Good. Come back tomorrow.','I cannot give you {n} in a sentence. I can only tell you where I was standing when it found me.','Do not make {n} into a project. Projects end. This does not.','People ask whether {n} is hard. It is not hard. It is only unfamiliar.'];
const WHAT=['You cannot get to {y} by skipping {x}. Every work that speaks of this puts {x} first.','{X} and {y} can look alike from outside. {X} leaves room for what you feel, and {y} closes it.','It is possible to have {x} and not need {y} alongside it. Most people assume the two must come together.','You do not make {x} directly. You look after {y}, and {x} follows in its own time.','{X} and {y} are often confused. Telling them apart is most of the work.','When {x} comes, you do not have to send it away. You can let it sit beside you and carry on.','Before anything else, {x}. What comes after depends on it.','You are not waiting for {x} to arrive. You are noticing that it never left.','Trying harder pushes {x} away. It comes when you make room for it.','Hiding {x} costs more than showing it. It begins with letting one person see.'];
function passage(B,p){const r=rng(p*2654435761+7),c=B.pC[p],n=WB[B.cA[c]],b=WB[Math.floor(r()*WB.length)];return SAY[Math.floor(r()*SAY.length)].replace(/\{n\}/g,n).replace(/\{N\}/g,cap(n)).replace(/\{b\}/g,b)}
/* a distillation at three depths. The full one reads downward in the order Adrian gave: what it is, what you do with it,
   how you embody it, understanding it more deeply, how it can be misunderstood. */
function distil(B,c,nb){const p=B.cpat[c],x=WB[B.cA[c]],y=WB[B.cB[c]],nw=B.cwOff[c+1]-B.cwOff[c],f=s=>s.replace(/\{x\}/g,x).replace(/\{X\}/g,cap(x)).replace(/\{y\}/g,y);
 const glance=p===255?'This is meant literally, about this moment, before anything is fixed or improved.':f(WHAT[p]);
 const works=nw>1?'The '+nw+' works that speak of it use different words and make the same point.':'One work speaks of it so far.';
 const doit='Pick one ordinary moment today, such as washing up or waiting for someone, and try it there. When '+x+' shows up, name it quietly to yourself before you do anything about it. Small and repeated works better than large and rare.';
 const body='Notice where '+x+' sits in the body: the jaw, the chest, the belly. Let the breath go there and stay a little longer than is comfortable. This is learned in the body before it is understood in words.';
 const deep=(nb.before?'It rests on “'+B.name[nb.before]+'”, so read that first if this stays abstract. ':'')+(nb.after?'It opens onto “'+B.name[nb.after]+'”. ':'')+'The voices here differ on how long it takes and agree that it cannot be hurried. Go to their exact words below when a summary is not enough.';
 const wrong='It can be used as a lid: said aloud in order not to feel something. If saying it makes the jaw tighter, it is being misused.'+(nb.against?' It is often mistaken for “'+B.name[nb.against]+'”.':'')+' The real version has room for what hurts.';
 return{glance,medium:[glance+' '+works,doit,deep],full:[['What it is',glance+' '+works+' None of them offer it as a belief to hold. They offer it as something you can check for yourself.'],['What you do with it',doit],['How you embody it',body],['Understanding it more deeply',deep],['How it can be misunderstood',wrong]]}}
const WHY=[['The second only holds once the first is steady.','Skip the first and the second turns into a pose.'],['It gives the idea an example you can stand inside.','It unpacks one side of the idea.'],['They say something close, from different directions.','They rhyme without being the same thing.'],['One sets a limit on the other.','They disagree about what comes naturally.'],['You joined these yourself.','Your own line.']];
function why(B,a,b,k){const r=rng(a*131+b*17+k);return WHY[k][Math.floor(r()*2)]}
