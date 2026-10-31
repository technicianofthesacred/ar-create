import {createCarouselVisualReviews} from './carousel-visual-review.mjs';
import { createExports } from "./exports.mjs";
import { createCarouselExports } from "./carousel.mjs";
const fail = (m) => {
  throw Object.assign(Error(m), { status: 409 });
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function createNativeOutputExports({ dataDir, store, outputs, resolveScope, library, validateStandInReview, exports: articles = createExports({ dataDir, store }), carousel = createCarouselExports({ dataDir, store, library }) }) {
  if (!outputs?.withExportSnapshot || typeof resolveScope !== "function") throw Error("Supply exact output snapshot and persisted scope owners.");
  async function scope(i) {
    if (!i || !uuid.test(i.rootBindingId || "") || typeof i.parentStudyId !== "string" || !uuid.test(i.selectedOutputId || "")) fail("Exact root, parent and selected output required.");
    const s = await resolveScope({ rootBindingId: i.rootBindingId, parentStudyId: i.parentStudyId });
    if (!uuid.test(s?.projectId || "") || !uuid.test(s?.documentId || "")) fail("Unknown trusted physical output scope.");
    return { ...s, outputId: i.selectedOutputId };
  }
  let visual;const visuals=()=>visual||=createCarouselVisualReviews({dataDir,carousel,outputs,resolveScope:scope,validateStandInReview});
  const guard = (i) => ({ rootBindingId: i.rootBindingId, parentStudyId: i.parentStudyId, selectedOutputId: i.selectedOutputId, expectedOutput: i.expectedOutput, ...i.expectedNative ? { expectedNative: i.expectedNative } : {} });
  return {
    reviewCarouselVisual:async input=>({...await visuals().review(input),view:await outputs.read({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId})}),
    standInReviewCarouselVisual:async input=>({...await visuals().standInReview(input),view:await outputs.read({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId})}),
    async saveArticle(input) {
      const s = await scope(input);
      return outputs.withExportSnapshot(guard(input), async ({ projectId, documentId, output, wordOwner, expectedOutput, sourceProofHash, finalCheck,languageEditionReview }) => {
        if (projectId !== s.projectId || documentId !== s.documentId) fail("Export scope changed across its snapshot lease.");
        if (!/^[a-f0-9]{64}$/.test(sourceProofHash||"")) fail("Trusted captured source proof digest required.");
        if (!["article","post","product-listing"].includes(output.kind) || output.id !== input.selectedOutputId || output.manuscriptRevision !== input.manuscriptRevision) fail("Exact selected article manuscript revision required.");
        return articles.save({ name: input.name, mimeType: input.mimeType, body: input.body, outputId: output.id, manuscriptRevision: input.manuscriptRevision }, { ...s, output, finalCheck, publicationBinding: { ...(output.languageEdition?{language:output.language,languageEdition:structuredClone(output.languageEdition),languageEditionReview:structuredClone(languageEditionReview)}:{}),wordOwner, expectedOutput, ...sourceProofHash ? { sourceProofHash } : {} } });
      });
    },
    async saveCarousel(input, origin) {
      const s = await scope(input);
      return outputs.withExportSnapshot(guard(input), async ({ projectId, documentId, output, wordOwner, expectedOutput, sourceProofHash, finalCheck, assetProof,languageEditionReview,wordsReviewDecision }) => {
        if (projectId !== s.projectId || documentId !== s.documentId) fail("Export scope changed across its snapshot lease.");
        if (!/^[a-f0-9]{64}$/.test(sourceProofHash||"")) fail("Trusted captured source proof digest required.");
        if (!Array.isArray(assetProof)) fail("Trusted captured used-asset proof required.");
        if (output.kind !== "carousel" || output.id !== input.selectedOutputId || (output.outputRevision || 0) !== input.outputRevision) fail("Exact selected carousel output revision required.");
        const renderUrl = (id, index) => {
          const q = new URLSearchParams({ rootBindingId: input.rootBindingId, parentStudyId: input.parentStudyId, selectedOutputId: input.selectedOutputId });
          return origin + "/api/carousel/exports/" + id + "/render/" + index + "?" + q;
        };
        return carousel.save({ outputId: output.id, outputRevision: input.outputRevision }, origin, { ...s, output, finalCheck, assetProof, renderUrl, publicationBinding: { ...(output.languageEdition?{language:output.language,languageEdition:structuredClone(output.languageEdition),languageEditionReview:structuredClone(languageEditionReview)}:{}),wordOwner, expectedOutput, ...(wordsReviewDecision?{wordsReviewDecision}:{}), ...sourceProofHash ? { sourceProofHash } : {} } });
      });
    },
    async list(input) {
      const s = await scope(input);
      const saved=carousel.list(s);return { ...articles.list(s), ...saved, exports:await Promise.all((saved.exports||[]).map(row=>visuals().inspect(input,{...row,files:row.files.map(file=>({...file,url:file.url+(file.url.includes('?')?'&':'?')+new URLSearchParams({rootBindingId:input.rootBindingId,parentStudyId:input.parentStudyId,selectedOutputId:input.selectedOutputId})}))}))) };
    },
    async file(input) {
      const s = await scope(input);
      return input.format === "carousel" ? carousel.file(input.exportId, input.name, s) : articles.file(input.exportId, s);
    },
    async page(input) {
      const s = await scope(input);
      return carousel.page(input.exportId, input.index, s);
    },
    capability: () => carousel.capability()
  };
}
export {
  createNativeOutputExports
};
