"use server";

import { redirect } from "next/navigation";
import { getClient, createAuthorizationCode } from "@/lib/oauth";
import { getSessionUser } from "@/lib/get-session-user";

/**
 * Re-validates everything from scratch (never trust the hidden form fields
 * alone) before minting a code — the page already checked this once to
 * decide what to render, but a form POST is a fresh, independently
 * forgeable request.
 */
async function revalidate(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const codeChallengeMethod = String(formData.get("code_challenge_method") ?? "");
  const state = formData.get("state") ? String(formData.get("state")) : undefined;

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error("Invalid client or redirect_uri");
  }

  const user = await getSessionUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  return { clientId, redirectUri, codeChallenge, codeChallengeMethod, state, userId: user.id };
}

export async function approveAuthorization(formData: FormData) {
  const { clientId, redirectUri, codeChallenge, codeChallengeMethod, state, userId } =
    await revalidate(formData);

  const code = await createAuthorizationCode({
    clientId,
    userId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
  });

  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}

export async function denyAuthorization(formData: FormData) {
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = formData.get("state") ? String(formData.get("state")) : undefined;
  const clientId = String(formData.get("client_id") ?? "");

  // Only redirect back to a redirect_uri we've actually validated belongs to
  // this client — otherwise this would be an open redirect.
  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error("Invalid client or redirect_uri");
  }

  const url = new URL(redirectUri);
  url.searchParams.set("error", "access_denied");
  if (state) url.searchParams.set("state", state);
  redirect(url.toString());
}
