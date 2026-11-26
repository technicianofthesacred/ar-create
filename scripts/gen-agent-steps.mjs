#!/usr/bin/env node
// Writes docs/AGENT-STEPS.md from runtime/agent-guide.mjs, so the document an agent reads and the guide the app serves
// (agent.guide, ar_create_guide, `guide`) are one source. Run by `npm run build`; tests/agent-guide.test.mjs fails when
// the document is out of date. `--check` exits 1 instead of writing.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {AGENTS, REACH, RULES, STEPS} from '../runtime/agent-guide.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = path.join(repo, 'docs/AGENT-STEPS.md');
const code = list => list?.length ? list.map(n => '`' + n + '`').join(', ') : 'none';

export function render() {
 const out = [
  '# Working through a story: the step guide for every agent',
  '',
  '> **GENERATED from `runtime/agent-guide.mjs`. Do not edit by hand.** Rerun `npm run build` (or `node scripts/gen-agent-steps.mjs`).',
  '> The app serves the same guide live: `agent.guide` (`GET /api/agent/guide?parentStudyId=<story>`), the MCP tool `ar_create_guide`, and `node agents/cli/ar-create.mjs guide story <story>`. With a story named, each step carries its state now and the next step is named.',
  '',
  'This is how any agent (Claude, Codex, Hermes, Grok, ChatGPT and the rest) works through a story with Adrian. Each step says what Adrian gives, what the agent does, the commands to read where it stands, the commands the agent may call to move it on, and the decisions that are his alone. The steps are the ones the story page shows, in its order. Permissions are in [AGENTS](../AGENTS.md); practice and lessons are in [Working with Adrian](AGENT-PLAYBOOK.md).',
  '',
  '## Who you are',
  '',
  '| agent | actor |', '|---|---|',
  ...AGENTS.map(a => `| ${a.who} | \`${a.actor}\` |`),
  '',
  'An agent not listed here has no name in the app yet, and every write from it is refused. Ask Adrian to add it rather than borrowing another agent\'s name.',
  '',
  '## How to reach the app',
  '',
  ...REACH.map(r => `- **${r.how}:** ${r.use.replace(/<home>/g, '~/Library/Application Support/i64os/ar-create')}`),
  '',
  'Then call any command by name with JSON input. `GET /api/capabilities` (or `list-commands`, or `ar_create_list_commands`) lists every command with its fields, whether it only reads, and whether it is his alone.',
  '',
  '## Rules for every step',
  '',
  ...RULES.map((r, i) => `${i + 1}. ${r}`),
  '',
  '## The steps',
  '',
  'A Magazine story has the steps marked **Magazine**. A subject kept in AR Create itself has its form\'s steps (an Article, a Carousel or a post); the ones only it has are marked **AR Create subject**.',
  '',
 ];
 for (const s of STEPS) {
  out.push(`### ${s.group}: ${s.name} (\`${s.id}\`)`, '', `**Adrian gives:** ${s.youGive}`, '', `**The agent does:** ${s.agentDoes}`, '');
  for (const [kind, label] of [['magazine', 'Magazine'], ['subject', 'AR Create subject']]) {
   const k = s[kind]; if (!k) continue;
   out.push(`**${label}**`, '', `1. Read: ${code(k.read)}`, `2. Do: ${code(k.do)}`, `3. His alone (refused to agents with 403): ${code(k.yours)}`);
   if (k.files) out.push('', k.files);
   out.push('');
  }
  out.push(`**Done when:** ${s.doneWhen}`, '');
 }
 out.push('## How this guide stays true', '',
  '- `tests/agent-guide.test.mjs` checks every command named here against the running registry: it exists, every "Read" only reads, every "Do" is open to agents, and every "His alone" is refused to them. It also checks this document matches the guide.',
  '- `node scripts/walk-steps.mjs --url http://127.0.0.1:8854 --actor <actor> --story <story>` walks every step of a Magazine story as that agent on the demo (`npm run demo`), following the guide, and reports what each step showed before and after. It refuses the installed app on 8841.',
  '');
 return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const text = render();
 if (process.argv.includes('--check')) {const now = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : ''; if (now !== text) {console.error('docs/AGENT-STEPS.md is out of date; run node scripts/gen-agent-steps.mjs.'); process.exit(1);} }
 else {fs.writeFileSync(FILE, text); console.log('Wrote docs/AGENT-STEPS.md');}
}
