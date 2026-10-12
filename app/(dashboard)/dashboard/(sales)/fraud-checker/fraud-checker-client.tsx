"use client";

import { useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { AlertTriangle, CreditCard, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFraudCheckLookup } from "@/features/fraud-checker/api/use-fraud-check";
import { FraudResult } from "@/features/fraud-checker/components/fraud-result";
import { PlanCard } from "@/features/fraud-checker/components/plan-card";
import { normalizeBdPhone } from "@/features/fraud-checker/phone";
import { cn } from "@/lib/utils";

export function FraudCheckerClient() {
  // The phone stays in the URL so a reload keeps the number in the box — but
  // a check never runs on its own. React Query's cache doesn't survive a
  // reload, so auto-running whatever sits in `?phone=` would bill a fresh BD
  // Courier call on every refresh, bookmark or pasted link. `requested` is
  // that gate: only a click starts a lookup.
  const [urlPhone, setUrlPhone] = useQueryState("phone", parseAsString.withDefault(""));
  const [requested, setRequested] = useState(false);
  const [tab, setTab] = useState("check");
  const [input, setInput] = useState(urlPhone);
  const [inputError, setInputError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const submitted = normalizeBdPhone(urlPhone);
  const { data, error, isFetching, dataUpdatedAt } = useFraudCheckLookup(
    submitted ?? "",
    !!submitted && requested
  );

  // Keep a short history so re-opening a number costs nothing — the cached
  // result is served without a second billed call.
  function lookup(phone: string) {
    setInput(phone);
    setInputError(null);
    setRequested(true);
    setUrlPhone(phone);
    setRecent((prev) => [phone, ...prev.filter((p) => p !== phone)].slice(0, 6));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeBdPhone(input);
    if (!normalized) {
      setInputError("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)");
      return;
    }
    lookup(normalized);
  }

  return (
    <div className="font-bengali mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-8 pt-4 md:pt-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ফ্রড চেকার</h1>
        <p className="text-muted-foreground text-sm">
          পার্সেল পাঠানোর আগে কাস্টমারের কুরিয়ার ডেলিভারি হিস্ট্রি যাচাই করুন।
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as string)}>
        <TabsList className="h-9">
          <TabsTrigger value="check" className="gap-1.5 px-4 text-xs font-semibold">
            <Search className="h-3.5 w-3.5" />
            নম্বর চেক
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5 px-4 text-xs font-semibold">
            <CreditCard className="h-3.5 w-3.5" />
            আমার প্ল্যান
          </TabsTrigger>
        </TabsList>

        {/* ---------- Check tab ---------- */}
        <TabsContent value="check" className="space-y-6 pt-2">
          <div className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
            <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1 space-y-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="01XXXXXXXXX"
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    className="pl-9"
                    autoFocus
                  />
                </div>
                {inputError && <p className="text-xs text-red-600 dark:text-red-400">{inputError}</p>}
              </div>
              <Button
                type="submit"
                disabled={isFetching || !input.trim()}
                className="h-9 shrink-0 rounded-full px-6 text-xs font-semibold"
              >
                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                চেক করুন
              </Button>
            </form>

            <p className="text-xs text-muted-foreground">
              প্রতিটি নতুন নম্বরে একটি BD Courier কল খরচ হয়। আগে চেক করা নম্বর এক ঘণ্টা
              পর্যন্ত ফ্রি।
            </p>

            {recent.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t pt-4">
                <span className="text-xs text-muted-foreground">সাম্প্রতিক</span>
                {recent.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => lookup(p)}
                    className={cn(
                      "rounded-full px-2.5 py-1 font-mono text-xs transition-colors",
                      p === submitted
                        ? "bg-foreground text-background"
                        : "bg-slate-100 text-muted-foreground hover:text-foreground dark:bg-slate-900/60"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && !isFetching && (
            <div className="flex items-start gap-3 rounded-3xl bg-red-50 dark:bg-red-950/40 p-5 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">চেক করা যায়নি</p>
                <p className="mt-0.5">{error.message}</p>
              </div>
            </div>
          )}

          <div className="rounded-3xl bg-white dark:bg-card p-6 md:p-8">
            <FraudResult data={data} isFetching={isFetching} dataUpdatedAt={dataUpdatedAt} />
          </div>
        </TabsContent>

        {/* ---------- Plan tab ---------- */}
        <TabsContent value="plan" className="pt-2">
          <div className="flex justify-center py-4">
            <PlanCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
