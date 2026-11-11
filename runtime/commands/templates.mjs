// Templates' commands for the one registry (runtime/commands.mjs). The app, the CLI (`template list|read|propose|decide|retire`)
// and MCP all reach them through these routes. Saving a slide as a template is instagram.template (it reads the plan);
// an assistant's save or markup is a proposal, and only Adrian accepts it, turns it down or retires a template.
// Placed things on a slide are set with instagram.placed; a look's marks and graphics are look.assets and look.asset.add.
export const TEMPLATES_COMMANDS = Object.freeze([
  ['GET', '/api/templates', ['status? (kept|proposed|turned-down|retired|all; default kept)', 'look?']],
  ['GET', '/api/template', ['id']],
  ['POST', '/api/template/propose'],
  ['POST', '/api/template/decide'],
  ['POST', '/api/template/retire'],
  ['GET', '/api/look/assets', ['id']],
  ['POST', '/api/look/asset/add'],
  ['POST', '/api/instagram/template'],
  ['POST', '/api/instagram/placed'],
]);
/** Decisions only Adrian makes. */
export const TEMPLATES_HUMAN_ONLY = Object.freeze(['POST /api/template/decide', 'POST /api/template/retire']);
/** Body fields agents most need, shown in /api/capabilities. */
export const TEMPLATES_BODY = Object.freeze({
  '/api/template/propose': ['operationId', 'name (plain, up to 80)', 'row (a row letter, such as C or M)', 'kind? (cover|inner|single|close; default the row\'s)', 'markup (one <div> 1080 by 1350; slots __IG_PHOTO_n__, __IG_TEXT_n__, __IG_LABEL__, __IG_CREDIT__, __IG_LOGO__; colours as {dark.headline} and the like; checked by allowlist)', 'looks? ("all", or look ids; default all)'],
  '/api/template/decide': ['operationId', 'id', 'decision (accept|turn-down)', 'expectedRevision', 'expectedHash'],
  '/api/template/retire': ['operationId', 'id', 'expectedRevision', 'expectedHash'],
  '/api/look/asset/add': ['id (the look)', 'operationId', 'expectedRevision', 'expectedHash', 'asset:{id, name, kind (logo|mark|graphic), file (name.png or name.svg), base64} or {id, name, kind: mark, text (one to four characters)}'],
  '/api/instagram/template': ['id (the plan)', 'operationId', 'format', 'slide (1 for the first)', 'name', 'looks? ("all", or look ids; default the plan\'s look)'],
  '/api/instagram/placed': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'format', 'slide (1 for the first)', 'placed:[{kind (logo|mark|graphic|picture|label|rule), asset? (the look\'s asset id; a plan photo for a picture), text? (label), x, y, width, height?, z?, tone? (dark|light), color? (a role), size? (label)}]'],
});
