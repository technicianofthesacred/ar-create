// Packs one direction into a single self-contained page (styles, scripts and fonts inlined) for sharing as one file.
// usage: node design/2026-11-better-interface/build-shareable.mjs <a-the-board|b-the-path|c-the-work> <out.html> "<Title>"
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const [dir,out,title]=process.argv.slice(2);
if(!dir||!out)throw Error('usage: build-shareable.mjs <direction folder> <out.html> "<Title>"');
const read=f=>fs.readFileSync(path.join(here,f),'utf8');
const css=read('kit/kit.css').replace(/url\('([^']+\.woff2)'\)/g,(_,u)=>`url(data:font/woff2;base64,${fs.readFileSync(path.resolve(here,'kit',u)).toString('base64')})`)+'\n'+read(dir+'/app.css');
const js=read('kit/kit.js')+'\n'+read(dir+'/app.js');
fs.writeFileSync(out,`<title>${title||dir}</title>\n<style>\n${css}\n</style>\n<nav id="mock" class="mock" aria-label="Mock-up screens"></nav>\n<div id="app"></div>\n<script>\n${js.replace(/<\/script/g,'<\\/script')}\n</script>\n`);
console.log('wrote',out,Math.round(fs.statSync(out).size/1024)+' KB');
