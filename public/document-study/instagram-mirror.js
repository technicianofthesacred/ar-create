// The mirror page's script (instagram-mirror.html): opens the studio as an agent, keeps one part, says when it is drawn.
// The actor is set before instagram-studio.js loads, so every button in the picture shows as Adrian's to press.
window.arCreateUiActor={actor:'agent:claude-code'};
window.addEventListener('load',async()=>{
 const q=new URLSearchParams(location.search),part=q.get('part')||'material',story=q.get('story');
 const LABEL={material:['Material','Coverage of the whole recording'],story:['Possible stories'],words:['Words to confirm'],made:['Made'],research:['Research worth doing']};
 const done=(state,extra={})=>{document.body.dataset.mirror=state;Object.assign(document.body.dataset,extra);};
 try{
  await window.arInstagram.open({planId:q.get('id')});
  const body=document.querySelector('.igs-body');
  for(let i=0;i<50&&!body.querySelector('section');i++)await new Promise(r=>setTimeout(r,100));
  const keep=LABEL[part]||[];let shown=0;
  for(const s of body.children){const on=keep.includes(s.getAttribute('aria-label'));s.classList.toggle('igs-mirror-hide',!on);shown+=on;}
  if(part==='story'){const cards=[...body.querySelectorAll('.igs-story')];for(const c of cards)c.classList.toggle('igs-mirror-hide',!!story&&c.dataset.story!==story);if(story&&!cards.some(c=>c.dataset.story===story))shown=0;}
  if(part==='made'&&!Object.keys(window.arInstagram.state()?.layouts||{}).length)shown=0;
  if(!shown)return done('empty');
  await Promise.all([...body.querySelectorAll('img,iframe')].filter(e=>!e.closest('.igs-mirror-hide')).map(e=>e.loading='eager'));
  await document.fonts.ready;
  await Promise.all([...body.querySelectorAll('img')].filter(e=>!e.closest('.igs-mirror-hide')&&!e.complete).map(e=>new Promise(r=>{e.onload=e.onerror=r;})));
  // The studio is a full-screen dialog, so the page is never shorter than the window: measure the visible parts instead.
  const bottom=Math.max(...[...body.children].filter(s=>!s.classList.contains('igs-mirror-hide')).map(s=>s.getBoundingClientRect().bottom+scrollY));
  done('ready',{height:String(Math.ceil(bottom+24))});
 }catch(e){done('failed',{error:e.message});}
});
