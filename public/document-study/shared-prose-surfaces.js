/* C05: Atlas reading typography for existing source, research and context nodes.
   Presentation only: no replacement, reparenting, serialization or hidden headings. */
(() => {
  const roots = [
    '.recordBody', '.draft-context-words', '.material-read-text', '.source-continuation-reader > pre',
    '.flow-direction > .flow-prose', '.flow-details.flow-prose',
    '.research-standard-row > div', '.research-standard-surrounding',
    '.research-standard-controls > details[data-research-source-point] > p',
    '.research-standard-controls > details[data-research-source-point] > blockquote',
    '.research-standard-coverage > details > pre',
    '.human-direction-preview', '.human-direction-banner > div > p',
    '.human-direction-edit > details > p:first-of-type',
    '.study-ai-change > section > p',
    'textarea.flow-source-words', 'textarea[data-human-direction]',
    'textarea[data-research-narration]', 'textarea[data-draft="note"]',
    'textarea[data-draft="words"]'
  ].join(',');
  const excluded = [
    'button','input','select','option','summary','label','figcaption','small','table',
    '.small','.flow-row','.flow-segment-meta','.research-standard-location',
    '.research-standard-provenance','.research-standard-label','.research-standard-plan-state',
    '.research-standard-actions','.research-standard-placement','.research-standard-narration-label',
    '.recordAnnotations','.material-editorial','.material-choice-details','.recordDetails',
    '.source-continuation-reader-heading','.human-direction-actions',
    '.slide','.carousel','.carouselCanvas','.carousel-canvas','[data-template]',
    '[data-template-id]','.portrait-template','.output-canvas'
  ].join(',');
  const blocks = 'p,blockquote,ul,ol,li,h1,h2,h3,h4,h5,h6,pre';
  function decorate(scope = document) {
    let added = 0;
    const candidates = [...scope.querySelectorAll(roots)];
    if (scope.matches?.(roots)) candidates.unshift(scope);
    for (const root of candidates) {
      if (root.matches(excluded) || !root.closest('.workspace') || root.closest('.slide,.carousel,.carouselCanvas,.carousel-canvas,[data-template],[data-template-id],.portrait-template,.output-canvas')) continue;
      // Manuscripts already have their own accepted adapter and heading ownership.
      if (root.matches('.manuscript-prose') || root.closest('#manuscript,.draft-read-words')) continue;
      if (!root.classList.contains('shared-prose-surface')) { root.classList.add('shared-prose-surface'); added++; }
      const passages = root.matches(blocks) ? [root, ...root.querySelectorAll(blocks)] : [...root.querySelectorAll(blocks)];
      for (const node of passages) {
        // Exclusions inside the root are metadata or controls; the root itself may be
        // an authored textarea nested in its existing label, which stays unchanged.
        let cursor = node, skip = false;
        while (cursor && cursor !== root) { if (cursor.matches(excluded)) { skip = true; break; } cursor = cursor.parentElement; }
        if (skip || node.matches(excluded)) continue;
        node.classList.add('shared-prose-block');
        for (const inline of node.querySelectorAll('span,a,em,strong,b,i,u,s,mark')) {
          let at = inline, blocked = false;
          while (at && at !== node) { if (at.matches(excluded)) { blocked = true; break; } at = at.parentElement; }
          if (!blocked) inline.classList.add('shared-prose-inline');
        }
      }
    }
    return added;
  }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; decorate(); });
  });
  const app = document.getElementById('app');
  if (app) observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  window.SharedProseSurfaces = { decorate };
  decorate();
})();
