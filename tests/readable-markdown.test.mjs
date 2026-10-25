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

test('retained term aliases and underscore emphasis read naturally without changing manuscript words',()=>{
 const body='The [[term:lacquer|lacquer]] is _a single utensil or a single matter._ and __bold words__.';
 assert.equal(load()(body),'<p>The lacquer is <em>a single utensil or a single matter.</em> and <strong>bold words</strong>.</p>');
 assert.equal(body,'The [[term:lacquer|lacquer]] is _a single utensil or a single matter._ and __bold words__.');
 assert.equal(load()('[[term:<key>|<img src=x> & "alias"]]'),'<p>&lt;img src=x&gt; &amp; &quot;alias&quot;</p>');
});
test('code spans keep term aliases and both emphasis styles literal and escaped',()=>{
 assert.equal(load()('`[[term:key|<alias>]] _words_ __bold__ **stars**`'),'<p><code>[[term:key|&lt;alias&gt;]] _words_ __bold__ **stars**</code></p>');
});
test('unmatched markup, intraword underscores and filenames retain their exact visible spelling',()=>{
 const body='[[term:key|alias] _unfinished __unfinished file_name.md a_b_c foo__bar__baz 中文_词_语 _ spaced _';
 assert.equal(load()(body),'<p>'+body+'</p>');
 assert.equal(load()('_a_ (__b__) _file_name_'),'<p><em>a</em> (<strong>b</strong>) <em>file_name</em></p>');
});
test('added retained markup keeps link URL validation and HTML escaping intact',()=>{
 const html=load()('[[term:key|<script>]] _<b>_ __<i>__ [safe](https://example.test/?a=1&b=2) [bad](javascript:alert) [network](//evil.test)');
 assert.match(html,/&lt;script&gt; <em>&lt;b&gt;<\/em> <strong>&lt;i&gt;<\/strong>/);
 assert.match(html,/<a href="https:\/\/example.test\/\?a=1&amp;b=2" rel="noopener noreferrer">safe<\/a>/);
 assert.ok(!html.includes('href="javascript:'));assert.ok(!html.includes('href="//'));assert.ok(!html.includes('<script>'));
});
