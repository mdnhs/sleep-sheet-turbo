"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";

interface PaymentMethod {
  id: string;
  label: string;
  value: string;
}

export function PosPaymentMethods() {
  const { data } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const cardEnabled = data ? data.payment_method_card !== "false" : true;
  const dueEnabled = data ? data.payment_method_due !== "false" : true;

  const methods: PaymentMethod[] = data?.pos_payment_methods
    ? JSON.parse(data.pos_payment_methods)
    : [];

  const save = (updated: PaymentMethod[]) => {
    mutate({ pos_payment_methods: JSON.stringify(updated) });
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    const value = label.toUpperCase().replace(/\s+/g, "_");
    if (methods.find(m => m.value === value)) return;
    save([...methods, { id: crypto.randomUUID(), label, value }]);
    setNewLabel("");
  };

  const remove = (id: string) => {
    save(methods.filter(m => m.id !== id));
  };

  const startEdit = (m: PaymentMethod) => {
    setEditingId(m.id);
    setEditLabel(m.label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
  };

  const saveEdit = (id: string) => {
    const label = editLabel.trim();
    if (!label) return;
    const value = label.toUpperCase().replace(/\s+/g, "_");
    save(methods.map(m => m.id === id ? { ...m, label, value } : m));
    cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Cash on Delivery</span>
          <span className="text-xs text-muted-foreground">Pay when order arrives</span>
        </div>
        <div className="text-xs text-muted-foreground font-medium">Default</div>
      </div>
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Credit / Debit Card</span>
          <span className="text-xs text-muted-foreground">Online card payments</span>
        </div>
        <Switch
          checked={cardEnabled}
          disabled={isPending}
          onCheckedChange={(checked) =>
            mutate({ payment_method_card: checked ? "true" : "false" })
          }
        />
      </div>
      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Due</span>
          <span className="text-xs text-muted-foreground">Payment collected later</span>
        </div>
        <Switch
          checked={dueEnabled}
          disabled={isPending}
          onCheckedChange={(checked) =>
            mutate({ payment_method_due: checked ? "true" : "false" })
          }
        />
      </div>

      {methods.map(m => (
        <div key={m.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
          {editingId === m.id ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)}
                className="h-8 text-sm rounded-lg flex-1"
                autoFocus
              />
              <Button variant="ghost" size="icon" onClick={() => saveEdit(m.id)} disabled={isPending || !editLabel.trim()} className="h-8 w-8 text-green-600">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.value}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => startEdit(m)} disabled={isPending} className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)} disabled={isPending} className="text-destructive hover:text-destructive h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

      <div className="flex gap-2">
        <Input
          placeholder="e.g. BKash, Nagad, Bank Transfer"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded-xl"
        />
        <Button onClick={add} disabled={isPending || !newLabel.trim()} className="rounded-xl shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
    </div>
  );
}
