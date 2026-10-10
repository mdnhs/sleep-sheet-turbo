import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerClient } from "@/lib/oauth";

// RFC 7591 Dynamic Client Registration. Deliberately unauthenticated — that
// is how DCR works everywhere (anyone can register a client id/secret); the
// real access-control boundary is later, at /oauth/authorize, where an
// actual logged-in user has to click "Allow".
const registerSchema = z.object({
  client_name: z.string().trim().min(1).max(200),
  redirect_uris: z.array(z.string().url()).min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const { clientId, clientSecret } = await registerClient({
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0, // never expires
      client_name: parsed.data.client_name,
      redirect_uris: parsed.data.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    },
    { status: 201 }
  );
}
