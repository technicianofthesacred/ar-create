// Shared by the editable 1080 × 1350 preview and the PNG capture page.
export const CAROUSEL_FONTS = Object.freeze({
  original: null, // Keep each canvas's authored family.
  caudex: 'Caudex,Georgia,serif',
  serif: "'Source Serif 4',Georgia,serif",
  sans: "'Instrument Sans',Arial,sans-serif",
});

export function validateCarouselTypography(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && ['original', 'caudex', 'serif', 'sans'].includes(value.font)
    && typeof value.scale === 'number' && Number.isFinite(value.scale) && value.scale >= .5 && value.scale <= 1.5
    && ['auto', 'manual'].includes(value.fit);
}

export function normalizeTypography(value) {
  const font = ['original', 'caudex', 'serif', 'sans'].includes(value?.font) ? value.font : 'original';
  const scale = typeof value?.scale === 'number' && Number.isFinite(value.scale) ? Math.min(1.5, Math.max(.5, value.scale)) : 1;
  const fit = value?.fit === 'auto' ? 'auto' : 'manual';
  return { font, scale, fit };
}

// This function deliberately contains its own validation and font map so the server
// can inject fitCarouselTypography.toString() into its isolated capture browser.
// It only reads/mutates descendants of root and is safe to call repeatedly.
export function fitCarouselTypography(root, typography) {
  if (!root || typeof root.querySelectorAll !== 'function') return { overflow: false, scale: 1 };
  const font = typography?.font === 'serif' ? "'Source Serif 4',Georgia,serif"
    : typography?.font === 'sans' ? "'Instrument Sans',Arial,sans-serif"
    : typography?.font === 'caudex' ? 'Caudex,Georgia,serif' : null;
  const rawScale = typeof typography?.scale === 'number' && Number.isFinite(typography.scale) ? typography.scale : 1;
  const bounded = Math.min(1.5, Math.max(.5, rawScale));
  const auto = typography?.fit === 'auto';
  const slots = [...root.querySelectorAll('[data-edit][data-base-font-size]')].filter(el =>
    ['text', 'label', 'credit'].includes(el.getAttribute('data-edit')) && Number(el.getAttribute('data-base-font-size')) > 0);
  if (!slots.length) return { overflow: false, scale: bounded };
  const main = slots.filter(el => el.getAttribute('data-edit') === 'text');
  const largestBase = main.length ? Math.max(...main.map(el => Number(el.getAttribute('data-base-font-size')))) : 0;
  // Body text remains readable on a phone after the 1080px canvas is scaled.
  // Each body block has its own 42px floor. The largest base determines when
  // every block has reached that floor without inflating a larger title.
  const floor = largestBase ? 42 / largestBase : .5;
  const requested = Math.max(bounded, floor);

  const setScale = scale => {
    for (const el of slots) {
      if (!Object.hasOwn(el,'__carouselAuthoredFontFamily')) el.__carouselAuthoredFontFamily = el.style.fontFamily;
      if (font) el.style.fontFamily = font;
      else el.style.fontFamily = el.__carouselAuthoredFontFamily;
      const base = Number(el.getAttribute('data-base-font-size'));
      const size = el.getAttribute('data-edit') === 'text' ? Math.max(42, base * scale) : Math.max(24, base * bounded);
      el.style.fontSize = `${Number(size.toFixed(3))}px`;
    }
  };
  const excess = () => {
    const rr = root.getBoundingClientRect();
    if (!rr.width || !rr.height) return false; // Hidden preview: fit when it is displayed.
    const sx = rr.width / (root.offsetWidth || 1080);
    const sy = rr.height / (root.offsetHeight || 1350);
    const px = value => (Number.parseFloat(value) || 0);
    const outside = (r, b) => r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1;
    for (const zone of root.querySelectorAll('[data-text-zone]')) {
      const zr = zone.getBoundingClientRect();
      if (outside(zr, rr)) return true;
      const style = zone.ownerDocument.defaultView?.getComputedStyle(zone);
      const content = {
        left: zr.left + px(style?.paddingLeft) * sx,
        right: zr.right - px(style?.paddingRight) * sx,
        top: zr.top + px(style?.paddingTop) * sy,
        bottom: zr.bottom - px(style?.paddingBottom) * sy,
      };
      const inline = zone.style || {};
      const has = value => !!value && value !== 'auto';
      const fixed = has(inline.height) || (has(inline.top) && has(inline.bottom))
        || (has(inline.inset) && /^0(?:px)?$/.test(inline.inset.trim()));
      const allowed = fixed ? content : { ...content, top: rr.top, bottom: rr.bottom };
      for (const el of zone.querySelectorAll('[data-edit]')) {
        // A whole-node Range includes trailing spaces at a wrapped line's end.
        // Those selection boxes can extend beyond the line without a visible
        // glyph overflowing. Measure visible runs; never rewrite the wording.
        const doc=el.ownerDocument,walker=doc?.createTreeWalker?.(el,4);
        let measured=false,node;
        while(walker&&(node=walker.nextNode())) {
          for(const match of node.textContent.matchAll(/\S+/g)) {
            const range=doc.createRange();range.setStart(node,match.index);range.setEnd(node,match.index+match[0].length);
            const rects=range.getClientRects?.();
            const glyphs=rects?.length?[...rects]:[range.getBoundingClientRect?.()||el.getBoundingClientRect()];
            measured=true;
            if(glyphs.some(glyph=>outside(glyph,allowed)||outside(glyph,rr)))return true;
          }
        }
        if(!measured&&el.textContent.trim()&&outside(el.getBoundingClientRect(),allowed))return true;
      }
    }
    return false;
  };

  setScale(requested);
  let overflow = excess();
  let scale = requested;
  let minScaleReached = false;
  if (overflow && auto) {
    setScale(floor);
    if (excess()) {
      scale = floor;
      minScaleReached = true;
    } else {
      let low = floor, high = requested;
      for (let i = 0; i < 16; i++) {
        const mid = (low + high) / 2;
        setScale(mid);
        if (excess()) high = mid; else low = mid;
      }
      scale = Math.max(floor, Math.floor(low * 1000) / 1000);
      setScale(scale);
    }
    overflow = excess();
  }

  // A real webfont may replace its fallback after the first preview paint.
  // Capture callers should also await document.fonts.ready before taking the PNG.
  const fonts = root.ownerDocument?.fonts;
  if (fonts?.status === 'loading' && root.__carouselTypographyFontWait !== fonts.ready) {
    root.__carouselTypographyFontWait = fonts.ready;
    fonts.ready.then(() => {
      if (root.isConnected && root.__carouselTypographyFontWait === fonts.ready) fitCarouselTypography(root, typography);
    });
  }
  return minScaleReached ? { overflow, scale, minScaleReached } : { overflow, scale };
}
