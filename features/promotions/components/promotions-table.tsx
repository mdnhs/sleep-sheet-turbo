"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import type { Promotion } from "../types";
import { paymentMethodLabel, promotionStatus, zoneLabel, type PromotionStatus } from "../utils";

const STATUS: Record<PromotionStatus, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  },
  ended: {
    label: "Ended",
    className: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  },
  off: {
    label: "Off",
    className: "border-border bg-transparent text-muted-foreground",
  },
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso: string) => dateFormat.format(new Date(iso));

function personalLimit(minutes: number | null) {
  if (!minutes) return null;
  const hours = Math.round((minutes / 60) * 100) / 100;
  return <div className="text-xs whitespace-nowrap text-primary">{hours}h per visitor</div>;
}

function DateWindow({ startsAt, endsAt, personalWindowMinutes }: Pick<Promotion, "startsAt" | "endsAt" | "personalWindowMinutes">) {
  if (!startsAt && !endsAt) {
    return (
      <div className="space-y-0.5">
        <span className="text-muted-foreground">Always</span>
        {personalLimit(personalWindowMinutes)}
      </div>
    );
  }
  return (
    <div className="space-y-0.5 text-xs whitespace-nowrap">
      <div>
        <span className="text-muted-foreground">From </span>
        {startsAt ? formatDate(startsAt) : "now"}
      </div>
      <div>
        <span className="text-muted-foreground">Until </span>
        {endsAt ? formatDate(endsAt) : "no end"}
      </div>
      {personalLimit(personalWindowMinutes)}
    </div>
  );
}

function Chips({ values }: { values: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="outline" className="font-normal">
          {value}
        </Badge>
      ))}
    </div>
  );
}

interface PromotionsTableProps {
  promotions: Promotion[];
  canWrite: boolean;
  /** Id of the promotion whose on/off switch is saving, if any. */
  togglingId: string | null;
  onToggle: (promotion: Promotion, isActive: boolean) => void;
  onEdit: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
}

export function PromotionsTable({ promotions, canWrite, togglingId, onToggle, onEdit, onDelete }: PromotionsTableProps) {
  const { formatAmount } = useCurrency();
  const now = new Date();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Promotion</TableHead>
          <TableHead>Payment methods</TableHead>
          <TableHead>Zones</TableHead>
          <TableHead>Min. order</TableHead>
          <TableHead>Dates</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>On</TableHead>
          {canWrite && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {promotions.map((promotion) => {
          const status = STATUS[promotionStatus(promotion, now)];
          return (
            <TableRow key={promotion.id}>
              <TableCell className="max-w-xs">
                <div className="font-medium truncate">{promotion.title}</div>
                {promotion.description && (
                  <div className="text-xs text-muted-foreground line-clamp-2 whitespace-normal">
                    {promotion.description}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <Chips values={promotion.paymentMethods.map(paymentMethodLabel)} />
              </TableCell>
              <TableCell>
                <Chips values={promotion.zones.map(zoneLabel)} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {promotion.minOrderAmount === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  formatAmount(promotion.minOrderAmount)
                )}
              </TableCell>
              <TableCell>
                <DateWindow
                    startsAt={promotion.startsAt}
                    endsAt={promotion.endsAt}
                    personalWindowMinutes={promotion.personalWindowMinutes}
                  />
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("border-transparent", status.className)}>
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell>
                <Switch
                  aria-label={promotion.isActive ? `Switch off ${promotion.title}` : `Switch on ${promotion.title}`}
                  checked={promotion.isActive}
                  disabled={!canWrite || togglingId === promotion.id}
                  onCheckedChange={(checked) => onToggle(promotion, checked)}
                />
              </TableCell>
              {canWrite && (
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${promotion.title}`}
                      onClick={() => onEdit(promotion)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${promotion.title}`}
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(promotion)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
