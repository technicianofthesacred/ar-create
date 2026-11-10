// Slides that exercise every branch of every Carousel layout, for the looks tests. Invented content only.
// The hashes in tests/fixtures/instagram-looks-teajia-today.json were taken from these slides before looks existed,
// so the teajia look can be held to what was drawn then, byte for byte.
const photos = n => ['/x/one.jpg', '/api/sources/blob?id=invented-2', '/x/three.webp', '/x/four.png'].slice(0, n).map((src, i) => ({src, x: 20 + i * 15, y: 70 - i * 10}));
const full = {role: 'inner', text: 'Invented first part\n\nInvented second part\n\nA third part', label: 'Invented label', credit: 'Invented credit', photos: photos(4)};
const cover = {role: 'cover', text: 'A cover line · teajia.com/read', label: 'Cover label', credit: '', photos: photos(1), pillar: '家'};
export const VARIANTS = Object.freeze({
 full: [full, {index: 1, total: 4, start: 3}],
 cover: [cover, {index: 0, total: 4}],
 close: [{role: 'close', text: 'The full story · link in bio', label: '', credit: 'Invented maker', photos: []}, {index: 3, total: 4}],
 bare: [{role: 'inner', text: '', photos: [], typography: {font: 'sans', scale: 1.3}}, {}],
 story: [full, {format: 'story', index: 0, total: 2}],
 logo: [cover, {logo: '/x/own-logo.png'}],
 serif: [{...full, typography: {font: 'serif', scale: 0.8}, pillar: '佳'}, {}],
});
