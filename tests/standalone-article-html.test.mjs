import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../runtime/node_modules/esbuild/lib/main.js';
const built=await build({entryPoints:['runtime/src/workspaces/standaloneArticleHtml.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {standaloneArticleHtml}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const origin='http://127.0.0.1:8859',photo='/api/review/magazine-media/file?revision=synthetic&sourceId=fixture';
const assets=new Map([
 ['/assets/canvas.css',new Response('@font-face{font-family:Reader;src:url("/assets/fonts/reader.woff2")} .photo{object-position:40% 60%}')],
 ['/assets/fonts/wordforge.css',new Response('@font-face{font-family:Control;src:url(control.ttf)}')],
 ['/assets/fonts/reader.woff2',new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'font/woff2'}})],
 ['/assets/fonts/control.ttf',new Response(new Uint8Array([4,5,6]),{headers:{'Content-Type':'font/ttf'}})],
 [photo,new Response(new Uint8Array([7,8,9]),{headers:{'Content-Type':'image/png'}})],
]);
const readAsset=async value=>assets.get(new URL(value,origin).pathname+new URL(value,origin).search)?.clone()||new Response('',{status:404});
const options=()=>({origin,readAsset,stylesheetUrl:'/assets/canvas.css',title:'Synthetic < & " title',imageAssets:[photo],markup:'<main><h1>Invented 茶</h1><img src="'+photo.replaceAll('&','&amp;')+'" style="object-position:40% 60%"/><p>Credit: invented person</p></main>'});
test('standalone bytes embed inspected photos and relative/absolute font resources, preserving maintained markup',async()=>{
 const html=await standaloneArticleHtml(options());assert.match(html,/Synthetic &lt; &amp; &quot; title/);assert.match(html,/Invented 茶/);assert.match(html,/Credit: invented person/);assert.match(html,/object-position:40% 60%/);assert.match(html,/data:image\/png;base64,BwgJ/);assert.match(html,/data:font\/woff2;base64,AQID/);assert.match(html,/data:font\/ttf;base64,BAUG/);assert.doesNotMatch(html,/\/api\/|\/assets\/|127\.0\.0\.1|\/Users\/|\/private\//);
});
test('missing image/font/styles fail closed',async()=>{
 for(const missing of [photo,'/assets/fonts/reader.woff2','/assets/canvas.css'])await assert.rejects(standaloneArticleHtml({...options(),readAsset:async value=>new URL(value,origin).pathname+new URL(value,origin).search===missing?new Response('',{status:404}):readAsset(value)}),/could not be included/);
});
test('unknown, external, redirected and unsupported assets refuse',async()=>{
 await assert.rejects(standaloneArticleHtml({...options(),imageAssets:[]}),/inspected/);
 await assert.rejects(standaloneArticleHtml({...options(),imageAssets:['https://external.invalid/image.png']}),/same-origin/);
 await assert.rejects(standaloneArticleHtml({...options(),readAsset:async value=>String(value).includes('reader.woff2')?{ok:true,redirected:true}:readAsset(value)}),/could not be included/);
 await assert.rejects(standaloneArticleHtml({...options(),readAsset:async value=>String(value).includes('sourceId=fixture')?new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}}):readAsset(value)}),/unsupported media/);
});
test('unsupported active markup and remaining resource forms refuse',async()=>{
 for(const markup of ['<script>alert(1)</script>','<img srcset="/unknown 2x">',"<img src='/unknown'>",'<link rel="stylesheet" href="/private/styles.css">','<div style="background:url(/private/image)"></div>'])await assert.rejects(standaloneArticleHtml({...options(),markup}));
});
test('CSS imports and external font dependencies refuse',async()=>{
 for(const css of ['@import "/private/theme.css";','@font-face{src:url(https://outside.invalid/font.woff2)}'])await assert.rejects(standaloneArticleHtml({...options(),readAsset:async value=>value==='/assets/canvas.css'?new Response(css):readAsset(value)}));
});
test('byte limit bounds input, accumulated assets and final base64 expansion',async()=>{
 await assert.rejects(standaloneArticleHtml({...options(),maxBytes:10}),/byte limit/);
 await assert.rejects(standaloneArticleHtml({...options(),maxBytes:500}),/byte limit/);
 await assert.rejects(standaloneArticleHtml({...options(),maxBytes:33*1024*1024}),/32 MB/);
});

test('native output wrapper keeps editorial guards and maintained saved words/photo crops',async()=>{
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url));
 const bundle=await build({entryPoints:['runtime/src/workspaces/exportOutput.tsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},jsx:'automatic'});
 const module={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,module,module.exports);
 const {outputHtml}=module.exports,paragraph={id:'synthetic-paragraph',attributions:[],doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Exact saved synthetic words.'}]}]}},doc={title:'Synthetic native article',paragraphs:[paragraph]},output={id:'synthetic-output',kind:'article',title:'Synthetic native article',manuscriptRevision:3,placements:[{id:'synthetic-photo',slot:'cover',url:photo,x:.4,y:.6,zoom:1,alt:'Invented vessel'}]};
 const before=globalThis.location;globalThis.location={origin};try{
  const html=await outputHtml(doc,output,{readAsset,stylesheetUrl:'/assets/canvas.css'});assert.match(html,/Exact saved synthetic words/);assert.match(html,/Invented vessel/);assert.match(html,/40\.0% 60\.0%/);assert.doesNotMatch(html,/\/api\//);
  for(const text of ['==Unapproved synthetic prose==','%%you: Synthetic editorial note%%'])await assert.rejects(outputHtml({...doc,paragraphs:[{...paragraph,doc:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]}}]},output,{readAsset}),/Approve|editorial/);
 }finally{if(before===undefined)delete globalThis.location;else globalThis.location=before;}
});
