import {captureNativeOutput,reopenNativeOutput,nativeOutputFreshness,nativeOutputRenderDocument} from './native-output-seam';
import {snapshotCarousel} from '../src/workspaces/document';
import {reconcileArticleComposition} from '../src/workspaces/articleComposition';
import {articleCompositionIssue} from '../src/workspaces/article-composition.mjs';
import {assertOutputEditorialReady} from '../src/workspaces/editorial-state.mjs';
import {carouselWordsHash} from '../src/workspaces/carousel-words.mjs';
export const mapper={capture:captureNativeOutput,reopen:reopenNativeOutput,freshness:nativeOutputFreshness,renderDocument:nativeOutputRenderDocument};
export const helpers={snapshotCarousel,reconcileArticleComposition,articleCompositionIssue,assertOutputEditorialReady,carouselWordsHash};
