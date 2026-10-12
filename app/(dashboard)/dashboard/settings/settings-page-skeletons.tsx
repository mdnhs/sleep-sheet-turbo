import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PageTitle } from "@/components/dashboard-page-title";
import { BUSINESS_RULE_SECTIONS, STORE_PROFILE_SECTIONS } from "@/features/settings/settings-fields";
import {
  BdCourierFormSkeleton,
  BkashFormSkeleton,
  CdnFormSkeleton,
  CourierFormSkeleton,
  CurrencyFormSkeleton,
  GoogleSheetsFormSkeleton,
  PaymentsFormSkeleton,
  PosFacebookPagesSkeleton,
  PosPaymentMethodsSkeleton,
  SeoFormSkeleton,
  SETTINGS_CARD,
  SettingsCardSkeleton,
  SettingsFieldsFormSkeleton,
  ShippingFormSkeleton,
  SocialManagerFormSkeleton,
  TabsListSkeleton,
  TextLineSkeleton,
  WebsiteFormSkeleton,
} from "@/features/settings/components/settings-skeletons";
import { ActionRowSkeleton, ApiKeysTableSkeleton, RoleCardSkeleton, RoleCardsSkeleton } from "./settings-skeletons";

// One loading skeleton per settings page, rendered by that page's loading.tsx.
// They fill SettingsShell's `{children}` slot (the shell draws both nav levels
// and the padding), so they start at the page's own root wrapper. Titles are
// not drawn: <PageTitle> puts the page's real title in the navbar instead, so
// the strings here must match the ones the page passes.

/* ------------------------------- Store ------------------------------- */

// store/store-client.tsx → SettingsFieldsForm(STORE_PROFILE_SECTIONS)
export function StoreSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Store Profile" description="Legal and registration details, location and locale. Name, logo, contact details and social links are on the Website page." />
      <SettingsFieldsFormSkeleton sections={STORE_PROFILE_SECTIONS} />
    </div>
  );
}

// business/business-client.tsx → SettingsFieldsForm(BUSINESS_RULE_SECTIONS)
export function BusinessSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Business Rules" description="Order numbering, invoices and stock alerts" />
      <SettingsFieldsFormSkeleton sections={BUSINESS_RULE_SECTIONS} />
    </div>
  );
}

// pos/pos-settings-client.tsx → PosFacebookPages + PosPaymentMethods cards
export function PosSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="POS Settings" description="Configure Facebook page sales channels, default page selection, and POS payment methods" />

      <div className="space-y-6">
        <SettingsCardSkeleton icon titleWidth="w-60" description={2}>
          <PosFacebookPagesSkeleton />
        </SettingsCardSkeleton>

        <SettingsCardSkeleton icon titleWidth="w-48" description={1}>
          <PosPaymentMethodsSkeleton />
        </SettingsCardSkeleton>
      </div>
    </div>
  );
}

// currency/currency-client.tsx → "Store Currency" card with CurrencyForm
export function CurrencySettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Currency" description="Applied across all prices, orders, and receipts" />
      <SettingsCardSkeleton titleWidth="w-32">
        <CurrencyFormSkeleton />
      </SettingsCardSkeleton>
    </div>
  );
}

// payments/payments-client.tsx → PaymentsForm, BkashForm, PosPaymentMethods cards
export function PaymentsSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Payment Methods" description="Enable or disable payment options at checkout and point of sale" />

      <div className="space-y-6">
        <SettingsCardSkeleton titleWidth="w-52">
          <PaymentsFormSkeleton />
        </SettingsCardSkeleton>

        <SettingsCardSkeleton titleWidth="w-48" description={1}>
          <BkashFormSkeleton />
        </SettingsCardSkeleton>

        <SettingsCardSkeleton icon titleWidth="w-48" description={1}>
          <PosPaymentMethodsSkeleton />
        </SettingsCardSkeleton>
      </div>
    </div>
  );
}

// shipping/shipping-client.tsx → ShippingForm card, CourierForm, BdCourierForm, GoogleSheetsForm
export function ShippingSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Shipping & Courier" description="Configure shipping costs and courier API credentials" />
      <div className="space-y-6">
        <SettingsCardSkeleton titleWidth="w-36">
          <ShippingFormSkeleton />
        </SettingsCardSkeleton>

        <CourierFormSkeleton />
        <BdCourierFormSkeleton />
        <GoogleSheetsFormSkeleton />
      </div>
    </div>
  );
}

// seo/seo-client.tsx → SeoForm: in-page tabs, then the General SEO card
export function SeoSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="SEO Settings" description="Manage search engine optimization, social sharing, and crawler settings" />
      <SeoFormSkeleton />
    </div>
  );
}

// catalog/catalog-client.tsx → Feed URLs card + Preview card
export function CatalogSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Meta Catalog" description="Product feed for Facebook / Meta Commerce Catalog" />

      <div className="space-y-6">
        <SettingsCardSkeleton titleWidth="w-24">
          <div className="space-y-3">
            {["w-56", "w-52", "w-56"].map((width, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-muted/30 px-4 py-3"
              >
                <Skeleton className="h-5 w-11 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Skeleton className={cn("h-4 max-w-full rounded-md", width)} />
                </div>
                <Skeleton className="size-8 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </SettingsCardSkeleton>

        <div aria-hidden className={cn(SETTINGS_CARD, "space-y-4")}>
          <div className="flex items-center justify-between">
            <Skeleton className="my-0.5 h-5 w-20 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <div className="flex flex-col gap-2">
            <TabsListSkeleton
              className="flex flex-nowrap items-center h-9 w-fit gap-1 bg-slate-100 dark:bg-muted/40 p-1 rounded-full mb-4"
              pillClassName="h-7 rounded-full bg-white/70 dark:bg-muted"
              widths={["w-14", "w-14", "w-16"]}
            />
            <div className="flex items-center justify-center rounded-2xl border border-dashed py-12">
              <TextLineSkeleton className="my-0.5 w-64 max-w-[80%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// social/social-client.tsx → SocialManagerForm
export function SocialSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Social Manager" description="Link the self-hosted social media scheduler (Postiz) so the Social entry in the sidebar opens it" />
      <SocialManagerFormSkeleton />
    </div>
  );
}

// website/website-client.tsx → WebsiteForm: in-page tabs, then the Header tab
export function WebsiteSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Website Settings" description="Configure homepage hero, features, newsletter, footer, and site-wide content" />
      <WebsiteFormSkeleton />
    </div>
  );
}

// cdn/cdn-client.tsx → CdnForm
export function CdnSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="CDN Settings" description="Manage Cloudinary API credentials for image uploads and storage" />
      <CdnFormSkeleton />
    </div>
  );
}

// roles/roles-client.tsx → "Create Role" row, Administrator card + role cards
export function RolesSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle title="Roles & Permissions" description="Choose which menus and tabs each role opens, and what it can change there" />
      <ActionRowSkeleton />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <RoleCardSkeleton actions={false} badges={1} />
        <RoleCardsSkeleton />
      </div>
    </div>
  );
}

// api-keys/api-keys-client.tsx → "New Key" row, DataTable card
export function ApiKeysSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageTitle
        title="API Keys"
        description="Server-to-server credentials — for the MCP server, scripts, or other integrations. A key acts as its creator, with the same role and permissions."
      />
      <ActionRowSkeleton buttonClassName="w-28" />
      <div className={cn(SETTINGS_CARD, "space-y-4")}>
        <ApiKeysTableSkeleton />
      </div>
    </div>
  );
}
