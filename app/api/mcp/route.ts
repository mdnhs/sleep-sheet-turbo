import { NextRequest } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiKey } from "@/lib/api-keys";
import { authenticateOAuthToken } from "@/lib/oauth";
import { registerMcpTools } from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.startsWith("mcp_at_") ? authenticateOAuthToken(token) : authenticateApiKey(token);
}

function unauthorized(origin: string) {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      // Points a client that just got a 401 at the metadata it needs to
      // start the OAuth flow — this is how MCP clients discover where to
      // send the user to log in, per the MCP authorization spec.
      "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

async function handle(req: NextRequest): Promise<Response> {
  const origin = req.nextUrl.origin;
  const authHeader = req.headers.get("authorization");
  const user = await authenticate(req);
  if (!user || !authHeader) return unauthorized(origin);

  // Fresh server + transport per request (stateless mode: no
  // sessionIdGenerator) — this route runs in a serverless/edge-adjacent
  // Next.js context with no guarantee two requests hit the same instance,
  // so nothing here can rely on in-memory state surviving between calls.
  const server = new McpServer({ name: "sleep-sheet", version: "0.1.0" });
  registerMcpTools(server, { origin, bearerToken: authHeader.slice(7).trim() });

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
