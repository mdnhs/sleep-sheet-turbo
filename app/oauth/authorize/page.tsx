import { getClient } from "@/lib/oauth";
import { getSessionUser } from "@/lib/get-session-user";
import { AuthorizeLoginForm } from "./login-form";
import { approveAuthorization, denyAuthorization } from "./actions";
import { Button } from "@/components/ui/button";

interface PageProps {
  searchParams: Promise<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    state?: string;
  }>;
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-2">
        <h1 className="text-lg font-bold text-rose-600">Authorization Error</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default async function AuthorizePage({ searchParams }: PageProps) {
  const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method, state } =
    await searchParams;

  if (!client_id || !redirect_uri) {
    return <ErrorScreen message="Missing client_id or redirect_uri." />;
  }

  const client = await getClient(client_id);
  if (!client || !client.redirectUris.includes(redirect_uri)) {
    // Can't trust redirect_uri here — it didn't match a registered client,
    // so we show an error directly instead of redirecting anywhere.
    return <ErrorScreen message="Unknown client or redirect URI. This connector may not be registered correctly." />;
  }

  // redirect_uri is trusted from here on (it matched a registered client).
  if (response_type !== "code") {
    return <ErrorScreen message="Only response_type=code is supported." />;
  }
  if (!code_challenge || code_challenge_method !== "S256") {
    return <ErrorScreen message="PKCE (code_challenge with method S256) is required." />;
  }

  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <AuthorizeLoginForm clientName={client.clientName} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-xl font-bold">Allow {client.clientName}?</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user.email}</span>. This will let{" "}
            <span className="font-semibold text-foreground">{client.clientName}</span> read and update blog posts,
            products, and orders on your store — the same access your own account has.
          </p>
        </div>
        <div className="flex gap-2">
          <form action={denyAuthorization} className="flex-1">
            <input type="hidden" name="client_id" value={client_id} />
            <input type="hidden" name="redirect_uri" value={redirect_uri} />
            {state && <input type="hidden" name="state" value={state} />}
            <Button type="submit" variant="outline" className="w-full">
              Deny
            </Button>
          </form>
          <form action={approveAuthorization} className="flex-1">
            <input type="hidden" name="client_id" value={client_id} />
            <input type="hidden" name="redirect_uri" value={redirect_uri} />
            <input type="hidden" name="code_challenge" value={code_challenge} />
            <input type="hidden" name="code_challenge_method" value={code_challenge_method} />
            {state && <input type="hidden" name="state" value={state} />}
            <Button type="submit" className="w-full">
              Allow
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
