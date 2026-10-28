import {inlineMap,capture,openingBoundary} from './draft-correspondence.mjs';

// The native donor owns syntax and byte mapping. Proposal edits support only a
// contiguous plain prose span; edge comments are retained by its text operation.
// Interior comments stay unsupported because a replacement could cross them.
export function proposalEditable(row) {
  if (!row || row.safe !== true || row.blockKind !== 'paragraph' || typeof row.raw !== 'string' || typeof row.words !== 'string' || !row.words) return false;
  const mapped = inlineMap(row.raw);
  if (!mapped.safe || mapped.blockKind !== 'paragraph' || mapped.words !== row.words || mapped.reworks.length) return false;
  // The donor may retain edge whitespace in raw while mapping only visible
  // prose. Use the same contiguous byte-run proof for noted and plain prose.
  const prose = row.raw.replace(/%%[\s\S]*?%%|<!--[\s\S]*?-->/g, '');
  if (prose.trim() !== row.words) return false;
  const visible = mapped.runs.filter(run => run.to > run.from && run.to > 0 && run.from < row.words.length);
  if (!visible.length || visible.some(run => run.locked || run.rawTo - run.rawFrom !== run.to - run.from)) return false;
  if (visible[0].from !== 0 || visible.at(-1).to !== row.words.length) return false;
  for (let i = 1; i < visible.length; i++) if (visible[i-1].rawTo !== visible[i].rawFrom || visible[i-1].to !== visible[i].from) return false;
  return !mapped.runs.some(run => run.locked && run.from > 0 && run.from < row.words.length);
}

/** Resolve the opening using donor boundaries and exact stable projection IDs. */
export function openingProposalTarget(baseline){
 const model=capture(baseline.raw,'native-opening');
 if(!Array.isArray(baseline.projection)||model.blocks.length!==baseline.projection.length)throw Object.assign(Error('Native opening projection changed.'),{status:409});
 model.blocks.forEach((block,i)=>{const row=baseline.projection[i];if(block.raw!==row.raw)throw Object.assign(Error('Native opening bytes changed.'),{status:409});block.id=row.id;});
 let boundary;try{boundary=openingBoundary(model);}catch(error){throw Object.assign(error,{status:409});}
 if(boundary.kind==='existing'){const row=baseline.projection.find(r=>r.id===boundary.id);if(!proposalEditable(row))throw Object.assign(Error('The opening is protected, nested or unsupported. Keep its exact words.'),{status:409});return {kind:'replace',id:row.id,seenBlockHash:row.blockHash};}
 return {kind:'insert',beforeId:boundary.beforeId,seenBoundaryHash:boundary.beforeId?baseline.projection.find(r=>r.id===boundary.beforeId).blockHash:null};
}
