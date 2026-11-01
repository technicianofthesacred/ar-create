// scripts/gen-capabilities-portable.ts
//
// PORTABLE, ZERO-CONFIG capability index — drop this one file into ANY of the
// projects (teajia, mandalacodes, Adrian-Website, erbweb, light-codes, LED-…)
// and run it. It auto-detects the repo's shape and writes docs/CAPABILITIES.md:
// a single always-current answer to "what does this project do and how do I use
// it". Because it reads the code, it can't drift.
//
//     npx tsx scripts/gen-capabilities-portable.ts            # this repo
//     npx tsx scripts/gen-capabilities-portable.ts --root ../teajia
//
// The second form is the i64os-as-OS move: from i64os you can index any sibling
// repo in the workspace without leaving home.
//
// It emits only the sections that exist, so a static site gets Commands + Pages
// + API, while a service gets Commands + API + MCP tools + Migrations. No config
// to edit. (The i64os-tuned generator is scripts/gen-capabilities.ts; this is
// the copy-me-anywhere sibling.)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function argOf(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const ROOT = path.resolve(
  argOf('--root') ?? path.dirname(fileURLToPath(import.meta.url)) + '/..',
);

function readFile(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}
function exists(rel: string): boolean {
  try {
    return fs.existsSync(path.join(ROOT, rel));
  } catch {
    return false;
  }
}
// Recursively list files under a dir (relative paths), bounded + ignoring noise.
function walk(relDir: string, exts: string[], cap = 2000): string[] {
  const out: string[] = [];
  const base = path.join(ROOT, relDir);
  const skip = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.astro', 'coverage']);
  const rec = (abs: string) => {
    if (out.length >= cap) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(abs, e.name);
      if (e.isDirectory()) rec(full);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(path.relative(ROOT, full));
    }
  };
  rec(base);
  return out.sort();
}

// ─── package.json (name + scripts = the universal "how do I use it") ─────────
interface Pkg {
  name?: string;
  scripts: Array<{ name: string; cmd: string }>;
  deps: string[];
}
function readPkg(): Pkg | null {
  const raw = readFile('package.json');
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    return {
      name: j.name,
      scripts: Object.entries(j.scripts ?? {}).map(([name, cmd]) => ({ name, cmd })),
      deps: Object.keys(j.dependencies ?? {}),
    };
  } catch {
    return null;
  }
}

