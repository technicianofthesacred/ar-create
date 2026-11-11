// Looks' commands for the one registry (runtime/commands.mjs). The app, the CLI (`look list|read|save|import`) and MCP
// all reach them through these routes. Owner and assistants may both save a look (with the revision they read); the
// import only proposes, and saves nothing. Setting a plan's look is instagram.look, a proposal like instagram.layout.
export const LOOKS_COMMANDS = Object.freeze([
  ['GET', '/api/looks'],
  ['GET', '/api/look', ['id']],
  ['GET', '/api/look/asset', ['id', 'file']],
  ['POST', '/api/look/save'],
  ['POST', '/api/look/import'],
  ['POST', '/api/instagram/look'],
]);
/** POST routes here that only read. */
export const LOOKS_READ_ONLY = Object.freeze(['POST /api/look/import']);
/** Body fields agents most need, shown in /api/capabilities. */
export const LOOKS_BODY = Object.freeze({
  '/api/look/save': ['id (lower-case letters, digits and dashes)', 'operationId', 'text (the whole DESIGN.md, with its slides: block)', 'assets?:[{name (png|jpg|webp), base64}]', 'expectedRevision? and expectedHash? (needed when the look exists, shipped or home)'],
  '/api/look/import': ['text? (a DESIGN.md) or path? (a DESIGN.md inside AR Create\'s home folder; never a web address)', 'id? (default: from its name)'],
  '/api/instagram/look': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'look (a look id such as art, or null for the door\'s look)'],
});
