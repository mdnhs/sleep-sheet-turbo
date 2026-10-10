"use client";

import { useState, useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import type { ColumnDef, Updater } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, KeyRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/dashboard/skeletons";

import { useGetUsers } from "@/features/users/api/use-get-users";
import { useGetRoles } from "@/features/roles/api/use-get-roles";
import { useUpdateUserRole } from "@/features/users/api/use-update-user-role";
import { useCreateUser } from "@/features/users/api/use-create-user";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  roleId: string | null;
  createdAt: string;
  assignedRole?: { id: string; name: string } | null;
}

export function UsersClient() {
  const { data: users, isLoading: loadingUsers } = useGetUsers();
  const { data: roles, isLoading: loadingRoles } = useGetRoles();
  const updateRole = useUpdateUserRole();
  const createUser = useCreateUser();

  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""));
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("none");
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);

  const safeUsers = useMemo(() => (users ?? []) as StaffRow[], [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return safeUsers;
    const q = searchQuery.toLowerCase();
    return safeUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [safeUsers, searchQuery]);

  const handleRoleChange = (userId: string, roleId: string) => {
    updateRole.mutate({ id: userId, roleId: roleId === "none" ? null : roleId });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser.mutate(
      {
        name,
        email,
        password,
        roleId: selectedRole === "none" ? null : selectedRole,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName("");
          setEmail("");
          setPassword("");
          setSelectedRole("none");
        },
      }
    );
  };

  const columns: ColumnDef<StaffRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-semibold">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "role",
      header: "System Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "ADMIN" ? "default" : "secondary"} className="rounded-full text-xs font-semibold px-3 py-0.5 border-none">
          {row.original.role}
        </Badge>
      ),
    },
    {
      id: "assignedRole",
      header: "Assigned Custom Role",
      cell: ({ row }) => {
        const user = row.original;
        if (user.role === "ADMIN") {
          return (
            <span className="text-xs text-muted-foreground italic">
              Admin bypasses custom roles
            </span>
          );
        }
        return (
          <Select
            defaultValue={user.roleId || "none"}
            onValueChange={(val) => handleRoleChange(user.id, val || "none")}
            disabled={updateRole.isPending}
          >
            <SelectTrigger className="w-[180px] rounded-full text-xs font-semibold bg-slate-50 dark:bg-muted/40 border-none shadow-none h-8">
              <SelectValue placeholder="Select a role">
                {user.roleId && user.roleId !== "none"
                  ? roles?.find((r) => r.id === user.roleId)?.name || user.assignedRole?.name || user.roleId
                  : "No Custom Role"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="none">No Custom Role</SelectItem>
              {roles?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full text-xs font-semibold h-8"
          onClick={() => setResetPasswordUser({ id: row.original.id, name: row.original.name })}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Reset Password
        </Button>
      ),
    },
  ];

  if (loadingUsers || loadingRoles) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32 rounded-xl mb-2" />
            <Skeleton className="h-4 w-60 rounded-xl" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
        <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none space-y-4">
          <Skeleton className="h-10 w-full sm:max-w-sm rounded-full" />
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
          <p className="text-muted-foreground text-sm">
            Manage team members and assign custom roles
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold">
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9 w-full rounded-full text-xs font-semibold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value || null)}
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredUsers}
          rowSelection={rowSelection}
          onRowSelectionChange={(updater: Updater<Record<string, boolean>>) => {
            setRowSelection(typeof updater === "function" ? updater(rowSelection) : updater)
          }}
        />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Role (Optional)</label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val || "none")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Custom Role (Basic Access)</SelectItem>
                  {roles?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                Create User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {resetPasswordUser && (
        <ResetPasswordDialog
          open={!!resetPasswordUser}
          onOpenChange={(open) => { if (!open) setResetPasswordUser(null); }}
          userId={resetPasswordUser.id}
          userName={resetPasswordUser.name}
        />
      )}
    </div>
  );
}
