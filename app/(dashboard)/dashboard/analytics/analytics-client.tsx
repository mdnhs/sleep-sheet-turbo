"use client";

import { useState } from "react";
import { useSettings } from "@/features/settings/api/use-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconBrandGoogleAnalytics,
  IconExternalLink,
  IconChartBar,
  IconShoppingCart,
  IconEye,
  IconCreditCard,
  IconTrendingUp,
  IconAlertCircle,
  IconCheck,
  IconBolt,
  IconArrowRight,
  IconDeviceAnalytics,
  IconUsers,
  IconSparkles,
} from "@tabler/icons-react";

export default function AnalyticsClient() {
  const { data: settings } = useSettings();

  const ga4PropertyId = settings?.ga4_property_id?.trim() || "546802046";
  const ga4MeasurementId =
    settings?.google_analytics_id?.trim() || "G-Y62ZKHQGLV";
  const gtmWebId = settings?.gtm_web_id?.trim() || "GTM-PQ667JWQ";

  // Deep links into official Google Analytics 4 Property
  const ga4BaseUrl = `https://analytics.google.com/analytics/web/#/p${ga4PropertyId}`;
  const ga4RealtimeUrl = `${ga4BaseUrl}/realtime/overview`;
  const ga4MonetizationUrl = `${ga4BaseUrl}/reports/dashboard?params=_u..nav%3Ddefault&r=lifecycle-monetization-overview`;
  const ga4FunnelUrl = `${ga4BaseUrl}/reports/explorer`;
  const ga4TrafficUrl = `${ga4BaseUrl}/reports/dashboard?params=_u..nav%3Ddefault&r=lifecycle-traffic-acquisition`;

  // Looker Studio Embed URL stored client-side in localStorage (0% server/DB
  // load). Read once via a lazy initializer rather than a mount effect that
  // calls setState — this dashboard page has no SSR-sensitive content this
  // value affects, and reading it during the initial render (instead of
  // after, in an effect) avoids the extra cascading re-render the previous
  // effect-based version caused on every mount.
  const readStoredEmbedUrl = () =>
    typeof window !== "undefined"
      ? (localStorage.getItem("ga4_looker_studio_embed_url") ?? "")
      : "";
  const [embedUrl, setEmbedUrl] = useState<string>(readStoredEmbedUrl);
  const [inputUrl, setInputUrl] = useState<string>(readStoredEmbedUrl);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const handleSaveEmbed = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ga4_looker_studio_embed_url", inputUrl.trim());
      setEmbedUrl(inputUrl.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <IconBrandGoogleAnalytics className="h-6 w-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Google Analytics & Sales Intelligence
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            GA4 E-Commerce Conversion Funnel, Channel Attribution & Marketing
            Insights —{" "}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              100% Zero Database Load
            </span>
          </p>
        </div>

        {/* System & Property Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium"
          >
            <IconBolt className="w-3.5 h-3.5 mr-1" /> 0% DB Overhead
          </Badge>
          <Badge
            variant="outline"
            className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 font-mono text-xs"
          >
            GA4: {ga4MeasurementId}
          </Badge>
          <Badge
            variant="outline"
            className="px-3 py-1 bg-slate-500/10 text-slate-600 dark:text-slate-400 border-border text-xs font-mono"
          >
            GTM: {gtmWebId}
          </Badge>
        </div>
      </div>

      {/* Quick Launch Cards (Direct Deep-Links to GA4) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <IconDeviceAnalytics className="w-4 h-4 text-indigo-500" />
            Official Google Analytics 4 Direct Launch Hub
          </h2>
          <span className="text-xs text-muted-foreground">
            Property ID: #{ga4PropertyId}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Realtime Traffic */}
          <Card className="hover:border-indigo-500/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <IconUsers className="h-5 w-5" />
                </span>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <CardTitle className="text-base mt-2">Realtime Traffic</CardTitle>
              <CardDescription className="text-xs">
                Live visitors browsing products right now
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs group"
                onClick={() => window.open(ga4RealtimeUrl, "_blank")}
              >
                <span>View Realtime</span>
                <IconExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: E-Commerce & Monetization */}
          <Card className="hover:border-indigo-500/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <IconTrendingUp className="h-5 w-5" />
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold"
                >
                  Revenue
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">
                Monetization & Sales
              </CardTitle>
              <CardDescription className="text-xs">
                Revenue, item sales, and purchase conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs group"
                onClick={() => window.open(ga4MonetizationUrl, "_blank")}
              >
                <span>Open Monetization</span>
                <IconExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Purchase Journey Funnel */}
          <Card className="hover:border-indigo-500/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <IconShoppingCart className="h-5 w-5" />
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold"
                >
                  Funnel
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">Purchase Journey</CardTitle>
              <CardDescription className="text-xs">
                View ➔ Cart ➔ Checkout drop-off rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs group"
                onClick={() => window.open(ga4FunnelUrl, "_blank")}
              >
                <span>Explore Funnel</span>
                <IconExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>

          {/* Card 4: Traffic Channels */}
          <Card className="hover:border-indigo-500/50 transition-all hover:shadow-md bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <IconChartBar className="h-5 w-5" />
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-semibold"
                >
                  Ads vs Organic
                </Badge>
              </div>
              <CardTitle className="text-base mt-2">
                Traffic Acquisition
              </CardTitle>
              <CardDescription className="text-xs">
                Facebook Ads, Google Search, Direct & Social
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs group"
                onClick={() => window.open(ga4TrafficUrl, "_blank")}
              >
                <span>View Acquisition</span>
                <IconExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="funnel" className="text-xs md:text-sm">
            E-Commerce Funnel & Sales Strategy
          </TabsTrigger>
          <TabsTrigger value="attribution" className="text-xs md:text-sm">
            Marketing Channels & Ads ROI
          </TabsTrigger>
          <TabsTrigger value="looker" className="text-xs md:text-sm">
            Live Google Looker Studio Embed
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: E-Commerce Funnel & Actionable Sales Planning */}
        <TabsContent value="funnel" className="space-y-5">
          {/* Visual Step-by-Step Funnel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IconSparkles className="w-5 h-5 text-indigo-500" />
                Sleep Sheet E-Commerce Purchase Funnel
              </CardTitle>
              <CardDescription>
                How visitors transition from discovering your comforters to
                completing their orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {/* Step 1: View Item */}
                <div className="p-4 rounded-xl border bg-card/60 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Step 1
                      </span>
                      <IconEye className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-lg font-bold">Product View</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      event: view_item
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Shoppers viewing single comforter sets & luxury bedsheet
                      product details.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t text-xs font-semibold text-blue-600 dark:text-blue-400">
                    100% of product traffic
                  </div>
                </div>

                {/* Step 2: Add To Cart */}
                <div className="p-4 rounded-xl border bg-card/60 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Step 2
                      </span>
                      <IconShoppingCart className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-lg font-bold">Add to Cart</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      event: add_to_cart
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Shoppers selecting size/color variants and clicking
                      &quot;কার্ট এ যোগ করুন&quot;.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>Benchmark: 8% - 15%</span>
                  </div>
                </div>

                {/* Step 3: Begin Checkout */}
                <div className="p-4 rounded-xl border bg-card/60 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Step 3
                      </span>
                      <IconCreditCard className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-lg font-bold">Initiate Checkout</div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      event: begin_checkout
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Shoppers landing on the checkout form to provide delivery
                      address & phone.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                    <span>Benchmark: 60% - 75% of Cart</span>
                  </div>
                </div>

                {/* Step 4: Purchase */}
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Final Goal
                      </span>
                      <IconCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      Purchase Order
                    </div>
                    <div className="text-xs font-mono text-emerald-600/80 mt-0.5">
                      event: purchase
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Order successfully placed via Cash on Delivery or Card
                      payment.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Industry Target: 2.5% - 4.5%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tactical Sales Planning Advice Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border-l-4 border-l-amber-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <IconAlertCircle className="w-4 h-4 text-amber-500" />
                  Cart Abandonment Recovery
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">লক্ষণ:</strong> কাস্টমার
                  কার্টে প্রোডাক্ট যোগ করে কিন্তু চেকআউটে যায় না।
                </p>
                <p>
                  <strong className="text-foreground">অ্যাকশন প্ল্যান:</strong>{" "}
                  কার্ট ড্রয়ারে ডেলিভারি চার্জ পরিষ্কারভাবে প্রদর্শন করুন এবং
                  &quot;ঢাকার ভিতরে ১ দিনে ডেলিভারি&quot; হাইলাইট করুন।
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <IconTrendingUp className="w-4 h-4 text-blue-500" />
                  Average Order Value (AOV)
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">লক্ষণ:</strong> শুধু ১টি
                  কম্ফোর্টার বিক্রি হচ্ছে কিন্তু বাস্কেট ভ্যালু বাড়ছে না।
                </p>
                <p>
                  <strong className="text-foreground">অ্যাকশন প্ল্যান:</strong>{" "}
                  চেকআউট পেজে &quot;ম্যাচিং পর্দা বা অতিরিক্ত পিলো কভার&quot;
                  অ্যাড-অন হিসেবে অফার করুন। এতে প্রতি অর্ডারে অতিরিক্ত ৫০০-৮০০
                  টাকা রেভিনিউ যোগ হবে।
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <IconBolt className="w-4 h-4 text-emerald-500" />
                  Meta Purchase Conversion Ad Scale
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">লক্ষণ:</strong> পারচেজ
                  ইভেন্টে ১০০% কারেন্সি (BDT) এবং সঠিক ভ্যালু যাচ্ছে।
                </p>
                <p>
                  <strong className="text-foreground">অ্যাকশন প্ল্যান:</strong>{" "}
                  ফেসবুক অ্যাডম্যানেজারে &quot;Sales / Purchase Conversion&quot;
                  ক্যাম্পেইনে বাজেট বৃদ্ধি করুন। মেটার AI সরাসরি সবচেয়ে বেশি
                  কেনাকাটা করা কাস্টমারদের টার্গেট করবে।
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Marketing Channels & Attribution */}
        <TabsContent value="attribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Channel Attribution Strategy (Bangladesh Market)
              </CardTitle>
              <CardDescription>
                How each traffic source contributes to Sleep Sheet revenue based
                on GA4 acquisition channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border bg-muted/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 text-white hover:bg-blue-600">
                        Facebook / Instagram Ads
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        Paid Social (cpc / meta)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      বাংলাদেশের ই-কমার্স সেলসের ৭০-৮৫% সরাসরি ফেসবুক ও
                      ইনস্টাগ্রাম বিজ্ঞাপন থেকে আসে। মেটা CAPI ও পিক্সেল নিখুঁত
                      থাকায় এই চ্যানেলে আরওআই (ROAS) সর্বোচ্চ পাওয়া সম্ভব।
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs shrink-0"
                    onClick={() => window.open(ga4TrafficUrl, "_blank")}
                  >
                    Inspect in GA4{" "}
                    <IconArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>

                <div className="p-4 rounded-xl border bg-muted/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                        Organic Google Search
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        SEO (organic search)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      &quot;কম্ফোর্টার সেট প্রাইজ ইন বাংলাদেশ&quot;,
                      &quot;বিছানার চাদর অনলাইন শপ&quot; ইত্যাদি কিওয়ার্ড থেকে
                      আসা ভিজিটররা সরাসরি কেনাকাটার উদ্দেশ্য নিয়ে আসে। এর
                      কনভার্সন রেট সবচেয়ে বেশি থাকে।
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs shrink-0"
                    onClick={() => window.open(ga4TrafficUrl, "_blank")}
                  >
                    Inspect in GA4{" "}
                    <IconArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>

                <div className="p-4 rounded-xl border bg-muted/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white hover:bg-purple-600">
                        Direct & WhatsApp Leads
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        Repeat Customers & Referrals
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      সন্তুষ্ট পুরাতন কাস্টমার এবং হোয়াটসঅ্যাপে সরাসরি মেসেজ
                      দিয়ে অর্ডার করা ক্রেতারা। এরা ব্র্যান্ড ভ্যালু ও বিশ্বাসের
                      মাধ্যমে শূন্য অ্যাড খরচে বিক্রি নিয়ে আসে।
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs shrink-0"
                    onClick={() => window.open(ga4TrafficUrl, "_blank")}
                  >
                    Inspect in GA4{" "}
                    <IconArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Looker Studio Embed Option */}
        <TabsContent value="looker" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Google Looker Studio Live Dashboard</span>
                <Badge variant="outline" className="text-xs font-normal">
                  Zero Server Load
                </Badge>
              </CardTitle>
              <CardDescription>
                Google Looker Studio থেকে আপনার GA4 প্রপার্টির একটি ফ্রি
                ইন্টারেক্টিভ রিপোর্ট তৈরি করে এখানে এম্বেড করুন। এটি সম্পূর্ণ
                গুগলের ক্লাউডে চলে এবং আপনার সার্ভারের কোনো রিসোর্স ব্যবহার করে
                না।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Paste Looker Studio embed URL (e.g. https://lookerstudio.google.com/embed/reporting/...)"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="text-xs font-mono"
                />
                <Button
                  onClick={handleSaveEmbed}
                  size="sm"
                  className="shrink-0"
                >
                  {isSaved ? "Saved!" : "Embed Report"}
                </Button>
              </div>

              {embedUrl ? (
                <div className="rounded-xl overflow-hidden border shadow-inner bg-card h-[600px] w-full">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center space-y-3 bg-muted/10">
                  <IconDeviceAnalytics className="w-10 h-10 mx-auto text-muted-foreground/60" />
                  <div className="max-w-md mx-auto">
                    <h3 className="text-sm font-semibold">
                      কোনো Looker Studio রিপোর্ট এম্বেড করা নেই
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      আপনি চাইলে{" "}
                      <a
                        href="https://lookerstudio.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        lookerstudio.google.com
                      </a>{" "}
                      থেকে GA4 কানেক্ট করে সুন্দর রিপোর্ট লিঙ্ক এখানে পেস্ট করতে
                      পারেন। অথবা উপরের{" "}
                      <strong>Official GA4 Direct Launch Hub</strong> বাটনগুলো
                      দিয়ে সরাসরি সব লাইভ ডাটা দেখতে পারেন।
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs mt-2"
                    onClick={() => window.open(ga4RealtimeUrl, "_blank")}
                  >
                    Open Live GA4 Dashboard{" "}
                    <IconExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
