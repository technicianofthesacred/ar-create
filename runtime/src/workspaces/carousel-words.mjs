// One shared wording receipt for review, provider capture and visual revisions.
// Layout, photos and typography do not change the approved verbal sequence.
export function carouselWordsRecord(output) {
 return {slides:(output.slides||[]).map(slide=>({id:slide.id,role:slide.role,text:slide.text,credit:slide.credit,label:slide.label??''})),caption:output.caption??''};
}
export async function carouselWordsHash(output) {
 const bytes=new TextEncoder().encode(JSON.stringify(carouselWordsRecord(output)));
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
}
