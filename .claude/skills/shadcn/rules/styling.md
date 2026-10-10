# Styling & Customization

See [customization.md](../customization.md) for theming, CSS variables, and adding custom colors.

## Contents

- Semantic colors
- Built-in variants first
- className for layout only
- No space-x-_ / space-y-_
- Prefer size-_ over w-_ h-\* when equal
- Prefer truncate shorthand
- No manual dark: color overrides
- Use cn() for conditional classes
- No manual z-index on overlay components
- Pointer cursor on interactive elements

---

## Semantic colors

**Incorrect:**

```tsx
<div className='bg-blue-500 text-white'>
  <p className='text-gray-600'>Secondary text</p>
</div>
```

**Correct:**

```tsx
<div className='bg-primary text-primary-foreground'>
  <p className='text-muted-foreground'>Secondary text</p>
</div>
```

---

## No raw color values for status/state indicators

For positive, negative, or status indicators, use Badge variants, semantic tokens like `text-destructive`, or define custom CSS variables — don't reach for raw Tailwind colors.

**Incorrect:**

```tsx
<span className="text-emerald-600">+20.1%</span>
<span className="text-green-500">Active</span>
<span className="text-red-600">-3.2%</span>
```

**Correct:**

```tsx
<Badge variant="secondary">+20.1%</Badge>
<Badge>Active</Badge>
<span className="text-destructive">-3.2%</span>
```

If you need a success/positive color that doesn't exist as a semantic token, use a Badge variant or ask the user about adding a custom CSS variable to the theme (see [customization.md](../customization.md)).

---

## Built-in variants first

**Incorrect:**

```tsx
<Button className='border-input hover:bg-accent border bg-transparent'>Click me</Button>
```

**Correct:**

```tsx
<Button variant='outline'>Click me</Button>
```

---

## className for layout only

Use `className` for layout (e.g. `max-w-md`, `mx-auto`, `mt-4`), **not** for overriding component colors or typography. To change colors, use semantic tokens, built-in variants, or CSS variables.

**Incorrect:**

```tsx
<Card className='bg-blue-100 font-bold text-blue-900'>
  <CardContent>Dashboard</CardContent>
</Card>
```

**Correct:**

```tsx
<Card className='mx-auto max-w-md'>
  <CardContent>Dashboard</CardContent>
</Card>
```

To customize a component's appearance, prefer these approaches in order:

1. **Built-in variants** — `variant="outline"`, `variant="destructive"`, etc.
2. **Semantic color tokens** — `bg-primary`, `text-muted-foreground`.
3. **CSS variables** — define custom colors in the global CSS file (see [customization.md](../customization.md)).

---

## No space-x-_ / space-y-_

Use `gap-*` instead. `space-y-4` → `flex flex-col gap-4`. `space-x-2` → `flex gap-2`.

```tsx
<div className='flex flex-col gap-4'>
  <Input />
  <Input />
  <Button>Submit</Button>
</div>
```

---

## Prefer size-_ over w-_ h-\* when equal

`size-10` not `w-10 h-10`. Applies to icons, avatars, skeletons, etc.

---

## Prefer truncate shorthand

`truncate` not `overflow-hidden text-ellipsis whitespace-nowrap`.

---

## No manual dark: color overrides

Use semantic tokens — they handle light/dark via CSS variables. `bg-background text-foreground` not `bg-white dark:bg-gray-950`.

---

## Use cn() for conditional classes

Use the `cn()` utility from the project for conditional or merged class names. Don't write manual ternaries in className strings.

**Incorrect:**

```tsx
<div className={`flex items-center ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
```

**Correct:**

```tsx
import { cn } from "@/lib/utils"

<div className={cn("flex items-center", isActive ? "bg-primary text-primary-foreground" : "bg-muted")}>
```

---

## No manual z-index on overlay components

`Dialog`, `Sheet`, `Drawer`, `AlertDialog`, `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard` handle their own stacking. Never add `z-50` or `z-[999]`.

---

## Pointer cursor on interactive elements

Tailwind v4 removed the browser default `cursor: pointer` on `<button>`. shadcn handles this with
the `--pointer` init flag (`"pointer": true` in `components.json`), which bakes `cursor-pointer`
into the generated components. Fix it at the source, not at the call site.

**Incorrect** — patching each usage:

```tsx
<Button className='cursor-pointer'>Save</Button>
<DropdownMenuItem className='cursor-pointer'>Edit</DropdownMenuItem>
```

**Correct** — the component already carries it:

```tsx
<Button>Save</Button>
<DropdownMenuItem>Edit</DropdownMenuItem>
```

```bash
# new project
npx shadcn@latest init --pointer
```

Existing project without it: add `"pointer": true` to `components.json`, then add `cursor-pointer`
to the base class of `buttonVariants` in `components/ui/button.tsx` and to the other interactive
primitives (dropdown/select/tabs triggers and items, checkbox, switch, radio, accordion trigger,
command items, pagination links, sidebar menu buttons). Full steps in [cli.md](../cli.md).

`cursor-pointer` in a `className` is acceptable only for a genuinely custom clickable element that
is not a shadcn primitive — a clickable card or table row, say. Those also need `role="button"` and
keyboard handling.
