// Accounts' commands for the one registry (runtime/commands.mjs). The app, the CLI (`account list|read|save`) and MCP all
// reach them through these routes. An account is a label and a destination: nothing here posts, fetches or holds a
// credential. Owner and assistants may both save one (it is filing, not publishing). Setting a plan's account is
// instagram.account, a proposal guarded like instagram.layout.
export const ACCOUNTS_COMMANDS = Object.freeze([
  ['GET', '/api/accounts', ['look?']],
  ['GET', '/api/account', ['id']],
  ['POST', '/api/account/save'],
  ['POST', '/api/instagram/account'],
]);
/** Body fields agents most need, shown in /api/capabilities. */
export const ACCOUNTS_BODY = Object.freeze({
  '/api/account/save': ['id? (lower-case letters, digits and dashes; default: from the name)', 'operationId', 'name', 'service? (default instagram)', 'handle? (may be empty)', 'link? (plain text, may be empty; never opened or fetched)', 'looks (the look ids that post here)', 'expectedRevision? and expectedHash? (needed when the account exists, shipped or home)'],
  '/api/instagram/account': ['id', 'operationId', 'expectedRevision', 'expectedHash', 'account (an account id such as mandala-codes that lists the plan\'s look, or null to use the first account that lists it)'],
});
