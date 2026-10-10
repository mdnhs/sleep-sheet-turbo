import { NextRequest, NextResponse } from "next/server";

// RFC 9728 — tells an MCP client which authorization server protects the
// /api/mcp resource, so it knows where to send the user to log in.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  });
}
