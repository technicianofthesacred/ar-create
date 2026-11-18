// Capability probe for tests that render Carousel PNGs through local headless Chrome.
// Use the renderer's real readiness/file protocol and bounded child cleanup; a
// dump-dom process may stay alive after producing its page and is not that protocol.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chrome} from '../../runtime/services/carousel.mjs';
import {renderCarouselProcess} from '../../runtime/services/carousel-render-process.mjs';

async function probe() {
  let bin;
  try { bin = chrome(); } catch (error) { return 'headless Chrome not installed (carousel.mjs looks only for the macOS Playwright build): ' + error.message; }
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ar-carousel-capability-'));
  try {
    const html=path.join(dir,'probe.html'),png=path.join(dir,'probe.png');
    fs.writeFileSync(html,'<!doctype html><html data-export-status="ready"><body>Invented rendering capability probe</body></html>');
    await renderCarouselProcess(bin,['--headless','--user-data-dir='+path.join(dir,'profile'),'--disable-background-networking','--disable-component-update','--disable-extensions','--hide-scrollbars','--window-size=1080,1350','--dump-dom','--screenshot='+png,pathToFileURL(html).href],png,{timeout:30000});
    return false;
  } catch (error) {
    return 'headless Chrome is installed but cannot render here: '+String(error.stderr||error.message).split('\n')[0].slice(0,200);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}

/** false when Chrome renders here; otherwise the skip reason. */
export const chromeSkip = await probe();
