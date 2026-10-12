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
import { fileURLToPath } from 'node:url';

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
function main(): void {
  const pkg = readPkg();
  const endpoints = collectEndpoints();
  const pages = collectPages();
  const tools = collectMcpTools();
  const migrations = collectMigrations();

  const name = pkg?.name ?? path.basename(ROOT);
  const L: string[] = [];
  L.push(`# ${name} — Capabilities`);
  L.push('');
  L.push('> **GENERATED — do not edit by hand.** Rerun');
  L.push('> `npx tsx scripts/gen-capabilities-portable.ts`. It reads the code, so it cannot drift.');
  L.push(`> Generated ${new Date().toISOString()}.`);
  L.push('');
  const at: string[] = [];
  if (pkg) at.push(`${pkg.scripts.length} commands`);
  if (endpoints.length) at.push(`${endpoints.length} endpoints`);
  if (pages.length) at.push(`${pages.length} pages`);
  if (tools.length) at.push(`${tools.length} MCP tools`);
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
      'pages, API routes, MCP tools, migrations). Copy that one file into any repo ' +
      'and run it — no config._',
  );

  const outPath = path.join(ROOT, 'docs/CAPABILITIES.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, L.join('\n') + '\n', 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Wrote ${path.relative(process.cwd(), outPath)} — ${at.join(' · ') || 'empty'}.`);
}

main();
