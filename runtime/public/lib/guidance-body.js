/** One accepted/pending boundary for guidance readers, editors and requests. */
export const requestBody = value => String(value || '').replace(/^(?:\uFEFF)?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
/** Accepted guidance projection only; source and manuscript bodies keep their headings. */
export function acceptedGuidanceBody(raw) {
  return guidanceRegions(raw).regions.filter(region => !region.pending).map(region => region.raw).join('').replace(/\r\n/g, '\n').trim();
}

/** Preserve every original byte while exposing only accepted regions for editing. */
export function guidanceRegions(raw) {
  raw = String(raw || '');
  const prefix = raw.slice(0, raw.length - requestBody(raw).length);
  const body = raw.slice(prefix.length), pending = new Uint8Array(body.length);
  const markers = /<!--\s*VOICE-QUEUE-START\s*-->[\s\S]*?(?:<!--\s*VOICE-QUEUE-END\s*-->|$)|<!--\s*VOICE-QUEUE-END\s*-->/gi;
  for (const match of body.matchAll(markers)) pending.fill(1, match.index, match.index + match[0].length);
  // Remove marker queues before interpreting Markdown headings/fences.
  // interpretation. The offset map lets the editor keep the full original file.
  const offsets = [], visible = [];
  for (let index = 0; index < body.length; index++) if (!pending[index]) { offsets.push(index); visible.push(body[index]); }
  let cursor = 0, queueLevel = null, fence = null;
  for (const match of visible.join('').matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
    const line = match[0].replace(/\r?\n$/, '');
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/);
    const heading = !fence && line.match(/^ {0,3}(#{1,6})[ \t]+(.+)$/);
    if (queueLevel !== null && heading && heading[1].length <= queueLevel) queueLevel = null;
    if (heading && /^Strengthenings[ \t]+queue\b/i.test(heading[2])) queueLevel = heading[1].length;
    if (queueLevel !== null) for (let index = cursor; index < cursor + match[0].length; index++) pending[offsets[index]] = 1;
    if (boundary) {
      if (!fence) fence = boundary[1];
      else if (boundary[1][0] === fence[0] && boundary[1].length >= fence.length) fence = null;
    }
    cursor += match[0].length;
  }
  const regions = [];
  for (let start = 0; start < body.length;) {
    let end = start + 1;
    while (end < body.length && pending[end] === pending[start]) end++;
    regions.push({ raw: body.slice(start, end), pending: !!pending[start] }); start = end;
  }
  if (!regions.length || regions[0].pending) regions.unshift({ raw: '', pending: false });
  return { prefix, regions };
}
