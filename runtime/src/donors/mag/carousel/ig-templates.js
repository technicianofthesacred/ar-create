// Teajia Instagram templates, as fillable slots. Shared by the magazine page (server and browser).
// Measured from the Instagram system canvas (claude.ai/artifact/8esgxBsfUugunEDBaHAVkT), 2026-10-06:
// every size, color and position below is the canvas's, at the real 1080 x 1350.
// A slide is { role, text, credit, label, photos: [{ src, x, y }] }; x and y are the crop focus in percent.
// The logo appears only on covers and closes (the Instagram guide); inner slides carry the label.
import {originalCatalog} from './ig-original-catalog.mjs';
const IG = (() => {
  const C = { ground: '#1a1714', box: '#2a2622', line: '#3a3530', head: '#f3eada', sup: '#cdc0a8', gold: '#a8874d' };
  const e = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const font = s => ({ serif: "'Source Serif 4',Georgia,serif", sans: "'Instrument Sans',Arial,sans-serif" })[s?.typography?.font] || 'Caudex,Georgia,serif';
  const scale = s => { const n = Number(s?.typography?.scale); return Number.isFinite(n) && n >= .5 && n <= 1.5 ? n : 1; };
  const dynamic = (kind, t, px, s, extra = '') => '<div data-edit="' + kind + '" data-base-font-size="' + px + '" style="font-family:' + font(s) + ';font-size:' + Number(Math.max(kind === 'text' ? 42 : 24, px * scale(s)).toFixed(3)) + 'px;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;min-width:0;flex-shrink:0;' + extra + '">' + e(t) + '</div>';
  const label = (t, s) => t ? dynamic('label', t, 30, s, 'letter-spacing:.16em;color:' + C.sup + ';text-transform:uppercase') : '';
  const credit = (t, s) => t ? dynamic('credit', t, 30, s, 'letter-spacing:.16em;color:' + C.gold + ';text-transform:uppercase') : '';
  const head = (t, px, s) => dynamic('text', t, px, s, 'line-height:1.1');
  const logo = (w, h, ctx) => '<img src="' + e(ctx.logo) + '" alt="teajiā" style="width:' + w + 'px;height:' + h + 'px;object-fit:contain;display:block;flex-shrink:0">';
  // Instagram pillar seal from the measured J06 canvas; never the website emblem.
  const pillarSeal = pillar => ['佳','家','嘉'].includes(pillar) ? '<div data-pillar-seal="' + pillar + '" style="position:absolute;left:72px;top:72px;width:88px;height:88px;background:' + C.gold + ';color:' + C.ground + ';font-family:Shippori Mincho,serif;font-weight:800;font-size:60px;line-height:1;display:flex;align-items:center;justify-content:center">' + pillar + '</div>' : '';
  // One photo slot. data-slot lets the page drop a photo on it and drag the crop.
  const photo = (s, i, box) => { const p = (s.photos || [])[i];
    const focus = n => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 50; };
    const inner = p && p.src ? '<img src="' + e(p.src) + '" alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;object-position:' + focus(p.x) + '% ' + focus(p.y) + '%;display:block">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#241f1a;color:#8d806b;font:34px Caudex,Georgia,serif">no photo matched</div>';
    return '<div data-slot="' + i + '" style="position:absolute;overflow:hidden;' + box + '">' + inner + '</div>'; };
  const fade = h => '<div style="position:absolute;left:0;bottom:0;width:1080px;height:' + h + 'px;background:linear-gradient(rgba(26,23,20,0),rgba(26,23,20,.9) 62%)"></div>';
  const frame = body => '<div style="width:1080px;height:1350px;position:relative;overflow:hidden;background:' + C.ground + ';color:' + C.head + ";font-family:'EB Garamond',Georgia,serif\">" + body + '</div>';
  // H10 displays only the title before a spaced middle dot. The editor must retain the raw full text. A look may name
  // its own link (ctx.link); Teajia's is teajia.com/read.
  const closeParts = t => { const p = String(t || '').split(/\s+·\s+/); return { title: p[0] || '', link: 'teajia.com/read' }; };

  const T = {
    H6: { name: 'Night bleed', photos: 1, roles: ['cover', 'hook'],
      render: (s, ctx) => frame(photo(s, 0, 'inset:0') + fade(720) +
        '<div data-text-zone style="position:absolute;left:90px;right:90px;bottom:90px;display:flex;flex-direction:column;gap:22px">' +
        logo(126, 50, ctx) + '<div style="height:8px"></div>' + label(s.label, s) + head(s.text, 64, s) + '</div>') },
    F1: { name: 'Full photo, words low', photos: 1, roles: ['inner', 'cover'],
      render: (s, ctx) => frame(photo(s, 0, 'inset:0') + fade(560) +
        '<div data-text-zone style="position:absolute;left:90px;right:90px;bottom:90px;display:flex;flex-direction:column;gap:18px">' +
        (ctx.cover ? logo(126, 50, ctx) : '') + head(s.text, 52, s) + (s.credit ? credit(s.credit, s) : label(s.label, s)) + '</div>') },
    H1: { name: 'Photo beside words', photos: 1, roles: ['inner'],
      render: (s) => frame(photo(s, 0, 'left:0;top:0;width:520px;height:1350px') +
        '<div data-text-zone style="position:absolute;left:520px;top:0;right:0;bottom:0;padding:90px 80px 80px 64px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;gap:36px">' +
        head(s.text, 52, s) + (s.credit ? credit(s.credit, s) : '') + label(s.label, s) + '</div>') },
    H4: { name: 'Plate', photos: 1, roles: ['inner'],
      render: (s) => frame(photo(s, 0, 'left:56px;top:56px;width:968px;height:960px') +
        '<div data-text-zone style="position:absolute;left:80px;right:80px;top:1060px;bottom:60px;display:flex;flex-direction:column;justify-content:center;gap:18px">' +
        (s.text ? head(s.text, 54, s) : '') + (s.credit ? credit(s.credit, s) : label(s.label, s)) + '</div>') },
    H9: { name: 'Photo with a box', photos: 1, roles: ['inner', 'close'],
      render: (s, ctx) => frame(photo(s, 0, 'inset:0') +
        '<div data-text-zone style="position:absolute;left:160px;right:160px;bottom:90px;background:' + C.box + ';padding:52px 56px 48px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;text-align:center;gap:28px">' +
        head(s.text, 52, s) + (s.credit ? credit(s.credit, s) : '') + (ctx.cover || ctx.close ? logo(101, 40, ctx) : label(s.label, s)) + '</div>') },
    N9: { name: 'Two photos', photos: 2, roles: ['inner'],
      render: (s) => frame(photo(s, 0, 'left:0;top:0;width:536px;height:1010px') + photo(s, 1, 'left:544px;top:0;width:536px;height:1010px') +
        '<div data-text-zone style="position:absolute;left:90px;right:90px;top:1010px;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:14px">' +
        head(s.text, 50, s) + (s.credit ? credit(s.credit, s) : label(s.label, s)) + '</div>') },
    M12: { name: 'Words only', photos: 0, roles: ['inner'],
      render: (s) => frame('<div data-text-zone style="position:absolute;inset:0;padding:90px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:36px;text-align:center">' +
        label(s.label, s) + head(s.text, 64, s) + '<div style="width:120px;border-top:1px solid ' + C.line + '"></div>' + credit(s.credit, s) + '</div>') },
    H10: { name: 'Full story link', photos: 1, roles: ['close'],
      render: (s, ctx) => { const c = closeParts(s.text); return frame(photo(s, 0, 'inset:0') +
        '<div data-text-zone style="position:absolute;left:72px;right:72px;bottom:72px;background:' + C.box + ';padding:56px 60px 52px;box-sizing:border-box;display:flex;flex-direction:column;gap:22px">' +
        '<div style="font-family:Caudex,Georgia,serif;font-size:30px;letter-spacing:.16em;color:' + C.gold + '">THE FULL STORY</div>' + head(c.title, 68, s) +
        '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ' + C.line + ';padding-top:26px">' +
        '<div style="font-family:Caudex,Georgia,serif;font-size:31px">' + e(ctx.link || c.link) + ' <span style="color:' + C.sup + '">· link in bio</span></div>' + logo(106, 42, ctx) + '</div></div>'); } },
  };
  Object.assign(T, originalCatalog);
  // Which kind of slide a role is, for picking sensible layouts.
  const kindOf = role => /^(cover|hook)$/i.test(role) ? 'cover' : /^close$/i.test(role) ? 'close' : 'inner';
  function render(id, s, ctx) { const t = T[id] || T.M12, k = kindOf(s.role);
    const html = t.render(s, Object.assign({ logo: '/ig-assets/teajia-wordmark.png' }, ctx, { cover: k === 'cover', close: k === 'close' })); return s.pillar ? html.slice(0,-6) + pillarSeal(s.pillar) + '</div>' : html; }
  // Layouts that suit this slide, best first: its own kind first, and ones that fit its photo count.
  function options(s) { const k = kindOf(s.role), n = (s.photos || []).filter(p => p && p.src).length;
    return Object.keys(T).filter(id => T[id].roles.includes(k) || (k !== 'inner' && T[id].roles.includes('inner') && T[id].photos > 0))
      .sort((a, b) => (T[b].roles[0] === k) - (T[a].roles[0] === k) || Math.abs(T[a].photos - n) - Math.abs(T[b].photos - n)); }
  return { T, render, options, kindOf };
})();
export default IG;