// ─── HTTP endpoints (Hono/Express/itty/Cloudflare-style `.get('/path')`) ─────
const METHOD_RE = /\.(get|post|put|patch|delete|all)\(\s*[`'"]([^`'"]+)[`'"]/g;
function collectEndpoints(): Array<{ method: string; path: string; file: string }> {
  const dirs = ['apps/core/routes', 'src/routes', 'src/api', 'functions', 'api', 'src'];
  const seen = new Set<string>();
  const out: Array<{ method: string; path: string; file: string }> = [];
  for (const d of dirs) {
    if (!exists(d)) continue;
    for (const f of walk(d, ['.ts', '.js', '.tsx'])) {
      const src = readFile(f);
      if (!src) continue;
      for (const m of src.matchAll(METHOD_RE)) {
        const method = m[1].toUpperCase();
        const p = m[2];
        if (!p.startsWith('/')) continue;
        const key = `${method} ${p}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ method, path: p, file: f });
      }
    }
    if (out.length) break; // first dir that yields endpoints wins
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

// ─── Pages (file-based routing: Astro/Next/Remix/SvelteKit) ──────────────────
function collectPages(): string[] {
  const roots = ['src/pages', 'pages', 'app', 'src/app', 'src/routes'];
  for (const r of roots) {
    if (!exists(r)) continue;
    const files = walk(r, ['.astro', '.tsx', '.jsx', '.svelte', '.vue', '.md', '.mdx']);
    const pages = files
      .filter((f) => !/[._](test|spec)\./.test(f))
      .map((f) => {
        // file path → URL: strip the root + extension + index/page/+page.
        let u = f.slice(r.length).replace(/\.[^.]+$/, '');
        u = u.replace(/\/(index|page|\+page)$/i, '') || '/';
        return u.startsWith('/') ? u : '/' + u;
      });
    const uniq = [...new Set(pages)].sort();
    if (uniq.length) return uniq;
  }
  return [];
}

// ─── MCP tools (the name→description→inputSchema triad, anywhere) ─────────────
function collectMcpTools(): Array<{ name: string; description: string }> {
  const out: Array<{ name: string; description: string }> = [];
  const seen = new Set<string>();
  for (const dir of ['apps', 'src', 'mcp']) {
    if (!exists(dir)) continue;
    for (const f of walk(dir, ['.ts', '.js'])) {
      const src = readFile(f);
      if (!src || !src.includes('inputSchema')) continue;
      const re = /name:\s*"([^"]+)",\s*description:\s*([\s\S]*?)\s*inputSchema:/g;
      for (const m of src.matchAll(re)) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push({ name: m[1], description: firstSentence(cleanDesc(m[2])) });
      }
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}
function cleanDesc(raw: string): string {
  return raw
    .replace(/"\s*\+\s*\n?\s*"/g, '')
    .replace(/\\n/g, ' ')
    .replace(/^[\s"']+|[\s",']+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function firstSentence(s: string, cap = 180): string {
  const dot = s.indexOf('. ');
  const out = dot > 0 && dot < cap ? s.slice(0, dot + 1) : s;
  return out.length > cap ? out.slice(0, cap - 1).trimEnd() + '…' : out;
}

// ─── Migrations ──────────────────────────────────────────────────────────────
function collectMigrations(): { count: number; latest: string } | null {
  for (const d of ['apps/core/migrations', 'migrations', 'src/migrations', 'db/migrations']) {
    if (!exists(d)) continue;
    try {
      const files = fs
        .readdirSync(path.join(ROOT, d))
        .filter((f) => /^\d+.*\.sql$/.test(f))
        .sort();
      if (files.length) return { count: files.length, latest: files[files.length - 1] };
    } catch {
      /* skip */
    }
  }
  return null;
}

// ─── Render ──────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------
// AR Create shape. Detected by runtime/commands.mjs and agents/cli/ar-create.mjs:
// the command registry (every route the app, the CLI and the MCP server share),
// the CLI subcommands and the MCP tools. Read from the code, never typed by hand.
// ---------------------------------------------------------------------------
interface RegistryCommand {
  name: string;
  section: string;
  method: string;
  route: string;
  readOnly: boolean;
  actors: string[];
  undo?: string;
}

/** A callable that answers any property or call with another stub: lets the route map be built without services. */
function stub(): any {
  return new Proxy(function () {}, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : stub()),
    apply: () => stub(),
  });
}

/** The coordination routes server.mjs adds beside the route map (events, presence, leases, journal). */
function coordinationRoutes(): [string, string, string[]?][] {
  const src = readFile('runtime/server.mjs');
  const m = src?.match(/const extraCommands=(\[\[[^\n]*\]\]);/);
  if (!m) return [];
  try {
    return new Function('return ' + m[1])();
  } catch {
    return [];
  }
}

async function collectCommandRegistry(): Promise<RegistryCommand[]> {
  if (!exists('runtime/commands.mjs')) return [];
  try {
    const mod: any = await import(pathToFileURL(path.join(ROOT, 'runtime/commands.mjs')).href);
    const routes = mod.createRouteMap(new Proxy({}, { get: () => stub() }))({
      url: new URL('http://127.0.0.1/'), request: { headers: {} }, server: {},
      outputQuery: () => ({}), decorateOutputExports: (x: unknown) => x, describe: () => {},
    });
    return mod.describeRoutes(routes, coordinationRoutes()).map(mod.publicEntry);
  } catch (error) {
    console.error('gen-capabilities: could not read runtime/commands.mjs:', (error as Error).message);
    return [];
  }
}

interface CliShape { commands: string[]; sugar: Record<string, Record<string, string>>; actors: string[]; exitCodes: Record<string, string> }
async function collectCli(): Promise<CliShape | null> {
  if (!exists('agents/cli/ar-create.mjs')) return null;
  try {
    const mod: any = await import(pathToFileURL(path.join(ROOT, 'agents/cli/ar-create.mjs')).href);
    return { commands: mod.USAGE.commands, sugar: mod.SUGAR, actors: mod.USAGE.actors, exitCodes: mod.USAGE.exitCodes };
  } catch (error) {
    console.error('gen-capabilities: could not read agents/cli/ar-create.mjs:', (error as Error).message);
    return null;
  }
}

/** MCP tools declared as ['tool_name', 'description', schema, readOnly] rows in agents/mcp/server.mjs and mcp/study/server.mjs. */
function collectArCreateMcpTools(): { name: string; description: string; file: string }[] {
  const out: { name: string; description: string; file: string }[] = [];
  const seen = new Set<string>();
  for (const file of ['agents/mcp/server.mjs', 'mcp/study/server.mjs']) {
    const src = readFile(file);
    if (!src) continue;
    for (const m of src.matchAll(/\n\s*\['([a-z][a-z0-9_]*)',\s*'((?:[^'\\]|\\.)*)'/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      out.push({ name: m[1], description: firstSentence(m[2].replace(/\\'/g, "'")), file });
    }
  }
  return out;
}

async function main(): Promise<void> {
  const pkg = readPkg();
  const endpoints = collectEndpoints();
  const pages = collectPages();
  const tools = collectMcpTools();
  const migrations = collectMigrations();
  const registry = await collectCommandRegistry();
  const cli = await collectCli();
  const arTools = registry.length ? collectArCreateMcpTools() : [];

  const name = pkg?.name ?? path.basename(ROOT);
  const L: string[] = [];
  L.push(`# ${name} — Capabilities`);
  L.push('');
  L.push('> **GENERATED — do not edit by hand.** Rerun');
  L.push(
    pkg?.scripts.some((s) => s.name === 'capabilities')
      ? '> `npm run build` (it regenerates this file). It indexes discoverable source declarations; enabled runtime interfaces may add commands.'
      : '> `npx tsx scripts/gen-capabilities-portable.ts`. It indexes discoverable source declarations; enabled runtime interfaces may add commands.',
  );
  // No timestamp: the file is a pure function of the source, so `npm run build` leaves a clean tree when nothing changed.
  L.push('> Regenerated by `npm run build`; never edited by hand.');
  L.push('');
  const at: string[] = [];
  if (pkg) at.push(`${pkg.scripts.length} commands`);
  if (endpoints.length) at.push(`${endpoints.length} endpoints`);
  if (pages.length) at.push(`${pages.length} pages`);
  if (tools.length) at.push(`${tools.length} MCP tools`);
  if (registry.length) at.push(`${registry.length} registry commands`);
  if (cli) at.push(`${cli.commands.length} CLI command groups`);
  if (arTools.length) at.push(`${arTools.length} AR Create MCP tools`);
  if (migrations) at.push(`migration head \`${migrations.latest}\``);
  L.push(`**At a glance:** ${at.join(' · ') || 'no auto-detected capabilities'}.`);
  L.push('');

  if (pkg && pkg.scripts.length) {
    L.push('## Commands (how to use it)');
    L.push('');
    L.push('| script | runs |');
    L.push('|---|---|');
    for (const s of pkg.scripts) L.push(`| \`npm run ${s.name}\` | \`${s.cmd.replace(/\|/g, '\\|')}\` |`);
    L.push('');
  }

  if (pages.length) {
    L.push('## Pages');
    L.push('');
    for (const p of pages) L.push(`- \`${p}\``);
    L.push('');
  }

  if (endpoints.length) {
    L.push('## HTTP API');
    L.push('');
    for (const e of endpoints) L.push(`- \`${e.method.padEnd(6)} ${e.path}\`  _(${e.file})_`);
    L.push('');
  }

  if (tools.length) {
    L.push('## MCP tools');
    L.push('');
    for (const t of tools) L.push(`- **\`${t.name}\`** — ${t.description}`);
    L.push('');
  }

  if (registry.length) {
    const bySection = new Map<string, RegistryCommand[]>();
    for (const c of registry) bySection.set(c.section, [...(bySection.get(c.section) ?? []), c]);
    L.push('## Command registry (routes shared by the app, the CLI and the MCP server)');
    L.push('');
    L.push(`${registry.length} commands from \`runtime/commands.mjs\`; the running app serves its complete enabled list at \`GET /api/capabilities\`. Call one with \`node agents/cli/ar-create.mjs call <name> --input -\`. **who**: \`any\` actor, or \`human\` for a decision agents are refused (403). **kind**: \`read\` or \`write\`; a write names an \`undo\` command when it has one.`);
    L.push('');
    for (const [section, list] of [...bySection].sort(([a], [b]) => a.localeCompare(b))) {
      L.push(`### ${section} (${list.length})`);
      L.push('');
      L.push('| name | route | who | kind |');
      L.push('|---|---|---|---|');
      for (const c of list.sort((a, b) => a.name.localeCompare(b.name))) {
        L.push(`| \`${c.name}\` | \`${c.method} ${c.route}\` | ${c.actors.join(', ')} | ${c.readOnly ? 'read' : 'write'}${c.undo ? ` · undo \`${c.undo}\`` : ''} |`);
      }
      L.push('');
    }
  }

  if (cli) {
    L.push('## CLI (agents/cli/ar-create.mjs)');
    L.push('');
    L.push('`node agents/cli/ar-create.mjs --url http://127.0.0.1:PORT --actor ACTOR COMMAND [--input FILE|-]`. JSON in, one JSON line out. `AR_CREATE_URL` and `AR_CREATE_ACTOR` are the defaults for `--url` and `--actor`.');
    L.push('');
    L.push(`Actors: ${cli.actors.map((a) => `\`${a}\``).join(', ')}.`);
    L.push('');
    L.push('Exit codes: ' + Object.entries(cli.exitCodes).map(([code, meaning]) => `${code} = ${meaning}`).join('; ') + '.');
    L.push('');
    L.push('| subcommand | does |');
    L.push('|---|---|');
    for (const [domain, verbs] of Object.entries(cli.sugar)) {
      for (const [verb, command] of Object.entries(verbs)) L.push(`| \`${domain} ${verb}\` | registry command \`${command}\` |`);
    }
    for (const c of cli.commands.filter((c) => !Object.keys(cli.sugar).some((d) => c.startsWith(d + ' ')))) L.push(`| \`${c.replace(/\|/g, '\\|')}\` | coordination and discovery |`);
    L.push('');
  }

  if (arTools.length) {
    L.push('## MCP tools (agents/mcp/server.mjs and mcp/study/server.mjs)');
    L.push('');
    for (const t of arTools) L.push(`- **\`${t.name}\`** — ${t.description} _(${t.file})_`);
    L.push('');
  }

  if (migrations) {
    L.push('## Migrations');
    L.push('');
    L.push(`Head: \`${migrations.latest}\` · ${migrations.count} total.`);
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push(
    '_Generated by `scripts/gen-capabilities-portable.ts` (auto-detects scripts, ' +
      'pages, API routes, MCP tools, migrations; and, where present, the AR Create command registry, CLI and MCP tools). Copy that one file into any repo ' +
      'and run it — no config._',
  );

  const outPath = path.join(ROOT, 'docs/CAPABILITIES.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, L.join('\n') + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${path.relative(process.cwd(), outPath)} — ${at.join(' · ') || 'empty'}.`);
}

await main();
