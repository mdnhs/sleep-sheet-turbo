"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react";
import { client } from "@/lib/rpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useSettings,
  useSettingsSecrets,
  useUpdateSettings,
} from "@/features/settings/api/use-settings";

type CredentialKey = "bkash_app_key" | "bkash_app_secret" | "bkash_username" | "bkash_password";

const FIELDS: { key: CredentialKey; label: string; placeholder: string }[] = [
  { key: "bkash_app_key", label: "App Key", placeholder: "bKash app key" },
  { key: "bkash_app_secret", label: "App Secret", placeholder: "bKash app secret" },
  { key: "bkash_username", label: "Username", placeholder: "bKash merchant username" },
  { key: "bkash_password", label: "Password", placeholder: "bKash merchant password" },
];

export function BkashForm() {
  const { data: settings, isLoading } = useSettings();
  const { data: secrets, isLoading: secretsLoading, isError: secretsError } = useSettingsSecrets();
  const { mutate, isPending } = useUpdateSettings();

  // Only what the admin has typed; anything untouched falls back to the saved
  // value, so saving never blanks a credential that was just not edited.
  const [edits, setEdits] = useState<Partial<Record<CredentialKey, string>>>({});
  const [modeEdit, setModeEdit] = useState<"sandbox" | "live" | null>(null);
  const [revealed, setRevealed] = useState<Partial<Record<CredentialKey, boolean>>>({});
  // GET /api/settings is CDN-cached for a few minutes, so right after a save
  // it can still return the old values. What this admin just saved is
  // remembered here and wins over that stale copy.
  const [saved, setSaved] = useState<{ enabled?: boolean; mode?: "sandbox" | "live" }>({});

  const test = useMutation({
    mutationFn: async () => {
      const res = await client.api.bkash.test.$post();
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.message || data.error || "Connection failed");
      return data.message ?? "Connected to bKash.";
    },
    onSuccess: (message) => toast.success(message),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || secretsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const enabled = saved.enabled ?? settings?.payment_method_bkash === "true";
  const savedMode = saved.mode ?? (settings?.bkash_mode === "live" ? "live" : "sandbox");
  const mode = modeEdit ?? savedMode;
  // From the admin-only secrets endpoint (never CDN-cached), not the public
  // "_set" flags, so the switch unlocks the moment the credentials are saved.
  const allSaved = FIELDS.every(({ key }) => (secrets?.[key] ?? "").trim() !== "");

  const valueOf = (key: CredentialKey) => edits[key] ?? secrets?.[key] ?? "";
  const dirty = (modeEdit !== null && modeEdit !== savedMode) || Object.keys(edits).length > 0;

  const save = () => {
    // Only edited credentials are sent, so a field that could not be loaded
    // (non-admin) or was never touched is never overwritten with a blank.
    const payload: Record<string, string> = { bkash_mode: mode };
    for (const { key } of FIELDS) {
      if (edits[key] !== undefined) payload[key] = edits[key].trim();
    }
    mutate(payload, {
      onSuccess: () => {
        setEdits({});
        setModeEdit(null);
        setSaved((prev) => ({ ...prev, mode }));
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col pr-4">
          <span className="text-sm font-semibold">bKash</span>
          <span className="text-xs text-muted-foreground">
            {allSaved
              ? "Customers pay online with bKash at checkout. The order is confirmed once bKash confirms the payment."
              : "Save all four credentials below to enable bKash at checkout."}
          </span>
        </div>
        <Switch
          checked={enabled}
          disabled={isPending || (!enabled && !allSaved)}
          onCheckedChange={(checked) =>
            mutate(
              { payment_method_bkash: checked ? "true" : "false" },
              { onSuccess: () => setSaved((prev) => ({ ...prev, enabled: checked })) },
            )
          }
        />
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Environment
          </Label>
          <div className="flex gap-2">
            {(["sandbox", "live"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={mode === m ? "default" : "outline"}
                className="rounded-full capitalize"
                onClick={() => setModeEdit(m)}
              >
                {m}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "sandbox"
              ? "Sandbox: test payments with bKash's test wallet — no real money moves. Use the sandbox credentials from your bKash developer account."
              : "Live: real customer payments. Use the production credentials bKash issued to your merchant account."}
          </p>
        </div>

        {secretsError && (
          <p className="text-xs text-destructive">
            Only an admin can view or change the saved credentials.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <div className="relative">
                <Input
                  id={key}
                  type={revealed[key] ? "text" : "password"}
                  autoComplete="off"
                  placeholder={placeholder}
                  value={valueOf(key)}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setRevealed((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={revealed[key] ? `Hide ${label}` : `Show ${label}`}
                >
                  {revealed[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="rounded-full text-xs font-semibold"
            disabled={isPending || !dirty}
            onClick={save}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full text-xs font-semibold"
            disabled={test.isPending || dirty || !allSaved}
            onClick={() => test.mutate()}
          >
            {test.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 h-4 w-4" />
            )}
            Test connection
          </Button>
          {dirty && (
            <span className="text-xs text-muted-foreground">Save your changes before testing.</span>
          )}
        </div>

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Whitelist this in your bKash merchant panel</p>
          <p>
            Callback URL:{" "}
            <code className="rounded bg-background px-1 py-0.5">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/bkash/callback
            </code>
          </p>
          <p>
            Customers are sent to bKash to pay, then returned to your store. Orders that are
            started but never paid are cancelled and restocked automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
