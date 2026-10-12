// Copied pure donor logic; original runtime/db/API dependencies are deliberately excluded.
// Source: apps/web/components/wordforge/study-material-bands.ts
// Original SHA256: c767bcdae41ba80edf771be2e7a8f9bd30b660baad2e2a8b072da6fb8b5b9b04
function claimBandForCard(card) {
  if (card.research_material_kind !== "claim") return null;
  const support = card.research_support_count;
  const contest = card.research_contest_count;
  const silent = card.research_silent_count;
  const unique = card.research_unique_source_count;
  if (support === null || contest === null || silent === null || unique === null || !Number.isInteger(support) || !Number.isInteger(contest) || !Number.isInteger(silent) || !Number.isInteger(unique) || support < 0 || contest < 0 || silent < 0 || unique < 1 || support + contest + silent !== unique) return "unclassified";
  if (contest > 0) return "contested";
  if (support === 1) return "singly-attested";
  if (support >= 3) return "settled";
  return "unclassified";
}
export {
  claimBandForCard
};
