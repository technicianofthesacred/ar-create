import {stripDirectionChoices,readDirectionChoices} from '../../public/lib/direction-choice.js';
import {digest} from './files.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const CONCEPT_CONTEXT_ROLE='mixed-concept-contributions-with-separate-explicit-direction';
const adoptedHeading='\n\n## Adopted human direction — explicit\n\n';
const headings=['# Concept\n\n## Author thoughts — supplied verbatim\n\n','\n\n## AI interpretation — provisional\n\n','\n\n## Suggestions — unadopted\n\n','\n\n## Selected Library passages — references, not approval\n\n'];
export function conceptReferences(body){const refs=[];const pattern=/### ([^\n]+)\n\nSource ID: `([a-f0-9-]{36})` · SHA-256: `([a-f0-9]{64})` · character (\d+)\n\n((?:> [^\n]*\n)+)/g;for(const m of body.matchAll(pattern)){if(UUID.test(m[2]))refs.push({title:m[1],sourceId:m[2],sourceHash:m[3],start:Number(m[4]),quote:m[5].slice(0,-1).split('\n').map(line=>line.slice(2)).join('\n')});}return refs;}
export function renderConcept(parts){return headings[0]+parts.authorThoughts+(parts.adoptedDirection?adoptedHeading+parts.adoptedDirection:'')+headings[1]+parts.aiInterpretation+headings[2]+parts.suggestions+headings[3]+parts.sourceSelections.map(s=>'### '+s.title.replace(/[\r\n]/g,' ')+'\n\nSource ID: `'+s.sourceId+'` · SHA-256: `'+s.sourceHash+'` · character '+s.start+'\n\n'+s.quote.split('\n').map(line=>'> '+line).join('\n')+'\n').join('\n');}
export function decodeConcept(body){if(!body)return {structured:true,authorThoughts:'',adoptedDirection:'',aiInterpretation:'',suggestions:'',sourceSelections:[]};const sourceSelections=conceptReferences(body);if(body.startsWith(headings[0])&&headings.every(h=>body.split(h).length===2)){const first=body.indexOf(headings[1]),second=body.indexOf(headings[2]),third=body.indexOf(headings[3]);if(first>=headings[0].length&&second>first&&third>second){const adoptedIndex=body.indexOf(adoptedHeading),hasAdopted=adoptedIndex>=headings[0].length&&adoptedIndex<first&&body.split(adoptedHeading).length===2;const parts={authorThoughts:body.slice(headings[0].length,hasAdopted?adoptedIndex:first),adoptedDirection:hasAdopted?body.slice(adoptedIndex+adoptedHeading.length,first):'',aiInterpretation:body.slice(first+headings[1].length,second),suggestions:body.slice(second+headings[2].length,third),sourceSelections};if(renderConcept(parts)===body)return {structured:true,...parts};}}return {structured:false,authorThoughts:null,adoptedDirection:null,aiInterpretation:null,suggestions:null,sourceSelections,existingDirection:body};}

/** Planning intent is read from its existing owned Markdown; it never approves prose. */
export function directionPlanProjection(body){
 const start='<!-- ar-create:direction-plan:v1 -->',end='<!-- /ar-create:direction-plan:v1 -->';
 if(!body.includes(start)&&!body.includes(end))return null;
 const section=body.split(start),tail=section[1]?.split(end);
 if(section.length!==2||tail?.length!==2||body.split(end).length!==2||body.indexOf(end)<body.indexOf(start))return {role:'planning-intent-not-wording-or-publication-approval',available:false,reason:'Planning section needs review; source wording is preserved.'};
 const match=tail[0].match(/^\n## Planning intent — not approval of wording or publication\n\n```json\n([\s\S]*)\n```\n$/);
 let values;try{values=match&&JSON.parse(match[1]);}catch{}
 if(!values||Array.isArray(values)||typeof values!=='object'||Object.keys(values).some(k=>!['title','audience','language','output','opening','closing'].includes(k))||Object.values(values).some(v=>typeof v!=='string'||v.length>8192))return {role:'planning-intent-not-wording-or-publication-approval',available:false,reason:'Planning section needs review; source wording is preserved.'};
 return {role:'planning-intent-not-wording-or-publication-approval',available:true,values};
}

/** Read-only attribution projection; the existing Markdown remains the sole saved authority. */
export function conceptContextProjection(body){
 const originalBody=body,choices=readDirectionChoices(body);if(choices.available)body=stripDirectionChoices(body);
 const plan=directionPlanProjection(body),planStart=body.indexOf('<!-- ar-create:direction-plan:v1 -->'),planEnd='<!-- /ar-create:direction-plan:v1 -->';
 // The UI appends a planning section after the existing brief. Decode its exact
 // untouched prefix for attribution while the full body/hash remain authoritative.
 const core=plan?.available&&body.endsWith(planEnd)&&planStart>=2&&body.slice(planStart-2,planStart)==='\n\n'?body.slice(0,planStart-2):body;
 const parsed=decodeConcept(core);
 const adoptedStart=body.indexOf(adoptedHeading),adoptedEnd=body.indexOf(headings[1]);
 const explicitManual=body.split(adoptedHeading).length===2&&body.split(headings[1]).length===2&&adoptedStart>=0&&adoptedEnd>adoptedStart?body.slice(adoptedStart+adoptedHeading.length,adoptedEnd):'';
 const adoptedDirection=parsed.structured?parsed.adoptedDirection:explicitManual;
 if(!/^# Concept(?:\s|$)/m.test(body)&&!/^## (?:Author thoughts|Adopted human direction|AI interpretation|Suggestions — unadopted|Selected Library passages)/m.test(body)&&!parsed.sourceSelections.length)return null;
 return {directionChoices:choices,...(plan?{planningIntent:plan}:{}),role:CONCEPT_CONTEXT_ROLE,body:adoptedDirection,bodyRole:'human-authored-editorial-direction-not-evidence-or-source-quotation',personalThoughts:{role:'human-personal-contribution-not-adopted-editorial-direction',body:parsed.structured?parsed.authorThoughts:''},attribution:parsed.structured?'labeled-contributions':'mixed-content-unclassified',sourceSnapshot:{role:CONCEPT_CONTEXT_ROLE,body:originalBody,hash:digest(originalBody)},...(parsed.structured?{aiInterpretation:{role:'ai-interpretation-provisional-not-human-direction',body:parsed.aiInterpretation},suggestions:{role:'ai-suggestions-unadopted-not-human-direction',body:parsed.suggestions}}:{unclassifiedMixedContent:{role:'mixed-concept-content-unclassified-not-human-direction',body:originalBody}}),libraryReferences:{role:'library-passages-not-personal-beliefs-or-verified-factual-support',records:parsed.sourceSelections}};
}
