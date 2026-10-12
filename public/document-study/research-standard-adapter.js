/* Presentation adapter for retained research. No acceptance or manuscript authority. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ResearchStandardAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clean = s => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
  const key = s => { let n = 2166136261; for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(16); };
  const isSource = r => r.role ? /^(source|transcript|canonical-source)$/i.test(r.role) : /(?:^|[ /\d-])SRC\s*-/i.test(r.name || r.path || '');
  const isResearch = r => /^research$/i.test(r.role||'') || /RESEARCH\b/i.test(r.name || r.path || '') || /^type:\s*RESEARCH\s*$/im.test(r.raw || '');
  const isNotes = r => /^notes$/i.test(r.role||'') || /NOTES\b/i.test(r.name || r.path || '') || /^type:\s*NOTES\s*$/im.test(r.raw || '');
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
  const labels = /^(?:[-*]\s+|#{3,6}\s+)?(?:\*\*)?(supported|uncertain|uncertainty|suggested shift|editorial shift|story implication|what was said|quote|speaker|time|location|title|context|sources?|references?|pages?|provenance|quality|narration)(?:\*\*)?\s*:(?:\*\*)?\s*(.*)$/i;
  const labelLine=line=>line.trim().replace(/^(#{3,6}\s+)(Supported|Uncertain|Uncertainty|Suggested shift|Editorial shift|Story implication|What was said|Quote|Speaker|Time|Location|Title|Context|Sources?|References?|Pages?|Provenance|Quality|Narration)\s*$/i,'$1$2:');
  function structured(body) {
    const fields = {}, preamble = []; let field = '';
    for (const line of body.split(/\r?\n|\s+·\s+(?=(?:Supported|Uncertain|Uncertainty|Suggested shift|Editorial shift|Story implication|What was said|Quote|Speaker|Time|Location|Title):)/i)) {
      const match = labelLine(line).match(labels);
      if (match) { field = match[1].toLowerCase(); fields[field] = [fields[field], match[2]].filter(Boolean).join('\n'); }
      else if (field) fields[field] += '\n' + line.trim(); else preamble.push(line);
    }
    return {fields,preamble:clean(preamble.join('\n')),explicit:Object.keys(fields).some(k=>['supported','uncertain','uncertainty','suggested shift','editorial shift','story implication','quote','what was said'].includes(k))};
  }
  // Match explicit source-owned speaker/locator blocks, retaining offsets into the
  // complete source. Highlight/context sections never become transcript speech.
  function sourceUnits(source) {
    let body=source.raw;const full=body.match(/^## Full Transcript\s*$/m);if(full)body=body.slice(0,full.index+full[0].length).replace(/[^\r\n]/g,' ')+body.slice(full.index+full[0].length);
    if(body.startsWith('---'))body=body.replace(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/,m=>m.replace(/[^\r\n]/g,' '));
    const starts=[],pattern=/^(?:\*\*([^\n*]+?):\*\*\s*|([^\n,:]+),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*:\s*|\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^\n:]+):\s*|([^\n,]+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*[, :]\s*)/gm;
    for(const match of body.matchAll(pattern)){let speaker=match[1]||match[2]||match[5]||match[6],location=match[3]||match[4]||match[7]||'',start=match.index+match[0].length;const marker=speaker.match(/^(.*?)\s*(?:\[([^\]]+)\]|(\([^)]*\)))$/);if(marker){speaker=marker[1];location=marker[2]||marker[3];}const ownTime=!location&&body.slice(start).match(/^\[(\d{1,2}:\d{2}(?::\d{2})?(?:[–-]\d{1,2}:\d{2}(?::\d{2})?)?)\]\s*/);if(ownTime){location=ownTime[1];start+=ownTime[0].length;}starts.push({labelStart:match.index,start,speaker:clean(speaker),location});}
    return starts.flatMap((item,index)=>{const limit=starts[index+1]?.labelStart??body.length,tail=body.slice(item.start,limit),heading=tail.search(/^#{1,6}\s/m),end=heading<0?limit:item.start+heading;return item.speaker&&item.location?[{...item,end,text:body.slice(item.start,end)}]:[];});
  }
  const locationKey=s=>String(s||'').replace(/\s+to\s+|[–-]/g,'–').replace(/^\[|\]$/g,'').trim();
  const sameLocation=(claimed,actual)=>{const a=locationKey(claimed),b=locationKey(actual);return a===b||!a.includes('–')&&a===b.split('–')[0];};
  function parse(records, options = {}) {
    if (!Array.isArray(records)) throw new TypeError('Research records must be an array.');
    const sources = [...records, ...(Array.isArray(options.sourceRecords)?options.sourceRecords:[])].filter(r=>typeof r.raw==='string'&&isSource(r)).filter((r,i,a)=>a.findIndex(x=>(x.path||x.id||x.name)===(r.path||r.id||r.name)&&x.hash===r.hash&&x.raw===r.raw)===i), units=new Map(sources.map(source=>[source,sourceUnits(source)]));
    const expected = options.expectedSourceHashes || {}, points = [], limits = new Set();
    limits.add('Retained statuses are declarations in the original record, not a new verification.');
    limits.add('No discussion, inclusion decision or manuscript placement is created by this adapter.');
    function point(record, entry) {
      const prose = clean(entry.body), status = declared(prose, entry.section), origin = { name: record.name || '', path: record.path || '', hash: record.hash || '', role: record.role || '', recordPath: record.path || '', recordHash: record.hash || '', raw: entry.raw };
      const parsed=structured(entry.body),fields=parsed.fields,quoteField=fields['what was said']||fields.quote,attr=fields.speaker&&(fields.time||fields.location)?{speaker:clean(fields.speaker),location:clean(fields.time||fields.location)}:attribution(quoteField||entry.body,entry.speaker),statement=quoteField||entry.body.split(/\s+·\s+/)[0],candidates=quotes(statement),spoken=[],paraphrases=[],linkedSources=[];
      if(quoteField&&!candidates.length&&quoteField.trim())candidates.push({quote:quoteField.trim(),at:0});
      for(const candidate of candidates){
        if(!quoteField&&!attr)continue;
        const matching=sources.filter(source=>source.raw.includes(candidate.quote)),fresh=matching.filter(source=>source.hash&&!source.stale&&!source.missing&&source.transcriptState?.coherent!==false&&(!source.transcriptState?.managed||source.transcriptState.reviewStatus==='reviewed')&&(!expected[source.path||source.name]||expected[source.path||source.name]===source.hash)),matches=[];
        for(const source of fresh)for(const unit of units.get(source)){const at=unit.text.indexOf(candidate.quote);if(at<0||unit.text.lastIndexOf(candidate.quote)!==at||attr&&(unit.speaker!==attr.speaker||!sameLocation(attr.location,unit.location)))continue;matches.push({source,unit,from:unit.start+at,to:unit.start+at+candidate.quote.length});}
        if(matches.length===1){const {source,unit,from,to}=matches[0];spoken.push({quote:candidate.quote,speaker:unit.speaker,location:unit.location,sourceHash:source.hash,sourcePath:source.path||'',sourceId:source.id||'',sourceRange:{from,to},attribution:'exact-canonical-source-words-and-source-owned-speaker-location',truthStatus:'attributed-source-words-not-independent-fact-verification'});linkedSources.push({name:source.name||'',path:source.path||'',hash:source.hash,role:'canonical-source',sourceId:source.id||'',raw:candidate.quote,quote:candidate.quote,speaker:unit.speaker,location:unit.location,sourceRange:{from,to},...(source.quality?{quality:source.quality}:{}),...(source.review?{review:source.review}:{}),...(source.transcriptState?{transcriptState:source.transcriptState}:{})});}
        else paraphrases.push({quote:candidate.quote,label:'Research paraphrase / unverified quotation',reason:matches.length>1?'The exact quotation has ambiguous attribution in more than one canonical source block.':matching.length&&!fresh.length?'The matching source revision/review is unavailable, stale, incoherent or differs from the expected hash.':fresh.length?'Exact words occur in a source, but no unique source-owned speaker/time marker matches the research attribution.':'No exact match in the supplied canonical sources.'});
      }
      const parts = prose.split(/\s+·\s+/), payload = parts.slice(1).filter(p => p !== status.verdict && p !== status.use).join(' · ');
      const held = /^(held|unconfirmed)/i.test(status.use || status.verdict) || /\b(cut|hold the claim|leave .* until|not usable|not in (?:the )?archive|not found|ask (?:for|which))\b/i.test(payload || prose) || /claims to check/i.test(entry.section);
      const qualified = /^qualified/i.test(status.use) || /^(mixed|corrected)/i.test(status.verdict);
      const legacyImplication = entry.kind === 'speaker-check' ? parts.slice(2).join(' · ') : held ? 'Hold factual narration until this is resolved.' : qualified ? 'Keep this qualified: '+status.use.replace(/^qualified\s*/i,'') : status.use === 'usable' ? 'The retained research allows this in narration, within its recorded evidence.' : 'No specific editorial shift is recorded.';
      const finding = payload || prose;
      const uncertainty = held ? finding : qualified ? [status.verdict, status.use].filter(Boolean).join(' · ') : '';
      const rawNote=entry.kind==='research-note'&&!parsed.explicit&&!held;
      const clarity=parsed.explicit?{supported:clean(fields.supported||''),uncertain:clean(fields.uncertain||fields.uncertainty||''),storyImplication:clean(fields['editorial shift']||fields['suggested shift']||fields['story implication']||'')}:{supported:rawNote||held?'':finding,uncertain:uncertainty,...(rawNote?{rawNote:prose}:{}),...(held?{recordedStatement:parts[0],evidenceNeeded:finding}:{}),storyImplication:rawNote?'':legacyImplication};
      const truthStatus={missingFields:[!fields.supported&&'clarity.supported',!fields.uncertain&&!fields.uncertainty&&'clarity.uncertain',!fields['editorial shift']&&!fields['suggested shift']&&!fields['story implication']&&'clarity.storyImplication',!spoken.length&&'spoken.exact-source-attribution'].filter(Boolean),state:rawNote?'raw-research-note':parsed.explicit?'retained-labelled-finding':'retained-status-declaration',verification:'not-verified-by-this-adapter',assessment:parsed.explicit?'Labels are recorded author/research declarations; preserve their stated limits.':rawNote?'No structured support, uncertainty or story-consequence assessment is recorded.':'Original status/use declarations are retained; no new evidence assessment.'};
      points.push({ truthStatus, id: 'retained-' + key([record.path || record.name, entry.section, entry.part, entry.label, entry.offset].join('|')), pointKey: (record.path || '') + '\n' + entry.raw, label: entry.label, title: (fields.title?clean(fields.title):entry.kind === 'research-note' ? clean(parsed.preamble||parts[0]).split(/\s*\(|\.\s/)[0] : clean(parts[0]).replace(/^[^,]+\d{1,2}:\d{2}(?:\s+to\s+\d{1,2}:\d{2})?,\s*/, '')).replace(/(.{140})[\s\S]+/, '$1…'), kind: entry.kind, section: entry.section, part: entry.part, spoken, researchParaphrases: paraphrases, clarity, sources: [origin,...linkedSources], originalText: entry.raw, sourceHash: record.hash || '', declaredStatus: status, stale: !!record.stale || paraphrases.some(p => /revision/.test(p.reason)), decision: { state: 'read-only', included: null, authority: 'retained-record' } });
      if (paraphrases.length) limits.add('Quoted research spans without a current exact canonical-source match are labelled paraphrases, not speaker words.');
      if (candidates.length && !attr && !quoteField) limits.add('Unattributed quotation marks can name terms or proposed wording; they are not treated as speech.');
    }
    for (const record of records) {
      if (typeof record.raw !== 'string' || !isResearch(record) && !isNotes(record)) continue;
      const research = isResearch(record) && !isNotes(record), lines = record.raw.split(/\r?\n/), lineStarts = [0, ...Array.from(record.raw.matchAll(/\r?\n/g), m => m.index + m[0].length)]; let section = '', part = '', speaker = '', pending = null;
      const flush = () => { if (pending) point(record, pending); pending = null; };
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i], heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading && !(pending&&heading[1].length>=4&&labels.test(labelLine(line)))) { flush(); if (heading[1].length <= 2) { section = clean(heading[2]); part = ''; } else part = clean(heading[2]); speaker = ''; continue; }
        if (!labels.test(labelLine(line))&&/^[\p{L}][\p{L}\s’'-]{0,60}:\s*$/u.test(line.trim())) { flush(); speaker = line.trim().slice(0, -1); continue; }
        const indent=line.match(/^\s*/)[0].length;
        if(pending&&line.trim()&&(indent>pending.indent||labels.test(labelLine(line)))){pending.body+='\n'+line;pending.raw=record.raw.slice(lineStarts[pending.offset],lineStarts[i]+line.length);continue;}
        const bullet = line.match(/^\s*-\s+(?:\*\*([RWS]\d+[a-z]?)\*\*\s+)?(.+)$/i), number = line.match(/^\s*(\d+)\.\s+(.+)$/);
        const claimSection = /\bclaims\b|speaker check|wisdom/i.test(section) && !/for .*people|expand/i.test(section);
        const notesSection = /enrich|check|research|findings/i.test(section) && !/summary|articles found/i.test(section);
        if (research && bullet && (bullet[1] || claimSection)) {
          flush(); pending = { body: bullet[2], raw: line, label: bullet[1] || '', section, part, speaker, indent, offset: i, kind: /^S/i.test(bullet[1] || '') || /speaker check/i.test(section) ? 'speaker-check' : 'claim' };
        } else if (!research && number && notesSection) {
          flush(); pending = { body: number[2], raw: line, label: number[1], section, part, speaker, indent, offset: i, kind: 'research-note' };
        } else if (pending && line.trim() && !bullet && !number) { pending.body += '\n' + line; pending.raw = record.raw.slice(lineStarts[pending.offset], lineStarts[i] + line.length); }
        else if (bullet || number) flush();
      }
      flush();
    }
    if (!sources.length) limits.add('No canonical source records supplied; no research quotation can be presented as exact speech.');
    limits.add('Numbered notes are parsed only from research, enrichment, findings or check sections; article indexes and summaries stay in their original records.');
    if(points.some(p=>p.truthStatus.state==='raw-research-note'))limits.add('Raw numbered notes lack authored Supported/Uncertain/Editorial shift fields; the adapter preserves them without manufacturing those assessments.');
    limits.add('Speech linkage requires exact current canonical words with a unique source-owned speaker and time/scene marker; a research timestamp alone is insufficient.');
    return { points, limits: [...limits] };
  }
  return { parse, parseRecords: parse };
});
