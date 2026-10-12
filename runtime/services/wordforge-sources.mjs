// Adapted directly from i64os/apps/core/lib/wordforge/sources.ts.
// File-first shelf, source kinds, frontmatter, stub and conflict semantics retained.
// Root isolation, identity and safe mutation live in library.mjs.
import fs from "node:fs";
import path from "node:path";
                                                                                             

                             
                                                                                    
                   
                                                                       
                   
                     
                               
                                                                                 
                                                                                   
                                                                             
                                                                            
                 
 

                               
                                                                             
                   
                                                        
                                                                         
                                                                        
                                                                                       
                         
                          
                      
 

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const KIND_BY_EXT                             = {
  '.pdf': 'pdf',
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio',
  '.aiff': 'audio', '.aif': 'audio', '.flac': 'audio', '.ogg': 'audio',
  '.mp4': 'audio', '.mov': 'audio', '.opus': 'audio', '.webm': 'audio', '.mkv': 'audio',
  '.md': 'note', '.markdown': 'note', '.txt': 'note',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image',
};

export function kindFor(fileName        , frontmatter                        )             {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.md' || ext === '.markdown') {
    // A transcript note declares itself via frontmatter kind: transcript
    // (written by the transcribe pipeline); a ripped web page carries a
    // source_url instead. Transcript check first — an interview transcript
    // could theoretically also carry provenance fields, transcript wins.
    if (frontmatter['kind'] === 'transcript') return 'transcript';
    if (frontmatter['source_url']) return 'web';
  }
  return KIND_BY_EXT[ext] ?? 'other';
}

/** True for a Syncthing conflict duplicate — hidden from the tree, kept on disk. */
function isSyncConflict(name        )          {
  return name.includes('.sync-conflict-');
}

/** Strip a sync-conflict copy or dotfile from the listing. */
function isHidden(name        )          {
  return name.startsWith('.') || isSyncConflict(name);
}

/** Stub threshold: a body under this many real characters is a clipper artifact. */
const STUB_BODY_CHARS = 200;

/** Split a markdown file's raw text into frontmatter fields + body (fm stripped). */
export function splitFrontmatter(raw        )                                                        {
  const fm                         = {};
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].replace(/^['">\s]+|['"\s]+$/g, '');
    }
  }
  const body = raw.slice(fmMatch ? fmMatch[0].length : 0);
  return { frontmatter: fm, body };
}

/** True when a markdown body (frontmatter already stripped) is stub-sized. */
function isStubBody(body        )          {
  return body.trim().length < STUB_BODY_CHARS;
}

/** Cheap frontmatter scan: only the first block, only the fields we use. */
export function readMeta(absPath        )                                                          {
  const ext = path.extname(absPath).toLowerCase();
  if (ext !== '.md' && ext !== '.markdown') return { frontmatter: {} };
  let head = '';
  try {
    const fd = fs.openSync(absPath, 'r');
    const buf = Buffer.alloc(2048);
    const n = fs.readSync(fd, buf, 0, 2048, 0);
    fs.closeSync(fd);
    head = buf.toString('utf8', 0, n);
  } catch {
    return { frontmatter: {} };
  }
  const fm                         = {};
  let title                    ;
  const fmMatch = head.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2].replace(/^['">\s]+|['"\s]+$/g, '');
    }
    title = fm['title'] || undefined;
  }
  if (!title) {
    const h = head.match(/^#\s+(.+)$/m);
    if (h) title = h[1].trim();
  }
  return { title, frontmatter: fm };
}

const STUB_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

/** Cheap stub check: read the whole file only when it's small text (stubs are tiny). */
function checkStub(absPath        , ext        , sizeBytes        )                      {
  if (!STUB_EXTENSIONS.has(ext)) return undefined;
  // A file bigger than a few stub-thresholds' worth of bytes can't be a stub —
  // skip the read entirely so large sources don't pay for a full-file read.
  if (sizeBytes > STUB_BODY_CHARS * 8) return false;
  let raw        ;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch {
    return undefined;
  }
  const { body } = splitFrontmatter(raw);
  return isStubBody(body);
}

export function readFolder(absDir, relDir, limits = { count: 0, max: 20000, truncated: false }, depth = 0)               {
  const folders                 = [];
  const files               = [];
  let conflictCount = 0;
  let entries              = [];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (error) {
    if (limits.throwOnReadError) throw error;
    // Folder doesn't exist yet (temple with no sources): return empty shelf.
    return {
      rel_path: relDir, name: path.basename(relDir),
      file_count: 0, total_count: 0, conflict_count: 0, folders: [], files: [],
    };
  }

  for (const e of entries) {
    if (limits.count >= limits.max) { limits.truncated = true; break; }
    if (depth > 24) { limits.truncated = true; break; }
    limits.count++;
    if (isSyncConflict(e.name)) { conflictCount++; continue; }
    if (isHidden(e.name)) continue;
    const childRel = relDir ? path.join(relDir, e.name) : e.name;
    const childAbs = path.join(absDir, e.name);
    if (e.isDirectory()) {
      folders.push(readFolder(childAbs, childRel, limits, depth + 1));
    } else if (e.isFile()) {
      let stat          ;
      try { stat = fs.statSync(childAbs); } catch { continue; }
      const ext = path.extname(e.name).toLowerCase();
      const stamp = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
      let cached = limits.metadataCache?.get(childAbs);
      if (!cached || cached.stamp !== stamp) { cached = { stamp, meta: readMeta(childAbs), stub: checkStub(childAbs, ext, stat.size) }; limits.metadataCache?.set(childAbs, cached); }
      const meta = cached.meta;
      files.push({
        rel_path: childRel,
        name: e.name.replace(/\.[^.]+$/, ''),
        kind: kindFor(e.name, meta.frontmatter),
        size_bytes: stat.size,
        modified_at: stat.mtime.toISOString(),
        title: meta.title,
        source_url: meta.frontmatter['source_url'],
        stub: cached.stub,
      });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => b.modified_at.localeCompare(a.modified_at));

  const totalCount = files.length + folders.reduce((s, f) => s + f.total_count, 0);
  return {
    rel_path: relDir,
    name: relDir ? path.basename(relDir) : '',
    file_count: files.length,
    total_count: totalCount,
    conflict_count: conflictCount, truncated: limits.truncated,
    folders,
    files,
  };
}


export function slugifyName(title        )         {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'untitled';
}
