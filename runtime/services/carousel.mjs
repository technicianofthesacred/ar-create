import {assertOutputEditorialReady} from '../src/workspaces/editorial-state.mjs';
// ACTUAL-REUSE: mag-preview.mjs chrome()/exportSlides() local headless workflow,
// own immutable render pages and output directory; no donor write or install.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import IG from '../src/donors/mag/carousel/ig-templates.js';
import {StateError} from '../store.mjs';
import {ensurePrivateDirectory,atomicWrite,readJson,resolveInside,regular,digest} from './files.mjs';
import {outputOwnership} from './output-ownership.mjs';
import {fitCarouselTypography,validateCarouselTypography} from '../src/workspaces/carousel-typography.mjs';
const run=promisify(execFile);
export function chrome(){
 const root=path.join(os.homedir(),'Library/Caches/ms-playwright');
 const dirs=(()=>{try{return fs.readdirSync(root).filter(d=>d.startsWith('chromium_headless_shell-')).sort((a,b)=>+b.split('-')[1]-+a.split('-')[1]);}catch{return [];}})();
 for(const d of dirs){const bin=path.join(root,d,'chrome-headless-shell-mac-arm64','chrome-headless-shell');if(fs.existsSync(bin))return bin;}
 throw new StateError('PNG export is unavailable: no existing local headless Chrome was found.',503);
}
const ownImage=/^\/api\/sources\/blob\?id=([^&]+)$/;
// Exact locally retained faces used by the original canvases and explicit user choices.
// Keep normal weights separate: a rendered template must not silently use Caudex or
// a browser's Georgia/CJK fallback in place of its authored family.
const exportFontCss=[
 ['Caudex',400,'/assets/fonts/Caudex-Regular.ttf','truetype'],
 ['Source Serif 4','400 600','/assets/fonts/ab68f14ec71c3016.woff2','woff2'],
 ['Instrument Sans','400 500','/assets/fonts/5963fe8e750eca5b.woff2','woff2'],
 ['EB Garamond',400,'/ig-assets/eb-garamond-400-normal.ttf','truetype'],
 ['EB Garamond',500,'/ig-assets/eb-garamond-500-normal.ttf','truetype'],
 ['Shippori Mincho',700,'/ig-assets/shippori-mincho-700-normal.ttf','truetype'],
 ['Shippori Mincho',800,'/ig-assets/shippori-mincho-800-normal.ttf','truetype'],
 ['Noto Serif TC',900,'/ig-assets/noto-serif-tc-900-normal.ttf','truetype'],
].map(([family,weight,file,format])=>`@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};src:url(${file}) format("${format}")}`).join('');
export function carouselSlidePage(slide,{fontCss=exportFontCss}={}) {
 const s=slide;
   const typography=s.typography?{font:s.typography.font,scale:s.typography.scale,fit:s.typography.fit}:null;
   const selectedFont=typography?({original:null,caudex:'Caudex',serif:'Source Serif 4',sans:'Instrument Sans'})[typography.font]:null;
   return '<!doctype html><html><head><meta charset="utf-8"><style>'+fontCss+'html,body{margin:0;background:#1a1714}</style></head><body>'+IG.render(s.template,slide,{})+`<script>
${fitCarouselTypography.toString()}
const pillar=${JSON.stringify(s.pillar||'')},typography=${JSON.stringify(typography)};
const selectedFont=${JSON.stringify(selectedFont)},fontFamilies=new Set(['Caudex','Source Serif 4','Instrument Sans','EB Garamond','Shippori Mincho','Noto Serif TC']);
const fontRequests=new Map(),root=document.body.firstElementChild;
for(const el of [root,...root.querySelectorAll('*')]){
 const text=Array.from(el.childNodes).filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim();
 if(!text)continue;
 const style=getComputedStyle(el);let family=style.fontFamily;
 // Browsers inherit computed family; the explicit ancestor fallback also makes the
 // isolated test DOM honest when its computed-style implementation omits inheritance.
 for(let parent=el.parentElement;!family&&parent;parent=parent.parentElement)family=getComputedStyle(parent).fontFamily;
 if(selectedFont&&el.closest('[data-edit="text"],[data-edit="label"],[data-edit="credit"]'))family=selectedFont;
 for(const part of family.split(',')){
  const name=part.trim().replace(/^['"]|['"]$/g,'');if(!fontFamilies.has(name))continue;
  const weight=style.fontWeight==='bold'?'700':style.fontWeight==='normal'||!style.fontWeight?'400':style.fontWeight;
  const spec=(style.fontStyle||'normal')+' '+weight+' 64px "'+name+'"';
  fontRequests.set(spec,(fontRequests.get(spec)||'')+text);
 }
}
if(pillar)fontRequests.set('normal 800 64px "Shippori Mincho"',pillar);
document.body.dataset.exportFontRequests=JSON.stringify([...fontRequests.keys()]);
const fontLoads=[...fontRequests].map(([spec,text])=>document.fonts.load(spec,text).then(faces=>faces.length>0&&document.fonts.check(spec,text)).catch(()=>false));
Promise.all([Promise.all(fontLoads).then(async loads=>{await document.fonts.ready;return loads;}),...Array.from(document.images).map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r}))]).then(results=>{
 const missing=!results[0].every(Boolean)||Array.from(document.images).some(i=>!i.naturalWidth);
 if(missing){document.body.dataset.exportStatus='missing-image';return;}
 const fit=fitCarouselTypography(root,typography),box=root.getBoundingClientRect();
 root.dataset.typographyFitScale=String(fit.scale);
 const bad=Array.from(root.querySelectorAll('div')).some(e=>e.children.length===0&&e.textContent.trim()&&((()=>{const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect();return r.bottom>box.bottom-40||r.top<box.top+40||r.right>box.right||r.left<box.left;})()));
 document.body.dataset.typographyOverflow=String(fit.overflow);document.body.dataset.legacyOverflow=String(bad);
 if(fit.overflow){const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom});document.body.dataset.typographyOverflowDetails=JSON.stringify([...root.querySelectorAll('[data-text-zone]')].map(zone=>({rect:rect(zone.getBoundingClientRect()),padding:getComputedStyle(zone).padding,client:[zone.clientWidth,zone.clientHeight],scroll:[zone.scrollWidth,zone.scrollHeight],fields:[...zone.querySelectorAll('[data-edit]')].map(el=>({kind:el.dataset.edit,fontSize:el.style.fontSize,rect:rect(el.getBoundingClientRect()),client:[el.clientWidth,el.clientHeight],scroll:[el.scrollWidth,el.scrollHeight]}))})));}
 document.body.dataset.exportStatus=fit.overflow||bad?'overflow':'ready';
}).catch(()=>{document.body.dataset.exportStatus='missing-image';});
</script></body></html>`;
}
function checkTypography(value){if(value!==undefined&&(!validateCarouselTypography(value)||Object.keys(value).some(key=>!['font','scale','fit'].includes(key))))throw new StateError('Slide typography requires a supported font, scale 0.5–1.5 and auto/manual fitting.');}
function checkVisibleWords(slide){if(IG.T[slide.template]?.textParts===0&&typeof slide.text==='string'&&slide.text.trim())throw new StateError('A photo-only template cannot hide reviewed slide words. Choose a template with text.');}
export function validateCarousel(output){
 if(output?.kind!=='carousel'||!Array.isArray(output.slides)||!output.slides.length||output.slides.length>40)throw new StateError('A carousel needs 1–40 slides.');
 for(const slide of output.slides){
  checkTypography(slide.typography);
  checkVisibleWords(slide);
  if(slide.pillar!==undefined&&!['','佳','家','嘉'].includes(slide.pillar))throw new StateError('Pillar seal must be 佳, 家, 嘉 or empty.');
  if(slide.label!==undefined&&(typeof slide.label!=='string'||slide.label.length>240))throw new StateError('Small heading must be text of at most 240 characters.');
  if(!IG.T[slide.template]||typeof slide.text!=='string'||slide.text.length>20000||typeof slide.credit!=='string'||!Array.isArray(slide.photos))throw new StateError('Carousel slide is invalid.');
  for(const photo of slide.photos){if(photo.src&&!ownImage.test(photo.src))throw new StateError('Choose a photograph saved in this workspace.');if(!Number.isFinite(photo.x)||photo.x<0||photo.x>100||!Number.isFinite(photo.y)||photo.y<0||photo.y>100)throw new StateError('Crop focus must be 0–100.');}
 }
}
export function createCarouselExports({dataDir,store,library}){
 const dir=ensurePrivateDirectory(dataDir,'carousel-exports');
 const owns=outputOwnership({dataDir,store});
 let busy=false;
 const folder=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw new StateError('Unknown carousel export.',404);return resolveInside(dir,id,{directory:true});};
 const record=id=>{const saved=readJson(path.join(folder(id),'.manifest.json'),null);if(!saved||saved.id!==id||!owns(saved))throw new StateError('Carousel export was not found in this piece.',404);return saved;};
 return {
  capability(){try{chrome();return {available:true,renderer:'existing local headless Chrome',size:'1080 × 1350'};}catch{return {available:false};}},
  list(){return {exports:fs.readdirSync(dir).filter(id=>/^[a-f0-9-]{36}$/.test(id)).map(id=>readJson(path.join(folder(id),'.manifest.json'),null)).filter(r=>r?.status==='complete'&&owns(r)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};},
  page(id,index){const r=record(id),s=r?.output?.slides?.[index];if(!s)throw new StateError('Slide not found.',404);
   checkTypography(s.typography);
   checkVisibleWords(s);
   const slide={...s,label:s.label??r.output.importedDraft?.label??r.output.title??'',photos:s.photos.map(photo=>{if(!photo.src)return photo;const asset=r.media[photo.src];if(!asset)throw new StateError('Export photograph was not retained.');const file=resolveInside(folder(id),asset.name);regular(file);return {...photo,src:`data:${asset.mimeType};base64,${fs.readFileSync(file).toString('base64')}`};})};
   return carouselSlidePage(slide);
  },
  file(id,name){const r=record(id);const item=r?.files?.find(f=>f.name===name);if(r?.status!=='complete'||!item)throw new StateError('Export file not found.',404);const file=resolveInside(folder(id),name);regular(file);return {file,...item};},
  async save(input,origin){
   const state=store.get(),document=state.project.document;const output=document?.outputs?.find(o=>o.id===input.outputId&&o.kind==='carousel');
   if(!output||(output.outputRevision||0)!==input.outputRevision)throw new StateError('Save the current carousel revision before exporting.',409);
   validateCarousel(output);try{assertOutputEditorialReady(output);}catch(error){throw new StateError(error.message,409);}const bin=chrome();if(busy)throw new StateError('Another carousel is rendering. Try again when it finishes.',409);busy=true;
   const id=randomUUID(),work=ensurePrivateDirectory(dir,id),manifest={id,projectId:state.project.id,documentId:document.id,outputId:output.id,outputRevision:output.outputRevision||0,manuscriptRevision:output.manuscriptRevision,createdAt:new Date().toISOString(),status:'rendering',path:work,output:structuredClone(output),media:{},files:[]};
   const write=()=>atomicWrite(path.join(work,'.manifest.json'),JSON.stringify(manifest,null,2));write();
   const add=(name,mimeType,bytes)=>{const file=path.join(work,name);atomicWrite(file,bytes,{exclusive:true});manifest.files.push({name,mimeType,sizeBytes:bytes.length,hash:digest(bytes),url:`/api/carousel/exports/${id}/file/${encodeURIComponent(name)}`});};
   const profile=fs.mkdtempSync(path.join(work,'chrome-profile-'));
   try{
    let total=0;for(const src of new Set(output.slides.flatMap(s=>s.photos.slice(0,IG.T[s.template].photos).map(p=>p.src)).filter(Boolean))){
     const source=await library.blob(decodeURIComponent(src.match(ownImage)[1]));const mimeType={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[path.extname(source.file).toLowerCase()];if(!mimeType)throw new StateError('Export requires JPEG, PNG or WebP photographs.');
     const bytes=fs.readFileSync(source.file);total+=bytes.length;if(total>64*1024*1024)throw new StateError('Carousel photographs exceed 64 MB.',413);const name='photo-'+Object.keys(manifest.media).length+path.extname(source.file);atomicWrite(path.join(work,name),bytes,{exclusive:true});manifest.media[src]={name,mimeType,hash:digest(bytes)};
    }
    write();
    for(let i=0;i<output.slides.length;i++){
     if(IG.T[output.slides[i].template].photos>output.slides[i].photos.slice(0,IG.T[output.slides[i].template].photos).filter(p=>p.src).length)throw new StateError(`Slide ${i+1} needs a photograph. Choose one or use Words only.`,422);
     const name='slide-'+String(i+1).padStart(2,'0')+'.png',file=path.join(work,name);
     const {stdout}=await run(bin,['--headless','--user-data-dir='+profile,'--disable-background-networking','--disable-component-update','--disable-extensions','--hide-scrollbars','--force-device-scale-factor=1','--window-size=1080,1350','--virtual-time-budget=6000','--dump-dom','--screenshot='+file,origin+`/api/carousel/exports/${id}/render/${i}`],{timeout:30000,maxBuffer:3*1024*1024});
     if(!stdout.includes('data-export-status="ready"'))throw new StateError(`Slide ${i+1} ${stdout.includes('data-export-status="overflow"')?'overflows its layout. Choose a roomier layout while keeping the reviewed words.':'could not load all its photographs or fonts.'}`,422);
     const bytes=fs.readFileSync(file);if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==1080||bytes.readUInt32BE(20)!==1350)throw new Error('Chrome did not produce a 1080 × 1350 PNG.');
     manifest.files.push({name,mimeType:'image/png',sizeBytes:bytes.length,hash:digest(bytes),url:`/api/carousel/exports/${id}/file/${name}`});
    }
    add('caption.txt','text/plain',Buffer.from((output.caption||'')+'\n'));add('output.json','application/json',Buffer.from(JSON.stringify(output,null,2)));manifest.status='complete';write();return {export:manifest};
   }catch(error){manifest.status='failed';manifest.error=error.message;write();throw error;}finally{busy=false;fs.rmSync(profile,{recursive:true,force:true});}
  }
 };
}
