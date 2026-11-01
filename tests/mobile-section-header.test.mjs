import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';

// Native layout needs an explicitly supplied, already agent-owned Ego TaskSpace.
// Ordinary package tests neither create a browser profile nor touch a user's app.
const space=Number(process.env.AR_CREATE_EGO_TASK_SPACE),enabled=Number.isSafeInteger(space)&&space>0;
const root=fileURLToPath(new URL('../',import.meta.url));
const artifactDir=process.env.AR_CREATE_HEADER_PROOF_DIR||'';
const prefix=process.env.AR_CREATE_HEADER_PROOF_PREFIX==='before'?'before':'after';
function fixture(stage,links){
 const title=stage===9?'Arrange':'Outputs';
 return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<title>Invented section header</title></head><body class="c3-tabs c3-rail-on c3-crumb-on c3-bar-on c3-tree-on wb-on wbf-on" data-c3-stage="${stage}"><div id="app"><div class="shell"><main id="workspace" class="workspace wb-section-surface wb-${stage===9?'arrange':'outputs'}"><header id="c3-surface-bar" data-wbf-section-actions="more" aria-label="This piece and its actions"><div class="sb-left"><span class="sb-where"><span class="sb-piece">Invented work</span><span class="sb-sep2">›</span><span class="sb-cp"><span class="sb-cp-n">${stage}</span><span class="sb-cp-name">${title}</span></span></span></div><div class="sb-right"><div class="sb-morew"><button class="sb-btn" aria-label="Section tools" aria-expanded="false" data-sb-more>•••</button><div class="sb-menu" hidden><button data-saved-action>Existing saved action</button></div></div><span class="sb-pw"><span class="sb-why" id="fixture-reason">The invented output is unavailable.</span><button class="sb-primary" aria-label="Outputs unavailable" data-short="Outputs unavailable" disabled aria-describedby="fixture-reason">Outputs unavailable</button></span><button class="btn" data-wbf-make-output disabled>Make an output</button></div><span data-review-state style="font-size:13px;white-space:nowrap;margin-left:auto">Read-only review</span></header><textarea aria-label="Invented unsaved wording">Invented unsaved words stay here.</textarea></main></div></div><script>window.fixtureHits=0;document.querySelector('[data-sb-more]').onclick=()=>{const b=document.querySelector('[data-sb-more]'),m=document.querySelector('.sb-menu');m.hidden=!m.hidden;b.setAttribute('aria-expanded',String(!m.hidden));};document.querySelector('[data-saved-action]').onclick=()=>window.fixtureHits++;</script></body></html>`;
}
test('native mobile section headers retain full titles, guarded actions and usable existing More', {skip:enabled?false:'needs a local ego-browser task space: set AR_CREATE_EGO_TASK_SPACE to a positive integer',timeout:90000},async()=>{
 const index=await fs.readFile(path.join(root,'public/document-study/index.html'),'utf8');
 const links=[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(m=>m[0].replace(/href="(?!\/)/,'href="/document-study/')).join('');
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.method!=='GET'){res.writeHead(405);return res.end();}
   const u=new URL(req.url,'http://localhost');
   if(u.pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture(Number(u.searchParams.get('stage')),links));}
   let file,type;
   if(/^\/document-study\/[a-z0-9-]+\.css$/.test(u.pathname)){file=path.join(root,'public',u.pathname);type='text/css';}
   else if(/^\/assets\/fonts\/[a-z0-9-]+\.woff2$/.test(u.pathname)){file=path.join(root,'runtime/public',u.pathname);type='font/woff2';}
   else{res.writeHead(404);return res.end();}
   res.setHeader('Content-Type',type);res.end(await fs.readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const script=`
 const t=await taskSpace(${space}),p=await t.newPage(),fs=await import('node:fs/promises'),rows=[];
 try{
  for(const stage of [9,12])for(const width of [390,320,760,1440])for(const theme of ['light','dark']){
   await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:false});
   await p.goto(${JSON.stringify(base)}+'/fixture?stage='+stage);await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await p.waitForFunction(()=>document.fonts.status==='loaded');
   const row=await p.evaluate(()=>{
    const bar=document.querySelector('#c3-surface-bar'),title=document.querySelector('.sb-cp-name'),more=document.querySelector('[data-sb-more]'),make=document.querySelector('[data-wbf-make-output]'),preview=document.querySelector('.sb-pw .sb-primary'),words=document.querySelector('textarea');
    const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    function visible(n){const r=n.getBoundingClientRect();if(!r.width||!r.height)return false;for(let a=n;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();if(a.hidden||s.display==='none'||s.visibility==='hidden')return false;if((s.overflowX==='hidden'||s.overflowX==='auto'||s.overflowX==='clip')&&(r.left<b.left-1||r.right>b.right+1))return false;}return r.left>=-1&&r.right<=innerWidth+1;}
    return{stage:Number(document.body.dataset.c3Stage),width:innerWidth,theme:document.documentElement.dataset.theme,title:title.textContent,titleVisible:visible(title),moreVisible:visible(more),makeVisible:visible(make),previewVisible:visible(preview),previewDisabled:preview.disabled,makeDisabled:make.disabled,words:words.value,bar:rect(bar),titleBox:rect(title),moreBox:rect(more),makeBox:rect(make),previewBox:rect(preview),previewTextFits:preview.scrollWidth<=preview.clientWidth+1,overflow:document.documentElement.scrollWidth>innerWidth,fontLoaded:document.fonts.check('13px "AR Plus Jakarta Sans"')};
   });
   const failed=!row.titleVisible||!row.moreVisible||!row.makeVisible||row.stage===9&&(!row.previewVisible||!row.previewTextFits)||row.overflow;
   if(${JSON.stringify(artifactDir)}&&width===390&&theme==='light'){
    await p.cdp('Emulation.setEmulatedMedia',{media:'screen'});const r=await p.cdp('Page.printToPDF',{printBackground:true,paperWidth:390/96,paperHeight:844/96,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,pageRanges:'1'},{timeout:10000});await fs.mkdir(${JSON.stringify(artifactDir)},{recursive:true});await fs.writeFile(${JSON.stringify(artifactDir)}+'/'+${JSON.stringify(prefix)}+'-'+stage+'.pdf',Buffer.from(r.data,'base64'));
   }
   rows.push(row);
   if(failed)throw Error('Native header clipping: '+JSON.stringify(row));
   if(!row.makeDisabled||!row.previewDisabled||row.words!=='Invented unsaved words stay here.')throw Error('Guarded action or unsaved wording changed');
   await p.click('loc=role:button[name="Section tools"]');await p.click('loc=css:[data-saved-action]');
   if(await p.evaluate(()=>window.fixtureHits)!==1)throw Error('Existing More action did not run exactly once');
  }
  if(${JSON.stringify(artifactDir)}){await fs.mkdir(${JSON.stringify(artifactDir)},{recursive:true});await fs.writeFile(${JSON.stringify(artifactDir)}+'/'+${JSON.stringify(prefix)}+'-native.json',JSON.stringify(rows,null,2));}console.log('HEADER_PROOF_COUNT:'+rows.length);
 }finally{await p.close();}
 `;
 try{
  const stdout=await new Promise((resolve,reject)=>{const child=execFile('ego-browser',['nodejs'],{timeout:85000,maxBuffer:1024*1024},(error,stdout,stderr)=>error?reject(new Error(stderr||error.message)):resolve(stdout+'\n'+stderr));child.stdin.end(script);});
  assert.match(stdout,/HEADER_PROOF_COUNT:16/,'Native browser must complete all sixteen layout and action checks');
  if(artifactDir)assert.equal(JSON.parse(await fs.readFile(path.join(artifactDir,prefix+'-native.json'),'utf8')).length,16);
 }finally{server.closeIdleConnections?.();await new Promise(resolve=>server.close(resolve));}
});
