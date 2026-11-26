# Claude Duet and AR Create

Researched 26 November 2026 from Anthropic's own pages and launch coverage. Recheck the official pages before relying on a detail: Duet is in research preview and changes.

## What Duet is

Claude Duet is Anthropic's always-on work agent, opened as a research preview on 21 October 2026. It is a standalone app (iPhone and iPad; Anthropic's pages also name Android and claude.ai) that checks your connected accounts every few hours, sends a morning brief, keeps a task list, and does work on its own computer in the cloud (a virtual machine with its own browser). It runs on Claude Opus 5.5.

- **Organisation:** one main thread, plus separate channels for different topics that share the same memory. A Tasks tab shows what it is working on; each task has a page where you can steer it.
- **Memory:** it carries over your Claude account's memory, skills and connected apps, and keeps its own history until you delete or reset it. Disconnecting an app keeps what Duet already learned from it until memory is reset.
- **Reach:** it uses the apps you have connected in Claude (the connector directory, plus custom connectors). Anthropic's page says it cannot see the files on your computer.
- **Asks first:** before it sends a message, pays, signs or deletes anything, it shows the action, the destination and the content, and waits. Some things are off-limits even with approval (trading securities, moving money between accounts, using someone else's account).
- **Limits:** it shares your plan's usage limits, background work included. Waitlist only, Pro, Max and Ultra, US first (one product page also lists India, Indonesia, Brazil and Japan).

Official pages: [Get started with Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet), [product page](https://claude.com/product/claude-duet), [announcement](https://claude.com/resources/articles/claude-duet), [safety, privacy and security](https://claude.com/resources/articles/claude-duet-safety-privacy-and-security), [connectors using remote MCP](https://support.claude.com/en/articles/11176164-pre-built-web-connectors-using-remote-mcp). Coverage: [TechCrunch, 22 October 2026](https://techcrunch.com/2026/10/22/claude-duet-app-is-anthropics-bet-on-agents/), [HackerNoon](https://hackernoon.com/what-is-claude-duet-inside-anthropics-always-on-ai-assistant). Not to be confused with `claude-duet`, a third-party command-line tool for sharing Claude Code sessions, or Decagon's "Duet".

## What it means for AR Create

- **Its name in the app is `agent:duet`.** Every write it makes is stamped as Duet's, and Adrian's decisions (accept, Your yes, approve, publish) are refused to it like every other agent. An MCP client that reports a name containing "duet" is recognised as `agent:duet`.
- **It cannot reach the app on the Mac directly.** Duet works from Anthropic's cloud, and custom connectors are reached from Anthropic's cloud over the public internet, not from the Mac. The local connections (the CLI, the MCP server started by the Claude desktop app) serve agents that run on the Mac or in a session linked to it; Duet is neither.
- **The way in is the remote connector.** `agents/remote/server.mjs` with an approved HTTPS address ([REMOTE-CONNECTIONS](../REMOTE-CONNECTIONS.md)) is the route a cloud agent uses. It is built and tested on invented data but not switched on: a public address, its access rules and which records it may carry are Adrian's decision. A connector added in Claude is shared by Claude's chats and Duet (Duet uses "the apps you've connected in Claude", and both sign in through the same claude.ai callback), so through that connector Duet arrives as the Claude principal, `agent:claude-code`; the app cannot tell the two apart there. `agent:duet` is for an entrance that knows it is Duet, such as an MCP client that reports Duet's name.
- **Once connected, it follows the same step guide** ([AGENT-STEPS](../AGENT-STEPS.md)): `ar_create_guide` first, then the commands each step names. Duet's own approval prompts sit on top of the app's: the app still refuses Adrian's decisions to Duet whatever Duet's own settings allow.
