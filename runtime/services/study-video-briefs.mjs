import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {provenance} from './actor.mjs';
import {atomicWrite, digest, ensurePrivateDirectory, readJson, resolveInside, safeRel, regular} from './files.mjs';

const PARENTS = Object.freeze({hk: 'hk', ancha: 'ref-an-cha', collector: 'ref-collector'});
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const ADD_FIELDS = ['operationId', 'title', 'findingId', 'sourcePath', 'sourceHash', 'from', 'to', 'quote'];
const CONTEXT_LENGTH = 360;
const fail = (message, status = 409) => { throw new StateError(message, status); };

function scope(input, fields = []) {
  const allowed = ['projectKey', 'parentStudyId', ...fields];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
    Object.keys(input).length !== allowed.length || allowed.some(key => !Object.hasOwn(input, key))) {
    fail('Choose one exact Video Editing brief scope.', 400);
  }
  if (!Object.hasOwn(PARENTS, input.projectKey)) fail('This project has no original source catalog for Video Editing.', 404);
  if (PARENTS[input.projectKey] !== input.parentStudyId) fail('This brief belongs to a different subject.');
}

function identity(id) {
  if (typeof id !== 'string' || !UUID.test(id)) fail('Choose one exact Video Editing brief ID.', 400);
  return id;
}

function briefFields({operationId, title, findingId, sourcePath, sourceHash, from, to, quote}) {
  const id = identity(operationId);
  if (typeof title !== 'string' || !title.trim() || title.length > 256 || /[\u0000-\u001f\u007f]/.test(title) ||
    typeof findingId !== 'string' || !findingId.trim() || findingId.length > 256 || /[\u0000-\u001f\u007f]/.test(findingId)) {
    fail('Choose one named Research finding for this brief.', 400);
  }
  safeRel(sourcePath, false);
  if (typeof sourceHash !== 'string' || !HASH.test(sourceHash) ||
    !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from ||
    typeof quote !== 'string' || !quote.trim() || quote.length > 8192 || /[\u0000\p{Surrogate}]/u.test(quote) ||
    to - from !== quote.length) {
    fail('Choose an exact passage from the original source.', 400);
  }
  return {id, title: title.trim(), findingId, sourcePath, sourceHash, from, to, quote};
}

function readBrief(file, id, projectKey) {
  const record = readJson(file, null);
  return briefIn(record,id,projectKey);
}

function briefIn(record,id,projectKey) {
  if (record && (record.schema !== 'ar-create.study-video-brief.v1' || record.projectKey !== projectKey || record.brief?.id !== id)) {
    fail('Saved Video Editing brief identity changed. Existing data was preserved.');
  }
  return record?.brief ?? null;
}

