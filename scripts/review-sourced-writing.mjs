// The review forwards only the exact scoped sourced-paragraph operations.
const HASH=/^[a-f0-9]{64}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);
const fail=()=>{throw Object.assign(Error('Use the exact sourced paragraph and current piece context.'),{status:400});};
export function validateSourcedWriting(action,input){
 const base=['storyId','pieceId','edition','parentStudyId','expectedHash','contextHash','operationId'],extra=action==='run'?['instruction']:action==='propose'?['claims','gaps']:['proposalId','proposalHash',...(action==='reject'?['reason']:[])];
 if(!['run','propose','accept','reject'].includes(action)||!input||typeof input!=='object'||Array.isArray(input)||base.some(k=>!Object.hasOwn(input,k))||Object.keys(input).some(k=>![...base,...extra].includes(k))||!text(input.storyId,256)||!text(input.pieceId,256)||!text(input.parentStudyId,256)||input.edition!=='working'||!HASH.test(input.expectedHash||'')||!HASH.test(input.contextHash||'')||!UUID.test(input.operationId||''))fail();
 if(action==='run'&&input.instruction!==undefined&&(typeof input.instruction!=='string'||input.instruction.length>2000||!input.instruction.isWellFormed()||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.instruction)))fail();
 if(['accept','reject'].includes(action)&&(!UUID.test(input.proposalId||'')||!HASH.test(input.proposalHash||'')))fail();
 if(action==='reject'&&input.reason!==undefined&&(typeof input.reason!=='string'||input.reason.length>2000||!input.reason.isWellFormed()||input.reason.includes('\0')))fail();
 if(action==='propose'&&(!Array.isArray(input.claims)||input.claims.length>30||!Array.isArray(input.gaps)||input.gaps.length>20))fail();
 return input;
}
