// Existing native review surface only; no new presentation or human authority.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
export async function captureNativeCreationReview({base,binding,requestId,paragraphs,own,markNote}){
 const output=process.env.AR_CREATE_CREATION_SHOTS;if(!output)return;
 const {chromium}=await import(process.env.AR_CREATE_PLAYWRIGHT||'playwright'),browser=await chromium.launch({headless:true}),checks=[];fs.mkdirSync(output,{recursive:true});
 try{for(const theme of ['light','dark'])for(const [width,height,size]of [[1440,900,'desktop'],[390,844,'phone']]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.setDefaultTimeout(15000);
  try{
   await page.goto(base+'/document-study/index.html?reviewActor=agent:codex');await page.waitForFunction(()=>typeof state!=='undefined'&&!!window.studyDraft?.openBinding);
   await page.evaluate(async b=>{let p=state.projects.find(p=>p.id===b.parentStudyId);if(!p){p={id:b.parentStudyId,name:'Invented blue cup',title:'Invented blue cup',collectionKind:'collection-root',collectionBindingId:b.bindingId,blocks:[],history:[],note:null,positions:{},slides:[],rev:1};state.projects.push(p);}state.project=p.id;p.view='article';p.viewedStage=5;const hold=studyDraft.holdForContext({deferWorking:true});render();await studyDraft.openBinding(b);if(hold)studyDraft.releaseContext({...hold,cancelOnly:true});},binding);
   await page.waitForFunction(b=>studyDraft.currentBinding()?.id===b.bindingId,binding);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const button=page.locator('[data-ai-action="review:'+requestId+'"]');await button.waitFor();await button.click();await page.locator('[data-ai-rt-words]').first().waitFor();
   const words=page.locator('[data-ai-rt-words]');assert.equal(await words.count(),paragraphs.length);for(let i=0;i<paragraphs.length;i++)assert.equal(await words.nth(i).inputValue(),paragraphs[i]);
   await words.nth(1).fill(own);await page.locator('[data-ai-rt-mark]').nth(2).check();await page.locator('[data-ai-rt-note]').fill(markNote);
   const host=page.locator(size==='desktop'?'#study-ai-reading':'.study-ai-readthrough').first();await host.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`article-readthrough-${size}-${theme}.png`)});
   assert.equal(await words.nth(1).inputValue(),own);assert.equal(await page.locator('[data-ai-rt-mark]').nth(2).isChecked(),true);
   const metrics=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,dirty:studyDraft.currentProof()?.dirty,bindingId:studyDraft.currentBinding()?.id}));assert.equal(metrics.bindingId,binding.bindingId);assert.equal(metrics.dirty,false,'review edits do not mutate the manuscript');
   const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('ar-create:read-through:'+id)),requestId);assert.ok(Object.values(stored.words).includes(own));assert.ok(Object.values(stored.notes).includes(markNote));
   checks.push({size,theme,...metrics,paragraphsRendered:paragraphs.length,reviewEditRetained:true,markRetained:true,humanFinishClicked:false});
  }catch(error){await page.screenshot({path:path.join(output,`failure-${size}-${theme}.png`)});fs.writeFileSync(path.join(output,`failure-${size}-${theme}.txt`),await page.locator('body').innerText());throw error;}finally{await context.close();}
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(output,'screen-proof.json'),JSON.stringify({synthetic:true,existingPresentation:true,appOnlyPreparation:false,provider:'deterministic-test-fixture',approval:false,checks},null,2)+'\n');
}
