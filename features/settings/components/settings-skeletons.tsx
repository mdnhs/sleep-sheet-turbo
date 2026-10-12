import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SettingsSection } from "@/features/settings/settings-fields";

// Building blocks for the settings pages' loading skeletons. Each mirrors a
// real piece of UI (same container classes, grid and breakpoints) so the page
// doesn't jump when the real content replaces it. The per-page skeletons that
// compose these live in app/(dashboard)/dashboard/settings/settings-page-skeletons.tsx;
// the per-form blocks at the bottom are also what each form renders while its
// settings query loads, so the route skeleton hands over to the real UI with no
// second placeholder in between.

/** The white card every settings section sits in. */
export const SETTINGS_CARD = "rounded-3xl bg-white dark:bg-card p-6 border-none shadow-none";

/** A line of text: `h` is the text height, the line box is a bit taller. */
export function TextLineSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 rounded-md", className)} />;
}

/** Section heading: `h2.text-base` title, optional icon and `text-xs` description lines. */
export function CardHeadingSkeleton({
  titleWidth = "w-40",
  icon = false,
  description = 0,
}: {
  titleWidth?: string;
  icon?: boolean;
  /** Number of description lines below the title. */
  description?: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 py-0.5">
        {icon && <Skeleton className="size-5 shrink-0 rounded-md" />}
        <Skeleton className={cn("h-5 max-w-full rounded-lg", titleWidth)} />
      </div>
      {description > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {Array.from({ length: description }).map((_, i) => (
            <TextLineSkeleton
              key={i}
              className={i === description - 1 && description > 1 ? "w-2/3" : "w-full max-w-md"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A settings section card: heading, then its content. */
export function SettingsCardSkeleton({
  titleWidth,
  icon,
  description,
  className,
  children,
}: {
  titleWidth?: string;
  icon?: boolean;
  description?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div aria-hidden className={cn(SETTINGS_CARD, "space-y-4", className)}>
      <CardHeadingSkeleton titleWidth={titleWidth} icon={icon} description={description} />
      {children}
    </div>
  );
}

const CONTROL = {
  // Input / SelectTrigger: h-9 rounded-4xl.
  input: "h-9 rounded-4xl",
  select: "h-9 rounded-4xl",
  // Textarea: field-sizing-content, min-h-16.
  textarea: "h-16 rounded-xl",
} as const;

export type FieldControl = keyof typeof CONTROL;

/** A labelled form field (FormItem: label, control, optional description). */
export function FieldSkeleton({
  control = "input",
  description = false,
  labelWidth = "w-28",
  controlClassName,
  className,
}: {
  control?: FieldControl;
  description?: boolean;
  labelWidth?: string;
  controlClassName?: string;
  /** FormItem is `grid gap-2`; plain Label + Input blocks use `space-y-1.5` (pass "gap-1.5"). */
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Skeleton className={cn("h-3.5 rounded-md", labelWidth)} />
      <Skeleton className={cn("w-full", CONTROL[control], controlClassName)} />
      {description && <TextLineSkeleton className="w-64 max-w-full" />}
    </div>
  );
}

/** The `Switch` primitive (default size). */
export function SwitchSkeleton() {
  return <Skeleton className="h-[18.4px] w-8 shrink-0 rounded-full" />;
}

/** A bordered option row: name + one-line hint on the left, a control on the right. */
export function OptionRowSkeleton({
  nameWidth = "w-32",
  hintWidth = "w-48",
  trailing = <SwitchSkeleton />,
  className,
}: {
  nameWidth?: string;
  hintWidth?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-lg border px-4 py-3", className)}>
      <div className="flex min-w-0 flex-col gap-1.5 py-0.5">
        <Skeleton className={cn("h-3.5 max-w-full rounded-md", nameWidth)} />
        <TextLineSkeleton className={cn("max-w-full", hintWidth)} />
      </div>
      {trailing}
    </div>
  );
}

/** A default-size Button (h-9). Most settings buttons are `rounded-full`. */
export function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-9 w-28 shrink-0 rounded-full", className)} />;
}

/** The right-aligned save button below a form. */
export function SaveRowSkeleton({ className, buttonClassName }: { className?: string; buttonClassName?: string }) {
  return (
    <div aria-hidden className={cn("flex justify-end", className)}>
      <ButtonSkeleton className={buttonClassName} />
    </div>
  );
}

/** The page-level action row (e.g. "New Key", "Create Role") above a list. */
export function ActionRowSkeleton({ buttonClassName }: { buttonClassName?: string }) {
  return (
    <div aria-hidden className="flex items-center justify-end gap-4">
      <ButtonSkeleton className={cn("w-32", buttonClassName)} />
    </div>
  );
}

/** "Add" row under an editable list: input + button. */
export function AddRowSkeleton({ buttonClassName }: { buttonClassName?: string }) {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-9 flex-1 rounded-xl" />
      <Skeleton className={cn("h-9 w-20 shrink-0 rounded-xl", buttonClassName)} />
    </div>
  );
}

/** The muted help box (`rounded-md bg-muted/50 p-3`) with a bold first line. */
export function InfoBoxSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2 rounded-md bg-muted/50 p-3">
      <TextLineSkeleton className="w-48 max-w-full" />
      {Array.from({ length: lines }).map((_, i) => (
        <TextLineSkeleton key={i} className={i === lines - 1 ? "w-3/4" : "w-full"} />
      ))}
    </div>
  );
}

/** A TabsList of pills: pass the list's own classes and one width per tab. */
export function TabsListSkeleton({
  className,
  pillClassName,
  widths,
}: {
  className?: string;
  pillClassName?: string;
  widths: string[];
}) {
  return (
    <div aria-hidden className={className}>
      {widths.map((width, i) => (
        <Skeleton key={i} className={cn("shrink-0", pillClassName, width)} />
      ))}
    </div>
  );
}

/**
 * SettingsFieldsForm (features/settings/components/settings-fields-form.tsx),
 * driven by the same section list so the card and field counts always match.
 */
export function SettingsFieldsFormSkeleton({ sections }: { sections: SettingsSection[] }) {
  return (
    <div aria-hidden className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="rounded-3xl bg-white dark:bg-card p-6 space-y-4">
          <CardHeadingSkeleton titleWidth="w-28" description={section.description ? 1 : 0} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <FieldSkeleton
                key={field.key}
                control={field.options ? "select" : field.multiline ? "textarea" : "input"}
                description={!field.options && !field.required && !!field.placeholder}
                className={field.multiline ? "md:col-span-2" : undefined}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <ButtonSkeleton className="w-36" />
      </div>
    </div>
  );
}

/* ------------- per-form blocks (page skeleton + form loading state) ------------- */

/** PaymentsForm: the Card and COD option rows (inside the "Checkout Payment Methods" card). */
export function PaymentsFormSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <OptionRowSkeleton nameWidth="w-36" hintWidth="w-full max-w-md" />
      <OptionRowSkeleton nameWidth="w-32" hintWidth="w-36" />
    </div>
  );
}

/** BkashForm: enable row, then the credentials panel (inside the "bKash Payment Gateway" card). */
export function BkashFormSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <OptionRowSkeleton nameWidth="w-14" hintWidth="w-72" />
      <div className="rounded-lg border p-4 space-y-4">
        <div className="space-y-2">
          <TextLineSkeleton className="w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
          <TextLineSkeleton className="w-full max-w-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {["w-16", "w-20", "w-20", "w-16"].map((width, i) => (
            <FieldSkeleton key={i} labelWidth={width} className="gap-1.5" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonSkeleton className="w-32" />
          <ButtonSkeleton className="w-40" />
        </div>
        <InfoBoxSkeleton lines={2} />
      </div>
    </div>
  );
}

