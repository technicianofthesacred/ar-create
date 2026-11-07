// The chat mirror of the Instagram studio: the studio's own screen, one part at a time, drawn as an agent so a picture
// in chat can never press one of Adrian's buttons. The page has to load under the app's script-src 'self' policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const page = fs.readFileSync(new URL('../public/document-study/instagram-mirror.html', import.meta.url), 'utf8');
const script = fs.readFileSync(new URL('../public/document-study/instagram-mirror.js', import.meta.url), 'utf8');

test('the mirror page has no inline script and opens the studio as an agent before the studio loads', () => {
  assert.doesNotMatch(page, /<script>(?!<\/script>)/, 'inline script is refused by the app policy');
  const order = [...page.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(order, ['instagram-mirror.js', 'instagram-studio.js']);
  assert.match(script, /arCreateUiActor=\{actor:'agent:claude-code'\}/);
  assert.doesNotMatch(script, /human:/);
});

test('every part the tool asks for names a section the studio draws', () => {
  const studio = fs.readFileSync(new URL('../public/document-study/instagram-studio.js', import.meta.url), 'utf8');
  for (const label of ['Material', 'Coverage of the whole recording', 'Possible stories', 'Words to confirm', 'Made', 'Research worth doing']) {
    assert.ok(script.includes(`'${label}'`), `mirror keeps ${label}`);
    assert.ok(studio.includes(`aria-label="${label}"`), `studio draws ${label}`);
  }
});

test('memo-show refuses to run without a plan id', () => {
  const r = spawnSync(process.execPath, [new URL('../agents/memo/memo-show.mjs', import.meta.url).pathname], {encoding: 'utf8'});
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: memo-show/);
});

// A fresh navigation must qualify the pixels it actually returns, not borrow
// readiness from the sizing pass. This fake headless binary exercises that seam.
for(const fixture of [
 {name:'failed capture navigation',first:'<body data-mirror="ready" data-height="500" data-revision="1">',capture:'<body data-mirror="failed" data-error="Invented capture failure">',error:/Invented capture failure/},
 {name:'oversized part',first:'<body data-mirror="ready" data-height="16001" data-revision="1">',capture:'',error:/too tall/},
 {name:'changed revision during capture',first:'<body data-mirror="ready" data-height="500" data-revision="1">',capture:'<body data-mirror="ready" data-height="500" data-revision="2">',error:/changed/}
])test('memo-show refuses '+fixture.name+' without reporting a successful PNG', async t => {
 const os=await import('node:os'),path=await import('node:path'),http=await import('node:http'),{execFile}=await import('node:child_process'),{promisify}=await import('node:util');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mirror-check-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bin=path.join(root,'chromium_headless_shell-999999','chrome-headless-shell-mac-arm64','chrome-headless-shell');fs.mkdirSync(path.dirname(bin),{recursive:true});
 const counter=path.join(root,'counter');
 fs.writeFileSync(bin,'#!'+process.execPath+'\n'+`const fs=require('node:fs'),p=${JSON.stringify(counter)};const n=fs.existsSync(p)?+fs.readFileSync(p):0;fs.writeFileSync(p,String(n+1));const shot=process.argv.find(a=>a.startsWith('--screenshot='));if(shot)fs.writeFileSync(shot.slice(13),'fake PNG');console.log(n===0?${JSON.stringify(fixture.first)}:${JSON.stringify(fixture.capture)});`,{mode:0o700});
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({title:'Invented mirror test',stories:[],layouts:{},revision:1}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const {stdout}=await promisify(execFile)(process.execPath,[new URL('../agents/memo/memo-show.mjs',import.meta.url).pathname,'11111111-2222-4333-8444-555555555555','--parts','material'],{env:{...process.env,AR_CREATE_URL:'http://127.0.0.1:'+server.address().port,PLAYWRIGHT_BROWSERS_PATH:root},timeout:10000});
 const picture=JSON.parse(stdout).pictures[0];assert.equal(picture.file,undefined);assert.match(picture.error,fixture.error);
});

test('a made picture includes the whole caption and waits for the frame fonts', async t => {
 const {createRequire}=await import('node:module'),require=createRequire(new URL('../runtime/package.json',import.meta.url));
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<div class="igs-body"><section aria-label="Made"><iframe src="http://mirror.test/frame"></iframe><textarea rows="5">A long invented final caption.</textarea></section></div>',{url:'http://mirror.test/?part=made',runScripts:'outside-only'}),w=dom.window;
 t.after(()=>w.close());await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
 const frame=w.document.querySelector('iframe'),field=w.document.querySelector('textarea');
 Object.defineProperties(field,{scrollHeight:{value:200},clientHeight:{value:40},offsetHeight:{value:42}});
 let finishFonts;const fonts=new Promise(resolve=>finishFonts=resolve);
 Object.defineProperty(frame,'contentDocument',{value:{readyState:'complete',URL:frame.src,contentType:'text/html',body:{children:[{}]},fonts:{ready:fonts},images:[]}});
 Object.defineProperty(w.document,'fonts',{value:{ready:Promise.resolve()}});
 w.arInstagram={open:async()=>{},state:()=>({revision:3,layouts:{post:{}}})};
 w.eval(script);w.dispatchEvent(new w.Event('load'));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(w.document.body.dataset.mirror,undefined,'a frame with pending fonts is not a ready picture');
 assert.ok(parseInt(field.style.height)>=field.scrollHeight,'the whole readonly caption is in the picture');
 finishFonts();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(w.document.body.dataset.mirror,'ready');assert.equal(w.document.body.dataset.revision,'3');
});