export function createStudyVideoBriefs({dataDir, originals, findings, inquiries} = {}) {
  if (!dataDir || !originals?.list) throw new TypeError('Private data and the original source catalog are required.');

  function directory(projectKey, create = false) {
    const relative = 'study-video-briefs/' + projectKey;
    if (create) return ensurePrivateDirectory(dataDir, relative);
    try {
      return resolveInside(dataDir, relative, {directory: true});
    } catch (error) {
      if (error.status !== 404) throw error;
      return null;
    }
  }

  async function original(projectKey, brief) {
    const listed = await originals.list(projectKey);
    const matches = listed?.projectKey === projectKey && Array.isArray(listed.records)
      ? listed.records.filter(record => record.path === brief.sourcePath)
      : [];
    if (matches.length !== 1) fail('The original source is unavailable or its identity is ambiguous.');
    const [record] = matches;
    if (record.role !== 'source' || record.missing || typeof record.raw !== 'string' ||
      record.hash !== brief.sourceHash || digest(record.raw) !== brief.sourceHash ||
      record.raw.slice(brief.from, brief.to) !== brief.quote) {
      fail('The original source or passage changed. Open Research and select it again.');
    }
    return record;
  }

  async function list(input) {
    scope(input);
    const room = directory(input.projectKey);
    if (!room) return {briefs: []};
    const briefs = [];
    for (const name of fs.readdirSync(room)) {
      if (!name.endsWith('.json') || !UUID.test(name.slice(0, -5))) continue;
      const brief = readBrief(path.join(room, name), name.slice(0, -5), input.projectKey);
      if (brief) briefs.push(brief);
    }
    briefs.sort((a, b) => b.provenance.at.localeCompare(a.provenance.at) || a.id.localeCompare(b.id));
    return {briefs};
  }

  async function add(input) {
    const hasInquiry=Object.hasOwn(input??{},'collectionId');
    scope(input, [...ADD_FIELDS,...hasInquiry?['collectionId']:[]]);
    const fields = briefFields(input);
    if(hasInquiry&&(typeof input.collectionId!=='string'||!UUID.test(input.collectionId)))fail('Choose one exact saved inquiry.',400);
    const collectionId=hasInquiry?input.collectionId:null;
    function replay(prior) {
      if (Object.entries(fields).some(([key, value]) =>
        (key==='findingId'?(prior.findingLink?.createdFindingId??prior.findingId):prior[key])!==value) ||
        (prior.inquiryOrigin?.collectionId??null)!==collectionId) {
        fail('This operation already saved a different Video Editing brief.');
      }
      return {brief: prior};
    }

    const existing = directory(input.projectKey);
    const prior = existing && readBrief(path.join(existing, fields.id + '.json'), fields.id, input.projectKey);
    if (prior) return replay(prior);

    await original(input.projectKey, fields);
    if(hasInquiry){
      if(!inquiries?.read)fail('Saved inquiry linking is unavailable.',503);
      const inquiry=await inquiries.read({collectionId});
      if(inquiry?.collection?.id!==collectionId||inquiry.record?.scope?.collectionId!==collectionId)fail('The saved inquiry changed identity. Refresh before saving.');
      // An independent inquiry is linked, never copied or editorially adopted.
      // Recheck the source after the awaited owner read before publishing one brief.
      await original(input.projectKey,fields);
    }
    const file = path.join(directory(input.projectKey, true), fields.id + '.json');
    const brief = {...fields,...hasInquiry?{collectionId,inquiryOrigin:{collectionId}}:{},status: 'proposed', provenance: provenance()};
    try {
      atomicWrite(file, JSON.stringify({schema: 'ar-create.study-video-brief.v1', projectKey: input.projectKey, brief}, null, 2) + '\n', {exclusive: true});
    } catch (error) {
      if (error.code !== 'EEXIST' && error.status !== 409) throw error;
      const winner = readBrief(file, fields.id, input.projectKey);
      if (!winner) throw error;
      return replay(winner);
    }
    return {brief};
  }

  async function resolve(input) {
    scope(input, ['id']);
    const id = identity(input.id);
    const room = directory(input.projectKey);
    const brief = room && readBrief(path.join(room, id + '.json'), id, input.projectKey);
    if (!brief) fail('This Video Editing brief could not be found.', 404);
    const record = await original(input.projectKey, brief);
    const before = record.raw.slice(Math.max(0, brief.from - CONTEXT_LENGTH), brief.from).replace(/^\p{Surrogate}/u, '');
    const after = record.raw.slice(brief.to, brief.to + CONTEXT_LENGTH).replace(/\p{Surrogate}$/u, '');
    const line = record.raw.slice(0, brief.from).split(/\r\n|\r|\n/).length;
    return {
      brief,
      source: {title: record.name || record.path, path: record.path, hash: record.hash, before, quote: brief.quote, after, line},
    };
  }

  let pending=Promise.resolve();
  function relink(input) {
    const task=pending.then(async()=>{
      scope(input,['id','operationId','expectedFindingId','findingId']);
      const id=identity(input.id);identity(input.operationId);
      for(const key of ['expectedFindingId','findingId']){
        if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>256||/[\u0000-\u001f\u007f]/.test(input[key]))fail('Choose one exact Research finding.',400);
      }
      if(!findings?.read)fail('Research finding linking is unavailable.',503);
      const room=directory(input.projectKey);
      if(!room)fail('This Video Editing brief could not be found.',404);
      const file=path.join(room,id+'.json');
      if(!fs.existsSync(file))fail('This Video Editing brief could not be found.',404);
      regular(file);
      const bytes=fs.readFileSync(file),envelope=JSON.parse(bytes.toString('utf8'));
      const prior=briefIn(envelope,id,input.projectKey);
      if(!prior)fail('This Video Editing brief could not be found.',404);
      const expectedHash=digest(bytes);
      const requestHash=digest(JSON.stringify([input.projectKey,input.parentStudyId,id,input.expectedFindingId,input.findingId]));
      const operations=prior.findingLink?.operations|| (prior.findingLink?[{operationId:prior.findingLink.operationId,requestHash:prior.findingLink.requestHash}]:[]);
      const committed=operations.find(operation=>operation.operationId===input.operationId);
      if(committed){
        if(committed.requestHash!==requestHash)fail('This operation already linked a different finding.');
        return {brief:prior};
      }
      if(prior.findingId!==input.expectedFindingId)fail('The brief finding changed. Refresh before linking.');
      await original(input.projectKey,prior);
      const available=await findings.read({projectKey:input.projectKey,parentStudyId:input.parentStudyId});
      const matches=available.available&&!available.stale?available.points.filter(point=>point.id===input.findingId):[];
      if(matches.length!==1)fail('Choose one current saved Research finding.');
      const [point]=matches;
      if(!point.spoken?.some(span=>span.sourcePath===prior.sourcePath&&span.sourceHash===prior.sourceHash&&span.sourceRange?.from===prior.from&&span.sourceRange?.to===prior.to&&span.quote===prior.quote))fail('The finding does not match this brief\'s exact source anchor.');
      const author=provenance();
      const brief={...prior,findingId:input.findingId,findingLink:{operationId:input.operationId,requestHash,createdFindingId:prior.findingLink?.createdFindingId||prior.findingId,previousFindingId:prior.findingId,provenance:author,operations:[...operations,{operationId:input.operationId,requestHash,from:prior.findingId,to:input.findingId,provenance:author}]}};
      atomicWrite(file,JSON.stringify({...envelope,brief},null,2)+'\n',{expectedHash});
      return {brief};
    });
    pending=task.catch(()=>{});return task;
  }
  function linkInquiry(input) {
    const task=pending.then(async()=>{
      scope(input,['id','operationId','expectedCollectionId','collectionId']);
      const id=identity(input.id);identity(input.operationId);
      for(const key of ['expectedCollectionId','collectionId']){
        if(input[key]!==null&&(typeof input[key]!=='string'||!UUID.test(input[key])))fail('Choose one exact saved inquiry or no inquiry.',400);
      }
      if(!inquiries?.read)fail('Saved inquiry linking is unavailable.',503);
      const room=directory(input.projectKey);
      if(!room)fail('This Video Editing brief could not be found.',404);
      const file=path.join(room,id+'.json');
      if(!fs.existsSync(file))fail('This Video Editing brief could not be found.',404);
      regular(file);
      const bytes=fs.readFileSync(file),envelope=JSON.parse(bytes.toString('utf8'));
      const prior=briefIn(envelope,id,input.projectKey);
      if(!prior)fail('This Video Editing brief could not be found.',404);
      const expectedHash=digest(bytes);
      const requestHash=digest(JSON.stringify([input.projectKey,input.parentStudyId,id,input.expectedCollectionId,input.collectionId]));
      const operations=prior.inquiryLink?.operations||[];
      const committed=operations.find(operation=>operation.operationId===input.operationId);
      if(committed){
        if(committed.requestHash!==requestHash)fail('This operation already linked a different inquiry.');
        return {brief:prior};
      }
      if((prior.collectionId??null)!==input.expectedCollectionId)fail('The brief inquiry changed. Refresh before linking.');
      await original(input.projectKey,prior);
      if(input.collectionId!==null){
        const inquiry=await inquiries.read({collectionId:input.collectionId});
        if(inquiry?.collection?.id!==input.collectionId||inquiry.record?.scope?.collectionId!==input.collectionId)fail('The saved inquiry changed identity. Refresh before linking.');
        // The inquiry is an independent learning record. Linking it neither copies
        // its words nor creates a Project association or editorial inheritance.
        await original(input.projectKey,prior);
      }
      const author=provenance();
      const operation={operationId:input.operationId,requestHash,from:prior.collectionId??null,to:input.collectionId,provenance:author};
      const brief={...prior,collectionId:input.collectionId,inquiryLink:{operations:[...operations,operation]}};
      atomicWrite(file,JSON.stringify({...envelope,brief},null,2)+'\n',{expectedHash});
      return {brief};
    });
    pending=task.catch(()=>{});return task;
  }
  return {list, add, resolve, relink, linkInquiry};
}
