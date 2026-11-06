// Resolve the existing, independently locked MCP installation; no runtime-lock coupling.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../mcp/study/package.json',import.meta.url));
export const {McpServer,WebStandardStreamableHTTPServerTransport}=require('@modelcontextprotocol/server');
export const z=require('zod/v4');
