// Capability probe for tests that render Carousel PNGs through the local headless Chrome.
// The renderer (runtime/services/carousel.mjs chrome()) only looks in
// ~/Library/Caches/ms-playwright/.../chrome-headless-shell-mac-arm64, so it is absent on Linux CI;
// and inside a macOS Seatbelt sandbox the binary exists but cannot start (mach port denied).
// Tests that need real PNGs skip with this reason instead of failing or silently passing.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chrome} from '../../runtime/services/carousel.mjs';

async function probe() {
  let bin;
  try { bin = chrome(); } catch (error) { return 'headless Chrome not installed (carousel.mjs looks only for the macOS Playwright build): ' + error.message; }
  try { await promisify(execFile)(bin, ['--headless', '--disable-gpu', '--dump-dom', 'about:blank'], {timeout: 30000}); return false; }
  catch (error) { return 'headless Chrome is installed but cannot start here: ' + String(error.stderr || error.message).split('\n').find(line => /FATAL|denied|error/i.test(line))?.trim().slice(0, 200) || 'launch failed'; }
}

/** false when Chrome renders here; otherwise the skip reason. */
export const chromeSkip = await probe();
