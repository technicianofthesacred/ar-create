import {StateError} from '../store.mjs';
import {guideFor} from '../agent-guide.mjs';

/** GET /api/agent/guide[?parentStudyId=…]. Read-only, any actor. Without a story: the whole guide. With one: its steps now. */
export async function handleAgentGuide(request, response, standing) {
 const url = new URL(request.url || '/', 'http://local.invalid');
 if (url.pathname !== '/api/agent/guide') return false;
 const send = (status, body) => {response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); response.end(JSON.stringify(body));};
 try {
  if (request.method !== 'GET') {response.setHeader('Allow', 'GET'); throw new StateError('Use GET.', 405);}
  const keys = [...url.searchParams.keys()];
  if (keys.some(k => k !== 'parentStudyId') || url.searchParams.getAll('parentStudyId').length > 1) throw new StateError('The guide takes one optional field: parentStudyId (a story or subject id).', 400);
  const id = url.searchParams.get('parentStudyId');
  if (!id) return send(200, guideFor()), true;
  if (!standing) throw new StateError('Where a story stands needs the study drafts, which this home does not have.', 503);
  send(200, guideFor(await standing.one({parentStudyId: id})));
 } catch (error) {send(Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500, {error: error.status ? error.message : 'The guide could not be read.'});}
 return true;
}
