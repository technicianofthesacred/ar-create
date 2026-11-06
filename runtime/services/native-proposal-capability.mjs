import {inlineMap,capture,render,openingBoundary,continuationBoundary} from './draft-correspondence.mjs';

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

export function continuationProposalTarget(baseline,opening,model){
 const retained=!!model;model=model?structuredClone(model):capture(baseline.raw,'native-continuation');
 if(render(model)!==baseline.raw||model.blocks.length!==baseline.projection?.length)throw Object.assign(Error('Continuation donor topology changed.'),{status:409});
 model.blocks.forEach((b,i)=>{const row=baseline.projection[i];if(b.raw!==row.raw||retained&&b.id!==row.id)throw Object.assign(Error('Continuation stable block bytes changed.'),{status:409});b.id=row.id;});
 const row=baseline.projection.find(r=>r.id===opening?.id);if(!proposalEditable(row)||row.words!==opening.words||row.blockHash!==opening.blockHash)throw Object.assign(Error('The chosen opening words changed or are unsupported.'),{status:409});
 let boundary;try{boundary=continuationBoundary(model,opening.id);}catch(error){throw Object.assign(error,{status:409});}
 return {...boundary,seenOpeningHash:row.blockHash,seenBoundaryHash:boundary.beforeId?baseline.projection.find(r=>r.id===boundary.beforeId).blockHash:null};
}

/** A complete initial article can only fill an empty native body. Metadata is retained. */
export function articleDraftProposalTarget(baseline){
 if(baseline.binding?.textOutputKind&&baseline.binding.textOutputKind!=='article')throw Object.assign(Error('A complete article draft requires an article piece.'),{status:409});
 const target=openingProposalTarget(baseline);
 if(target.kind!=='insert')throw Object.assign(Error('A complete initial draft requires an empty article body. Revise selected paragraphs or continue a chosen opening instead.'),{status:409});
 return target;
}

/** Capture exact editable IDs in document order; the model never chooses a wider scope. */
export function scopedRevisionProposalTargets(baseline,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>30||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id))throw Object.assign(Error('Choose 1–30 unique paragraph identities for revision.'),{status:400});
 const rows=baseline.projection.filter(row=>ids.includes(row.id));
 if(rows.length!==ids.length||rows.some(row=>!proposalEditable(row)))throw Object.assign(Error('Revision targets must be exact supported plain paragraphs; nested or protected formatting is retained.'),{status:409});
 return rows.map(row=>({id:row.id,seenBlockHash:row.blockHash}));
}
