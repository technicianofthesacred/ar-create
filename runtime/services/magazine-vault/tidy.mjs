// One draft per story: the plan of ~/builds/mag-tidy.mjs (2026-10-21), ported so AR Create makes the
// moves itself under the lock. Kept per story: the newest whole draft (frontmatter updated:, else file
// time), every part, the NOTES of each kept draft and the newest CHECK. Everything else of that story's
// DEV, NOTES and CHECK files moves to _archive/Superseded drafts/<story>/. Nothing is deleted. Sources
// (SRC, CONTEXT, MOMENTS, MAP, PLANS) are never touched. Plain renames (no git commit; the vault's
// own history records them when Adrian commits).
import fs from 'node:fs';
import path from 'node:path';

export function planTidy({vault, board}) {
  const W = path.join(vault, 'Workflow');
  const fm = p => { try { return (fs.readFileSync(p, 'utf8').match(/^---\n([\s\S]*?)\n---/) || [, ''])[1]; } catch { return ''; } };
  const updated = p => (fm(p).match(/^updated:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || new Date(fs.statSync(p).mtimeMs).toISOString().slice(0, 10);
  const lead = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
  const ls = (d, k) => { try { return fs.readdirSync(path.join(W, d)).filter(f => f.startsWith(`${k} - `) && f.endsWith('.md')); } catch { return []; } };
  const belongs = (f, kind, story) => {
    const t = lead(f.replace(new RegExp(`^${kind} - `), ''));
    if (t === lead(story) || t.startsWith(lead(story))) return true;
    const a = fm(path.join(W, kind === 'CHECK' ? '4-Review' : '3-Develop', f)).match(/^aliases:\s*\n((?:\s+-.*\n?)+)/m);
    return !!a && a[1].split('\n').some(l => lead(l.replace(/^\s*-\s*/, '').replace(/['"]/g, '')) === lead(story));
  };
  const variant = (f, kind) => f.replace(new RegExp(`^${kind} - `), '').replace(/\.md$/, '');
  const moves = [], keeps = [];
  for (const b of board.board) {
    const devs = ls('3-Develop', 'DEV').filter(f => belongs(f, 'DEV', b.story));
    if (!devs.length) continue;
    const parts = devs.filter(f => /^part:\s*\d/m.test(fm(path.join(W, '3-Develop', f))));
    const whole = devs.filter(f => !parts.includes(f)).sort((x, y) => updated(path.join(W, '3-Develop', y)).localeCompare(updated(path.join(W, '3-Develop', x))) || fs.statSync(path.join(W, '3-Develop', y)).mtimeMs - fs.statSync(path.join(W, '3-Develop', x)).mtimeMs);
    const keepDev = new Set([whole[0], ...parts].filter(Boolean));
    const keepVariants = new Set([...keepDev].map(f => variant(f, 'DEV')));
    const to = (d, f) => ({story: b.story, from: `Workflow/${d}/${f}`, to: `_archive/Superseded drafts/${b.story}/${f}`});
    for (const f of devs) if (!keepDev.has(f)) moves.push(to('3-Develop', f));
    for (const f of ls('3-Develop', 'NOTES').filter(f => belongs(f, 'NOTES', b.story))) if (!keepVariants.has(variant(f, 'NOTES'))) moves.push(to('3-Develop', f));
    const checks = ls('4-Review', 'CHECK').filter(f => belongs(f, 'CHECK', b.story)).sort((x, y) => fs.statSync(path.join(W, '4-Review', y)).mtimeMs - fs.statSync(path.join(W, '4-Review', x)).mtimeMs);
    for (const f of checks.slice(1)) moves.push(to('4-Review', f));
    keeps.push({story: b.story, drafts: [...keepDev], check: checks[0] || null});
  }
  return {moves, keeps};
}
