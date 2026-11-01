// Reads the captured `npm test` output and writes ci-summary.json:
// {tests,pass,fail,skipped,sha,at}. The status generator reads this shape.
// Usage: node tests/helpers/ci-summary.mjs <test-output.log> <ci-summary.json>
// Accepts both node:test summary styles: TAP ("# pass 12") and spec ("ℹ pass 12").
import fs from 'node:fs';

const [input = 'test-output.log', output = 'ci-summary.json'] = process.argv.slice(2);
const text = fs.existsSync(input) ? fs.readFileSync(input, 'utf8') : '';
const count = key => {
  const all = [...text.matchAll(new RegExp(`^(?:#|ℹ) ${key} (\\d+)\\s*$`, 'gm'))];
  return all.length ? Number(all.at(-1)[1]) : null;
};
const summary = {
  tests: count('tests'),
  pass: count('pass'),
  fail: count('fail'),
  skipped: count('skipped'),
  sha: process.env.GITHUB_SHA || null,
  at: new Date().toISOString(),
};
fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
// A missing count means the suite did not finish; that is not a pass.
if (summary.tests === null) process.exitCode = 1;
