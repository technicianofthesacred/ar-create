// The step guide (runtime/agent-guide.mjs): what Adrian gives and what an agent does at each step of a story, with the
// commands in order. Read-only, so any actor may call it; with parentStudyId it lays that story's standing over the
// guide (each step's state now, and the next step). The CLI (`guide [story]`) and MCP (`ar_create_guide`) reach it too.
export const AGENT_GUIDE_COMMANDS = Object.freeze([
  ['GET', '/api/agent/guide', ['parentStudyId?']],
]);
