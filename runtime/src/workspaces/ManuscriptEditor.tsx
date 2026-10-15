import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {EditorContent,useEditor,type Editor} from '@tiptap/react';
import {Node as ExtensionNode,type JSONContent} from '@tiptap/core';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {Mapping,StepMap} from '@tiptap/pm/transform';
import {Fragment,Slice} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {passageEditorExtensions} from '../donors/wordforge/wf-block-markdown';
import {SourcedMark,InlineQuoteMark,ParaphraseMark,BlockquoteAttributedNode,ReferenceCardNode} from '../donors/study/marks';
import {registerParagraphEditor,unregisterParagraphEditor} from '../donors/wordforge/InlineParagraph';
import {wrapManuscript,createPassageMetadata,passageRanges,globalToLocal,localToGlobal,type PassageMetadata} from './continuous-manuscript-model';
import {PassageNode,PassageIdentity,passageIdentityKey} from './passage-node';
import {NativePassageKeys} from './native-passage-keys';
import {plainText,uid,type Paragraph} from './document';
import './manuscript-editor.css';
const NativeDocument=ExtensionNode.create({name:'doc',topNode:true,content:'manuscriptPassage*'});
type SelectionPart={id:string;from:number;to:number;text:string};
type Props={paragraphs:Paragraph[];activeId?:string;focusOnly?:boolean;hideText?:boolean;visible?:boolean;externalReplacementNonce?:number;renderTools:(p:Paragraph,i:number)=>React.ReactNode;onChange:(paragraphs:Paragraph[])=>void;onEditor:(id:string,editor:Editor,initial:boolean)=>void;onSelect:(id:string,text:string,parts:SelectionPart[])=>void;onFocus:(id:string)=>void;onActivate:(id:string)=>void;onBlur:()=>void;onBlocked:(message:string)=>void;};
type PassageDOM={id:string;dom:HTMLElement;content:HTMLElement;tools:HTMLElement;marker:HTMLButtonElement;getPos:()=>number|undefined};
/** One native editor, with passage-local handles for existing source/revision UI. */
export function ManuscriptEditor(props:Props){
 const current=useRef(props);current.current=props;
 const metadata=useRef<PassageMetadata>();if(!metadata.current)metadata.current=createPassageMetadata(props.paragraphs);
 const native=useRef<Editor|null>(null),views=useRef(new Map<HTMLElement,PassageDOM>()),handles=useRef(new Map<string,Editor>()),registered=useRef(new Map<HTMLElement,string>());
 const previousVisible=useRef(props.visible);
 const [renderTick,setRenderTick]=useState(0),alive=useRef(true),initial=useRef(true),suppress=useRef(false),lastEmitted=useRef(''),replacementNonce=useRef(props.externalReplacementNonce),notifyPending=useRef(false);
 function notify(){if(notifyPending.current)return;notifyPending.current=true;queueMicrotask(()=>{notifyPending.current=false;if(alive.current)setRenderTick(value=>value+1);});}
 const passageExtension=useRef(PassageNode.extend({
  addNodeView(){return ({node,getPos})=>{
   const dom=document.createElement('article'),header=document.createElement('header'),marker=document.createElement('button'),content=document.createElement('div'),tools=document.createElement('div');
   dom.className='ar-paragraph ar-native-passage';header.contentEditable='false';marker.type='button';marker.className='ar-passage-marker';header.append(marker);content.className='wr-paragraph-editor wf-passage-document ar-passage-content';content.setAttribute('role','textbox');content.setAttribute('aria-multiline','true');content.setAttribute('spellcheck','true');tools.className='ar-native-passage-tools';tools.contentEditable='false';dom.append(header,content,tools);
   let id=String(node.attrs.id||'');const row:PassageDOM={id,dom,content,tools,marker,getPos};
   const activate=()=>current.current.onActivate(row.id);
   marker.addEventListener('mousedown',event=>event.preventDefault());marker.addEventListener('click',activate);views.current.set(dom,row);notify();
   return {dom,contentDOM:content,update(next){if(next.type.name!=='passage')return false;const nextId=String(next.attrs.id||'');if(nextId!==id){id=nextId;row.id=id;notify();}return true;},ignoreMutation(mutation){if(mutation.type==='selection'){const selection=document.getSelection();return !!selection&&(tools.contains(selection.anchorNode)||tools.contains(selection.focusNode));}return !content.contains(mutation.target)||mutation.target===dom||mutation.type==='attributes'&&mutation.target===content;},stopEvent(event){return tools.contains(event.target as Node)||header.contains(event.target as Node);},destroy(){views.current.delete(dom);unregisterParagraphEditor(content);registered.current.delete(content);marker.removeEventListener('click',activate);notify();}};
  };
 }})).current;
 function passageView(id:string){return [...views.current.values()].find(row=>row.id===id);}
 function range(id:string){const ed=native.current;return ed?passageRanges(ed.getJSON()).find(p=>p.id===id):undefined;}
 function paragraphJSON(id:string){const ed=native.current,r=range(id);if(!ed||!r)return metadata.current!.get(id)?.doc||{type:'doc',content:[{type:'paragraph'}]};const wrapper=ed.state.doc.nodeAt(r.from)!;return {type:'doc',content:wrapper.content.toJSON()||[]};}
 function localState(id:string){const ed=native.current!,r=range(id)!,doc=ed.schema.nodeFromJSON(paragraphJSON(id)),end=Math.max(1,doc.content.size-1);const from=Math.max(1,Math.min(ed.state.selection.from-r.offset,end)),to=Math.max(1,Math.min(ed.state.selection.to-r.offset,end));return EditorState.create({schema:ed.schema,doc,selection:TextSelection.create(doc,Math.min(from,to),Math.max(from,to))});}
 function dispatchLocal(id:string,transaction:any){const ed=native.current,r=range(id);if(!ed||!r)return;const global=closeHistory(ed.state.tr),mapping=new Mapping([StepMap.offset(r.offset)]);for(const step of transaction.steps){const mapped=step.map(mapping);if(mapped)global.step(mapped);}if(transaction.selectionSet){const selection=transaction.selection;global.setSelection(TextSelection.create(global.doc,selection.from+r.offset,selection.to+r.offset));}ed.view.dispatch(global);}
 function handle(id:string):Editor{
  const found=handles.current.get(id);if(found)return found;
  const commands=new Proxy({}, {get(_target,name:string){return (...args:any[])=>{
   const ed=native.current,r=range(id);if(!ed||!r)return false;
   if(name==='setTextSelection'){const selection=typeof args[0]==='number'?{from:args[0],to:args[0]}:args[0];const global=localToGlobal(ed.getJSON(),id,selection);return global?ed.commands.setTextSelection(global):false;}
   if(name==='focus'){const position=args[0];if(typeof position==='number')return ed.commands.focus(position+r.offset,args[1]);ed.view.focus();return true;}
   if(name==='setContent'){const next=ed.schema.nodeFromJSON(args[0]),tr=closeHistory(ed.state.tr).replaceWith(r.offset,r.to-1,next.content);if(args[1]?.emitUpdate===false)tr.setMeta('preventUpdate',true);ed.view.dispatch(tr);return true;}
   if(name==='insertContentAt'){const at=typeof args[0]==='number'?args[0]+r.offset:{from:args[0].from+r.offset,to:args[0].to+r.offset};return ed.commands.insertContentAt(at,args[1],args[2]);}
   return (ed.commands as any)[name]?.(...args)??false;
  };}});
  const value:any={get nativeEditor(){return native.current;},getJSON:()=>paragraphJSON(id),getText:()=>localState(id).doc.textContent,get isDestroyed(){return !native.current||native.current.isDestroyed||!range(id);},get isFocused(){const ed=native.current,r=range(id);return !!ed?.isFocused&&!!r&&(ed.state.selection.head>=r.offset&&ed.state.selection.head<=r.to-1||ed.state.selection.head===ed.state.doc.content.size&&r.to===ed.state.doc.content.size||ed.state.selection.head===0&&r.from===0);},get schema(){return native.current!.schema;},get state(){return localState(id);},commands,chain:()=>native.current!.chain(),get view(){return {get dom(){return passageView(id)?.content||native.current!.view.dom;},get state(){return localState(id);},dispatch:(tr:any)=>dispatchLocal(id,tr),focus:()=>native.current!.view.focus()};},currentParagraphId:()=>globalToLocal(native.current!.getJSON(),native.current!.state.selection)?.paragraphId,selectionScope:()=>globalToLocal(native.current!.getJSON(),native.current!.state.selection)?'passage':'manuscript'};
  handles.current.set(id,value);return value;
 }
 function reportSelection(ed:Editor){
  const selection=ed.state.selection,ranges=passageRanges(ed.getJSON()),focus=ranges.find(p=>selection.head>=p.offset&&selection.head<=p.to-1)||ranges[selection.head===0?0:ranges.length-1];if(!focus)return;
  const parts=ranges.flatMap(r=>{const from=Math.max(selection.from,r.offset),to=Math.min(selection.to,r.to-1);if(to<=from)return [];const text=ed.state.doc.textBetween(from,to,'\n');return text?[{id:r.id,from:from-r.offset,to:to-r.offset,text}]:[];});
  current.current.onFocus(focus.id);current.current.onSelect(focus.id,selection.empty?'':ed.state.doc.textBetween(selection.from,selection.to,'\n'),parts);
 }
 const extensions=useRef([...passageEditorExtensions().filter(extension=>extension.name!=='starterKit'),...passageEditorExtensions().filter(extension=>extension.name==='starterKit').map(extension=>extension.configure({document:false})),NativeDocument,passageExtension,NativePassageKeys,PassageIdentity.configure({metadata:metadata.current,onBlocked:message=>current.current.onBlocked(message)}),SourcedMark,InlineQuoteMark,ParaphraseMark,BlockquoteAttributedNode,ReferenceCardNode]).current;
 function pasteFragment(fragment:Fragment):Fragment{const nodes:any[]=[];fragment.forEach(node=>{const content=node.content.size?pasteFragment(node.content):node.content;if(node.type.name==='passage'){const id=uid();metadata.current!.copy(String(node.attrs.id||''),id,{type:'doc',content:content.toJSON()||[]});nodes.push(node.type.create({...node.attrs,id},content,node.marks));}else nodes.push(node.isText?node:node.copy(content));});return Fragment.fromArray(nodes);}
 const editorProps=useRef({transformPasted:(slice:Slice)=>new Slice(pasteFragment(slice.content),slice.openStart,slice.openEnd),attributes:{class:'ar-continuous-editor',role:'textbox','aria-label':'Manuscript text','aria-multiline':'true',spellcheck:'true'}}).current;
 const editor=useEditor({
  extensions,
  content:wrapManuscript(props.paragraphs),editorProps,
  onUpdate({editor:ed,transaction,appendedTransactions}){
   native.current=ed;const mapping=new Mapping();const assigned:any[]=[];for(const tr of [transaction,...appendedTransactions]){mapping.appendMapping(tr.mapping);assigned.push(...(tr.getMeta(passageIdentityKey)?.assigned||[]));}
   const rows=metadata.current!.reconcile(ed.getJSON(),{previousDoc:transaction.before.toJSON(),mapping,assigned});lastEmitted.current=JSON.stringify(wrapManuscript(rows));if(!suppress.current)current.current.onChange(rows);notify();
  },
  onSelectionUpdate:({editor:ed})=>reportSelection(ed),onFocus:({editor:ed})=>reportSelection(ed),onBlur:()=>current.current.onBlur(),
 },[]);
 useEffect(()=>{alive.current=true;native.current=editor;if(editor)notify();return()=>{alive.current=false;for(const dom of registered.current.keys())unregisterParagraphEditor(dom);};},[editor]);
 useEffect(()=>{
  if(!editor)return;metadata.current!.update(props.paragraphs);const desired=editor.schema.nodeFromJSON(wrapManuscript(props.paragraphs));
  if(replacementNonce.current!==props.externalReplacementNonce){replacementNonce.current=props.externalReplacementNonce;metadata.current!.clear();metadata.current!.update(props.paragraphs);const selection=TextSelection.near(desired.resolve(Math.min(2,desired.content.size)));editor.view.updateState(EditorState.create({schema:editor.schema,doc:desired,selection,plugins:editor.state.plugins}));reportSelection(editor);lastEmitted.current=JSON.stringify(wrapManuscript(props.paragraphs));notify();return;}
  if(desired.eq(editor.state.doc)||JSON.stringify(wrapManuscript(props.paragraphs))===lastEmitted.current)return;
  const actualIds=passageRanges(editor.getJSON()).map(p=>p.id),nextIds=props.paragraphs.map(p=>p.id);let transaction=editor.state.tr;
  if(JSON.stringify(actualIds)===JSON.stringify(nextIds)){
   for(let index=props.paragraphs.length-1;index>=0;index--){const r=passageRanges(transaction.doc.toJSON())[index],wrapper=transaction.doc.nodeAt(r.from)!,next=desired.child(index);if(!wrapper.content.eq(next.content))transaction.replaceWith(r.offset,r.to-1,next.content);}
  }else transaction.replaceWith(0,transaction.doc.content.size,desired.content);
  transaction.setMeta('addToHistory',false);suppress.current=true;try{editor.view.dispatch(transaction);}finally{suppress.current=false;}lastEmitted.current=JSON.stringify(wrapManuscript(props.paragraphs));notify();
 },[editor,props.paragraphs,props.externalReplacementNonce,props.visible]);
 useEffect(()=>{
  if(!editor)return;if(editor.isEditable!==(props.visible!==false))editor.setEditable(props.visible!==false,false);
  for(const row of views.current.values()){const position=row.getPos();const id=position===undefined?row.id:String(editor.state.doc.nodeAt(position)?.attrs.id||row.id);row.id=id;const index=props.paragraphs.findIndex(p=>p.id===id),p=props.paragraphs[index];row.dom.dataset.paragraph=id;row.dom.dataset.active=String(id===props.activeId);row.dom.hidden=index<0||!!props.focusOnly&&id!==props.activeId;row.content.hidden=!!props.hideText;row.content.setAttribute('aria-label',`Passage ${index+1}`);row.marker.textContent=String(index+1).padStart(2,'0')+(p?.proposal?' ·':'');row.marker.setAttribute('aria-label',`Focus passage ${index+1}`);row.marker.setAttribute('aria-pressed',String(id===props.activeId));if(index>=0&&registered.current.get(row.content)!==id){const ed=handle(id);registerParagraphEditor(row.content,ed);registered.current.set(row.content,id);current.current.onEditor(id,ed,initial.current);}}
  initial.current=false;if(previousVisible.current===false&&props.visible!==false)editor.view.focus();previousVisible.current=props.visible;
 },[editor,renderTick,props.activeId,props.focusOnly,props.hideText,props.visible,props.paragraphs]);
 return <>{!editor?props.paragraphs.map((p,index)=><article key={p.id} data-paragraph={p.id} data-active={p.id===props.activeId} className="ar-paragraph" hidden={!!props.focusOnly&&p.id!==props.activeId}><header><button className="ar-passage-marker" aria-label={`Focus passage ${index+1}`}>{String(index+1).padStart(2,'0')}</button></header><div className="wr-paragraph-editor" hidden={props.hideText}>{plainText(p.doc)}</div>{props.renderTools(p,index)}</article>):<EditorContent editor={editor}/>} {props.paragraphs.map((p,index)=>{const row=passageView(p.id);return row?createPortal(props.renderTools(p,index),row.tools,p.id):null;})}</>;
}
