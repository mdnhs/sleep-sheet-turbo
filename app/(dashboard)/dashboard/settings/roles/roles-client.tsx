"use client";

import { useState } from "react";
import { Plus, Edit, Trash2, CheckCircle2, ShieldAlert, Eye, Pencil } from "lucide-react";
import { useGetRoles, type Role } from "@/features/roles/api/use-get-roles";
import { useCreateRole } from "@/features/roles/api/use-create-role";
import { useUpdateRole } from "@/features/roles/api/use-update-role";
import { useDeleteRole } from "@/features/roles/api/use-delete-role";
import { useCurrent } from "@/features/auth/api/use-current";
import { MODULES, can, expandPermissions, type ModuleDef, type ModuleKey } from "@/lib/permissions";
import {
  NAV_MENUS,
  NAV_TABS,
  allowedTabIds,
  leafIds,
  menuTabs,
  tabPerm,
  type NavMenu,
  type NavTab,
} from "@/lib/dashboard-nav";
import { canAccessNavId } from "@/lib/tab-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageTitle } from "@/components/dashboard-page-title";
import { RoleCardsSkeleton } from "../settings-skeletons";
import { useRememberRows } from "@/hooks/use-skeleton-rows";

// A role is edited as two things:
//  - tabs: which menus, tabs and in-page tabs it opens. The editor ticks
//    leaves only — a tab's in-page tabs, or the tab itself when it has none —
//    and a tab is open when any of its leaves is. Stored as `tab:<id>` and
//    `tab:<id>/<key>`.
//  - actions: what it may change in those modules (`module:write` + extras)
// Module `read` isn't picked by hand: it follows from the tabs, since every
// module is reached through at least one tab (lib/dashboard-nav.ts).

const isTabPermission = (p: string) => p.startsWith("tab:");
const moduleOf = (p: string) => p.slice(0, p.indexOf(":"));
const ALL_LEAVES = NAV_TABS.flatMap(leafIds);
const tabOpen = (tab: NavTab, leaves: ReadonlySet<string>) => leafIds(tab).some((id) => leaves.has(id));

function fromRole(permissions?: string[]) {
  const granted = expandPermissions(permissions);
  const allowed = allowedTabIds(granted);
  const tabs = new Set(ALL_LEAVES.filter((id) => allowed.has(id)));
  const actions = new Set([...granted].filter((p) => !isTabPermission(p) && !p.endsWith(":read")));
  return { tabs, actions };
}

function toPermissions(tabs: ReadonlySet<string>, actions: ReadonlySet<string>): string[] {
  const open = NAV_TABS.filter((tab) => tabOpen(tab, tabs));
  const readable = new Set(open.map((tab) => tab.module as string));
  const writable = new Set([...actions].filter((p) => p.endsWith(":write")).map(moduleOf));
  return [
    ...open.map((tab) => tabPerm(tab.id)),
    ...[...tabs].filter((id) => id.includes("/")).map(tabPerm),
    ...[...readable].map((m) => `${m}:read`),
    // `write` already grants every extra of its module, so don't store those twice.
    ...[...actions].filter((p) => readable.has(moduleOf(p)) && (p.endsWith(":write") || !writable.has(moduleOf(p)))),
  ];
}

// Card badges: one per menu the role opens anything in.
function summarizeRole(permissions?: string[]) {
  const { tabs, actions } = fromRole(permissions);
  const badges: { key: string; label: string; write: boolean }[] = [];
  for (const menu of NAV_MENUS) {
    const all = menuTabs(menu);
    const open = all.filter((tab) => tabOpen(tab, tabs));
    if (open.length === 0) continue;
    badges.push({
      key: menu.key,
      label: open.length === all.length ? menu.title : `${menu.title} ${open.length}/${all.length}`,
      write: open.some((tab) => actions.has(`${tab.module}:write`)),
    });
  }
  return badges;
}

