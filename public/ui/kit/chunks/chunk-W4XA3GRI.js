import{a as E}from"./chunk-VAI3NKH2.js";import{a as D}from"./chunk-TZORI5HO.js";import{a as j}from"./chunk-DCANE7XH.js";var y=j(R=>{"use strict";var t=D(),M=E();function O(u,r){return u===r&&(u!==0||1/u===1/r)||u!==u&&r!==r}var N=typeof Object.is=="function"?Object.is:O,w=M.useSyncExternalStore,G=t.useRef,I=t.useEffect,W=t.useMemo,_=t.useDebugValue;R.useSyncExternalStoreWithSelector=function(u,r,v,a,o){var i=G(null);if(i.current===null){var f={hasValue:!1,value:null};i.current=f}else f=i.current;i=W(function(){function m(e){if(!d){if(d=!0,s=e,e=a(e),o!==void 0&&f.hasValue){var l=f.value;if(o(l,e))return n=l}return n=e}if(l=n,N(s,e))return l;var V=a(e);return o!==void 0&&o(l,V)?(s=e,l):(s=e,n=V)}var d=!1,s,n,b=v===void 0?null:v;return[function(){return m(r())},b===null?void 0:function(){return m(b())}]},[r,v,a,o]);var c=w(u,i[0],i[1]);return I(function(){f.hasValue=!0,f.value=c},[c]),_(c),c}});var k=j((A,z)=>{"use strict";z.exports=y()});export{k as a};
/*! Bundled license information:

use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js:
  (**
   * @license React
   * use-sync-external-store-shim/with-selector.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
