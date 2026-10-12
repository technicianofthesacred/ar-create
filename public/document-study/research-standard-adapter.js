/* Presentation adapter for retained research. No acceptance or manuscript authority. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ResearchStandardAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clean = s => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
  const key = s => { let n = 2166136261; for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); };
  const isSource = r => /^(source|transcript|canonical-source)$/i.test(r.role || '') || /(?:^|[ /\d-])SRC\s*-/i.test(r.name || r.path || '');
  const isResearch = r => /RESEARCH\b/i.test(r.name || r.path || '') || /^type:\s*RESEARCH\s*$/im.test(r.raw || '');
  const isNotes = r => /NOTES\b/i.test(r.name || r.path || '') || /^type:\s*NOTES\s*$/im.test(r.raw || '');
  function declared(text, section) {
    const pieces = text.split(/\s+·\s+/), verdict = pieces.find(s => /^(confirmed|unconfirmed|corrected|mixed|not-graded)(?:\s|$)/i.test(s));
    const use = pieces.find(s => /^(usable|qualified|held(?: back)?|quote-only)(?:\s|$)/i.test(s));
    return { verdict: verdict || '', use: use || '', section };
  }
  function quotes(text) {
    const out = []; const re = /“([^”\n]+)”|"([^"\n]+)"/g; let m;
    while ((m = re.exec(text))) out.push({ quote: m[1] || m[2], at: m.index });
    return out;
  }
  function attribution(text, speaker) {
    const prefix = text.split(/\s+·\s+/)[0];
    const m = prefix.match(/^([^\d,()"“]+?)\s+(\d{1,2}:\d{2}(?:\s+to\s+\d{1,2}:\d{2})?|\([^)]*\))/);
    if (m) return { speaker: clean(m[1]), location: m[2] };
    const time = prefix.match(/^\s*(\d{1,2}:\d{2}(?:\s+to\s+\d{1,2}:\d{2})?)/);
    return speaker && time ? { speaker, location: time[1] } : null;
  }
  function parse(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError('Research records must be an array.');
    const sources = [...records.filter(isSource), ...(options.sourceRecords || []).filter(r => typeof r.raw === 'string' && isSource(r))];
    const expected = options.expectedSourceHashes || {}, points = [], limits = new Set();
    limits.add('Retained statuses are declarations in the original record, not a new verification.');
    limits.add('No discussion, inclusion decision or manuscript placement is created by this adapter.');
    function point(record, entry) {
      const prose = clean(entry.body), status = declared(prose, entry.section), origin = { name: record.name || '', path: record.path || '', hash: record.hash || '', role: record.role || '', recordPath: record.path || '', recordHash: record.hash || '', raw: entry.raw };
      const attr = attribution(prose, entry.speaker), candidates = quotes(prose), spoken = [], paraphrases = [];
      for (const candidate of candidates) {
        // Only quotes in the attributed source-statement segment are speech candidates.
        const statement = prose.split(/\s+·\s+/)[0];
        if (!attr || candidate.at >= statement.length) continue;
        const matching = sources.filter(s => s.raw.includes(candidate.quote));
        const current = matching.find(s => !s.stale && !s.missing && (!expected[s.path || s.name] || expected[s.path || s.name] === s.hash));
        if (current) spoken.push({ quote: candidate.quote, speaker: attr.speaker, location: attr.location, sourceHash: current.hash || '', sourcePath: current.path || '', attribution: 'explicit-research-marker; exact-canonical-source-match' });
        else paraphrases.push({ quote: candidate.quote, label: 'Research paraphrase / unverified quotation', reason: matching.length ? 'The matching source revision is marked stale or differs from the expected hash.' : 'No exact match in the supplied canonical sources.' });
      }
      const parts = prose.split(/\s+·\s+/), payload = parts.slice(1).filter(p => p !== status.verdict && p !== status.use).join(' · ');
      const held = /^(held|unconfirmed)/i.test(status.use || status.verdict) || /\b(cut|hold the claim|leave .* until|not usable)\b/i.test(payload);
      const qualified = /^qualified/i.test(status.use) || /^(mixed|corrected)/i.test(status.verdict);
      const implication = entry.kind === 'speaker-check' ? parts.slice(2).join(' · ') : held ? 'Hold factual narration until this is resolved.' : qualified ? 'Keep this qualified: '+status.use.replace(/^qualified\s*/i,'') : status.use === 'usable' ? 'The retained research allows this in narration, within its recorded evidence.' : 'No specific editorial shift is recorded.';
      const finding = payload || prose;
      const uncertainty = held ? finding : qualified ? [status.verdict, status.use].filter(Boolean).join(' · ') : '';
      points.push({ id: 'retained-' + key([record.path || record.name, entry.section, entry.part, entry.label, entry.offset].join('|')), pointKey: (record.path || '') + '\n' + entry.raw, label: entry.label, title: (entry.kind === 'research-note' ? clean(parts[0]).split(/\s*\(|\.\s/)[0] : clean(parts[0]).replace(/^[^,]+\d{1,2}:\d{2}(?:\s+to\s+\d{1,2}:\d{2})?,\s*/, '')).replace(/(.{140})[\s\S]+/, '$1…'), kind: entry.kind, section: entry.section, part: entry.part, spoken, researchParaphrases: paraphrases, clarity: { supported: held ? '' : finding, uncertain: uncertainty, storyImplication: implication }, sources: [origin], originalText: entry.raw, sourceHash: record.hash || '', declaredStatus: status, stale: !!record.stale || paraphrases.some(p => /revision/.test(p.reason)), decision: { state: 'read-only', included: null, authority: 'retained-record' } });
      if (paraphrases.length) limits.add('Quoted research spans without a current exact canonical-source match are labelled paraphrases, not speaker words.');
      if (candidates.length && !attr) limits.add('Unattributed quotation marks can name terms or proposed wording; they are not treated as speech.');
    }
    for (const record of records) {
      if (typeof record.raw !== 'string' || !isResearch(record) && !isNotes(record)) continue;
      const research = isResearch(record) && !isNotes(record), lines = record.raw.split(/\r?\n/), lineStarts = [0, ...Array.from(record.raw.matchAll(/\r?\n/g), m => m.index + m[0].length)]; let section = '', part = '', speaker = '', pending = null;
      const flush = () => { if (pending) point(record, pending); pending = null; };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i], heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) { flush(); if (heading[1].length <= 2) { section = clean(heading[2]); part = ''; } else part = clean(heading[2]); speaker = ''; continue; }
        if (/^[\p{L}][\p{L}\s’'-]{0,60}:\s*$/u.test(line.trim())) { flush(); speaker = line.trim().slice(0, -1); continue; }
        const bullet = line.match(/^\s*-\s+(?:\*\*([RWS]\d+[a-z]?)\*\*\s+)?(.+)$/i), number = line.match(/^\s*(\d+)\.\s+(.+)$/);
        const claimSection = /\bclaims\b|speaker check|wisdom/i.test(section) && !/for .*people|expand/i.test(section);
        const notesSection = /enrich|check|research|findings/i.test(section) && !/summary|articles found/i.test(section);
        if (research && bullet && (bullet[1] || claimSection)) {
          flush(); pending = { body: bullet[2], raw: line, label: bullet[1] || '', section, part, speaker, offset: i, kind: /^S/i.test(bullet[1] || '') || /speaker check/i.test(section) ? 'speaker-check' : 'claim' };
        } else if (!research && number && notesSection) {
          flush(); pending = { body: number[2], raw: line, label: number[1], section, part, speaker: '', offset: i, kind: 'research-note' };
        } else if (pending && line.trim() && !bullet && !number) { pending.body += '\n' + line; pending.raw = record.raw.slice(lineStarts[pending.offset], lineStarts[i] + line.length); }
        else if (bullet || number || !line.trim()) flush();
      }
      flush();
    }
    if (!sources.length) limits.add('No canonical source records supplied; no research quotation can be presented as exact speech.');
    limits.add('Numbered notes are parsed only from research, enrichment, findings or check sections; article indexes and summaries stay in their original records.');
    return { points, limits: [...limits] };
  }
  return { parse, parseRecords: parse };
});
