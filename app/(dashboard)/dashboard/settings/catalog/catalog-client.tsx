"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Database, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/dashboard-page-title";

type FeedFormat = "xml" | "csv" | "json";

const FORMATS: FeedFormat[] = ["xml", "csv", "json"];
const LABELS: Record<FeedFormat, string> = { xml: "XML", csv: "CSV", json: "JSON" };
const EXT: Record<FeedFormat, string> = { xml: ".xml", csv: ".csv", json: ".json" };

const PREVIEW_LINES = 50;

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CatalogSettings() {
  const [baseUrl, setBaseUrl] = useState("");
  const [copied, setCopied] = useState<FeedFormat | null>(null);
  const [previewTab, setPreviewTab] = useState<FeedFormat>("xml");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMeta, setPreviewMeta] = useState<{
    format: FeedFormat;
    totalLines: number;
    byteSize: number;
  } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location isn't available during SSR render, so the real origin can only be read client-side in an effect.
    setBaseUrl(getBaseUrl());
  }, []);

  const feedUrl = (format: FeedFormat) => `${baseUrl}/facebook-feed${EXT[format]}`;

  const handleCopy = useCallback(async (format: FeedFormat) => {
    try {
      await navigator.clipboard.writeText(feedUrl(format));
      setCopied(format);
      toast.success(`Feed URL copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [baseUrl]);

  const handlePreview = useCallback(async (format: FeedFormat) => {
    setPreviewLoading(true);
    setPreview(null);
    setPreviewMeta(null);

    try {
      const resp = await fetch(feedUrl(format));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const text = await resp.text();
      const lines = text.split("\n");
      const truncated = lines.slice(0, PREVIEW_LINES).join("\n");

      setPreview(truncated);
      setPreviewMeta({
        format,
        totalLines: lines.length,
        byteSize: text.length,
      });
    } catch (err) {
      toast.error(`Failed to load feed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setPreview("Failed to load feed preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [baseUrl]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageTitle title="Meta Catalog" description="Product feed for Facebook / Meta Commerce Catalog" />

      <div className="space-y-6">
        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <h2 className="text-base font-bold tracking-tight">Feed URLs</h2>
          <div className="space-y-3">
            {FORMATS.map((format) => (
              <div
                key={format}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-muted/30 px-4 py-3"
              >
                <Badge variant="secondary" className="shrink-0 font-mono text-xs font-semibold rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-none">
                  {LABELS[format]}
                </Badge>
                <code className="flex-1 text-xs truncate font-mono text-muted-foreground">
                  {baseUrl ? feedUrl(format) : <Skeleton className="inline-block h-4 w-56 align-middle" />}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(format)}
                  className="shrink-0 h-8 w-8 rounded-full"
                >
                  {copied === format ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight">Preview</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreview(previewTab)}
              disabled={previewLoading || !baseUrl}
              className="gap-2 rounded-full text-xs font-semibold border bg-slate-50 dark:bg-muted/40"
            >
              {previewLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {previewLoading ? "Loading..." : "Load Preview"}
            </Button>
          </div>

          <Tabs
            value={previewTab}
            onValueChange={(v) => {
              setPreviewTab(v as FeedFormat);
              setPreview(null);
              setPreviewMeta(null);
            }}
          >
            <TabsList className="flex flex-nowrap items-center h-9 w-fit gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-full mb-4">
              {FORMATS.map((f) => (
                <TabsTrigger
                  key={f}
                  value={f}
                  className="shrink-0 rounded-full px-4 h-7 text-xs font-semibold cursor-pointer transition-colors data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:data-[state=active]:bg-slate-100 dark:data-[state=active]:text-slate-900 data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {LABELS[f]}
                </TabsTrigger>
              ))}
            </TabsList>

            {FORMATS.map((format) => (
              <TabsContent key={format} value={format}>
                {!preview ? (
                  previewLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed py-12 text-xs font-medium text-muted-foreground">
                      Click &quot;Load Preview&quot; to fetch the {LABELS[format]} feed
                    </div>
                  )
                ) : previewMeta && previewMeta.format === format ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        <strong className="font-semibold text-foreground">
                          {previewMeta.totalLines.toLocaleString()}
                        </strong>{" "}
                        {previewMeta.totalLines === 1 ? "line" : "lines"}
                      </span>
                      <span>
                        <strong className="font-semibold text-foreground">
                          {formatSize(previewMeta.byteSize)}
                        </strong>{" "}
                        total
                      </span>
                      {previewMeta.totalLines > PREVIEW_LINES && (
                        <Badge variant="outline" className="text-xs rounded-full">
                          Showing first {PREVIEW_LINES} lines
                        </Badge>
                      )}
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-muted/40 p-4 text-xs font-mono leading-relaxed">
                      {preview}
                      {previewMeta.totalLines > PREVIEW_LINES && (
                        <span className="block text-muted-foreground italic pt-2 border-t mt-2">
                          ... {previewMeta.totalLines - PREVIEW_LINES} more lines
                        </span>
                      )}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed py-12 text-xs font-medium text-muted-foreground">
                    Switch tab and load preview
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
