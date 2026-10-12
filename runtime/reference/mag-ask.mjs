// Generic ASK parser and exact decision-file writer from the owned Magazine donor.

import fs from 'fs';
import path from 'path';

const today = () => new Date().toISOString().slice(0, 10);

export function parseAsk(text) {
  const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const meta = Object.fromEntries(fm.split('\n').map(l => l.match(/^([\w-]+):\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]));
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const questions = body.split(/^## /m).slice(1).map((chunk, index) => {
    const [title, ...lines] = chunk.split('\n');
    const q = { index, title: title.trim(), context: [], read: null, options: [], other: false, text: false, answer: '', answered: '' };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if (!l) continue;
      if ((m = l.match(/^read:\s*([^|]+?)\s*(?:\|\s*(.+))?$/))) { const r = { file: m[1], label: m[2] || 'Read it' }; (q.reads ||= []).push(r); q.read ||= r; }
      else if ((m = l.match(/^- \[( |x|X)\]\s*(.+)$/))) {
        const rec = /\(recommended\)\s*$/i.test(m[2]);
        q.options.push({ label: m[2].replace(/\s*\(recommended\)\s*$/i, ''), recommended: rec, chosen: m[1] !== ' ' });
      } else if ((m = l.match(/^- other(?::\s*(.+))?$/i))) { q.other = true; q.otherLabel = m[1] || ''; }
      else if ((m = l.match(/^answer:\s*(.*)$/))) { q.text = true; q.answer = m[1]; }
      else if ((m = l.match(/^answered:\s*(.*)$/))) q.answered = m[1];
      // A line research changed: the page shows these together as one ledger (who, when, said, suggested).
      else if ((m = l.match(/^(who|at|said|suggested|why|telling):\s*(.*)$/))) (q.line ||= {})[m[1]] = m[2];
      else if (!/^#/.test(l)) q.context.push(l);
    }
    const picked = q.options.find(o => o.chosen);
    q.value = picked ? picked.label : q.answer;
    q.open = !q.answered;
    return q;
  });
  return { meta, questions };
}

export function answer(mag, file, index, value) {
  const abs = path.resolve(mag, file);
  if (!abs.startsWith(path.resolve(mag, 'Workflow') + path.sep) || !/^ASK - .+\.md$/.test(path.basename(abs))) throw new Error('not an ASK file');
  const text = fs.readFileSync(abs, 'utf8');
  const head = text.match(/^---\n[\s\S]*?\n---\n?/)?.[0] || '';
  const parts = text.slice(head.length).split(/^(?=## )/m);
  const qChunks = parts.filter(p => p.startsWith('## '));
  const chunk = qChunks[index];
  if (!chunk) throw new Error('no such question');
  const { questions, meta } = parseAsk(text);
  const q = questions[index];
  value = String(value).trim().replace(/\n+/g, ' ');
  if (!value) throw new Error('empty answer');
  let lines = chunk.split('\n').filter(l => !/^answered:/.test(l.trim()));
  if (q.text) {
    lines = lines.map(l => /^answer:/.test(l.trim()) ? `answer: ${value}` : l);
  } else {
    const known = q.options.some(o => o.label === value);
    if (!known && !q.other) throw new Error('not one of the choices');
    lines = lines.map(l => {
      const m = l.match(/^(\s*)- \[( |x|X)\]\s*(.+)$/);
      if (!m) return l;
      const label = m[3].replace(/\s*\(recommended\)\s*$/i, '');
      return `${m[1]}- [${label === value ? 'x' : ' '}] ${m[3]}`;
    });
    if (!known) {
      const at = lines.findIndex(l => /^- other(:.*)?$/i.test(l.trim()));
      lines.splice(at, 0, `- [x] ${value}`);
    }
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines.push(`answered: ${today()}`, '', '');
  const newChunk = lines.join('\n');
  const out = head + parts.map(p => (p === chunk ? newChunk : p)).join('');
  fs.writeFileSync(abs, out);

  // Also on the record it belongs to: a dated line under "## Adrian's decisions".
  if (meta['record-to']) {
    const rec = path.resolve(mag, meta['record-to']);
    if (rec.startsWith(path.resolve(mag, 'Workflow') + path.sep) && fs.existsSync(rec)) {
      let r = fs.readFileSync(rec, 'utf8');
      const tag = `- ${today()}: ${q.title}: `;
      const line = `${tag}${value} (picked on the magazine page)`;
      // A change of mind the same day replaces that day's page answer; earlier days are never touched.
      r = r.split('\n').filter(l => !(l.startsWith(tag) && l.endsWith('(picked on the magazine page)'))).join('\n');
      const h = r.match(/^## Adrian's decisions.*$/m);
      if (h) {
        // After the last line of the decisions section, so the list stays oldest to newest.
        const start = h.index + h[0].length;
        const next = r.slice(start).search(/^## /m);
        const end = next < 0 ? r.length : start + next;
        r = r.slice(0, start) + r.slice(start, end).replace(/\s*$/, `\n${line}\n`) + (next < 0 ? '' : '\n' + r.slice(end));
      } else r = r.replace(/\s*$/, `\n\n## Adrian's decisions (dated, never overwritten)\n\n${line}\n`);
      fs.writeFileSync(rec, r);
    }
  }
  return parseAsk(fs.readFileSync(abs, 'utf8')).questions[index];
}

export function listAsks(mag) {
  const dir = path.join(mag, 'Workflow');
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^ASK - .+\.md$/.test(f)); } catch {}
  return files.map(f => {
    const { meta, questions } = parseAsk(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { file: `Workflow/${f}`, story: meta.story || f.replace(/^ASK - |\.md$/g, ''), questions };
  });
}
