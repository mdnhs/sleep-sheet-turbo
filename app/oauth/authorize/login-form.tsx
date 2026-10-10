"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { client } from "@/lib/rpc";
import { Loader2 } from "lucide-react";

/**
 * A standalone login form scoped to this page — not the main /signin flow,
 * which has no way to carry the OAuth request's query params through a
 * redirect. Simpler to just reload this same URL after a successful login:
 * the cookie is now set, so the server re-renders the consent screen
 * instead of this form on the next request.
 */
export function AuthorizeLoginForm({ clientName }: { clientName: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const res = await client.api.auth.login.$post({ json: { email, password } });
      if (!res.ok) {
        const data = await res.json();
        throw new Error("error" in data ? data.error : "Login failed");
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setIsPending(false);
    }
  };

  return (
    <div className="max-w-sm w-full mx-auto">
      <h1 className="text-xl font-bold text-center mb-1">Sign in to continue</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        <span className="font-semibold text-foreground">{clientName}</span> wants to connect to your store — sign in as an admin to approve it.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
