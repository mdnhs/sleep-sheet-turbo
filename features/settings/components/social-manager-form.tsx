"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { isValidSocialManagerUrl } from "@/lib/social-manager";

export function SocialManagerForm() {
  const { data: settings, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const [edit, setEdit] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-48 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>
    );
  }

  const saved = settings?.social_manager_url ?? "";
  const value = edit ?? saved;
  const trimmed = value.trim();
  const valid = isValidSocialManagerUrl(trimmed);
  const dirty = trimmed !== saved;

  return (
    <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
      <div>
        <h2 className="text-base font-bold tracking-tight">Postiz URL</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          The address where your social scheduler is hosted, for example{" "}
          <code className="rounded bg-muted px-1 py-0.5">https://social.sleepsheetbd.com</code>. Leave empty until it
          is set up — the sidebar then shows this page instead.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="social_manager_url">Social manager URL</Label>
        <Input
          id="social_manager_url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://social.example.com"
          value={value}
          onChange={(e) => setEdit(e.target.value)}
        />
        {!valid && (
          <p className="text-xs text-destructive">Enter a full http:// or https:// address, or leave it empty.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className="rounded-full text-xs font-semibold"
          disabled={isPending || !dirty || !valid}
          onClick={() =>
            mutate({ social_manager_url: trimmed }, { onSuccess: () => setEdit(null) })
          }
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
        {saved && isValidSocialManagerUrl(saved) && (
          <Button
            type="button"
            variant="outline"
            className="rounded-full text-xs font-semibold"
            nativeButton={false}
            render={<a href={saved} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Social Manager
          </Button>
        )}
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">How this works</p>
        <p>
          The scheduler runs as its own service (Docker, with Postgres and Redis) and signs in separately. Once the
          URL is saved, the <strong>Social</strong> item in the admin sidebar opens it in a new tab.
        </p>
      </div>
    </div>
  );
}
