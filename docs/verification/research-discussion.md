# Source-bounded Research discussion: owner and review boundaries

The candidate connects Discuss this point to the existing Research Answers owner. A prepared question captures explicitly selected readable Library source IDs and revisions; only the separate human Run action requests execution. Answers and exact excerpts remain unreviewed AI learning. Keep retains that owner's answer, not a shared-brief update, fact-check result or manuscript decision.

The normal owner exposes these existing routes. The installed app uses that owner on `127.0.0.1:8841`; the candidate requires its ordinary authorized release before its interface is installed. This connection does not grant a provider account, enable FirstFlow, or demonstrate real-provider execution. Native verification uses an invented fixture and an invented execution stub.

## The main review entrance remains restricted

The review proxy on `127.0.0.1:59958` can read source text, recent Research Answers and an exact saved answer through its existing GET forwarding. Its maintained POST read allowlist does not include Research Answers preview, run or keep. Those requests receive `423` with the proxy's `readOnly:true` refusal before reaching the owner. No route, allowlist, correction permission, provider flag or FirstFlow gate is expanded for discussion.

The interface retains the question and displays the confirmed review refusal. It does not redirect execution, retry another route, connect directly to the owner's origin or infer a broader global provider ban. The review entrance must not be reported as execution-complete merely because the separate normal-owner fixture can run.

## Focused proof

`tests/research-discussion.test.mjs` starts the actual `createReviewConnection` against an invented HTTP owner backed by the actual Research Answers service. Source/recent/exact-answer GETs succeed. Preview/run/keep POSTs are rejected before the owner, every forwarded request remains GET, and execution count stays zero. The actual discussion panel's Prepare refusal preserves exact typed input and creates no second owner capture.

Other checks in that file exercise Prepare → explicit invented Run → collect → exact excerpts → Keep → owner restart → reopen, source staleness, late completion, dirty-context refusal and unchanged manuscripts. Prepared display keeps technical provenance collapsed while preserving the canonical request exactly. Same-answer disclosure state survives Run, Check and Keep; a new answer resets it.

Run the affected checks with:

```sh
node --test tests/research-discussion.test.mjs tests/research-browser-integration.test.mjs tests/research-library-console.test.mjs tests/review-connection.test.mjs
```
