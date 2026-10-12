// Copied pure donor logic; original runtime/db/API dependencies are deliberately excluded.
// Source: apps/core/lib/study/research-materials.ts
// Original SHA256: 7c2a7a59cc5b5a166c951e1c9cacd3339007308b033641e4e76eafc92f89582c
import { createHash } from "node:crypto";
function verifyExactPassage(body, passage) {
  return passage.length > 0 && body.includes(passage);
}
function exactParagraphContext(text, quote) {
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const index = paragraphs.findIndex((paragraph) => paragraph.includes(quote));
  return {
    before: index > 0 ? paragraphs[index - 1] : "",
    after: index >= 0 && index + 1 < paragraphs.length ? paragraphs[index + 1] : ""
  };
}
function groundedSpeaker(source, candidate) {
  const proposed = candidate.speaker?.trim() || source.trusted_speaker?.trim() || "";
  if (!proposed) return null;
  if (source.trusted_speaker && proposed.toLocaleLowerCase() === source.trusted_speaker.trim().toLocaleLowerCase()) return proposed;
  return source.text.includes(proposed) ? proposed : null;
}
function verifyMaterialCandidates(source, candidates) {
  const materials = [];
  const dropped = [];
  for (const candidate of candidates) {
    const quote = candidate.quote.trim();
    if (!verifyExactPassage(source.text, quote)) {
      dropped.push({ candidate, reason: "quote_not_exact" });
      continue;
    }
    if (candidate.kind === "claim") {
      const claimText = candidate.claim_text?.trim();
      if (!claimText || candidate.stance !== "support" && candidate.stance !== "contest") {
        dropped.push({ candidate, reason: "claim_incomplete" });
        continue;
      }
      materials.push({
        kind: "claim",
        study_item_id: source.study_item_id,
        claim_text: claimText,
        exact_quote: quote,
        stance: candidate.stance,
        locator: candidate.locator?.trim() && source.text.includes(candidate.locator.trim()) ? candidate.locator.trim() : source.locator,
        locator_url: source.locator_url,
        source_kind: source.source_kind,
        spine_order: source.spine_order,
        lane: source.lane,
        wildcard_kind: source.wildcard_kind ?? null
      });
      continue;
    }
    const speaker = groundedSpeaker(source, candidate);
    if (!speaker) {
      dropped.push({ candidate, reason: "speaker_not_grounded" });
      continue;
    }
    const context = exactParagraphContext(source.text, quote);
    if (!context.before || !context.after) {
      dropped.push({ candidate, reason: "account_context_missing" });
      continue;
    }
    materials.push({
      kind: "account",
      study_item_id: source.study_item_id,
      verbatim_text: quote,
      speaker,
      locator: candidate.locator?.trim() && source.text.includes(candidate.locator.trim()) ? candidate.locator.trim() : source.locator,
      locator_url: source.locator_url,
      context_before: context.before,
      context_after: context.after,
      lane: source.lane,
      wildcard_kind: source.wildcard_kind ?? null
    });
  }
  return { materials, dropped };
}
function liveMaterialClaimBand(claim) {
  if (claim.counts.contest > 0) return "contested";
  if (claim.band === "what-goes-wrong") return "what-goes-wrong";
  if (claim.counts.support <= 2) return "fringe";
  return "settled";
}
function sortClaimsByRarity(claims) {
  const rank = (claim) => {
    const band = liveMaterialClaimBand(claim);
    return band === "fringe" ? 0 : band === "contested" ? 1 : band === "what-goes-wrong" ? 2 : 3;
  };
  const bookOrder = (claim) => Math.min(
    ...claim.votes.filter((vote) => vote.source_kind === "book" && vote.spine_order !== null).map((vote) => vote.spine_order),
    Number.POSITIVE_INFINITY
  );
  return claims.slice().sort((a, b) => rank(a) - rank(b) || bookOrder(a) - bookOrder(b) || a.counts.support - b.counts.support || b.counts.contest - a.counts.contest || a.id.localeCompare(b.id));
}
function encoded(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function studyMaterialContentDigest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function receipt(marker, value) {
  const payload = encoded(value);
  return `<!-- ${marker}:${payload}:${digest(payload)} -->`;
}
function decoded(markdown, marker) {
  const match = markdown.match(new RegExp(`<!-- ${marker}:([A-Za-z0-9_-]+):([a-f0-9]{64}) -->`));
  if (!match) throw new Error(`missing ${marker} rebuild receipt`);
  if (digest(match[1]) !== match[2]) throw new Error(`corrupt ${marker} rebuild receipt`);
  return JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
}
function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validCount(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function validClaim(value) {
  if (!record(value) || typeof value.id !== "string" || !value.id.trim() || typeof value.text !== "string" || !value.text.trim() || !["settled", "contested", "what-goes-wrong", "fringe"].includes(String(value.band)) || !Array.isArray(value.votes)) return false;
  const lane = value.lane === void 0 ? "main" : value.lane;
  const wildcardKind = value.wildcard_kind === void 0 ? null : value.wildcard_kind;
  if (!["main", "wildcard"].includes(String(lane)) || !(wildcardKind === null || ["alternative_frame", "cultural", "fringe"].includes(String(wildcardKind))) || lane === "main" && wildcardKind !== null || lane === "wildcard" && wildcardKind === null) return false;
  const counts = value.counts;
  if (!record(counts) || !["support", "contest", "silent", "unique_sources"].every((key) => validCount(counts[key]))) return false;
  const supportCount = counts.support;
  const contestCount = counts.contest;
  const silentCount = counts.silent;
  const uniqueSourceCount = counts.unique_sources;
  const sourceIds = /* @__PURE__ */ new Set();
  let support = 0;
  let contest = 0;
  for (const vote of value.votes) {
    if (!record(vote) || typeof vote.source_id !== "string" || !vote.source_id.trim() || !["support", "contest", "silent"].includes(String(vote.stance)) || !(vote.exact_quote === null || typeof vote.exact_quote === "string") || !(vote.locator === null || typeof vote.locator === "string") || !(vote.locator_url === null || typeof vote.locator_url === "string") || !["book", "video", "article", "document", "other"].includes(String(vote.source_kind)) || !(vote.spine_order === null || typeof vote.spine_order === "number")) return false;
    if (sourceIds.has(vote.source_id)) return false;
    sourceIds.add(vote.source_id);
    if (vote.source_kind === "book" && (!Number.isInteger(vote.spine_order) || vote.spine_order < 0)) return false;
    if (vote.stance !== "silent" && (!vote.exact_quote?.trim() || !vote.locator?.trim())) return false;
    if (vote.stance === "support") support++;
    if (vote.stance === "contest") contest++;
  }
  return supportCount === support && contestCount === contest && supportCount + contestCount + silentCount === uniqueSourceCount && sourceIds.size <= uniqueSourceCount;
}
function renderClaimsMarkdown(input) {
  const sorted = sortClaimsByRarity(input.claims);
  const lines = ["---", "kind: research-claims", `board_id: ${input.board_id}`, "---", "", "# Claims", ""];
  for (const claim of sorted) {
    lines.push(`## ${claim.text}`, "", `${claim.counts.support} support, ${claim.counts.contest} contest, ${claim.counts.silent} silent`, "");
    for (const vote of claim.votes) {
      if (!vote.exact_quote) continue;
      lines.push(`> ${vote.exact_quote}`, `> ${vote.locator ?? ""} (${vote.stance}, ${vote.source_kind})`, "");
    }
  }
  lines.push(receipt("i64os-claims", sorted), "");
  return lines.join("\n");
}
function parseClaimsMarkdown(markdown) {
  const claims = decoded(markdown, "i64os-claims");
  if (!Array.isArray(claims) || !claims.every(validClaim) || new Set(claims.map((claim) => claim.id)).size !== claims.length) {
    throw new Error("invalid i64os-claims rebuild receipt");
  }
  return claims;
}
function renderAccountMarkdown(record2) {
  const a = record2.account;
  return [
    "---",
    "kind: research-account",
    `account_id: ${record2.account_id}`,
    `run_id: ${record2.run_id}`,
    `research_source_id: ${record2.research_source_id}`,
    `study_item_id: ${a.study_item_id}`,
    `lane: ${a.lane}`,
    ...a.wildcard_kind ? [`wildcard_kind: ${a.wildcard_kind}`] : [],
    "---",
    "",
    `# ${a.speaker}`,
    "",
    `Locator: ${a.locator}`,
    "",
    `> ${a.verbatim_text}`,
    "",
    "## Context before",
    "",
    a.context_before,
    "",
    "## Context after",
    "",
    a.context_after,
    "",
    receipt("i64os-account", record2),
    ""
  ].join("\n");
}
function parseAccountMarkdown(markdown) {
  const value = decoded(markdown, "i64os-account");
  if (!record(value) || typeof value.account_id !== "string" || !value.account_id.trim() || typeof value.run_id !== "string" || !value.run_id.trim() || typeof value.research_source_id !== "string" || !value.research_source_id.trim() || !record(value.account) || value.account.kind !== "account" || typeof value.account.study_item_id !== "string" || !value.account.study_item_id.trim() || typeof value.account.verbatim_text !== "string" || !value.account.verbatim_text.trim() || typeof value.account.speaker !== "string" || !value.account.speaker.trim() || typeof value.account.locator !== "string" || !value.account.locator.trim() || value.account.locator_url !== null && typeof value.account.locator_url !== "string" || typeof value.account.context_before !== "string" || !value.account.context_before.trim() || typeof value.account.context_after !== "string" || !value.account.context_after.trim() || !["main", "wildcard"].includes(String(value.account.lane)) || !(value.account.wildcard_kind === void 0 || value.account.wildcard_kind === null || ["alternative_frame", "cultural", "fringe"].includes(String(value.account.wildcard_kind))) || value.account.lane === "main" && value.account.wildcard_kind != null || value.account.lane === "wildcard" && value.account.wildcard_kind == null) {
    throw new Error("invalid i64os-account rebuild receipt");
  }
  return value;
}
function renderStudyMaterialManifest(manifest) {
  return [
    "---",
    "kind: study-material-snapshot",
    `run_id: ${manifest.run_id}`,
    "---",
    "",
    receipt("i64os-study-material-manifest", manifest),
    ""
  ].join("\n");
}
function parseStudyMaterialManifest(markdown) {
  const value = decoded(markdown, "i64os-study-material-manifest");
  if (!record(value) || value.version !== 1 || typeof value.run_id !== "string" || !value.run_id.trim() || typeof value.board_id !== "string" || !value.board_id.trim() || !record(value.claims) || value.claims.file !== "_claims.md" || typeof value.claims.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.claims.sha256) || !Array.isArray(value.accounts)) throw new Error("invalid study material snapshot manifest");
  const files = /* @__PURE__ */ new Set();
  for (const account of value.accounts) {
    if (!record(account) || typeof account.file !== "string" || !/^accounts\/[a-f0-9]{64}\.md$/.test(account.file) || typeof account.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(account.sha256) || files.has(account.file)) throw new Error("invalid study material snapshot manifest");
    files.add(account.file);
  }
  return value;
}
export {
  liveMaterialClaimBand,
  parseAccountMarkdown,
  parseClaimsMarkdown,
  parseStudyMaterialManifest,
  renderAccountMarkdown,
  renderClaimsMarkdown,
  renderStudyMaterialManifest,
  sortClaimsByRarity,
  studyMaterialContentDigest,
  verifyMaterialCandidates
};
