"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettings, useUpdateSettings } from "@/features/settings/api/use-settings";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { HeroSlidesManager } from "./hero-slides-manager";
import { PromoBannersManager } from "./promo-banners-manager";

const websiteSchema = z.object({
  site_name: z.string().optional(),
  logo_url: z.string().optional(),
  hero_title: z.string().optional(),
  hero_subtitle: z.string().optional(),
  hero_cta_text: z.string().optional(),
  hero_cta_link: z.string().optional(),
  hero_bg_image: z.string().optional(),
  hero_slides: z.string().optional(),
  promo_banners: z.string().optional(),
  feature_1_title: z.string().optional(),
  feature_1_desc: z.string().optional(),
  feature_2_title: z.string().optional(),
  feature_2_desc: z.string().optional(),
  feature_3_title: z.string().optional(),
  feature_3_desc: z.string().optional(),
  feature_4_title: z.string().optional(),
  feature_4_desc: z.string().optional(),
  newsletter_title: z.string().optional(),
  newsletter_subtitle: z.string().optional(),
  footer_brand_desc: z.string().optional(),
  footer_email: z.string().optional(),
  footer_phone: z.string().optional(),
  footer_address: z.string().optional(),
  footer_address_link: z.string().optional(),
  social_facebook: z.string().optional(),
  social_instagram: z.string().optional(),
  social_twitter: z.string().optional(),
  social_youtube: z.string().optional(),
  social_tiktok: z.string().optional(),
  footer_copyright: z.string().optional(),
});

type WebsiteFormValues = z.infer<typeof websiteSchema>;

const FIELD_LABELS: Record<keyof WebsiteFormValues, string> = {
  site_name: "Site Name",
  logo_url: "Logo URL",
  hero_title: "Title",
  hero_subtitle: "Subtitle",
  hero_cta_text: "CTA Button Text",
  hero_cta_link: "CTA Button Link",
  hero_bg_image: "Background Image URL",
  hero_slides: "Hero Slides",
  promo_banners: "Promo Banners",
  feature_1_title: "Feature 1 Title",
  feature_1_desc: "Feature 1 Description",
  feature_2_title: "Feature 2 Title",
  feature_2_desc: "Feature 2 Description",
  feature_3_title: "Feature 3 Title",
  feature_3_desc: "Feature 3 Description",
  feature_4_title: "Feature 4 Title",
  feature_4_desc: "Feature 4 Description",
  newsletter_title: "Title",
  newsletter_subtitle: "Subtitle",
  footer_brand_desc: "Brand Description",
  footer_email: "Email",
  footer_phone: "Phone",
  footer_address: "Address",
  footer_address_link: "Address Map Link",
  social_facebook: "Facebook URL",
  social_instagram: "Instagram URL",
  social_twitter: "Twitter URL",
  social_youtube: "YouTube URL",
  social_tiktok: "TikTok URL",
  footer_copyright: "Copyright Text",
};

const SECTION_FIELDS = {
  header: ["site_name", "logo_url"],
  hero: ["hero_slides"],
  promo: ["promo_banners"],
  features: [
    "feature_1_title", "feature_1_desc",
    "feature_2_title", "feature_2_desc",
    "feature_3_title", "feature_3_desc",
    "feature_4_title", "feature_4_desc",
  ],
  newsletter: ["newsletter_title", "newsletter_subtitle"],
  footer: [
    "footer_brand_desc", "footer_email", "footer_phone", "footer_address", "footer_address_link",
    "social_facebook", "social_instagram", "social_twitter", "social_youtube", "social_tiktok",
    "footer_copyright",
  ],
} as const satisfies Record<string, (keyof WebsiteFormValues)[]>;

type SectionKey = keyof typeof SECTION_FIELDS;