/** PosPaymentMethods: Cash (fixed), Card and Due toggles, custom methods, add row. */
export function PosPaymentMethodsSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <OptionRowSkeleton nameWidth="w-28" hintWidth="w-36" trailing={<TextLineSkeleton className="w-12 shrink-0" />} />
      <OptionRowSkeleton nameWidth="w-32" hintWidth="w-36" />
      <OptionRowSkeleton nameWidth="w-10" hintWidth="w-40" />
      <AddRowSkeleton />
    </div>
  );
}

/** PosFacebookPages: default-page picker, page rows, add row. */
export function PosFacebookPagesSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-muted/40 border border-slate-100 dark:border-border">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-44 rounded-md" />
          <TextLineSkeleton className="w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-[220px] rounded-xl" />
      </div>
      <div className="space-y-2.5">
        {["w-28", "w-36"].map((width, i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border px-4 py-3">
            <Skeleton className={cn("h-4 rounded-md", width)} />
            <div className="flex items-center gap-1">
              {i > 0 && <Skeleton className="h-8 w-24 rounded-full" />}
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <AddRowSkeleton buttonClassName="w-28" />
    </div>
  );
}

/** CurrencyForm: currency select and save row (inside the "Store Currency" card). */
export function CurrencyFormSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <FieldSkeleton control="select" />
      <SaveRowSkeleton className="pt-2" />
    </div>
  );
}

/** ShippingForm: inside / outside Dhaka fields and save row (inside the "Shipping Costs" card). */
export function ShippingFormSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <FieldSkeleton labelWidth="w-24" />
      <FieldSkeleton labelWidth="w-28" />
      <SaveRowSkeleton className="pt-2" buttonClassName="w-32" />
    </div>
  );
}

