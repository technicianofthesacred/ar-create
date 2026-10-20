import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const css=read('./c3-theme.css'),html=read('./index.html'),study=read('./study.js');

test('the theme loads after every other stylesheet so it wins without !important wars',()=>{
 const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
 assert.equal(links.at(-1),'c3-theme.css');
});

test('dark is the default only when no theme was ever saved',()=>{
 assert.match(study,/if\(!state\.theme\)state\.theme='dark'/);
 assert.doesNotMatch(study,/state\.theme='dark';save\(\)/,'a saved Light or System choice is never overwritten');
});

test('every font the theme names is bundled locally; no network fonts',()=>{
 const urls=[...css.matchAll(/url\('([^']+)'\)/g)].map(m=>m[1]);
 assert.ok(urls.length>=6);
 for(const u of urls){assert.match(u,/^\/assets\/fonts\//);assert.ok(fs.existsSync(new URL('../../runtime/public'+u,import.meta.url)),u);}
 assert.doesNotMatch(css,/googleapis|https?:/);
 assert.ok(fs.existsSync(new URL('../../runtime/public/assets/fonts/PLUS-JAKARTA-SANS-LICENSE.txt',import.meta.url)));
});

test('the theme leaves slide templates, manuscript type and portrait previews alone',()=>{
 assert.doesNotMatch(css,/\.(slide|slideProse|catalog|car-|ig-)[^{]*\{[^}]*font-family/);
 assert.doesNotMatch(css,/--atlas-(prose|heading)-font/);
 assert.doesNotMatch(css,/shared-prose-font/);
});

test('the default layer has bare-element weight so module rules always win, and loads before the theme',()=>{
 const d=read('./c3-defaults.css');
 for(const rule of d.split('}').map(r=>r.trim()).filter(r=>r&&!r.startsWith('/*'))){const sel=rule.split('{')[0].replace(/\/\*[\s\S]*?\*\//g,'').trim();for(const part of sel.split(/,(?![^(]*\))/))assert.match(part.trim(),/^:where\([^)]*\) [a-z0-9]+(:[a-z-]+)?$/,'bare element: '+part);}
 const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m=>m[1]);
 assert.equal(links.at(-2),'c3-defaults.css');
});
