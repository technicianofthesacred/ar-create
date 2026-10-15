import {Extension} from '@tiptap/core';
import {TextSelection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import {passageRanges} from './continuous-manuscript-model';
/** Passage wrappers do not add an extra Backspace/Delete or arrow stop. */
export const NativePassageKeys=Extension.create({
 name:'nativePassageKeys',priority:1100,
 addKeyboardShortcuts(){
  const editor=this.editor;
  const move=(direction:-1|1,extend=false)=>{const state=editor.state,selection=state.selection,ranges=passageRanges(state.doc.toJSON()),index=ranges.findIndex(r=>selection.head>=r.offset&&selection.head<=r.to-1);if(index<0||!extend&&!selection.empty)return false;const current=ranges[index],at=selection.head,boundary=direction===-1?current.offset+1:current.to-2;if(at!==boundary)return false;const next=ranges[index+direction];if(!next)return false;const head=direction===-1?next.to-2:next.offset+1;editor.view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,extend?selection.anchor:head,head)));return true;};
  const join=(direction:-1|1)=>{const state=editor.state,selection=state.selection;if(!selection.empty)return false;const ranges=passageRanges(state.doc.toJSON()),index=ranges.findIndex(r=>selection.head>=r.offset&&selection.head<=r.to-1);if(index<0)return false;const current=ranges[index],expected=direction===-1?current.offset+1:current.to-2;if(selection.head!==expected)return false;const left=ranges[direction===-1?index-1:index],right=ranges[direction===-1?index:index+1];if(!left||!right)return false;const leftNode=state.doc.nodeAt(left.from)!,rightNode=state.doc.nodeAt(right.from)!;if(!['paragraph','heading'].includes(leftNode.lastChild?.type.name||'')||!['paragraph','heading'].includes(rightNode.firstChild?.type.name||''))return false;
   const caret=left.to-2,innerBoundary=left.to-1;const transaction=closeHistory(state.tr).join(right.from).join(innerBoundary);transaction.setSelection(TextSelection.create(transaction.doc,caret));editor.view.dispatch(transaction);editor.view.dispatch(closeHistory(editor.state.tr));return true;};
  return {'ArrowLeft':()=>move(-1),'ArrowRight':()=>move(1),'Shift-ArrowLeft':()=>move(-1,true),'Shift-ArrowRight':()=>move(1,true),'Backspace':()=>join(-1),'Delete':()=>join(1)};
 }
});
