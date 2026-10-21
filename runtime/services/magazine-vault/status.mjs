// STATUS.md: AR Create writes only its story table (D6). The table sits between two markers; every
// other line of STATUS.md is Adrian's and is never touched. The markers are put in once, by Adrian's
// own yes (magazine.status.install), directly under the "# Magazine Status" heading.
export const START = '<!-- ar-create:story-table:start (AR Create writes only between these two lines) -->';
export const END = '<!-- ar-create:story-table:end -->';

const cell = value => String(value ?? '').replace(/\|/g, '/').replace(/[\r\n]+/g, ' ').trim();

/** The table from the live board and the registered numbers. */
export function renderTable(board, numbers = new Map(), {date = new Date().toISOString().slice(0, 10)} = {}) {
  const rows = board.board.map(b => ({number: numbers.get(b.story) ?? null, b})).sort((x, y) => (x.number ?? 999) - (y.number ?? 999) || x.b.story.localeCompare(y.b.story));
  const next = b => b.open ? `${b.open} question(s) on the page` : b.answered.length ? 'act on the answered questions' : b.stepName;
  return [START, '', `Read from the files on ${date}.`, '', '| # | Story | Step | Whose move | Next |', '|---|---|---|---|---|',
    ...rows.map(({number, b}) => `| ${number ?? ''} | ${cell(b.story)} | ${b.step} of 12, ${cell(b.stepName)} | ${b.who === 'you' ? 'you' : 'me'} | ${cell(next(b))} |`), '', END].join('\n');
}

/** Where the markers are, or why they cannot be used. */
export function findTable(text) {
  const s = text.indexOf(START), e = text.indexOf(END);
  if (s < 0 && e < 0) return {installed: false};
  if (s < 0 || e < 0 || e < s || text.indexOf(START, s + 1) >= 0 || text.indexOf(END, e + 1) >= 0) return {installed: false, broken: true};
  return {installed: true, start: s, end: e + END.length};
}

export function replaceTable(text, table) {
  const at = findTable(text);
  if (!at.installed) throw Object.assign(new Error(at.broken ? 'The story-table markers in STATUS.md are broken; fix them by hand.' : 'STATUS.md has no story table yet; Adrian installs it once (magazine.status.install).'), {status: 409});
  return text.slice(0, at.start) + table + text.slice(at.end);
}

/** Insert empty markers under the "# Magazine Status" heading (or after the frontmatter). */
export function installMarkers(text) {
  if (findTable(text).installed) return text;
  if (findTable(text).broken) throw Object.assign(new Error('The story-table markers in STATUS.md are broken; fix them by hand.'), {status: 409});
  const block = '\n' + START + '\n' + END + '\n';
  const heading = text.match(/^# .*$/m);
  if (heading) { const at = heading.index + heading[0].length; return text.slice(0, at) + '\n' + block + text.slice(at); }
  const fm = text.match(/^---\n[\s\S]*?\n---\n/);
  const at = fm ? fm[0].length : 0;
  return text.slice(0, at) + block + text.slice(at);
}
