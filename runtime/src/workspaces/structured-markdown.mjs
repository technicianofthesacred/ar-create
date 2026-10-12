// Markdown renders study attribution; source identity remains in the stored JSON.
// Shared by browser exports and the opt-in per-piece publisher.
import { docToMarkdown } from "../donors/wordforge/wf-block-serialize.mjs";
function structuredMarkdown(doc) {
  const copy = structuredClone(doc);
  const visit = (node) => {
    if (node.type === "referenceCard") {
      node.type = "paragraph";
      node.content = [{ type: "text", text: `[Reference: ${node.attrs?.sourceTitle || ""}] ${node.attrs?.text || ""}` }];
    }
    if (node.type === "blockquoteAttributed") {
      node.type = "blockquote";
      node.content = [{ type: "paragraph", content: node.content || [] }, { type: "paragraph", content: [{ type: "text", text: `\u2014 ${node.attrs?.author || node.attrs?.sourceTitle || "Source"}` }] }];
    }
    node.content?.forEach(visit);
  };
  visit(copy);
  return docToMarkdown(copy);
}
export {
  structuredMarkdown
};
