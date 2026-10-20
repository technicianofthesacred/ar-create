/* Read-only reuse of the maintained article canvas and portrait slide renderer. */
import React from 'react';
import {createRoot} from 'react-dom/client';
import ConversationCanvas from '../../runtime/src/donors/teajia/conversation/ConversationCanvas';
import {LocalStoryProvider} from '../../runtime/src/donors/teajia/storyEdit';
import {outputSpec} from '../../runtime/src/workspaces/compositionSpec';
import {Frame} from '../../runtime/src/workspaces/CarouselWorkspace';
export function mountStudyAudience(element:HTMLElement,read:any){
 const output=read?.output,doc=read?.document;
 if(!output?.id||!doc||!['article','carousel'].includes(output.kind))throw Error('A supported saved audience edition is required.');
 const width=Math.max(240,Math.min(540,element.clientWidth||540)),root=createRoot(element);
 root.render(output.kind==='article'?<div className="ar-donor-workspace"><main className="ar-output-reader"><LocalStoryProvider placements={output.placements||[]} editing={false} onPlacements={()=>{}}><ConversationCanvas spec={outputSpec(doc,output)} paragraphs={output.manuscript||doc.paragraphs}/></LocalStoryProvider></main></div>:<div className="ar-donor-workspace"><div className="oss-sequence">{output.slides.map((slide:any,index:number)=><article className="oss-slide" key={slide.id} aria-label={'Slide '+(index+1)}><Frame slide={slide} title={output.title||doc.title} width={width}/></article>)}</div>{output.caption&&<div className="oss-reader"><h3>Caption</h3><p>{output.caption}</p></div>}</div>);
 return {destroy(){root.unmount();}};
}
