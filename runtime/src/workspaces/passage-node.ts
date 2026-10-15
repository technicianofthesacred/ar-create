import {Node,Extension,mergeAttributes} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Mapping} from '@tiptap/pm/transform';
import {PASSAGE_NODE,normalizePassageIds,passageRanges,type PassageMetadata} from './continuous-manuscript-model';
export const PassageNode=Node.create({
 name:PASSAGE_NODE,group:'manuscriptPassage',content:'block+',definingAsContext:true,definingForContent:false,selectable:false,
 addAttributes(){return {id:{default:null,parseHTML:element=>element.getAttribute('data-passage-id'),renderHTML:attrs=>attrs.id?{'data-passage-id':attrs.id}:{}}};},
 parseHTML(){return [{tag:'section[data-passage-id]'}];},renderHTML({HTMLAttributes}){return ['section',mergeAttributes(HTMLAttributes,{'class':'ar-native-passage'}),0];},
});
export const passageIdentityKey=new PluginKey('ar-passage-identity');
export const PassageIdentity=Extension.create<{metadata?:PassageMetadata;onBlocked?:(message:string)=>void;createId:()=>string}>({
 name:'passageIdentity',addOptions(){return {createId:()=>crypto.randomUUID()};},
 addProseMirrorPlugins(){const options=this.options;return [new Plugin({
  key:passageIdentityKey,
  filterTransaction(transaction,state){
   if(!transaction.docChanged)return true;
   const before=passageRanges(state.doc.toJSON()),after=passageRanges(transaction.doc.toJSON());
   for(const range of before){
    if(!options.metadata?.get(range.id)?.proposal)continue;
    const matches=after.filter(p=>p.id===range.id);let blocked=matches.length!==1;
    // A different passage's surviving content cannot merge into a pending proposal's wrapper.
    if(!blocked)for(const removed of before.filter(p=>!after.some(next=>next.id===p.id))){const mapped=transaction.mapping.mapResult(Math.min(removed.to-2,removed.offset+1),1);if(!mapped.deleted&&mapped.pos>=matches[0].offset&&mapped.pos<=matches[0].to-1)blocked=true;}
    if(blocked){options.onBlocked?.('Review or discard the waiting proposal before deleting, splitting or joining its passage.');return false;}
   }
   return true;
  },
  appendTransaction(transactions,old,state){
   if(!transactions.some(t=>t.docChanged))return null;
   const mapping=new Mapping();for(const transaction of transactions)mapping.appendMapping(transaction.mapping);
   const current=passageRanges(state.doc.toJSON()),preferred=new Map<string,number>();
   for(const range of passageRanges(old.doc.toJSON())){const mapped=mapping.mapResult(range.offset,1);if(mapped.deleted)continue;const index=current.findIndex(next=>next.id===range.id&&mapped.pos>=next.offset&&mapped.pos<=next.to-1);if(index>=0)preferred.set(range.id,index);}
   const normalized=normalizePassageIds(state.doc.toJSON(),options.createId,preferred);if(!normalized.assigned.length)return null;
   const transaction=state.tr;let index=0;state.doc.forEach((node,position)=>{const currentIndex=index++;const assignment=normalized.assigned.find(item=>item.index===currentIndex);if(assignment)transaction.setNodeMarkup(position,undefined,{...node.attrs,id:assignment.id});});
   return transaction.setMeta(passageIdentityKey,{assigned:normalized.assigned});
  },
 })];},
});
