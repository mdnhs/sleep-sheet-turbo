"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, XCircle, ArrowLeft, RefreshCw, Phone, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useWebsiteSettings } from "@/hooks/use-website-settings";

function PaymentFailureContent() {
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();
  const { siteName, footerPhone } = useWebsiteSettings();

  const status = searchParams.get("status") || "failure";
  const rawMessage = searchParams.get("message");
  const orderNumber = searchParams.get("orderNumber");
  const isCancelled = status === "cancel" || status === "cancelled";

  // Checklist items 1 & 3: Display proper errorMessageEn from bKash API response
  const displayMessage =
    rawMessage ||
    (isCancelled
      ? language === "bn"
        ? "আপনি বিকাশ পেমেন্ট বাতিল করেছেন।"
        : "You cancelled the bKash payment."
      : language === "bn"
        ? "বিকাশ পেমেন্ট সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।"
        : "bKash payment was not completed. Please try again.");

  const title = isCancelled
    ? language === "bn"
      ? "পেমেন্ট বাতিল করা হয়েছে"
      : "Payment Cancelled"
    : language === "bn"
      ? "পেমেন্ট ব্যর্থ হয়েছে"
      : "Payment Failed";

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-8 sm:py-16">
      <Card className="bg-background border border-border/50 rounded-3xl shadow-xl overflow-hidden relative">
        <CardContent className="flex flex-col items-center justify-center text-center p-6 sm:p-10 pt-10">
          {/* Icon */}
          <div
            className={`mb-6 h-16 w-16 rounded-full flex items-center justify-center ${
              isCancelled
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
            }`}
          >
            {isCancelled ? <AlertCircle className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mb-3">
            {title}
          </h1>

          {/* Subtitle / Order details */}
          {orderNumber && (
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {language === "bn" ? `অর্ডার নম্বর: #${orderNumber}` : `Order #${orderNumber}`}
            </p>
          )}

          {/* Highlighted error message box (Checklist 1 & 3) */}
          <div
            className={`w-full rounded-2xl p-4 sm:p-5 mb-6 text-left border ${
              isCancelled
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-destructive/10 border-destructive/30 text-destructive-foreground dark:text-red-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`h-5 w-5 mt-0.5 shrink-0 ${
                  isCancelled ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                }`}
              />
              <div className="flex-1 text-sm leading-relaxed">
                <span className="font-semibold block mb-0.5">
                  {language === "bn" ? "বিকাশ রেসপন্স বার্তা:" : "bKash Reason (errorMessageEn):"}
                </span>
                <span className="break-words font-medium">{displayMessage}</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            {language === "bn"
              ? "আপনার টাকা কাটা হয়নি। আপনি আবার চেকআউট থেকে পেমেন্ট সম্পন্ন করতে পারেন অথবা ক্যাশ অন ডেলিভারি বেছে নিতে পারেন।"
              : "No money was deducted from your account. You can retry paying via bKash or choose another payment method at checkout."}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row w-full gap-3 mb-6">
            <Link href="/checkout" className="flex-1">
              <Button className="w-full h-11 rounded-full font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                <RefreshCw className="h-4 w-4 mr-2" />
                {language === "bn" ? "পুনরায় চেষ্টা করুন" : "Try Again at Checkout"}
              </Button>
            </Link>

            {footerPhone && (
              <a href={`tel:${footerPhone}`} className="flex-1">
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-full font-bold text-sm border-border/60 hover:bg-muted/40"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {language === "bn" ? "সাহায্যের জন্য কল করুন" : "Call for Help"}
                </Button>
              </a>
            )}
          </div>

          {/* Back to Home */}
          <div className="w-full border-t border-border/40 pt-6">
            <Link
              href="/"
              className="text-sm font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "bn" ? "হোম পেজে ফিরে যান" : `Back to ${siteName || "Store"}`}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mx-auto" />
        </div>
      }
    >
      <PaymentFailureContent />
    </Suspense>
  );
}
