// Adapted directly from i64os capture/extractors/article.ts.
// DNS-pinned public-address fetch, redirects/deadline/size limits and real Readability parser retained.
// Only third-party installed dependencies are read; donor app code/config/storage is never imported.
import https from 'node:https';
import http from 'node:http';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const dependencyRequire = createRequire(process.env.AR_CREATE_READABILITY_PACKAGE || import.meta.url);
export function articleCapability() { let parser = false; try { dependencyRequire.resolve('@mozilla/readability'); dependencyRequire.resolve('jsdom'); parser = true; } catch {} return { ready: parser, problem: parser ? null : 'Install ar-create dependencies with npm ci for local Readability extraction.', parser: parser ? 'Mozilla Readability' : 'unavailable', backend: 'copied-i64os-static-article', limits: '20s, 5MB, 5 redirects; public IPs only; scripts/resources are never executed' }; }
const FETCH_TIMEOUT_MS = 20_000; // 30 s
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nowIso()         {
  return new Date().toISOString();
}

function slugify(text        , maxWords = 8)         {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, maxWords)
      .join('-') || 'article-capture'
  );
}

function ensureDir(dir        )       {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileAtomic(filePath        , content        )       {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

/**
 * Extract the first HTTP/HTTPS URL from a string.
 */
export function extractUrl(content        )                {
  const m = content.match(/https?:\/\/[^\s]+/);
  return m ? m[0]  : null;
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------
function publicIpv4(address        )          {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [a, b] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && octets[2] === 0)
    || (a === 192 && b === 168)
    || (a === 192 && b === 88 && octets[2] === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 192 && b === 0 && octets[2] === 2)
    || (a === 198 && b === 51 && octets[2] === 100)
    || (a === 203 && b === 0 && octets[2] === 113));
}

function ipv6Words(address        )                  {
  if (address.includes('%') || address.split('::').length > 2) return null;
  let normalized = address.toLocaleLowerCase();
  const dotted = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) {
    const octets = dotted.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    normalized = `${normalized.slice(0, normalized.length - dotted.length)}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  const halves = normalized.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(missing).fill('0'), ...right];
  if (words.length !== 8 || words.some((word) => !/^[a-f0-9]{1,4}$/.test(word))) return null;
  return words.map((word) => Number.parseInt(word, 16));
}

export function isPublicArticleAddress(address        )          {
  if (isIP(address) === 4) return publicIpv4(address);
  if (isIP(address) !== 6) return false;
  const words = ipv6Words(address);
  if (!words) return false;
  // IPv4-compatible and IPv4-mapped forms inherit the IPv4 decision.
  if (words.slice(0, 5).every((word) => word === 0) && (words[5] === 0 || words[5] === 0xffff)) {
    return publicIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  // Allow only global unicast, excluding documentation and transition ranges.
  if ((words[0] & 0xe000) !== 0x2000) return false;
  if (words[0] === 0x2001 && (words[1] < 0x0200 || words[1] === 0x0db8)) return false;
  if (words[0] === 0x2002) return false;
  if (words[0] === 0x3fff && (words[1] & 0xf000) === 0) return false;
  return true;
}

                                     
                                                
                                                
                 
 

                                 
                       
                                            
                      
                   
 

function resolverAddresses(
  resolve                         ,
  family       ,
)                                                     {
  let promise                   ;
  try {
    promise = resolve();
  } catch (error) {
    promise = Promise.reject(error);
  }
  return promise
    .then((addresses) => addresses.map((address) => ({ address, family })))
    .catch((error         ) => {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code === 'ENODATA' || code === 'ENOTFOUND') return [];
      throw error;
    });
}

export async function resolvePublicArticleHost(
  hostname        ,
  options                                                                            ,
)                                                     {
  options.signal?.throwIfAborted();
  if (options.timeoutMs <= 0) throw new Error('article network deadline exceeded');
  const resolver = options.resolver ?? new Resolver();
  let timer                                           ;
  let abortListener                          ;
  const boundary = new Promise       ((_resolve, reject) => {
    const stop = (error         ) => {
      try { resolver.cancel(); } catch { /* already settled */ }
      reject(error);
    };
    timer = setTimeout(() => stop(new Error('article network deadline exceeded')), options.timeoutMs);
    timer.unref?.();
    if (options.signal) {
      abortListener = () => stop(options.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      options.signal.addEventListener('abort', abortListener, { once: true });
    }
  });
  const resolution = Promise.all([
    resolverAddresses(() => resolver.resolve4(hostname), 4),
    resolverAddresses(() => resolver.resolve6(hostname), 6),
  ]).then(([ipv4, ipv6]) => [...ipv4, ...ipv6]);
  try {
    return await Promise.race([resolution, boundary]);
  } finally {
    if (timer) clearTimeout(timer);
    if (options.signal && abortListener) options.signal.removeEventListener('abort', abortListener);
  }
}

export function createPinnedArticleLookup(address        , family       )                 {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

async function resolvePublicUrl(rawUrl        , options                       )           
           
                  
                
   {
  options.signal?.throwIfAborted();
  const url = new URL(rawUrl);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('article URL is not public HTTP');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLocaleLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')
    || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.home.arpa')) {
    throw new Error('article URL host is not public');
  }
  const remaining = options.deadline - options.clock();
  if (remaining <= 0) throw new Error('article network deadline exceeded');
  const resolved = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname)          }]
    : await resolvePublicArticleHost(hostname, {
      signal: options.signal,
      timeoutMs: remaining,
      resolver: options.resolverFactory(),
    });
  if (resolved.length === 0 || resolved.some((entry) => !isPublicArticleAddress(entry.address))) {
    throw new Error('article URL resolved to a non-public address');
  }
  return { url, address: resolved[0].address, family: resolved[0].family          };
}

async function fetchHtml(rawUrl        , options                       , redirects = 0)                  {
  if (redirects > 5) throw new Error('too many article redirects');
  const resolved = await resolvePublicUrl(rawUrl, options);
  options.signal?.throwIfAborted();
  const remaining = options.deadline - options.clock();
  if (remaining <= 0) throw new Error('article network deadline exceeded');
  return new Promise((resolve, reject) => {
    const lib = resolved.url.protocol === 'https:' ? https : http;
    const req = lib.get(
      resolved.url,
      {
        timeout: remaining,
        signal: options.signal,
        lookup: createPinnedArticleLookup(resolved.address, resolved.family),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; i64os-reader/1.0; +https://i64os.personal)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        // Follow redirects (up to 5 hops)
        if (
          res.statusCode &&
          res.statusCode >= 301 &&
          res.statusCode <= 308 &&
          res.headers.location
        ) {
          req.destroy();
          fetchHtml(new URL(res.headers.location, resolved.url).toString(), options, redirects + 1).then(resolve, reject);
          return;
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 400)) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const chunks           = [];
        let total = 0;

        res.on('data', (chunk        ) => {
          total += chunk.length;
          if (total > MAX_HTML_BYTES) {
            req.destroy();
            reject(new Error(`article too large: ${total} bytes`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });

        res.on('error', reject);
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`fetch timeout after ${FETCH_TIMEOUT_MS}ms`));
    });

    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Article parsing via @mozilla/readability + jsdom
// ---------------------------------------------------------------------------
                                  
                
                        
                             
                      
                         
 

export async function parseReadableArticle(html        , url        )                           {
  // Dynamic imports — these packages are installed via npm on the VPS.
  // We do dynamic import so the module loads without crashing if they're
  // absent on dev machines where the packages haven't been installed yet.
  let Readability                                                                                                 ;
  let JSDOM                                                                                       ;
  let VirtualConsole                                                                           ;

  try {
    const readMod = dependencyRequire('@mozilla/readability');
    Readability = (readMod                                        ).Readability ?? (readMod                                    ).default;
  } catch {
    Readability = undefined;
  }

  try {
    const jsdomMod = dependencyRequire('jsdom');
    JSDOM = (jsdomMod                            ).JSDOM ?? (jsdomMod                              ).default;
    VirtualConsole = (jsdomMod                                              ).VirtualConsole;
  } catch {
    JSDOM = undefined;
    VirtualConsole = undefined;
  }

  if (!Readability || !JSDOM) {
    // Fallback: strip tags and return raw text
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);

    return {
      title: url,
      byline: null,
      publishDate: null,
      textContent: stripped,
      excerpt: null,
    };
  }

  const virtualConsole = VirtualConsole ? new VirtualConsole() : undefined;
  // jsdom's default virtual console forwards parser failures plus the raw
  // stylesheet to process stderr. Source bytes must remain transient.
  virtualConsole?.on('jsdomError', () => undefined);
  const dom = new JSDOM(html, { url, ...(virtualConsole ? { virtualConsole } : {}) });
  const doc = dom.window.document;

  const reader = new Readability(doc, { charThreshold: 100 });
  const article = reader.parse();

  if (!article) {
    const title = doc.title || url;
    dom.window.close();
    return {
      title,
      byline: null,
      publishDate: null,
      textContent: '',
      excerpt: null,
    };
  }

  const a = article                           ;

  // Attempt to find publish date from meta tags
  let publishDate                = null;
  const metaCandidates = [
    'article:published_time',
    'og:article:published_time',
    'date',
    'DC.date',
    'pubdate',
  ];
  for (const name of metaCandidates) {
    const el =
      doc.querySelector(`meta[property="${name}"]`) ??
      doc.querySelector(`meta[name="${name}"]`);
    if (el?.getAttribute('content')) {
      publishDate = el.getAttribute('content') ?? null;
      break;
    }
  }

  const parsed = {
    title: String(a.title ?? doc.title ?? url),
    byline: typeof a.byline === 'string' && a.byline ? a.byline : null,
    publishDate,
    textContent: String(a.textContent ?? ''),
    excerpt: typeof a.excerpt === 'string' && a.excerpt ? a.excerpt : null,
  };
  dom.window.close();
  return parsed;
}

/** Fetch and mechanically extract a readable static article without writing it. */
export async function fetchReadableArticle(
  url        ,
  options   
                         
                                               
                         
    = {},
)                           {
  options.signal?.throwIfAborted();
  const clock = options.clock ?? Date.now;
  const html = await fetchHtml(url, {
    signal: options.signal,
    resolverFactory: options.resolverFactory ?? (() => new Resolver()),
    clock,
    deadline: clock() + FETCH_TIMEOUT_MS,
  });
  options.signal?.throwIfAborted();
  const result = await parseReadableArticle(html, url);
  return { ...result, rawHtml: html };
}

// ---------------------------------------------------------------------------
