/* Isolated reuse entry. Mounts the existing canvas; adds no editor or canonical store. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CompositionWorkspace} from '../../runtime/src/workspaces/CompositionWorkspace';
import type {Manuscript} from '../../runtime/src/workspaces/document';
import type {WorkspaceOptions} from '../../runtime/src/workspaces/EditorWorkspace';
import {persistOutputExport} from '../../runtime/src/workspaces/exportOutput';
import {createStudyOutputBoundary} from './study-output-boundary.mjs';

export function mountStudyComposition(element:HTMLElement,input:any){
 const root=createRoot(element);let boundary:any,doc:Manuscript;
 const outputChange=(next:Manuscript)=>{try{void boundary.change(next).catch(()=>{});}catch(error){input.onError?.(error);doc=boundary.document;render();}};
 const render=()=>{if(!boundary||boundary.disposed)return;const identity=boundary.scope;
  const options:WorkspaceOptions={activity:'use',embeddedArrange:input.embeddedArrange===true,selectedOutputId:boundary.selectedOutputId,project:{id:identity.rootBindingId,title:doc.title,document:doc},document:doc,api:boundary.api,readOutputAsset:boundary.readAsset,mediaApi:boundary.mediaApi,compositionCapabilities:{...boundary.compositionCapabilities,manualCreate:input.embeddedArrange?false:input.canCreateOutput?.()??false,restore:false},canUndoArrangement:!!boundary.arrangementUndo?.operationId,onUndoArrangement:input.onUndoArrangement,onRefreshOutput:input.onRefreshOutput,onReviewCarouselWords:input.onReviewCarouselWords,carouselReviewRole:input.carouselReviewRole,onCreateOutput:input.onCreateOutput,outputRelationship:boundary.outputRelationship,onOutputSelect:(id)=>{void boundary.selectOutput(id).catch((error:any)=>input.onError?.(error));},onOutputWriting:(id)=>{void boundary.nativeEdit(id).catch((error:any)=>input.onError?.(error));},outputExport:(source,output,format)=>persistOutputExport(boundary.api,source,output,format,{readAsset:boundary.readAsset,stylesheetUrl:'/assets/study-output-canvas.css'}),ensureSaved:boundary.ensureSaved,onDocumentChange:()=>{throw Error('Writing stays in the native Draft owner.');},onNavigate:()=>{void boundary.nativeEdit().catch((error:any)=>input.onError?.(error));},onShelfRequest:(target,payload)=>boundary.shelf(target,payload)};
  root.render(<div className="ar-donor-workspace"><CompositionWorkspace key={JSON.stringify(identity)} options={options} doc={doc} change={outputChange}/></div>);
 };
 boundary=createStudyOutputBoundary({...input,onView:(next:Manuscript)=>{doc=next;render();}});doc=boundary.document;render();
 return {update(model:any){boundary.update(model);},async flush(){await boundary.ensureSaved();},returnToDraft(outputId?:string){return boundary.nativeEdit(outputId);},restoreBrowserDraft(output:any){const next=boundary.document;next.outputs=next.outputs.map((row:any)=>row.id===output.id?output:row);return boundary.change(next);},destroy(){boundary.destroy();root.unmount();}};
}
