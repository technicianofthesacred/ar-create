/* Adapted from the generic compact-dialogue.mjs and conversation-notes.mjs.
 * Pure presentation helpers: transcript words and notes remain separate inputs.
 * The caller owns selection, source loading and existing correction tools.
 */
const sections = [['stories', 'Potential stories'], ['interests', 'Points of interest'], ['business', 'Purchases and business']];
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
function boundary(turn) {
  return ['editorial', 'session', 'session-boundary', 'editorial-boundary', 'boundary'].includes(turn.kind) || String(turn.id).startsWith('editorial-') || /^\[Editorial session boundary/.test(turn.originalText || '');
}
function clock(value) {
  if (typeof value !== 'string') return NaN;
  const time = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!time) return Date.parse(value);
  if (+time[1] > 23 || +time[2] > 59 || +(time[3] || 0) > 59) return NaN;
  return ((+time[1] * 60 + +time[2]) * 60 + +(time[3] || 0)) * 1000 + +(time[4] || '').padEnd(3, '0');
}
function day(turn) { return turn.date || (typeof turn.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}/.test(turn.timestamp) ? turn.timestamp.slice(0, 10) : null); }
export function groupTurns(turns) {
  const groups = [];
  for (const turn of turns || []) {
    const last = groups.at(-1), previous = last?.turns.at(-1), isolated = boundary(turn);
    const a = clock(previous?.timestamp), b = clock(turn.timestamp);
    const pause = Number.isFinite(a) && Number.isFinite(b) && (b < a || b - a > 30 * 60 * 1000);
    const changedDay = previous && day(previous) && day(turn) && day(previous) !== day(turn);
    const changedSession = previous && (previous.sessionId || turn.sessionId) && previous.sessionId !== turn.sessionId;
    if (last && !last.boundary && !isolated && !pause && !changedDay && !changedSession && last.speaker === turn.speaker) last.turns.push(turn);
    else groups.push({speaker: turn.speaker, boundary: isolated, turns: [turn]});
  }
  return groups;
}
function bullets(record, key) {
  return Array.isArray(record?.[key]) ? record[key].map(value => typeof value === 'string' ? {text: value, turnIds: []} : value).filter(value => value && typeof value.text === 'string' && value.text.trim()).slice(0, 8) : [];
}
function recordFor(session, records) {
  const record = records && Object.hasOwn(records, session.id) ? records[session.id] : null;
  return record && typeof record === 'object' && !Array.isArray(record) ? record : null;
}
function current(session, record) {
  return typeof session.id === 'string' && !!session.id && typeof session.sourceHash === 'string' && !!session.sourceHash && record.sourceHash === session.sourceHash && (record.sessionId === undefined || record.sessionId === session.id);
}
export function resolveNoteAnchors(session, records, key, index) {
  const record = recordFor(session, records);
  if (!record || !current(session, record) || !sections.some(([k]) => k === key) || !Number.isInteger(index) || index < 0) return [];
  const point = bullets(record, key)[index];
  if (!Array.isArray(point?.turnIds) || !point.turnIds.length || point.turnIds.length > 8) return [];
  const turns = session.turns || [], available = new Set(turns.map(turn => turn.id));
  if (available.size !== turns.length || turns.some(turn => typeof turn.id !== 'string' || !turn.id) || point.turnIds.some(id => typeof id !== 'string' || !available.has(id))) return [];
  return [...new Set(point.turnIds)];
}
export function renderConversationNotes(session, records) {
  const record = recordFor(session, records);
  if (!record) return '';
  if (!current(session, record)) return '<p class="conversation-notes-stale">These notes refer to earlier wording and need review.</p>';
  return `<div class="conversation-notes" aria-label="Conversation notes">${sections.map(([key, label]) => {
    const points = bullets(record, key);
    return `<section class="conversation-note-section"><h3>${label}</h3>${points.length ? `<ul>${points.map((point, index) => {
      const linked = resolveNoteAnchors(session, records, key, index).length > 0;
      return `<li>${linked ? `<button type="button" class="note-link" data-note-session="${escape(session.id)}" data-note-section="${key}" data-note-index="${index}" title="Show supporting passage">${escape(point.text)}</button>` : escape(point.text)}</li>`;
    }).join('')}</ul>` : `<p class="muted">${key === 'stories' ? 'No distinct story identified.' : 'No points recorded.'}</p>`}</section>`;
  }).join('')}</div>`;
}
function groupTime(group) {
  const value = group.turns[0]?.timestamp;
  // Timing belongs to the first supplied remark, never an inferred group offset.
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(clock(value))) return '';
  return `<time datetime="${escape(value)}" title="Timestamp of first remark">${escape(value)}</time>`;
}
export function renderSourceGroups(session) {
  return `<div class="recordBody source-dialogue">${groupTurns(session.turns).map(group => `<section class="source-dialogue-group${group.boundary ? ' source-dialogue-boundary' : ''}">${groupTime(group)}${group.speaker ? `<p class="source-speaker"><strong>${escape(group.speaker)}</strong></p>` : ''}${group.turns.map(turn => `<p class="source-remark" data-source-session="${escape(session.id)}" data-source-turn="${escape(turn.id)}">${escape(turn.text).replace(/\n/g, '\n<br>')}</p>`).join('')}</section>`).join('')}</div>`;
}
