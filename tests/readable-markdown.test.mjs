import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const window={};const location=new URL('../public/document-study/readable-markdown.js',import.meta.url);
const load=()=>{vm.runInNewContext(fs.readFileSync(location,'utf8'),{window});return window.studyReadableMarkdown.render;};
test('research Markdown renders numbered findings as real list items, preserving numbering and paragraphs',()=>{const render=load(),html=render('## Findings\n\nAn introduction.\n1. First finding. Evidence stays here.\n2. Second finding. Citation p15.\n\n### Other view\n\n5. A later numbered finding.');assert.match(html,/<ol start="1">/);assert.equal((html.match(/<li(?:\s|>)/g)||[]).length,3);assert.match(html,/<ol start="5">/);assert.ok(!html.includes('1. First'));assert.match(html,/Evidence stays here/);});
test('a source list after an introductory line is semantic rather than a paragraph full of dash lines',()=>{const html=load()('Core sources\n- Source one, p3.\n- Source two, p15.');assert.match(html,/<p>Core sources<\/p><ul>/);assert.equal((html.match(/<li(?:\s|>)/g)||[]).length,2);});
test('reader never executes supplied HTML, unsafe links or code fences',()=>{const html=load()('<img src=x onerror=alert(1)>\n\n[bad](javascript:alert)\n\n```html\n<script>bad()</script>\n```');assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script'));assert.ok(!html.includes('href="javascript:'));assert.match(html,/&lt;script&gt;/);});

test('quoted source passages render as readable quotations without Markdown markers or executable HTML',()=>{
 const out=load()('Before.\n\n> A **specific** observation.\n> <script>unsafe()</script>\n\nAfter.');
 assert.match(out,/<blockquote><p>A <strong>specific<\/strong> observation\.<br>&lt;script&gt;unsafe\(\)&lt;\/script&gt;<\/p><\/blockquote>/);
 assert.equal(out.includes('<script>'),false);assert.match(out,/<p>After\.<\/p>/);
});
test('quote-looking code and greater-than comparisons remain literal',()=>{
 const out=load()('```\n> literal code\n```\n\nThe value is > 2.');assert.match(out,/<pre><code>&gt; literal code<\/code><\/pre>/);assert.match(out,/The value is &gt; 2/);assert.equal(out.includes('<blockquote>'),false);
});
