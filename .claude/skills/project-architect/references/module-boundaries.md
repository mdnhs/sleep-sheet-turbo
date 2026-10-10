# Module Boundaries (ESLint)

Enforces architectural boundaries between layers using `eslint-plugin-boundaries`.
Prevents features from importing directly from other features without going through
the shared layer, prevents shared utilities from importing feature-specific code, and — most
importantly — keeps `src/server/**` (database, secrets, services) out of client-side code.

## Files to generate

### `eslint.config.mjs` (add boundaries plugin — extends existing Next.js config)

```javascript
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundariesPlugin from 'eslint-plugin-boundaries';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        {
          mode: 'full',
          type: 'shared',
          pattern: [
            'src/components/**/*',
            'src/contexts/**/*',
            'src/hooks/**/*',
            'src/lib/**/*',
            'src/types/**/*',
            'src/services/**/*',
            'src/validations/**/*',
          ],
        },
        {
          mode: 'full',
          type: 'feature',
          capture: ['featureName'],
          pattern: ['src/features/*/**/*'],
        },
        {
          mode: 'full',
          type: 'server',
          pattern: ['src/server/**/*'],
        },
        {
          mode: 'full',
          type: 'app',
          capture: ['_', 'fileName'],
          pattern: ['src/app/**/*'],
        },
      ],
    },
    rules: {
      'boundaries/no-unknown': ['error'],
      'boundaries/no-unknown-files': ['error'],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // Shared layer can only import from shared — never from server or features
            { from: ['shared'], allow: ['shared'] },
            // Server layer: shared utils + itself. Never imports a feature or a page.
            { from: ['server'], allow: ['shared', 'server'] },
            // Features can import from shared and from other features
            // (for cross-module communication — use sparingly).
            // Server code is reachable only through type-only imports (rule below).
            { from: ['feature'], allow: ['shared', 'feature'] },
            // App layer can import from anywhere — Server Components call services directly.
            { from: ['app'], allow: ['shared', 'feature', 'server'] },
          ],
        },
      ],
    },
  },
  {
    // Belt and braces: a value import of server code from a client component leaks
    // DATABASE_URL and friends into the bundle. Type-only imports are erased and fine.
    files: ['src/features/**/*', 'src/components/**/*', 'src/hooks/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/*', '@/server/**'],
              importNames: ['*'],
              allowTypeImports: true,
              message: 'Client-side code must not import from src/server. Call the API, or use `import type`.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

Also add `import 'server-only';` at the top of `src/server/db/index.ts` and any module holding
secrets — it turns an accidental client import into a build error rather than a leak.

### `src/lib/cross-module/README.md`

```markdown
# Cross-Module Communication

When one feature needs data from another feature, do NOT import directly from
`@/features/other-feature/...`. Instead:

1. Create a shared abstraction in `src/lib/` or `src/services/`
2. Or use React Context / Zustand store in `src/contexts/`
3. Or pass data down via page-level server components in `src/app/`

This keeps feature modules decoupled and boundaries clean.
```

## Setup commands to append

```bash
pnpm add -D eslint-plugin-boundaries
pnpm add server-only
# Verify module boundaries are working
pnpm eslint src/ --quiet
```
