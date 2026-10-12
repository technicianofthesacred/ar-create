import {inlineMap} from './draft-correspondence.mjs';

// The native donor owns syntax and byte mapping. Proposal edits support only a
// contiguous plain prose span; edge comments are retained by its text operation.
// Interior comments stay unsupported because a replacement could cross them.
export function proposalEditable(row) {
  if (!row || row.safe !== true || row.blockKind !== 'paragraph' || typeof row.raw !== 'string' || typeof row.words !== 'string' || !row.words) return false;
  const mapped = inlineMap(row.raw);
  if (!mapped.safe || mapped.blockKind !== 'paragraph' || mapped.words !== row.words || mapped.reworks.length) return false;
  if (!mapped.notes) return row.raw === row.words;
  const prose = row.raw.replace(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g, '');
  if (prose.trim() !== row.words) return false;
  const visible = mapped.runs.filter(run => run.to > run.from && run.to > 0 && run.from < row.words.length);
  if (!visible.length || visible.some(run => run.locked || run.rawTo - run.rawFrom !== run.to - run.from)) return false;
  if (visible[0].from !== 0 || visible.at(-1).to !== row.words.length) return false;
  for (let i = 1; i < visible.length; i++) if (visible[i-1].rawTo !== visible[i].rawFrom || visible[i-1].to !== visible[i].from) return false;
  return !mapped.runs.some(run => run.locked && run.from > 0 && run.from < row.words.length);
}
