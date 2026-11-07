// The mirror page's script (instagram-mirror.html): opens the studio as an agent, keeps one part, says when it is drawn.
// The actor is set before instagram-studio.js loads, so every button in the picture shows as Adrian's to press.
window.arCreateUiActor={actor:'agent:claude-code'};
window.addEventListener('load',async()=>{
 const q=new URLSearchParams(location.search),part=q.get('part')||'material',story=q.get('story'),format=q.get('format');
 const LABEL={material:['Material','Coverage of the whole recording'],story:['Possible stories'],words:['Words to confirm'],made:['Made'],research:['Research worth doing']};
 const done=(state,extra={})=>{document.body.dataset.mirror=state;Object.assign(document.body.dataset,extra);};
 try{
  await window.arInstagram.open({planId:q.get('id')});
  const body=document.querySelector('.igs-body');
  for(let i=0;i<50&&!body.querySelector('section');i++)await new Promise(r=>setTimeout(r,100));
  if(part==='made'&&format){
   const pick=body.querySelector('[data-igs="format"][data-f="'+CSS.escape(format)+'"]');
   if(!pick||pick.disabled)throw Error('That format has not been made.');
   pick.click();
  }
  if(!body.querySelector('section'))throw Error('The studio did not finish loading.');
  const keep=LABEL[part]||[];let shown=0;
  for(const s of body.children){const on=keep.includes(s.getAttribute('aria-label'));s.classList.toggle('igs-mirror-hide',!on);shown+=on;}
  if(part==='story'){const cards=[...body.querySelectorAll('.igs-story')];for(const c of cards)c.classList.toggle('igs-mirror-hide',!!story&&c.dataset.story!==story);if(story&&!cards.some(c=>c.dataset.story===story))shown=0;}
  if(part==='made'&&!Object.keys(window.arInstagram.state()?.layouts||{}).length)shown=0;
  if(!shown)return done('empty');
  // A caption in a picture has no scroll affordance: include all of its words.
  for(const field of body.querySelectorAll('textarea'))if(!field.closest('.igs-mirror-hide')){
   field.style.height='auto';field.style.height=(field.scrollHeight+field.offsetHeight-field.clientHeight)+'px';
  }
  const visible=selector=>[...body.querySelectorAll(selector)].filter(e=>!e.closest('.igs-mirror-hide'));
  for(const e of visible('img,iframe'))e.loading='eager';
  const imageReady=img=>img.complete?(img.naturalWidth?Promise.resolve():Promise.reject(Error('An image did not load.'))):new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('An image did not load.')),{once:true});});
  await Promise.all(visible('iframe').map(async frame=>{
   if(!frame.contentDocument||frame.contentDocument.readyState!=='complete'||frame.contentDocument.URL!==frame.src)await new Promise((resolve,reject)=>{frame.addEventListener('load',resolve,{once:true});frame.addEventListener('error',()=>reject(Error('A frame did not load.')),{once:true});});
   const doc=frame.contentDocument;if(!doc||doc.contentType!=='text/html'||!doc.body?.children.length)throw Error('A frame did not finish drawing.');
   await doc.fonts?.ready;await Promise.all([...doc.images].map(imageReady));
  }));
  await document.fonts.ready;
  await Promise.all(visible('img').map(imageReady));
  // The studio is a full-screen dialog, so the page is never shorter than the window: measure the visible parts instead.
  const bottom=Math.max(...[...body.children].filter(s=>!s.classList.contains('igs-mirror-hide')).map(s=>s.getBoundingClientRect().bottom+scrollY));
  done('ready',{height:String(Math.ceil(bottom+24)),revision:String(window.arInstagram.state()?.revision??'')});
 }catch(e){done('failed',{error:e.message});}
});
