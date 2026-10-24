// Pure adapter guard for the root-owned pickup/destination boundary. No storage or editor.
const fields=['schema','origin','projectId','id','authority','edition','nativeOutputId','slideCount','slideIds','revision','carouselRevision','wordsSignature','arrangementSignature','persistence','undo'];
function valid(value){
 return value?.schema==='ar-create.browser-carousel-pickup.v1'&&typeof value.origin==='string'&&value.origin!=='null'&&typeof value.projectId==='string'&&!!value.projectId&&value.id==='carousel'&&value.authority==='browser-local'&&value.edition==='Browser copy'&&value.nativeOutputId===null&&Number.isInteger(value.slideCount)&&value.slideCount>0&&Array.isArray(value.slideIds)&&value.slideIds.length===value.slideCount&&new Set(value.slideIds).size===value.slideCount&&value.slideIds.every(id=>typeof id==='string'&&!!id)&&typeof value.wordsSignature==='string'&&typeof value.arrangementSignature==='string'&&value.persistence==='this-origin-localStorage'&&value.undo==='local-history';
}
export function assertExactCarouselPickup(expected,current){
 if(!valid(expected)||!valid(current)||fields.some(field=>JSON.stringify(expected[field])!==JSON.stringify(current[field])))throw Error('This browser carousel edition changed. Reopen Pieces before continuing.');
 return current;
}
