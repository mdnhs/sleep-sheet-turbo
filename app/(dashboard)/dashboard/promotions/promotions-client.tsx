"use client";

import { useState } from "react";
import { Loader2, Plus, TicketPercent } from "lucide-react";
import { PageTitle } from "@/components/dashboard-page-title";
import { PromotionsActionsSkeleton, PromotionsTableSkeleton } from "./promotions-skeleton";
import { useRememberRows } from "@/hooks/use-skeleton-rows";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCurrent } from "@/features/auth/api/use-current";
import {
  useDeletePromotion,
  usePromotions,
  useUpdatePromotion,
} from "@/features/promotions/api/use-promotions";
import { PromotionFormDialog } from "@/features/promotions/components/promotion-form-dialog";
import { PromotionsTable } from "@/features/promotions/components/promotions-table";
import { ProductAdSettings } from "@/features/promotions/components/product-ad-settings";
import type { Promotion } from "@/features/promotions/types";
import { toPayload } from "@/features/promotions/utils";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { isAllowed } from "@/lib/permissions";

export default function PromotionsClientPage() {
  // The user and list can already be cached by the time this suspended boundary hydrates,
  // so the first client render has to match the server's (no user, loading).
  const mounted = useHasMounted();
  const { data: user } = useCurrent();
  const canWrite = mounted && isAllowed(user ?? null, "promotions", "write", ["MODERATOR"]);

  const { data: promotions, isLoading, isError, error, refetch } = usePromotions();
  const updateMutation = useUpdatePromotion();
  const deleteMutation = useDeletePromotion();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [toDelete, setToDelete] = useState<Promotion | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (promotion: Promotion) => {
    setEditing(promotion);
    setFormOpen(true);
  };

  const toggle = (promotion: Promotion, isActive: boolean) => {
    updateMutation.mutate({
      id: promotion.id,
      json: toPayload(promotion, { isActive }),
      successMessage: isActive ? "Promotion switched on" : "Promotion switched off",
    });
  };

  // This mutation instance only backs the row switches (the form has its own).
  const togglingId = updateMutation.isPending ? (updateMutation.variables?.id ?? null) : null;

  useRememberRows("promotions.list", isLoading || isError ? undefined : (promotions?.length ?? 0));

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <PageTitle
        title="Promotions"
        description="Free delivery offers by payment method — shown on /offer and applied at checkout"
      />

      {!mounted && <PromotionsActionsSkeleton />}
      {canWrite && (
        <div className="flex items-center justify-end gap-4">
          <Button
            onClick={openCreate}
            className="gap-2 text-white bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 whitespace-nowrap rounded-full px-5 h-9 text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            New promotion
          </Button>
        </div>
      )}

      <div className="rounded-3xl bg-white dark:bg-card p-4 sm:p-6 border-none shadow-none">
        {!mounted || isLoading ? (
          <PromotionsTableSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-destructive">{error.message}</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !promotions?.length ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <TicketPercent className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No promotions yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Offer free delivery when a customer pays with a chosen method (Cash on Delivery, bKash or Card)
                in a chosen delivery zone — optionally above a minimum order and within dates. Live offers show on
                /offer and apply automatically at checkout.
              </p>
            </div>
            {canWrite && (
              <Button variant="outline" size="sm" className="mt-2 gap-2 rounded-full" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                New promotion
              </Button>
            )}
          </div>
        ) : (
          <PromotionsTable
            promotions={promotions}
            canWrite={canWrite}
            togglingId={togglingId}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={setToDelete}
          />
        )}
      </div>

      {canWrite && <PromotionFormDialog open={formOpen} onOpenChange={setFormOpen} promotion={editing} />}

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{toDelete?.title}&quot;? Checkout stops applying it right away. This cannot be undone —
              switch it off instead to pause it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (toDelete) deleteMutation.mutate(toDelete.id, { onSuccess: () => setToDelete(null) });
              }}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* The ad runs code on the storefront: its setting is ADMIN-write only. */}
      {user?.role === "ADMIN" && <ProductAdSettings />}
    </div>
  );
}