// Modules with something to change beyond viewing.
const EDITABLE_MODULES = (MODULES as readonly ModuleDef[]).filter(
  (m) => m.actions.includes("write") || (m.extras?.length ?? 0) > 0
);

function TabCheckbox({
  label,
  ids,
  selected,
  grantable,
  onChange,
  strong,
}: {
  label: string;
  ids: string[];
  selected: ReadonlySet<string>;
  grantable: (id: string) => boolean;
  onChange: (ids: string[], checked: boolean) => void;
  strong?: boolean;
}) {
  const on = ids.filter((id) => selected.has(id)).length;
  const settable = ids.filter(grantable);
  const all = on === ids.length;
  return (
    <label className={`flex items-center gap-2.5 ${settable.length ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
      <Checkbox
        aria-label={label}
        checked={all}
        indeterminate={on > 0 && !all}
        disabled={settable.length === 0}
        onCheckedChange={() => onChange(settable, !all)}
      />
      <span className={strong ? "text-sm font-medium" : "text-sm"}>{label}</span>
      {ids.length > 1 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {on}/{ids.length}
        </span>
      )}
    </label>
  );
}

function MenuTree({
  menu,
  selected,
  grantable,
  onChange,
}: {
  menu: NavMenu;
  selected: ReadonlySet<string>;
  grantable: (id: string) => boolean;
  onChange: (ids: string[], checked: boolean) => void;
}) {
  const ids = (tabs: NavTab[]) => tabs.flatMap(leafIds);
  const subLeaves = (tab: NavTab) => (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {(tab.subtabs ?? []).map((sub) => {
        const id = `${tab.id}/${sub.key}`;
        return <TabCheckbox key={id} label={sub.title} ids={[id]} selected={selected} grantable={grantable} onChange={onChange} />;
      })}
    </div>
  );
  // Tabs without in-page tabs sit in a 2-column grid; a tab with them gets a
  // full row with its in-page tabs nested below.
  const leaves = (tabs: NavTab[]) => (
    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
      {tabs.map((tab) =>
        tab.subtabs ? (
          <div key={tab.id} className="space-y-2 sm:col-span-2">
            <TabCheckbox label={tab.title} ids={leafIds(tab)} selected={selected} grantable={grantable} onChange={onChange} />
            <div className="pl-6.5">{subLeaves(tab)}</div>
          </div>
        ) : (
          <TabCheckbox key={tab.id} label={tab.title} ids={[tab.id]} selected={selected} grantable={grantable} onChange={onChange} />
        )
      )}
    </div>
  );
  const all = menuTabs(menu);
  // A menu with one page (Dashboard, Promotions) lists that page's in-page
  // tabs directly, or nothing when it has none.
  const single = all.length === 1 && !menu.groups;

  return (
    <div className="px-4 py-3">
      <TabCheckbox label={menu.title} ids={ids(all)} selected={selected} grantable={grantable} onChange={onChange} strong />
      {single && all[0].subtabs && <div className="mt-2.5 pl-6.5">{subLeaves(all[0])}</div>}
      {!single && (
        <div className="mt-2.5 space-y-3 pl-6.5">
          {menu.tabs && leaves(menu.tabs)}
          {menu.groups?.map((group) => (
            <div key={group.key} className="space-y-2">
              <TabCheckbox label={group.title} ids={ids(group.tabs)} selected={selected} grantable={grantable} onChange={onChange} strong />
              <div className="pl-6.5">{leaves(group.tabs)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RolesClient() {
  const { data: roles, isLoading } = useGetRoles();
  const { data: me } = useCurrent();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();
  useRememberRows("roles.cards", isLoading ? undefined : (roles?.length ?? 0));

  const [isOpen, setIsOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [tabs, setTabs] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [landingUrl, setLandingUrl] = useState("");

  const handleOpenNew = () => {
    setEditingRole(null);
    setName("");
    setTabs(new Set());
    setActions(new Set());
    setLandingUrl("");
    setIsOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    const current = fromRole(role.permissions);
    setEditingRole(role);
    setName(role.name);
    setTabs(current.tabs);
    setActions(current.actions);
    setLandingUrl(role.landingUrl ?? "");
    setIsOpen(true);
  };

  // An editor can only grant tabs and actions they have themselves (the API
  // enforces the same rule).
  const grantableTab = (id: string) => canAccessNavId(me ?? null, id);

  const setTabsChecked = (ids: string[], checked: boolean) => {
    setTabs((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const hasAction = (module: string, action: string) => actions.has(`${module}:${action}`);

  const toggleAction = (module: string, action: string, checked: boolean) => {
    setActions((prev) => {
      const next = new Set(prev);
      const key = `${module}:${action}`;
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  // Modules this role reaches through at least one tab, with those tabs' names.
  const openModules = EDITABLE_MODULES.map((m) => ({
    module: m,
    tabs: NAV_TABS.filter((tab) => tab.module === m.key && tabOpen(tab, tabs)),
  })).filter((entry) => entry.tabs.length > 0);

  const updateRole = useUpdateRole(editingRole?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name,
      permissions: toPermissions(tabs, actions),
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
      <PageTitle title="Roles & Permissions" description="Choose which menus and tabs each role opens, and what it can change there" />
      <div className="flex items-center justify-end gap-4">
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
        {isLoading && <RoleCardsSkeleton />}
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="min-w-0 space-y-6 mt-4">
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
                {NAV_TABS.filter((tab) => tabOpen(tab, tabs)).map((tab) => (
                  <option key={tab.id} value={tab.href}>{tab.title}</option>
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground">
                Where this role lands after login. Leave blank to use the first tab it can open.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Menus &amp; tabs</label>
                <p className="text-xs text-muted-foreground">
                  Menus and tabs the role can&apos;t open are hidden. In-page tabs (the last level) stay visible but disabled.
                </p>
              </div>
              <div className="rounded-2xl border divide-y">
                {NAV_MENUS.map((menu) => (
                  <MenuTree key={menu.key} menu={menu} selected={tabs} grantable={grantableTab} onChange={setTabsChecked} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> What it can change</label>
                <p className="text-xs text-muted-foreground">
                  Without these the role can only view the tabs above.
                </p>
              </div>
              {openModules.length === 0 ? (
                <p className="rounded-2xl border px-4 py-3 text-xs text-muted-foreground">
                  Pick at least one tab above first.
                </p>
              ) : (
                <div className="rounded-2xl border divide-y">
                  {openModules.map(({ module: m, tabs: moduleTabs }) => {
                    const writeOn = hasAction(m.key, "write");
                    const extras = m.extras ?? [];
                    return (
                      <div key={m.key} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{m.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {moduleTabs.map((tab) => tab.title).join(", ")}
                            </p>
                          </div>
                          {m.actions.includes("write") && (
                            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer shrink-0">
                              <Checkbox
                                aria-label={`${m.label} edit`}
                                checked={writeOn}
                                disabled={!writeOn && !can(me ?? null, m.key as ModuleKey, "write")}
                                onCheckedChange={(v) => toggleAction(m.key, "write", v as boolean)}
                              />
                              Edit
                            </label>
                          )}
                        </div>

                        {extras.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 pl-1">
                            {extras.map((ex) => (
                              <label key={ex.key} className="flex items-center gap-2 text-xs cursor-pointer">
                                <Checkbox
                                  aria-label={`${m.label} ${ex.label}`}
                                  // write grants every extra automatically
                                  checked={writeOn || hasAction(m.key, ex.key)}
                                  disabled={writeOn || (!hasAction(m.key, ex.key) && !can(me ?? null, m.key as ModuleKey, ex.key))}
                                  onCheckedChange={(v) => toggleAction(m.key, ex.key, v as boolean)}
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
              )}
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
