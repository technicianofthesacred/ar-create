// Copied pure donor logic; original runtime/db/API dependencies are deliberately excluded.
// Source: apps/core/lib/wordforge/study-material-import.ts
// Original SHA256: 45a5bd90e180e159cc9386fdd7d6a7bf2002c7ea9e7eaabaa349bc1f47c5a46f
function required(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`invalid_study_material_${name}`);
  }
  return value;
}
function nonnegative(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`invalid_study_material_${name}`);
  }
  return value;
}
function materialLane(lane, wildcardKind) {
  const normalizedLane = lane ?? "main";
  const normalizedKind = wildcardKind ?? null;
  if (normalizedLane === "main" && normalizedKind !== null || normalizedLane === "wildcard" && normalizedKind === null) {
    throw new Error("invalid_study_material_wildcard_lane");
  }
  return { research_lane: normalizedLane, wildcard_kind: normalizedKind };
}
function claimSources(claim) {
  return claim.votes.map((vote) => {
    required(vote.source_id, "source_id");
    if (!["support", "contest", "silent"].includes(vote.stance)) {
      throw new Error("invalid_study_material_stance");
    }
    if (!["book", "video", "article", "document", "other"].includes(vote.source_kind)) {
      throw new Error("invalid_study_material_source_kind");
    }
    if (vote.exact_quote !== null) required(vote.exact_quote, "exact_quote");
    if (vote.locator !== null) required(vote.locator, "locator");
    if (vote.locator_url !== null) required(vote.locator_url, "locator_url");
    if (vote.spine_order !== null && (!Number.isInteger(vote.spine_order) || vote.spine_order < 0)) {
      throw new Error("invalid_study_material_spine_order");
    }
    return {
      source_id: vote.source_id,
      stance: vote.stance,
      exact_quote: vote.exact_quote,
      locator: vote.locator,
      locator_url: vote.locator_url,
      source_kind: vote.source_kind,
      spine_order: vote.spine_order
    };
  });
}
function claimCard(pileId, claim, actor) {
  required(claim.id, "claim_id");
  required(claim.text, "claim_text");
  const sources = claimSources(claim);
  const lane = materialLane(claim.lane, claim.wildcard_kind);
  const support = nonnegative(claim.counts.support, "support_count");
  const contest = nonnegative(claim.counts.contest, "contest_count");
  const silent = nonnegative(claim.counts.silent, "silent_count");
  const unique = nonnegative(claim.counts.unique_sources, "unique_source_count");
  const explicitSupport = sources.filter((source) => source.stance === "support").length;
  const explicitContest = sources.filter((source) => source.stance === "contest").length;
  const explicitSilent = sources.filter((source) => source.stance === "silent").length;
  if (support + contest + silent !== unique || explicitSupport !== support || explicitContest !== contest || explicitSilent > silent || sources.length > unique) {
    throw new Error("invalid_study_material_source_count");
  }
  return {
    kind: "point",
    text: claim.text,
    source_ref: null,
    excerpt: "",
    ref_label: `${unique} ${unique === 1 ? "source" : "sources"}`,
    origin: "ai",
    disagrees_with: [],
    added_by: actor,
    research_material_kind: "claim",
    ...lane,
    research_material_identity: `study:${pileId}:claim:${claim.id}`,
    research_support_count: support,
    research_contest_count: contest,
    research_silent_count: silent,
    research_unique_source_count: unique,
    research_sources: sources
  };
}
function accountCard(pileId, record, actor) {
  const account = record.account;
  required(record.account_id, "account_id");
  required(record.research_source_id, "account_source_id");
  required(account.verbatim_text, "account_verbatim");
  required(account.speaker, "account_speaker");
  required(account.locator, "account_locator");
  required(account.context_before, "account_context_before");
  required(account.context_after, "account_context_after");
  if (account.locator_url !== null) required(account.locator_url, "account_locator_url");
  if (account.lane !== "main" && account.lane !== "wildcard") {
    throw new Error("invalid_study_material_account_lane");
  }
  const lane = materialLane(account.lane, account.wildcard_kind);
  return {
    kind: "quote",
    text: account.verbatim_text,
    source_ref: null,
    excerpt: "",
    ref_label: account.speaker,
    origin: "ai",
    disagrees_with: [],
    added_by: actor,
    research_material_kind: "account",
    ...lane,
    research_material_identity: `study:${pileId}:account:${record.account_id}`,
    research_sources: [],
    research_source_id: record.research_source_id,
    research_speaker: account.speaker,
    research_locator: account.locator,
    research_locator_url: account.locator_url,
    research_context_before: account.context_before,
    research_context_after: account.context_after
  };
}
function buildStudyMaterialCardInputs(pileId, material, actor) {
  return [
    ...material.claims.map((claim) => claimCard(pileId, claim, actor)),
    ...material.accounts.map((account) => accountCard(pileId, account, actor))
  ];
}
export {
  buildStudyMaterialCardInputs
};
