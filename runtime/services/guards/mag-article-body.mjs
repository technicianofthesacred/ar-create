// Conservative body extraction: only an explicit leading YAML block and a
// recognized legacy DEV credit block are metadata. Horizontal rules never
// imply that later article paragraphs may be discarded.
export function articleBody(input) {
  let text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  let legacy = false;
  if (/^---\s*\n/.test(text)) {
    const close = /^---\s*$/gm; close.lastIndex = text.indexOf('\n') + 1;
    const match = close.exec(text);
    if (!match) throw new Error('Unclosed leading frontmatter; article body is ambiguous.');
    legacy = /^type:\s*DEV\s*$/mi.test(text.slice(0, match.index));
    text = text.slice(match.index + match[0].length).replace(/^\n/, '');
  }
  if (legacy) {
    const divider = /^---\s*$/m.exec(text);
    if (divider) {
      const prefix = text.slice(0, divider.index);
      const lines = prefix.split('\n').map(line => line.trim()).filter(Boolean);
      const credits = /^\*\*(?:Interview by|Interview Date|Story Subject|Photography, Words, Translation|Location):\*\*/;
      if (lines.some(line => credits.test(line)) && lines.every(line => line.startsWith('# ') || credits.test(line))) {
        text = text.slice(divider.index + divider[0].length).replace(/^\n/, '');
      }
    }
  }
  // AR ownership/paragraph anchors are comments, not visible article text.
  return text.replace(/<!--[\s\S]*?-->/g, ' ');
}

export function unsupportedLetters(text) {
  return [...text].some(char => /\p{L}/u.test(char) && !/[a-z]/i.test(char));
}
