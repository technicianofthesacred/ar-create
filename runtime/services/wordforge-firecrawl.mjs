// Adapted i64os Firecrawl scrape/probe client. No donor host/credentials/default calls.
export function createScraper(configuration) {

function base()         {
  // FIRECRAWL_API_URL overrides (e.g. to point at cloud or a moved IP).
  return (configuration?.baseUrl || '').replace(/\/$/, '');
}

function authHeaders()                         {
  const key = configuration?.apiKey;
  const h                         = { 'Content-Type': 'application/json' };
  // Self-hosted needs no auth; only send a bearer if a real key is configured.
  if (key && key !== 'self-hosted-no-key') h['Authorization'] = `Bearer ${key}`;
  return h;
}

class FirecrawlError extends Error {
  constructor(message        , status         ) {
    super(message);
    this.status = status;
    this.name = 'FirecrawlError';
  }
}

// --- Firecrawl health probe, cached briefly so a dead box doesn't add its
// full connect timeout to every call in a session. ---

const PROBE_TIMEOUT_MS = 3_000;
const PROBE_CACHE_MS = 60_000;

let probeCache                                                 = null;

/**
 * Cheap, cached reachability probe for the self-hosted Firecrawl box. A real
 * connect attempt (not a config check), short-timeout, result cached for
 * PROBE_CACHE_MS so a sleeping studio desktop only costs one slow probe per
 * minute rather than one per call.
 */
async function probeFirecrawl()                   {
  if (!configuration?.baseUrl) return false;
  const now = Date.now();
  if (probeCache && now - probeCache.checkedAt < PROBE_CACHE_MS) {
    return probeCache.healthy;
  }
  let healthy = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${base()}/`, { signal: ctrl.signal });
    clearTimeout(t);
    healthy = res.ok;
  } catch {
    healthy = false;
  }
  probeCache = { healthy, checkedAt: now };
  return healthy;
}

/** Force the next probe to run live instead of serving the cache. Test-only. */
function _resetFirecrawlProbeCache()       {
  probeCache = null;
}

async function call(path        , body         , timeoutMs = 60_000)               {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new FirecrawlError(`Firecrawl ${path} returned HTTP ${res.status}`, res.status);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof FirecrawlError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new FirecrawlError(`Firecrawl ${path} failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Which backend actually served a call, named in plain language. */
                                                    

/** One plain-language line, safe to show a non-developer: no IPs, no paths. */
function backendNote(backend            , firecrawlHealthy         , capability        )                     {
  if (backend === 'firecrawl') return undefined; // primary path working — nothing to explain
  if (!firecrawlHealthy) {
    return `${capability} ran via DuckDuckGo because the studio machine's Firecrawl did not respond.`;
  }
  return `${capability} ran via DuckDuckGo (Firecrawl fallback).`;
}

                               
              
                 
                   
                      
                      
                
 

/**
 * Scrape one URL to clean markdown. Firecrawl is the only backend that can
 * actually render JS pages and return clean markdown, so there is no
 * DuckDuckGo equivalent to fall back to here — a dead Firecrawl fails the
 * scrape outright, but fails FAST (short probe) with a plain-language reason
 * instead of hanging on the box's full 60s call timeout.
 */
async function scrape(url        , opts                                )                        {
  const healthy = await probeFirecrawl();
  if (!healthy) {
    throw new FirecrawlError(
      "could not read that page because the studio machine's Firecrawl did not respond",
    );
  }
  const data = await call('/v1/scrape', {
    url,
    formats: ['markdown'],
    onlyMainContent: opts?.onlyMainContent ?? true,
  }, 15000);
  const d = data?.data ?? {};
  return {
    url,
    title: d?.metadata?.title,
    markdown: d?.markdown ?? '',
    statusCode: d?.metadata?.statusCode,
    backend: 'firecrawl',
  };
}


return scrape;
}
