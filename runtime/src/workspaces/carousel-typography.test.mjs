import test from 'node:test';
import assert from 'node:assert/strict';
import {fitCarouselTypography} from './carousel-typography.mjs';
function slide(){
 let measured=0;
 const attrs={'data-edit':'text','data-base-font-size':'60'},text={style:{},getAttribute:k=>attrs[k]??null};
 const root={querySelectorAll:selector=>selector.includes('data-base-font-size')?[text]:[],getBoundingClientRect(){measured++;return {width:1080,height:1350,left:0,right:1080,top:0,bottom:1350};},offsetWidth:1080,offsetHeight:1350,ownerDocument:{}};
 return {root,text,measured:()=>measured};
}
test('a preview that reports nothing sets its sizes without measuring words',()=>{
 const {root,text,measured}=slide();
 assert.deepEqual(fitCarouselTypography(root,{font:'serif',scale:1.2,fit:'manual'},{measure:false}),{overflow:false,scale:1.2});
 assert.equal(text.style.fontSize,'72px');
 assert.equal(text.style.fontFamily,"'Source Serif 4',Georgia,serif");
 assert.equal(measured(),0);
});
test('the reporting preview and the capture page still measure',()=>{
 const reporting=slide();
 fitCarouselTypography(reporting.root,{font:'original',scale:1,fit:'manual'},{measure:true});
 assert.ok(reporting.measured()>0);
 const capture=slide();
 fitCarouselTypography(capture.root,{font:'original',scale:1,fit:'manual'});
 assert.ok(capture.measured()>0);
 const auto=slide();
 fitCarouselTypography(auto.root,{font:'original',scale:1,fit:'auto'},{measure:false});
 assert.ok(auto.measured()>0,'auto fit always measures');
});
