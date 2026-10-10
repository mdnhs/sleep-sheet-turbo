"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Plus, Edit, Trash2, CheckCircle2, ShieldAlert, Eye, Pencil } from "lucide-react";
import { useGetRoles, type Role } from "@/features/roles/api/use-get-roles";
import { useCreateRole } from "@/features/roles/api/use-create-role";
import { useUpdateRole } from "@/features/roles/api/use-update-role";
import { useDeleteRole } from "@/features/roles/api/use-delete-role";
import { MODULES, expandPermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Turn a role's stored permissions (legacy or granular) into a set of granular
// perm strings, e.g. { "products:read", "products:write" }.
const toGranular = (permissions?: string[]) => expandPermissions(permissions);

// Human-readable badges for a role card, one per module the role can touch.
function summarizeRole(permissions?: string[]) {
  const granted = toGranular(permissions);
  const badges: { key: string; label: string; write: boolean }[] = [];
  for (const m of MODULES) {
    const write = granted.has(`${m.key}:write`);
    const read = granted.has(`${m.key}:read`);
    if (write || read) {
      badges.push({ key: m.key, label: m.label, write });
    }
  }
  return badges;
}

export function RolesClient() {
  const { data: roles, isLoading } = useGetRoles();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form State — a set of granular "module:action" strings.
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [landingUrl, setLandingUrl] = useState("");

  const handleOpenNew = () => {
    setEditingRole(null);
    setName("");
    setPermissions(new Set());
    setLandingUrl("");
    setIsOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setName(role.name);
    setPermissions(toGranular(role.permissions));
    setLandingUrl(role.landingUrl ?? "");
    setIsOpen(true);
  };

  const has = (module: string, action: string) => permissions.has(`${module}:${action}`);

  const toggle = (module: string, action: string, checked: boolean) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      const key = `${module}:${action}`;
      if (checked) {
        next.add(key);
        // write requires read
        if (action === "write") next.add(`${module}:read`);
      } else {
        next.delete(key);
        // dropping read also drops write (write can't exist without read)
        if (action === "read") next.delete(`${module}:write`);
      }
      return next;
    });
  };

  const updateRole = useUpdateRole(editingRole?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name,
      permissions: [...permissions],
      landingUrl: landingUrl.trim() || null,
    };

    if (editingRole) {
      updateRole.mutate(payload, { onSuccess: () => setIsOpen(false) });
    } else {
      createRole.mutate(payload, { onSuccess: () => setIsOpen(false) });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">
            Grant each role read (view) or write (manage) access per module
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* System Admin Role Card */}
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldAlert className="w-24 h-24" />
          </div>
          <div>
            <h3 className="font-bold text-xl mb-1 flex items-center gap-2">
              Administrator
              <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </h3>
            <p className="text-xs text-muted-foreground">
              System-level role with unrestricted access to all features.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-none">All Permissions</span>
          </div>
        </div>

        {/* Custom Roles */}
        {isLoading && (
          <>
            <Skeleton className="h-28 w-full rounded-3xl" />
            <Skeleton className="h-28 w-full rounded-3xl" />
          </>
        )}
        {roles?.map((role) => {
          const badges = summarizeRole(role.permissions);
          return (
            <div key={role.id} className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-xl">{role.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleOpenEdit(role)}>
                      <Edit className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-destructive hover:bg-destructive/10" onClick={() => {
                      if (confirm("Are you sure you want to delete this role?")) {
                        deleteRole.mutate(role.id);
                      }
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {badges.length === 0 ? "No access granted." : "Custom role with specific access."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {badges.slice(0, 4).map((b) => (
                  <span key={b.key} className={`px-3 py-1 rounded-full text-xs font-semibold border-none inline-flex items-center gap-1 ${b.write ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"}`}>
                    {b.write ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {b.label}
                  </span>
                ))}
                {badges.length > 4 && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 border-none">
                    +{badges.length - 4} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role Name</label>
              <Input
                placeholder="e.g. Cashier"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Landing URL <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="/dashboard/orders"
                value={landingUrl}
                onChange={(e) => setLandingUrl(e.target.value)}
                list="landing-url-suggestions"
              />
              <datalist id="landing-url-suggestions">
                <option value="/dashboard" />
                <option value="/dashboard/orders" />
                <option value="/dashboard/pos" />
                <option value="/dashboard/products" />
                <option value="/dashboard/reports" />
                <option value="/dashboard/expenses" />
                <option value="/dashboard/blog" />
                <option value="/dashboard/testimonials" />
                <option value="/dashboard/users" />
                <option value="/dashboard/settings" />
                <option value="/dashboard/activity" />
              </datalist>
              <p className="text-xs text-muted-foreground">
                Where this role lands after login. Leave blank to use the first accessible page.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Module Permissions</label>
                <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Read</span>
                  <span className="flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Write</span>
                </div>
              </div>

              <div className="rounded-2xl border divide-y max-h-[45vh] overflow-y-auto">
                {MODULES.map((m) => {
                  const hasWrite = (m.actions as readonly string[]).includes("write");
                  const writeOn = has(m.key, "write");
                  const extras = (m as { extras?: { key: string; label: string }[] }).extras ?? [];
                  return (
                    <div key={m.key} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                        </div>
                        <div className="flex items-center gap-6 shrink-0">
                          <Checkbox
                            aria-label={`${m.label} read`}
                            // write implies read, so force-on & lock when write is set
                            checked={has(m.key, "read") || writeOn}
                            disabled={writeOn}
                            onCheckedChange={(v) => toggle(m.key, "read", v as boolean)}
                          />
                          {hasWrite ? (
                            <Checkbox
                              aria-label={`${m.label} write`}
                              checked={writeOn}
                              onCheckedChange={(v) => toggle(m.key, "write", v as boolean)}
                            />
                          ) : (
                            <span className="w-4 h-4 inline-block" />
                          )}
                        </div>
                      </div>

                      {extras.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 pl-1">
                          {extras.map((ex) => (
                            <label key={ex.key} className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox
                                aria-label={`${m.label} ${ex.label}`}
                                // write grants every extra automatically
                                checked={writeOn || has(m.key, ex.key)}
                                disabled={writeOn}
                                onCheckedChange={(v) => toggle(m.key, ex.key, v as boolean)}
                              />
                              <span className={writeOn ? "text-muted-foreground" : ""}>{ex.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button type="button" variant="outline" className="mr-2" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRole.isPending || updateRole.isPending}>
                {editingRole ? "Save Changes" : "Create Role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
