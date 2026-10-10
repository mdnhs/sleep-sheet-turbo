"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/conform-dialouge";
import { Plus, Copy, Check, KeyRound, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  useGetApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@/features/api-keys/api/use-api-keys";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
}

export function ApiKeysClient() {
  const { data: keys, isLoading } = useGetApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  const rows = (keys ?? []) as ApiKeyRow[];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createKey.mutate(name, {
      onSuccess: (data) => {
        setCreateOpen(false);
        setName("");
        setNewRawKey(data.rawKey);
      },
    });
  };

  const handleCopy = async () => {
    if (!newRawKey) return;
    await navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const columns: ColumnDef<ApiKeyRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-semibold flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            {row.original.name}
          </div>
          <code className="mt-0.5 inline-block text-xs text-muted-foreground font-mono bg-slate-100 dark:bg-muted/50 px-1.5 py-0.5 rounded max-w-[280px] truncate">
            {row.original.keyPrefix}…
          </code>
        </div>
      ),
    },
    {
      id: "owner",
      header: "Created By",
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.ownerName ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{row.original.ownerEmail}</div>
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{format(new Date(row.original.createdAt), "MMM d, yyyy")}</span>,
    },
    {
      accessorKey: "lastUsedAt",
      header: "Last Used",
      cell: ({ row }) =>
        row.original.lastUsedAt ? (
          <span className="text-xs whitespace-nowrap">{format(new Date(row.original.lastUsedAt), "MMM d, yyyy h:mm a")}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.revokedAt ? (
          <Badge variant="outline" className="rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">
            Revoked
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-none">
            Active
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5">
          {!row.original.revokedAt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs font-semibold h-8 text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
              onClick={() => setRevokeTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">
            Server-to-server credentials — for the MCP server, scripts, or other integrations. A key acts as its creator, with the same role and permissions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold">
          <Plus className="h-4 w-4" />
          New Key
        </Button>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <DataTable columns={columns} data={rows} />
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New API Key</DialogTitle>
            <DialogDescription>
              Give it a name that describes where it&apos;s used — e.g. &quot;Claude Code MCP&quot;.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="Claude Code MCP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKey.isPending}>
                {createKey.isPending ? "Creating..." : "Create Key"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reveal-once dialog */}
      <Dialog open={!!newRawKey} onOpenChange={(open) => { if (!open) setNewRawKey(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your key now</DialogTitle>
            <DialogDescription>
              This is the only time it&apos;s shown in full. If you lose it, revoke this key and create a new one — the server never stores the raw value.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 text-xs bg-slate-50 dark:bg-muted/40 rounded-xl px-3 py-2.5 break-all font-mono">
              {newRawKey}
            </code>
            <Button type="button" variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={() => setNewRawKey(null)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
        onConfirm={() => {
          if (revokeTarget) revokeKey.mutate(revokeTarget.id);
          setRevokeTarget(null);
        }}
        title="Revoke this key?"
        description={`"${revokeTarget?.name}" will stop working immediately. Anything using it (e.g. the MCP server) will need a new key.`}
      />
    </div>
  );
}