function SaveSectionButton({
  form,
  section,
}: {
  form: ReturnType<typeof useForm<WebsiteFormValues>>;
  section: SectionKey;
}) {
  const { mutate, isPending } = useUpdateSettings();

  const handleSave = async () => {
    const fields = SECTION_FIELDS[section];
    const valid = await form.trigger(fields);
    if (!valid) return;
    const values = form.getValues();
    const payload = Object.fromEntries(fields.map((f) => [f, values[f]]));
    mutate(payload);
  };

  return (
    <div className="flex justify-end">
      <Button type="button" onClick={handleSave} disabled={isPending} className="gap-2 rounded-full text-xs font-semibold">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

export function WebsiteForm() {
  const { data: settings, isLoading } = useSettings();

  const form = useForm<WebsiteFormValues>({
    resolver: zodResolver(websiteSchema),
    defaultValues: {
      site_name: "", logo_url: "",
      hero_title: "", hero_subtitle: "", hero_cta_text: "", hero_cta_link: "", hero_bg_image: "", hero_slides: "", promo_banners: "",
      feature_1_title: "", feature_1_desc: "",
      feature_2_title: "", feature_2_desc: "",
      feature_3_title: "", feature_3_desc: "",
      feature_4_title: "", feature_4_desc: "",
      newsletter_title: "", newsletter_subtitle: "",
      footer_brand_desc: "", footer_email: "", footer_phone: "", footer_address: "", footer_address_link: "",
      social_facebook: "", social_instagram: "", social_twitter: "", social_youtube: "", social_tiktok: "",
      footer_copyright: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        site_name: settings.site_name || "",
        logo_url: settings.logo_url || "",
        hero_title: settings.hero_title || "",
        hero_subtitle: settings.hero_subtitle || "",
        hero_cta_text: settings.hero_cta_text || "",
        hero_cta_link: settings.hero_cta_link || "",
        hero_bg_image: settings.hero_bg_image || "",
        hero_slides: settings.hero_slides || "",
        promo_banners: settings.promo_banners || "",
        feature_1_title: settings.feature_1_title || "",
        feature_1_desc: settings.feature_1_desc || "",
        feature_2_title: settings.feature_2_title || "",
        feature_2_desc: settings.feature_2_desc || "",
        feature_3_title: settings.feature_3_title || "",
        feature_3_desc: settings.feature_3_desc || "",
        feature_4_title: settings.feature_4_title || "",
        feature_4_desc: settings.feature_4_desc || "",
        newsletter_title: settings.newsletter_title || "",
        newsletter_subtitle: settings.newsletter_subtitle || "",
        footer_brand_desc: settings.footer_brand_desc || "",
        footer_email: settings.footer_email || "",
        footer_phone: settings.footer_phone || "",
        footer_address: settings.footer_address || "",
        footer_address_link: settings.footer_address_link || "",
        social_facebook: settings.social_facebook || "",
        social_instagram: settings.social_instagram || "",
        social_twitter: settings.social_twitter || "",
        social_youtube: settings.social_youtube || "",
        social_tiktok: settings.social_tiktok || "",
        footer_copyright: settings.footer_copyright || "",
      });
    }
  }, [settings, form]);

  if (isLoading) {
    return (
      <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6 animate-in fade-in duration-300">
        <Tabs defaultValue="header" className="w-full">
          <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1">
            <TabsList className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full border-none shadow-none">
              <TabsTrigger
                value="header"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Header
              </TabsTrigger>
              <TabsTrigger
                value="hero"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Hero Slides
              </TabsTrigger>
              <TabsTrigger
                value="promo"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Promo Banners
              </TabsTrigger>
              <TabsTrigger
                value="features"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Features
              </TabsTrigger>
              <TabsTrigger
                value="newsletter"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Newsletter
              </TabsTrigger>
              <TabsTrigger
                value="footer"
                className="shrink-0 rounded-full px-4 h-8 text-xs font-semibold capitalize cursor-pointer transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 data-active:!bg-white data-active:!text-slate-900 data-active:shadow-xs data-[state=active]:!bg-white data-[state=active]:!text-slate-900 dark:data-active:!bg-slate-900 dark:data-active:!text-slate-100 border-none"
              >
                Footer
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="header" className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Header Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Site name and logo displayed in the navigation bar.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="site_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.site_name}</FormLabel>
                    <FormControl><Input placeholder="Sleep Sheet" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="logo_url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.logo_url}</FormLabel>
                    <FormControl><Input placeholder="/logo.png" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
            <SaveSectionButton form={form} section="header" />
          </TabsContent>

          <TabsContent value="hero" className="space-y-6">
            <HeroSlidesManager />
            <SaveSectionButton form={form} section="hero" />
          </TabsContent>

          <TabsContent value="promo" className="space-y-6">
            <PromoBannersManager />
            <SaveSectionButton form={form} section="promo" />
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-6">
              <div>
                <h2 className="text-base font-bold tracking-tight">Stats / Features</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Feature cards shown below the hero section.</p>
              </div>
              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    {i > 1 && <Separator className="mb-6" />}
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Feature {i}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name={`feature_${i}_title` as keyof WebsiteFormValues} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{FIELD_LABELS[`feature_${i}_title` as keyof WebsiteFormValues]}</FormLabel>
                          <FormControl><Input placeholder="Payment only online" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`feature_${i}_desc` as keyof WebsiteFormValues} render={({ field }) => (
                        <FormItem>
                          <FormLabel>{FIELD_LABELS[`feature_${i}_desc` as keyof WebsiteFormValues]}</FormLabel>
                          <FormControl><Input placeholder="Secure & simple checkout" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <SaveSectionButton form={form} section="features" />
          </TabsContent>

          <TabsContent value="newsletter" className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Newsletter</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Subscription section text on the homepage.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="newsletter_title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.newsletter_title}</FormLabel>
                    <FormControl><Input placeholder="Join the inner circle" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="newsletter_subtitle" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.newsletter_subtitle}</FormLabel>
                    <FormControl><Input placeholder="Subscribe for early access..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
            <SaveSectionButton form={form} section="newsletter" />
          </TabsContent>

          <TabsContent value="footer" className="space-y-6">
            <div className="rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none space-y-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">Footer</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Brand info, contact details, and social links displayed in the footer.</p>
              </div>
              <div className="space-y-4">
                <FormField control={form.control} name="footer_brand_desc" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.footer_brand_desc}</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="Elevating your rest with premium..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="footer_email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.footer_email}</FormLabel>
                      <FormControl><Input placeholder="support@sleepsheet.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="footer_phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.footer_phone}</FormLabel>
                      <FormControl><Input placeholder="+880 1700-000000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="footer_address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.footer_address}</FormLabel>
                      <FormControl><Input placeholder="Hope Market, Mirpur 10, Dhaka 1216" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="footer_address_link" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.footer_address_link}</FormLabel>
                      <FormControl><Input placeholder="https://maps.app.goo.gl/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Separator />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Social Links</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="social_facebook" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.social_facebook}</FormLabel>
                      <FormControl><Input placeholder="https://facebook.com/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="social_instagram" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.social_instagram}</FormLabel>
                      <FormControl><Input placeholder="https://instagram.com/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="social_twitter" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.social_twitter}</FormLabel>
                      <FormControl><Input placeholder="https://twitter.com/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="social_youtube" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.social_youtube}</FormLabel>
                      <FormControl><Input placeholder="https://youtube.com/..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="social_tiktok" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{FIELD_LABELS.social_tiktok}</FormLabel>
                      <FormControl><Input placeholder="https://tiktok.com/@..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Separator />
                <FormField control={form.control} name="footer_copyright" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{FIELD_LABELS.footer_copyright}</FormLabel>
                    <FormControl><Input placeholder="© 2024 SLEEP SHEET. All rights reserved." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>
            <SaveSectionButton form={form} section="footer" />
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
}
