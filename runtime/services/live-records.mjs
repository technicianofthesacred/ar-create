// Presentation-only classification. Originals and saved identities remain addressable.
const UUID='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
const connectionDemo=new RegExp('^connection-demo-'+UUID+'$','i');
const oracleFixture=new RegExp('^Synthetic Oracle test '+UUID+'$','i');
const syntheticAudio=new RegExp('^oracle-synthetic-'+UUID+'\\.(?:wav|m4a)$','i');
const jobPath=new RegExp('(?:^|/)Transcription/'+UUID+'/');
const explicitFixture=record=>record?.fixture===true||record?.syntheticFixture===true||record?.provenance?.fixture===true||['fixture','synthetic-test','demo-fixture'].includes(record?.provenance?.kind);
export function isFixtureRecord(record){
 if(!record||typeof record!=='object')return false;
 if(explicitFixture(record))return true;
 const identity=record.parentStudyId||record.parentStudyKey||record.id,title=record.title||record.name||'';
 // These are the exact legacy test namespaces, never general title keywords.
 return connectionDemo.test(identity||'')&&/^Connection demo(?: \u2014 .+)?$/.test(title)||oracleFixture.test(title);
}
export function isLiveLibrarySource(source){
 if(!source||isFixtureRecord(source))return false;
 const relative=String(source.rel_path||source.relativePath||''),parts=relative.split('/'),base=parts.at(-1);
 if(source.rootId==='recordings'&&jobPath.test(relative))return false;
 if(!['library','recordings'].includes(source.rootId))return true;
 if(parts[0]==='synthetic-qa-narration'||parts.some(part=>oracleFixture.test(part)))return false;
 if(base==='synthetic-qa-narration.wav'||syntheticAudio.test(base||''))return false;
 if(base==='ar-material-intake-check.md'&&(source.title==='Synthetic intake check'||source.name==='Synthetic intake check'))return false;
 if(source.rootId==='recordings'&&relative==='vault/Workflow/0-Inbox/RAW - synthetic-qa-narration.md')return false;
 if(source.rootId==='recordings'&&relative.startsWith('vault/Workflow/0-Inbox/RAW - ')&&oracleFixture.test(base.slice(6,-3)))return false;
 return true;
}
