# Translation — Non-Route

Non-route i18n using `next-intl`. The locale is resolved server-side from a cookie
and does not appear in the URL — no proxy/middleware, no `[locale]` segment. Switching locale
sets the cookie via a Server Action and refreshes the page.

> **Cost trade-off — decide deliberately.** Reading the locale from `cookies()` makes every page
> that renders a translation **dynamic**: no static generation, no CDN caching, a billed function
> invocation on every visit including the marketing pages. That is the price of keeping the locale
> out of the URL.
>
> If the site has public marketing/blog pages, prefer **route-based i18n**
> (`translation-route.md`): each locale gets its own statically generated, CDN-served URL — better
> for SEO and free to serve. Non-route is the right choice only for a fully authenticated app where
> every page is dynamic anyway.
>
> Mixed approach: keep marketing routes untranslated (or route-based) and static, and use the
> cookie only inside the authenticated dashboard.

All translation code lives under `src/lib/translation/` for consistency with the Route variant.

---

## Files to generate

### `src/lib/translation/locale/constants.ts`

```typescript
export const LOCALES = ['en', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'locale' as const;
```

---

### `src/lib/translation/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from './locale/constants';

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

---

### `src/lib/translation/actions.ts`

Server Action for switching locale. Imported directly by `LocaleSwitcher` — no prop-drilling.

```typescript
'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, LOCALES, type Locale } from './locale/constants';

export async function setLocale(locale: Locale) {
  if (!LOCALES.includes(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
```

---

### `next.config.ts` addition

Custom path is required since the file is not at next-intl's default location.

```typescript
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/lib/translation/request.ts');
export default withNextIntl(nextConfig);
```

---

### `src/lib/translation/messages/en.json`

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "loading": "Loading...",
    "error": "Something went wrong",
    "noData": "No data found",
    "confirm": "Confirm"
  },
  "auth": {
    "login": "Login",
    "logout": "Logout",
    "email": "Email",
    "password": "Password",
    "forgotPassword": "Forgot password?"
  },
  "nav": {
    "dashboard": "Dashboard"
  }
}
```

---

### `src/lib/translation/messages/bn.json`

```json
{
  "common": {
    "save": "সংরক্ষণ করুন",
    "cancel": "বাতিল",
    "delete": "মুছুন",
    "edit": "সম্পাদনা করুন",
    "create": "তৈরি করুন",
    "loading": "লোড হচ্ছে...",
    "error": "কিছু একটা ভুল হয়েছে",
    "noData": "কোনো ডেটা পাওয়া যায়নি",
    "confirm": "নিশ্চিত করুন"
  },
  "auth": {
    "login": "লগইন",
    "logout": "লগআউট",
    "email": "ইমেইল",
    "password": "পাসওয়ার্ড",
    "forgotPassword": "পাসওয়ার্ড ভুলে গেছেন?"
  },
  "nav": {
    "dashboard": "ড্যাশবোর্ড"
  }
}
```

---

## App structure

No changes to the Phase 2 folder skeleton — routes stay flat with no `[locale]` segment.

### `src/app/layout.tsx`

Reads locale server-side for `lang` attribute. `NextIntlClientProvider` lives inside
`ProviderWrapper` — layout stays clean.

```typescript
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from 'next-intl/server';
import ProviderWrapper from '@/contexts/ProviderWrapper';
import { inter } from '@/lib/font';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'My App',
  description: 'My App',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <body className='antialiased'>
        <ProviderWrapper>{children}</ProviderWrapper>
      </body>
    </html>
  );
}
```

---

### `src/contexts/ProviderWrapper.tsx` — updated by this feature

`NextIntlClientProvider` is added as the outermost wrapper inside `ProviderWrapper`.

```typescript
'use client';

import { NextIntlClientProvider } from 'next-intl';
import LoadingOverlayProvider from '@/contexts/LoadingOverlayProvider';
import { ReactNode } from 'react';

export default function ProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider>
      <LoadingOverlayProvider>
        {children}
      </LoadingOverlayProvider>
    </NextIntlClientProvider>
  );
}
```

---

### `src/components/layout/locale-switcher.tsx`

Imports `setLocale` directly — no prop-drilling from layout.

```typescript
'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/lib/translation/actions';
import { LOCALES, type Locale } from '@/lib/translation/locale/constants';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  bn: 'বাংলা',
};

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {LOCALES.map((l) => (
        <button
          key={l}
          disabled={isPending}
          onClick={() => switchLocale(l)}
          aria-current={l === locale ? 'true' : undefined}
          className={l === locale ? 'font-bold' : 'opacity-60 hover:opacity-100'}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
```

---

## Usage patterns

### Server Components

```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('common');
  return <button>{t('save')}</button>;
}
```

### Server Components — read locale

```typescript
import { getLocale } from 'next-intl/server';

export default async function Page() {
  const locale = await getLocale();
  return <p>Current locale: {locale}</p>;
}
```

### Client Components

```typescript
'use client';
import { useTranslations } from 'next-intl';

export function MyForm() {
  const t = useTranslations('common');
  return <button>{t('save')}</button>;
}
```

### Client Components — read locale

```typescript
'use client';
import { useLocale } from 'next-intl';

export function MyWidget() {
  const locale = useLocale();
  return <span>{locale}</span>;
}
```

### Server Actions with translations

```typescript
import { getTranslations } from 'next-intl/server';

async function submitAction(data: FormData) {
  'use server';
  const t = await getTranslations('common');
  // use t('error') in returned error messages
}
```

### Adding translations for a new feature

1. Add keys to `src/lib/translation/messages/en.json` and `src/lib/translation/messages/bn.json` under a feature namespace:
   ```json
   { "orders": { "title": "Orders", "createNew": "Create Order" } }
   ```
2. Access via `getTranslations('orders')` in server or `useTranslations('orders')` in client.

---

## Setup commands

```bash
pnpm add next-intl
```
