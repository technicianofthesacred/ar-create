# Connect Claude and ChatGPT to AR Create

This source candidate provides a scoped connection for existing project text and native paragraph proposals. It has not been activated on a public endpoint or proven in either cloud account. Existing local CLI and STDIO connections remain available. W0 controls routing, accounts, integration and release; no private content transfer is authorized by these instructions.

## Supported client path, checked 6 November 2026

Claude cloud custom connectors support remote MCP with Streamable HTTP and OAuth. Actual plan/workspace permission must be checked in the intended account. Fixed request headers are a limited-organization beta, so they are not the common authentication path here. Private tunnels are separately gated. Claude needs a real HTTP 401 challenge and the exact resource URL; its callback is `https://claude.ai/api/mcp/auth_callback`. See [Claude connector authentication](https://claude.com/docs/connectors/building/authentication), [building connectors](https://claude.com/docs/connectors/building), and [custom connector availability](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

ChatGPT supports Streamable HTTP and OAuth through custom MCP plugins. Current help documents full write-tool support for Business/Enterprise/Edu on web, while Pro access is described as read/fetch; confirm the actual workspace entitlement before promising this write journey. The current Plugins flow adds a custom MCP server without assuming an old Developer Mode toggle. Custom API-key paste and machine-to-machine grants are not the path supported here. Copy the exact redirect shown in that plugin's setup: the documented unique form is `https://chatgpt.com/connector/oauth/{callback_id}`; issuer-aware setups can use `https://chatgpt.com/connector_platform_oauth_redirect`. Both families require an explicit exact local allowlist. See [ChatGPT account capabilities](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt), [custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server), and [plugin authentication](https://developers.openai.com/plugins/build/auth).

These are documented capabilities, not evidence about Adrian's accounts. [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) and [Claude MCP tunnels](https://claude.com/docs/connectors/mcp-tunnels/overview) have separate account and network prerequisites; no tunnel was configured by this change.

## Prepare one synthetic connection

Build/setup the approved immutable source using the normal repository instructions. Keep configuration, OAuth state and the synthetic owner home outside Git and outside the checkout. Use mode 0600 for configuration and 0700 for its directories. Never point the initial qualification at the installed private owner on 8841.

The following is a configuration template, not a usable public endpoint. Replace every placeholder using W0's activation record. Read exact synthetic project/output identities from the existing synthetic owner. No generated test project IDs are production defaults.

```json
{
  "schema": "ar-create.remote-config.v1",
  "ownerUrl": "http://127.0.0.1:8875",
  "resourceUrl": "https://W0-APPROVED-HOST/mcp",
  "issuerUrl": "https://W0-APPROVED-HOST",
  "stateDir": "/ABSOLUTE/EXTERNAL/PRIVATE/remote-state",
  "port": 8876,
  "redirectUris": ["https://claude.ai/api/mcp/auth_callback", "EXACT-CHATGPT-CALLBACK-FROM-SETUP"],
  "principals": [
    {
      "id": "claude-synthetic",
      "actor": "agent:claude-code",
      "provider": "claude",
      "client": "claude-cloud",
      "projectIds": ["EXACT-SYNTHETIC-PROJECT-ID"],
      "tools": ["ar_create_projects", "ar_create_current_work", "ar_create_validate_work", "ar_create_capture_contribution", "ar_create_save_preparation", "ar_create_prepare_proposal", "ar_create_proposal_context", "ar_create_stage_proposal", "ar_create_changes"],
      "expiresAt": "REPLACE-WITH-APPROVED-UTC-EXPIRY"
    }
  ]
}
```

For ChatGPT, add a separate principal with actor `agent:chatgpt`, provider `openai`, client `chatgpt-web` and its own ID and explicit grants. Use a short qualification window. For synthetic loopback-only SDK tests, resource/issuer can be matching `http://127.0.0.1:8876/mcp` and origin, with an exact loopback callback. Those addresses cannot be reached by a cloud connector.

Run `node agents/remote/server.mjs --config ABS_EXTERNAL_CONFIG`. It binds only loopback. An independently approved HTTPS proxy must route `/mcp`, `/oauth/*`, and the two OAuth metadata routes to it, preserve the external Host and Authorization header, enforce suitable network/request limits, and avoid logging credentials, authorization codes, ticket URLs or bodies. Do not route the local owner's API or change its host restrictions. No common server mount is required.

In the actual connector/plugin setup, enter the approved `/mcp` endpoint and choose OAuth. The browser displays a pending request. On the Mac, run:

```sh
node agents/remote/admin.mjs --config ABS_EXTERNAL_CONFIG requests
node agents/remote/admin.mjs --config ABS_EXTERNAL_CONFIG approve EXACT_TICKET EXACT_PRINCIPAL_ID
```

Review the exact callback, initiated connection, intended principal and configured scope before approval; client names are unverified. Return to the browser and select **Check approval**. There is no public approve endpoint. Do not paste bearer credentials into chat or configuration examples. If redirect delivery was lost, start a new connection request.

Revoke a principal locally with `node agents/remote/admin.mjs --config ABS_EXTERNAL_CONFIG revoke-principal EXACT_PRINCIPAL_ID`. Revocation survives restart. A later new grant uses a deliberately configured new principal ID; never erase revocation or delivery history to reconnect. Stop the listener and remove approved proxy routing to disable the endpoint. Preserve private auth/delivery state for reconciliation; it contains no manuscript copy.

## Qualify the actual accounts

Record exact adapter revision, client surface, observed entitlement, endpoint, synthetic project IDs, test time and results. For each actual client:

1. Authenticate and list only permitted tools/projects. Read the same invented project and exact native piece.
2. Save provisional preparation without altering personal thoughts; relay one exact excerpt with honest origin coverage. Prepare and stage a supported paragraph proposal; inspect pending app review and unchanged manuscript.
3. Amend the synthetic work in the app. Read the amendment from the other client. Refuse stale preparation, keep both contributions, and deliberately reconcile.
4. Verify wrong project/action, forged human fields, duplicate operation, expired/revoked grant, missing media and offline Mac/owner behavior. Preserve an uncertain operation; never assume a failed reply means no owner write.
5. Confirm project-scoped change polling and current-work rereads. Verify native originals and an independent sibling output remain unchanged.

Acceptance and Finish stay in the app. This adapter does not expose raw media, exports, sending, publication, human decision authority, collection-only inquiry discovery or arbitrary AI-provider compatibility. A scoped bridge does not make the Mac always online. Actual transfer of private sources or manuscript text requires separate explicit authority after synthetic qualification. See the [contract](contracts/remote-connections.md) for exact bounds and recovery.
