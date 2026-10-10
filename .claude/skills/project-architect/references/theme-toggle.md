# Dark/Light Theme Toggle

Client-side theme switching with `next-themes`. Costs nothing server-side — the theme lives in
`localStorage` and a class on `<html>`, so themed pages stay static and CDN-cacheable. Do **not**
store the theme in a cookie read on the server; that opts every page into dynamic rendering.

## Files to generate

### `src/contexts/ThemeProvider.tsx`

```typescript
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### Update `src/app/layout.tsx` — required

`next-themes` writes `class="dark"` onto `<html>` before React hydrates, so the server and client
markup differ by design. Without `suppressHydrationWarning` this logs a hydration error on every
page load:

```tsx
<html lang='en' suppressHydrationWarning>
```

It applies to that element only — it does not hide real hydration bugs deeper in the tree.

### `src/components/layout/theme-toggle.tsx`

> Icon import must match the project's `iconLibrary` in `components.json` (`tabler` →
> `@tabler/icons-react`, `lucide` → `lucide-react`). Check before copying.

```typescript
'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant='ghost'
      size='icon'
      // resolvedTheme, not theme: with enableSystem, theme can be 'system'
      // and the toggle would do nothing on the first click.
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      // `relative` is required — the Moon icon below is absolutely positioned.
      className='relative'
      aria-label='Toggle theme'
    >
      <Sun className='size-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
      <Moon className='absolute size-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
      <span className='sr-only'>Toggle theme</span>
    </Button>
  );
}
```

### Update `src/contexts/ProviderWrapper.tsx`

Make sure `ThemeProvider` is included with these props:

```tsx
<ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
```

`defaultTheme='light'` together with `enableSystem` is contradictory — it ignores the OS preference
until the user touches the toggle. Use `'system'` unless the design deliberately forces light.

### `globals.css` requirement

Ensure the `.dark` block of CSS variables is present (already in core globals.css template).

### Rendering the toggle

The button renders identical markup in both themes (the icons swap via CSS `dark:` classes), so it
needs no `mounted` guard. If you write a variant that renders *different content* per theme — a
label, a different icon component — it must guard on mount or it will mismatch on hydration:

```tsx
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton className='size-9 rounded-md' />;
```

Prefer the CSS-only version: no guard, no layout shift, no extra client state.

## Setup commands to append

```bash
pnpm add next-themes
```
