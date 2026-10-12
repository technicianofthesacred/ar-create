// Copied URL identity semantics from i64os research/source-identity.ts.
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'mobile.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
]);

const YOUTUBE_ID_PREFIXES = ['/shorts/', '/embed/', '/live/', '/v/'];
const TRACKING_PARAMS = [
  /^utm_/i,
  /^(fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|twclid|yclid|_hsenc|_hsmi)$/i,
  /^(ref|ref_src|ref_url|referrer|si|feature)$/i,
];

function isTrackingParam(key        )          {
  return TRACKING_PARAMS.some((re) => re.test(key));
}

/** The single normalized material identity used by research intake and Study discovery. */
export function normalizeSourceUrl(raw        )         {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');

    if (YOUTUBE_HOSTS.has(host)) {
      const v = u.searchParams.get('v');
      if (v) return `youtube:${v}`;
      for (const prefix of YOUTUBE_ID_PREFIXES) {
        if (u.pathname.startsWith(prefix)) {
          const id = u.pathname.slice(prefix.length).split('/')[0];
          if (id) return `youtube:${id}`;
        }
      }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\/+/, '').split('/')[0];
      if (id) return `youtube:${id}`;
    }

    for (const key of [...u.searchParams.keys()]) {
      if (isTrackingParam(key)) u.searchParams.delete(key);
    }
    const bare = host.replace(/^(m|mobile)\./, '');
    return `${bare}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

