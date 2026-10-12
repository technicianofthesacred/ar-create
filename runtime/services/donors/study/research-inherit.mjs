// Copied pure donor logic; original runtime/db/API dependencies are deliberately excluded.
// Source: apps/core/lib/wordforge/research-inherit.ts
// Original SHA256: 8061a748dc3cef46a93d0a267b24cc4c1811be51a8e90433c13285873f81b4fb
function claimSentinel(claimId) {
  return `primer-claim:${claimId}`;
}
function positionSentinel(positionId) {
  return `primer-position:${positionId}`;
}
function gapSentinel(pileId) {
  return `primer-gap:${pileId}`;
}
function conceptSentinel(conceptId) {
  return `primer-concept:${conceptId}`;
}
function titleKey(title) {
  return title.trim().toLowerCase();
}
function claimRefLabel(claim) {
  const quote = claim.quotes[0];
  const provenance = quote ? `${quote.speaker}, ${quote.locator}` : "no verbatim quote captured";
  const total = claim.supports + claim.contests + claim.silent;
  const tallyParts = [`${claim.supports} of ${total} sources support this`];
  if (claim.contests > 0) tallyParts.push(`${claim.contests} contest it`);
  if (claim.fringe) tallyParts.push("fringe: carried by 1-2 sources only");
  return `${provenance} \xB7 ${tallyParts.join(", ")}`;
}
export {
  claimRefLabel,
  claimSentinel,
  conceptSentinel,
  gapSentinel,
  positionSentinel,
  titleKey
};
