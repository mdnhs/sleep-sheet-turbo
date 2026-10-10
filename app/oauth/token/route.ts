import { NextRequest, NextResponse } from "next/server";
import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/oauth";

/** OAuth clients are required to POST `application/x-www-form-urlencoded`
 * here, but some send JSON in practice — accept either rather than fail a
 * spec-compliant client on a technicality we don't need to enforce. */
async function parseBody(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }
  const form = await req.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
}

function tokenResponse(pair: { accessToken: string; refreshToken: string; expiresIn: number }) {
  return NextResponse.json(
    {
      access_token: pair.accessToken,
      token_type: "Bearer",
      expires_in: pair.expiresIn,
      refresh_token: pair.refreshToken,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req);
  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    if (!body.code || !body.client_id || !body.redirect_uri || !body.code_verifier) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const result = await exchangeAuthorizationCode({
      code: body.code,
      clientId: body.client_id,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return tokenResponse(result);
  }

  if (grantType === "refresh_token") {
    if (!body.refresh_token || !body.client_id) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const result = await refreshAccessToken({
      refreshToken: body.refresh_token,
      clientId: body.client_id,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return tokenResponse(result);
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}
