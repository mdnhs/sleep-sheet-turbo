"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Plus, Trash2, Pencil, Check, X, Star, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface FacebookPageItem {
  id: string;
  name: string;
}

export function PosFacebookPages() {
  const { data } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const pages: FacebookPageItem[] = data?.pos_facebook_pages
    ? JSON.parse(data.pos_facebook_pages)
    : [];

  const defaultPage = data?.pos_default_facebook_page || "";

  const save = (updatedPages: FacebookPageItem[], newDefault?: string) => {
    const nextDefault = newDefault !== undefined ? newDefault : defaultPage;
    // If the default page was removed, clear it or pick the first available
    const validatedDefault = updatedPages.some((p) => p.name === nextDefault)
      ? nextDefault
      : updatedPages[0]?.name || "";

    mutate({
      pos_facebook_pages: JSON.stringify(updatedPages),
      pos_default_facebook_page: validatedDefault,
    });
  };

  const add = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (pages.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) return;

    const newPage: FacebookPageItem = {
      id: crypto.randomUUID(),
      name: trimmed,
    };
    const updated = [...pages, newPage];
    // If this is the first page added, make it default automatically
    const nextDefault = pages.length === 0 ? trimmed : defaultPage;
    save(updated, nextDefault);
    setNewName("");
  };

  const remove = (id: string) => {
    const toRemove = pages.find((p) => p.id === id);
    const updated = pages.filter((p) => p.id !== id);
    const nextDefault = toRemove?.name === defaultPage ? updated[0]?.name || "" : defaultPage;
    save(updated, nextDefault);
  };

  const startEdit = (p: FacebookPageItem) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const oldPage = pages.find((p) => p.id === id);
    const isCurrentlyDefault = oldPage?.name === defaultPage;

    const updated = pages.map((p) => (p.id === id ? { ...p, name: trimmed } : p));
    const nextDefault = isCurrentlyDefault ? trimmed : defaultPage;
    save(updated, nextDefault);
    cancelEdit();
  };

  const setDefault = (pageName: string) => {
    mutate({
      pos_default_facebook_page: pageName,
    });
  };

  return (
    <div className="space-y-5">
      {/* Default Selector Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-muted/40 border border-slate-100 dark:border-border">
        <div>
          <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            Default Facebook Page
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            This page will be automatically selected when starting a new order in POS
          </p>
        </div>
        <div className="w-full sm:w-[220px]">
          <Select
            value={defaultPage || "__none__"}
            onValueChange={(val) => setDefault(val === "__none__" ? "" : (val || ""))}
            disabled={isPending || pages.length === 0}
          >
            <SelectTrigger className="w-full rounded-xl text-xs font-semibold bg-white dark:bg-card">
              <SelectValue placeholder="No default page" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="__none__" className="text-xs font-medium text-muted-foreground">
                None (No Default)
              </SelectItem>
              {pages.map((p) => (
                <SelectItem key={p.id} value={p.name} className="text-xs font-medium">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pages List */}
      <div className="space-y-2.5">
        {pages.map((p) => {
          const isDefault = p.name === defaultPage;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                isDefault
                  ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                  : "border-slate-200 dark:border-border bg-white dark:bg-card"
              }`}
            >
              {editingId === p.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(p.id)}
                    className="h-8 text-sm rounded-xl flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => saveEdit(p.id)}
                    disabled={isPending || !editName.trim()}
                    className="h-8 w-8 text-green-600"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-foreground">{p.name}</span>
                    {isDefault && (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 font-semibold">
                        <CheckCircle2 className="h-3 w-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault(p.name)}
                        disabled={isPending}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Set as Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEdit(p)}
                      disabled={isPending}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(p.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {pages.length === 0 && (
          <div className="text-center py-6 border border-dashed rounded-2xl text-muted-foreground text-xs">
            No Facebook pages configured yet. Add your sales channel pages below.
          </div>
        )}
      </div>

      {/* Add New Page Input */}
      <div className="flex gap-2">
        <Input
          placeholder="e.g. Main Page, Outlet Page"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded-xl text-sm"
        />
        <Button onClick={add} disabled={isPending || !newName.trim()} className="rounded-xl shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Page
        </Button>
      </div>
    </div>
  );
}