/** A credentials card (CourierForm, BdCourierForm, …): heading, fields, left-aligned save button. */
export function CredentialsCardSkeleton({
  titleWidth,
  description = 1,
  children,
}: {
  titleWidth: string;
  description?: number;
  children: React.ReactNode;
}) {
  return (
    <SettingsCardSkeleton titleWidth={titleWidth} description={description}>
      <div className="space-y-4">
        {children}
        <ButtonSkeleton className="w-32" />
      </div>
    </SettingsCardSkeleton>
  );
}

/** CourierForm (Steadfast): API key + secret key. */
export function CourierFormSkeleton() {
  return (
    <CredentialsCardSkeleton titleWidth="w-40">
      <FieldSkeleton labelWidth="w-16" />
      <FieldSkeleton labelWidth="w-20" />
    </CredentialsCardSkeleton>
  );
}

/** BdCourierForm: API key. */
export function BdCourierFormSkeleton() {
  return (
    <CredentialsCardSkeleton titleWidth="w-56">
      <FieldSkeleton labelWidth="w-16" />
    </CredentialsCardSkeleton>
  );
}

/** GoogleSheetsForm: service account email, private key, spreadsheet ID. */
export function GoogleSheetsFormSkeleton() {
  return (
    <CredentialsCardSkeleton titleWidth="w-52">
      <FieldSkeleton labelWidth="w-40" />
      <FieldSkeleton labelWidth="w-48" description />
      <FieldSkeleton labelWidth="w-28" description />
    </CredentialsCardSkeleton>
  );
}

/** CdnForm (Cloudinary): cloud name, API key, API secret. */
export function CdnFormSkeleton() {
  return (
    <CredentialsCardSkeleton titleWidth="w-36">
      <FieldSkeleton labelWidth="w-24" description />
      <FieldSkeleton labelWidth="w-16" description />
      <FieldSkeleton labelWidth="w-20" description />
    </CredentialsCardSkeleton>
  );
}

/** SocialManagerForm: "Postiz URL" card with the URL field, buttons and help box. */
export function SocialManagerFormSkeleton() {
  return (
    <SettingsCardSkeleton titleWidth="w-28" description={2}>
      <FieldSkeleton labelWidth="w-36" className="gap-1.5" />
      <div className="flex flex-wrap items-center gap-2">
        <ButtonSkeleton className="w-32" />
      </div>
      <InfoBoxSkeleton lines={2} />
    </SettingsCardSkeleton>
  );
}

/** WebsiteForm: in-page tabs, then the Header tab card and its save row. */
export function WebsiteFormSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div className="flex w-full flex-col gap-2">
        <div className="w-full overflow-hidden pb-1">
          <TabsListSkeleton
            className="inline-flex flex-nowrap items-center h-10 w-max sm:w-fit gap-1 bg-slate-200 dark:bg-card p-1 rounded-full border-none shadow-none"
            pillClassName="h-8 rounded-full bg-white/70 dark:bg-muted"
            widths={["w-[72px]", "w-24", "w-28", "w-20", "w-24", "w-16"]}
          />
        </div>
        <div className="space-y-6">
          <SettingsCardSkeleton titleWidth="w-36" description={1}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-20" />
              <FieldSkeleton labelWidth="w-16" />
            </div>
          </SettingsCardSkeleton>
          <SaveRowSkeleton buttonClassName="w-32" />
        </div>
      </div>
    </div>
  );
}

/** SeoForm (features/seo): in-page tabs, then the General SEO card and its save row. */
export function SeoFormSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <div className="flex w-full flex-col gap-2">
        <TabsListSkeleton
          className="bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl flex flex-wrap h-auto w-fit gap-1 border-none mb-4"
          pillClassName="h-8 rounded-xl bg-white/70 dark:bg-muted"
          widths={["w-32", "w-48", "w-40", "w-32"]}
        />
        <div className={cn(SETTINGS_CARD, "space-y-4")}>
          <div className="flex items-center gap-2 py-0.5">
            <Skeleton className="size-5 shrink-0 rounded-md" />
            <Skeleton className="h-5 w-56 max-w-full rounded-lg" />
          </div>
          <div className="space-y-4">
            <FieldSkeleton labelWidth="w-32" controlClassName="rounded-xl" description />
            <FieldSkeleton labelWidth="w-40" control="textarea" controlClassName="h-20" description />
            <FieldSkeleton labelWidth="w-52" controlClassName="rounded-xl" description />
          </div>
        </div>
      </div>
      <SaveRowSkeleton className="pt-2" buttonClassName="w-40" />
    </div>
  );
}
