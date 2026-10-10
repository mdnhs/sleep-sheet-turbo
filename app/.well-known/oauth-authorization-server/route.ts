import { NextRequest, NextResponse } from "next/server";

// RFC 8414 — lets an OAuth/MCP client discover this server's endpoints
// instead of having them hardcoded.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
  });
}
