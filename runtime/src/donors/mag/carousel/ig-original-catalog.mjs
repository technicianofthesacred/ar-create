// Authored Instagram canvases captured from the read-only Teajia artifact.
// Geometry and decorative styling are stored in ig-original-layouts.json.
// Only local Library photos, export-owned raster data, and a local wordmark may enter rendered markup.
import layouts from './ig-original-layouts.json' with { type: 'json' };

const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const localImage = value => {
  const url = String(value ?? '');
  const comma=url.indexOf(',');
  if(comma>0 && /^data:image\/(?:jpeg|png|webp);base64,$/i.test(url.slice(0,comma+1))){
    const bytes=url.slice(comma+1);
    return bytes.length%4===0 && /^[A-Za-z0-9+/]+={0,2}$/.test(bytes) ? url : '';
  }
  return /^\/(?!\/)(?!_blob\/)(?!appifact\/)[^\s<>"'`\\()]+$/.test(url) ? url : '';
};
const focus = value => Number.isFinite(Number(value)) ? Math.max(0,Math.min(100,Number(value))) : 50;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const imageStyle = (geometry, photo) => {
  if (!geometry) return 'width:100%;height:100%;object-fit:cover;display:block';
  const {style,boxWidth,boxHeight,imageWidth,imageHeight,left,top}=geometry;
  const xoverflow=Math.max(0,imageWidth-boxWidth), yoverflow=Math.max(0,imageHeight-boxHeight);
  const lx=xoverflow?clamp(left+(50-focus(photo?.x))/100*xoverflow,-xoverflow,0):left;
  const ty=yoverflow?clamp(top+(50-focus(photo?.y))/100*yoverflow,-yoverflow,0):top;
  return style.replace(/(^|;)\s*left:\s*-?[\d.]+px/,'$1 left:'+Number(lx.toFixed(3))+'px')
    .replace(/(^|;)\s*top:\s*-?[\d.]+px/,'$1 top:'+Number(ty.toFixed(3))+'px')
    +';object-fit:cover;object-position:50% 50%';
};

export function renderOriginal(id, slide={}, ctx={}) {
  const layout=layouts[id];
  if (!layout) throw new Error('Unknown original Instagram layout '+id);
  const parts=String(slide.text ?? '').split(/\n\s*\n/);
  // The last authored prose block receives any extra paragraphs, so no text is lost.
  const part=index=>index===layout.textParts-1 ? parts.slice(index).join('\n\n') : parts[index]||'';
  const photos=Array.isArray(slide.photos)?slide.photos:[];
  const logo=localImage(ctx.logo)||'/ig-assets/teajia-wordmark.png';
  return layout.html.replace(/<img\b[^>]*src="__IG_PHOTO_(\d+)__"[^>]*>|__IG_BG_(\d+)__|__IG_TEXT_(\d+)__|__IG_LABEL__|__IG_CREDIT__|__IG_LOGO__/g,(token,imgIndex,bgIndex,textIndex)=>{
    if (imgIndex!==undefined) {
      const n=Number(imgIndex),url=localImage(photos[n]?.src);
      if (!url) return '<div aria-label="Photo needed" style="position:absolute;inset:0;background:#241f1a;color:#8d806b;font:34px Caudex,Georgia,serif;display:flex;align-items:center;justify-content:center">photo needed</div>';
      return '<img src="'+escapeHtml(url)+'" alt="" draggable="false" style="'+escapeHtml(imageStyle(layout.photoStyles[n],photos[n]))+'">';
    }
    if (bgIndex!==undefined) {
      const url=localImage(photos[Number(bgIndex)]?.src);
      return url?'url(&quot;'+escapeHtml(url)+'&quot;)':'none';
    }
    if (textIndex!==undefined) return escapeHtml(part(Number(textIndex)));
    if (token==='__IG_LABEL__') return escapeHtml(slide.label);
    if (token==='__IG_CREDIT__') return escapeHtml(slide.credit);
    return escapeHtml(logo);
  });
}

// Object values match the existing IG.T shape. The parent module can merge with
// Object.assign(IG.T, originalCatalog) and keep legacy IDs untouched.
export const originalCatalog=Object.fromEntries(Object.entries(layouts).map(([id,entry])=>[id,{
  name:entry.name,
  group:entry.group,
  photos:entry.photos,
  roles:entry.roles,
  sourceFile:entry.sourceFile,
  originalId:entry.originalId,
  textParts:entry.textParts,
  render:(slide,ctx)=>renderOriginal(id,slide,ctx),
}]));

export default originalCatalog;
