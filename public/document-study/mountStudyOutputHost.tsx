import {mountStudyComposition} from './mountStudyComposition';
import {createStudyOutputHost} from './study-output-host.mjs';
export const mountStudyOutputHost=(element:HTMLElement,options:any)=>createStudyOutputHost({...options,element,mount:mountStudyComposition});
