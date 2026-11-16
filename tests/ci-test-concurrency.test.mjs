import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const command = workflow.split('\n').find(line => line.includes(' | tee "$RUNNER_TEMP/test-output.log"')).trim();
const macConcurrency = workflow.match(/CONCURRENCY: .*'(--test-concurrency=\d+)'/)?.[1];

test('Mac CI runs every test file with no more than two concurrent workers', () => {
  assert.equal(macConcurrency, '--test-concurrency=2');
  const limit = 2;
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-worker-limit-'));
  try {
    mkdirSync(path.join(dir, 'tests'));
    const fixture = `import {test} from 'node:test';
import {appendFileSync} from 'node:fs';
test('worker', async () => {
appendFileSync(process.env.PROBE_LOG, 'start\\n');
await new Promise(resolve => setTimeout(resolve, 250));
appendFileSync(process.env.PROBE_LOG, 'end\\n');
});`;
    for (let i = 0; i < 6; i++) writeFileSync(path.join(dir, 'tests', `${i}.test.mjs`), fixture);
    const log = path.join(dir, 'workers.log');
    const env = {...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`, CONCURRENCY: macConcurrency, SHARD: '1/1', RUNNER_TEMP: dir, PROBE_LOG: log};
    delete env.NODE_TEST_CONTEXT; // Exercise a standalone runner, outside this parent test.
    const result = spawnSync('/bin/bash', ['-o', 'pipefail', '-c', command], {
      cwd: dir,
      env,
      encoding: 'utf8', timeout: 15000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let active = 0, peak = 0, starts = 0;
    for (const event of readFileSync(log, 'utf8').trim().split('\n')) {
      if (event === 'start') {active++; starts++;} else active--;
      peak = Math.max(peak, active);
    }
    assert.equal(starts, 6, 'all fixture files must execute');
    assert.equal(active, 0);
    assert.ok(peak > 0 && peak <= limit, `observed ${peak} workers, limit ${limit}`);
  } finally {rmSync(dir, {recursive: true, force: true});}
});
