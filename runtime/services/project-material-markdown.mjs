// A small owned format for authored intake. Metadata remains a YAML header;
// the human's note body is the actual Markdown content, not a JSON mirror.
export function materialMarkdown(record) {
  const fields = ['---', 'ar_create_material: 1', `kind: ${record.kind}`, `title: ${JSON.stringify(record.name)}`];
  if (record.kind === 'url') {
    fields.push(`source_url: ${JSON.stringify(record.url)}`, `linked_image: ${record.linkedImage === true}`);
  } else if (record.sourceUrl) fields.push(`source_url: ${JSON.stringify(record.sourceUrl)}`);
  fields.push('---', '');
  const body = record.kind === 'note' ? record.text : `<${record.url}>\n`;
  return fields.join('\n') + '\n' + body;
}

export function readMaterialMarkdown(raw) {
  const text = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(raw);
  const header = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!header || !/^ar_create_material: 1\r?$/m.test(header)) return null;
  const field = key => header.split(/\r?\n/).filter(line => line.startsWith(key + ': '));
  const one = key => {const values=field(key); if(values.length!==1)throw Error('Invalid material header.'); return values[0].slice(key.length+2);};
  const kind=one('kind'); if(!['url','note'].includes(kind))throw Error('Invalid material kind.');
  const title=JSON.parse(one('title')); if(typeof title!=='string')throw Error('Invalid material title.');
  const sources=field('source_url'); if(sources.length>1)throw Error('Duplicate material URL.');
  const url=sources.length ? JSON.parse(sources[0].slice('source_url: '.length)) : '';
  if(url){const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Invalid material URL.');}
  if(kind==='url'&&!url)throw Error('URL material has no URL.');
  const linked=kind==='url'?one('linked_image'): 'false'; if(!['true','false'].includes(linked))throw Error('Invalid image-link flag.');
  return {kind,availability:kind==='url'?'linked':'local',title,url,linkedImage:linked==='true'};
}
