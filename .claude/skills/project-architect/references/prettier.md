# Prettier + Tailwind CSS

Always generated. Configures Prettier with Tailwind CSS class sorting and wires it into
Husky's lint-staged pre-commit hook.

## Files to generate

### `prettier.config.mjs`

> Use `.mjs` with `export default`. A `prettier.config.js` using `module.exports` throws
> `module is not defined` the moment `package.json` has `"type": "module"` — and it is silently
> ignored by some editor integrations. `.mjs` works either way.

```javascript
export default {
  printWidth: 120,
  jsxSingleQuote: true,
  quoteProps: 'as-needed',
  bracketSameLine: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
};
```

### `.prettierignore`

```
node_modules
.next
.vercel
dist
build
public
coverage
pnpm-lock.yaml
src/server/db/migrations
*.min.js
```

Generated migration SQL is excluded on purpose: reformatting it produces noisy diffs on files that
must stay byte-identical to what was applied.

### `.lintstagedrc.json`

```json
{
  "*.{js,jsx,ts,tsx}": ["prettier --write --ignore-path .prettierignore", "eslint --fix --max-warnings=0"],
  "*.{css,scss,json,md,yml,mjs,cjs}": ["prettier --write --ignore-path .prettierignore"]
}
```

`eslint --fix --max-warnings=0` both fixes and fails on anything left — running `eslint` a second
time afterwards doubles the slowest part of every commit for no extra signal.

## Setup commands

```bash
pnpm add -D prettier prettier-plugin-tailwindcss lint-staged
```

Tailwind v4 has no `tailwind.config.js`, so point the plugin at the CSS entry that holds
`@import 'tailwindcss'`:

```javascript
// prettier.config.mjs
export default {
  // …
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './src/app/globals.css',
};
```
