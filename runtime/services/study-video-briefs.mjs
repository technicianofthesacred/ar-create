import fs from 'node:fs';
import path from 'node:path';
import {StateError} from '../store.mjs';
import {provenance} from './actor.mjs';
import {atomicWrite, digest, ensurePrivateDirectory, readJson, resolveInside, safeRel} from './files.mjs';

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
  if (record && (record.schema !== 'ar-create.study-video-brief.v1' || record.projectKey !== projectKey || record.brief?.id !== id)) {
    fail('Saved Video Editing brief identity changed. Existing data was preserved.');
  }
  return record?.brief ?? null;
}

export function createStudyVideoBriefs({dataDir, originals} = {}) {
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
    scope(input, ADD_FIELDS);
    const fields = briefFields(input);
    function replay(prior) {
      if (Object.entries(fields).some(([key, value]) => prior[key] !== value)) {
        fail('This operation already saved a different Video Editing brief.');
      }
      return {brief: prior};
    }

    const existing = directory(input.projectKey);
    const prior = existing && readBrief(path.join(existing, fields.id + '.json'), fields.id, input.projectKey);
    if (prior) return replay(prior);

    await original(input.projectKey, fields);
    const file = path.join(directory(input.projectKey, true), fields.id + '.json');
    const brief = {...fields, status: 'proposed', provenance: provenance()};
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

  return {list, add, resolve};
}
