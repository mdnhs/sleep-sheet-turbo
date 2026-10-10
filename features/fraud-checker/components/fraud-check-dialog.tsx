"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFraudCheckLookup } from "@/features/fraud-checker/api/use-fraud-check";
import { FraudResult } from "@/features/fraud-checker/components/fraud-result";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";

/**
 * Controlled by whichever page opens it — `phone` non-null means open. Keep it
 * mounted at page level, not inside a table cell: a cell remounts whenever the
 * table re-renders, which would close the dialog mid-look.
 *
 * Opening a customer costs one billed BD Courier call, and the answer is then
 * cached for an hour, so reopening the same number is free.
 */
export function FraudCheckDialog({
  phone,
  onOpenChange,
}: {
  phone: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const normalized = phone ? normalizeBdPhone(phone) : null;
  const { data, isFetching, error, dataUpdatedAt } = useFraudCheckLookup(
    normalized ?? "",
    !!normalized
  );

  return (
    <Dialog open={!!phone} onOpenChange={onOpenChange}>
      <DialogContent
        className="font-bengali sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>ফ্রড চেক</DialogTitle>
          <DialogDescription>
            {normalized ? (
              <>
                <span className="font-mono font-semibold">{normalized}</span> — এই নম্বরের
                কুরিয়ার ডেলিভারি হিস্ট্রি।
              </>
            ) : (
              "এই অর্ডারে কোনো বৈধ মোবাইল নম্বর নেই।"
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">চেক করা যায়নি</p>
              <p className="mt-0.5">{error.message}</p>
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <FraudResult data={data} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
