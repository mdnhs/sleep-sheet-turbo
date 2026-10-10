# Single-Store Completion: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the nine verified security holes and add a CI quality gate (SP-0), then deliver SP-1 … SP-7 one sub-project at a time.

**Architecture:**
- Each security rule becomes a small pure function with its own vitest file, then gets wired into the existing Hono route that needs it.
- There are no new services and no new runtime dependencies.
- There are two migrations, both applied by hand: drop `api_keys.rawKey` and add `User.tokenVersion`.
- CI gains a `verify` job, and the Docker build depends on it.

**Tech Stack:** Next.js 16.3.5, Hono 4, Drizzle + Postgres 18, vitest 5, GitHub Actions → GHCR → Dokploy.

**Spec:** [`docs/brief.md`](brief.md). SP-0 is in §4; the sequencing for the roadmap is in §5.

**Scope of this file:** detailed tasks for SP-0 only. SP-1 … SP-7 appear as a roadmap at the end. Each of them gets its own design pass and its own plan before any code is written.

## Global Constraints

- **Next.js docs first.** Next.js is 16.3.5. Before writing Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- **Versions.** Node 22 (`node:22-bookworm-slim`); pnpm 10.32.1.
- **Migrations.**
  1. Change `db/schema.ts`.
  2. Run `pnpm db:generate --name <name>`.
  3. Check that the emitted SQL holds only the intended change. If it holds more, the snapshot has drifted; see `db/migrations/README.md`.
  4. The owner applies the SQL with `psql`.
  5. Commit the SQL together with `db/migrations/meta/*`.
  - Never run `pnpm db:migrate` or `pnpm db:push`.
- **Tests.** Use vitest, put `*.test.ts` beside the code, and import with the `@/` alias. Run with `pnpm test <path>`.
- **Commits.**
  - Commit directly to `main`, staging explicit paths only.
  - The owner often has uncommitted work in progress in the same tree. Never run `git add -A` or `git add .`.
- **Commit messages.** Format: `type(scope): summary`, a short body, then the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Pushing.** A push to `main` deploys production. Do not push until the owner says so, and follow "Deployment order" below.
- **Performance budget.**
  - SP-0 changes no storefront rendering except the track-order page.
  - SP-0 adds no client dependencies.

## Review Focus

The five failure modes most likely to hurt real users, each pinned by a test in the task named:

1. **Sessions from before the deploy** carry no `tv` claim and must keep working; the deploy itself must log nobody out. Task 5, "treats tokens issued before versioning as version 0".
2. **Order numbers typed loosely.** Customers type them in lower case or with spaces, and the lookup must still match. Task 6, `sameOrderNumber` tests.
3. **Ordinary settings saves by non-admins.** A non-admin with `settings:write` saving a page with no credentials must not get a 403. Task 3, "returns nothing for ordinary settings".
4. **Legacy permission strings** (`manage_orders` …) in roles created before this change stay valid and grantable. Task 4, `isKnownPermission` / `holdsAll` legacy tests.
5. **Deleted products.** Order history items whose product was deleted (`product: null`) must not crash summaries or cost blanking. Task 6 and Task 7 null-product tests.

## Deployment order

Two tasks change the database. Their order relative to the deploy matters.

1. **Before the push that contains Task 5,** the owner applies Task 5's migration (`ADD COLUMN "tokenVersion"`). The new code reads that column, and the column is additive with a default, so the old code is unaffected.
2. **Push.** The `verify` job (Task 10) must pass before an image is built.
3. **After the deploy is live,** the owner applies Task 2's migration (`DROP COLUMN "rawKey"`). The old code selected that column, so dropping it earlier would break the running app.

---

## SP-0 Tasks

### Task 1: Take the client IP from a trusted header

**Files:**
- Create: `lib/client-ip.ts`
- Create: `lib/client-ip.test.ts`
- Modify: `lib/rate-limit.ts:37-43`
- Modify: `lib/rate-limit.test.ts` (append a test)
- Modify: `lib/blocked-ip.ts:5-11`
- Modify: `features/activity/server/log-activity.ts:139-143`
- Modify: `features/pos/server/route.ts:125`

**Interfaces:**
- Consumes: nothing.
- Produces: `getClientIp(get: HeaderGetter): string | null` and `type HeaderGetter = (name: string) => string | null | undefined`, both exported from `lib/client-ip.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/client-ip.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/client-ip";

const headers = (h: Record<string, string>) => (name: string) => h[name];

describe("getClientIp", () => {
  it("prefers Cloudflare's header over a forged X-Forwarded-For", () => {
    expect(
      getClientIp(headers({ "cf-connecting-ip": "103.1.2.3", "x-forwarded-for": "6.6.6.6, 103.1.2.3" }))
    ).toBe("103.1.2.3");
  });

  it("falls back to X-Real-IP", () => {
    expect(getClientIp(headers({ "x-real-ip": "10.0.0.5" }))).toBe("10.0.0.5");
  });

  it("uses the rightmost X-Forwarded-For hop, not the client-supplied leftmost one", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "6.6.6.6, 172.70.1.1" }))).toBe("172.70.1.1");
  });

  it("trims whitespace", () => {
    expect(getClientIp(headers({ "cf-connecting-ip": "  103.1.2.3 " }))).toBe("103.1.2.3");
  });

  it("returns null when no header is present", () => {
    expect(getClientIp(headers({}))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/client-ip.test.ts`
Expected: FAIL, the import of `@/lib/client-ip` cannot be resolved.

- [ ] **Step 3: Implement `lib/client-ip.ts`**

```ts
/**
 * The address a request really came from.
 *
 * Production traffic arrives through Cloudflare, which sets CF-Connecting-IP
 * itself. A client can't forge it as long as the origin only accepts
 * Cloudflare's IP ranges (deploy/README.md, "Origin firewall"). The leftmost
 * X-Forwarded-For entry, which this codebase used to trust, is whatever the
 * client chose to send. Without the Cloudflare header (local dev, or a direct
 * hit on the origin) we fall back to X-Real-IP, then to the rightmost
 * X-Forwarded-For entry: the hop our own proxy appended.
 */
export type HeaderGetter = (name: string) => string | null | undefined;

export function getClientIp(get: HeaderGetter): string | null {
  const cf = get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/client-ip.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add the rate-limit regression test**

Append inside the existing `describe("rateLimit", …)` block in `lib/rate-limit.test.ts`:

```ts
  it("can't be dodged by rotating a forged X-Forwarded-For", async () => {
    const middleware = rateLimit(`test-${Math.random()}`, 1, 60_000);
    const next = async () => {};
    const ctx = (forged: string) => {
      const h: Record<string, string> = { "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": forged };
      return {
        req: { header: (name: string) => h[name] },
        json: (body: unknown, status: number) => ({ body, status }),
      };
    };

    await middleware(ctx("1.1.1.1") as never, next);
    const blocked = await middleware(ctx("2.2.2.2") as never, next);

    expect(blocked).toEqual({ body: { message: expect.any(String) }, status: 429 });
  });
```

Run: `pnpm test lib/rate-limit.test.ts`
Expected: FAIL on the new test. Today the limiter keys on the forged leftmost value, so the second request passes.

- [ ] **Step 6: Switch every caller to `getClientIp`**

In `lib/rate-limit.ts`, add `import { getClientIp } from "@/lib/client-ip";` under the existing import and replace the `clientIp` function (lines 37-43) with:

```ts
function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return getClientIp((name) => c.req.header(name)) ?? "unknown";
}
```

In `lib/blocked-ip.ts`, add `import { getClientIp } from "@/lib/client-ip";` and replace `clientIpFromHeaders` (lines 5-11) with:

```ts
/** The client IP a request came from, as stored on orders. */
export function clientIpFromHeaders(headers: {
  get?: (name: string) => string | null;
}): string | null {
  return getClientIp((name) => headers.get?.(name));
}
```

In `features/activity/server/log-activity.ts`, add `import { getClientIp } from "@/lib/client-ip";` beside the other imports and replace `clientIp` (lines 139-143) with:

```ts
function clientIp(headers: Headers): string {
  return getClientIp((name) => headers.get(name)) ?? "unknown";
}
```

In `features/pos/server/route.ts`, add `import { getClientIp } from "@/lib/client-ip";` beside the other imports and replace line 125 with:

```ts
    const clientIp = getClientIp((name) => c.req.header(name));
```

- [ ] **Step 7: Verify**

Run: `pnpm test lib/client-ip.test.ts lib/rate-limit.test.ts && pnpm typecheck`
Expected: all tests PASS and the typecheck reports no errors.

Run: `grep -rn "x-forwarded-for" lib features app --include=*.ts | grep -v test`
Expected: only `lib/client-ip.ts`.

- [ ] **Step 8: Commit**

```bash
git add lib/client-ip.ts lib/client-ip.test.ts lib/rate-limit.ts lib/rate-limit.test.ts lib/blocked-ip.ts features/activity/server/log-activity.ts features/pos/server/route.ts
git commit -F - <<'EOF'
fix(security): take the client IP from Cloudflare's header

Rate limiting, IP blocking, the audit log and POS all trusted the leftmost
X-Forwarded-For entry, which the client controls. They now share one
getClientIp() that prefers CF-Connecting-IP.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 9 (owner, after deploy): Spot-check stored IPs**

Run in psql: `SELECT "ipAddress", "createdAt" FROM orders ORDER BY "createdAt" DESC LIMIT 5;`
Expected: new orders show customer addresses, not Cloudflare ranges such as `104.16.0.0/13`, `172.64.0.0/13` or `162.158.0.0/15`.

---

### Task 2: Stop storing raw API keys

**Files:**
- Create: `features/api-keys/api-keys-table.test.ts`
- Modify: `db/schema.ts:163` (remove the `rawKey` column)
- Modify: `features/api-keys/server/route.ts:31,62`
- Modify: `app/(dashboard)/dashboard/settings/api-keys/api-keys-client.tsx`
- Create (generated): `db/migrations/0031_api_keys_drop_raw_key.sql`, plus updates to `db/migrations/meta/_journal.json` and a new `db/migrations/meta/0031_snapshot.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `GET /api/api-keys` rows no longer carry `rawKey`. `POST /api/api-keys` still returns `rawKey` once.

- [ ] **Step 1: Write the failing test**

Create `features/api-keys/api-keys-table.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { apiKeys } from "@/db/schema";

describe("api_keys table", () => {
  it("has no column that could hold a usable raw key", () => {
    expect(Object.keys(getTableColumns(apiKeys))).not.toContain("rawKey");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/api-keys/api-keys-table.test.ts`
Expected: FAIL, the received array contains `"rawKey"`.

- [ ] **Step 3: Remove the column and every use of it**

1. In `db/schema.ts`, delete line 163: `  rawKey: text("rawKey"),`
2. In `features/api-keys/server/route.ts`:
   - Delete line 31 (`        rawKey: apiKeys.rawKey,`).
   - Delete line 62 (`          rawKey,`) from the `.values({...})` object.
   - Keep `return c.json({ ...created, rawKey }, 201);`. That is the one-time display.
3. In `app/(dashboard)/dashboard/settings/api-keys/api-keys-client.tsx`:
   - Delete `rawKey?: string | null;` from `interface ApiKeyRow`.
   - Delete the `revealedIds` and `copiedRowId` state, and the `toggleReveal` and `handleCopyRowKey` functions.
   - Replace the whole `cell` of the `"name"` column (from `cell: ({ row }) => (` to its closing `),`) with:

```tsx
      cell: ({ row }) => (
        <div>
          <div className="font-semibold flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            {row.original.name}
          </div>
          <code className="mt-0.5 inline-block text-xs text-muted-foreground font-mono bg-slate-100 dark:bg-muted/50 px-1.5 py-0.5 rounded max-w-[280px] truncate">
            {row.original.keyPrefix}…
          </code>
        </div>
      ),
```

   Then run `pnpm lint "app/(dashboard)/dashboard/settings/api-keys/api-keys-client.tsx"` and delete the imports it reports as unused (`Eye`, `EyeOff`, and any others).

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate --name api_keys_drop_raw_key`
(drizzle-kit `generate` does not connect to the database. If it complains about `DATABASE_URL`, prefix the command with `DATABASE_URL=postgres://x:x@127.0.0.1:1/x`.)

Expected: `db/migrations/0031_api_keys_drop_raw_key.sql` containing exactly:

```sql
ALTER TABLE "api_keys" DROP COLUMN "rawKey";
```

If the file contains anything else, trim it to this statement and read `db/migrations/README.md` before going on.

- [ ] **Step 5: Run the tests and the typecheck**

Run: `pnpm test features/api-keys/api-keys-table.test.ts && pnpm typecheck`
Expected: PASS and no type errors. TypeScript now rejects any leftover `rawKey` reference.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts db/migrations/0031_api_keys_drop_raw_key.sql db/migrations/meta features/api-keys/server/route.ts features/api-keys/api-keys-table.test.ts "app/(dashboard)/dashboard/settings/api-keys/api-keys-client.tsx"
git commit -F - <<'EOF'
fix(security): keep only the hash of API keys

The raw key was stored in api_keys.rawKey and returned by the list
endpoint, despite the schema comment promising hash-only storage. The key
is now shown once at creation and the column is dropped.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 7 (owner, after the deploy is live): Apply the migration**

Apply `db/migrations/0031_api_keys_drop_raw_key.sql` with psql against production, after the deploy (see "Deployment order").
Then check with `\d api_keys`: there is no `rawKey` column.

---

### Task 3: Credentials writable by ADMIN only

**Files:**
- Create: `features/settings/secret-keys.ts`
- Create: `features/settings/secret-keys.test.ts`
- Modify: `features/settings/server/route.ts:17-43` (move the secret-key list out), `:218-224` (add the check)

**Interfaces:**
- Consumes: nothing.
- Produces: `SECRET_SETTING_KEYS`, `isSecretKey(key: string): boolean` and `secretKeysIn(keys: readonly string[]): string[]`, all from `features/settings/secret-keys.ts`.

- [ ] **Step 1: Write the failing test**

Create `features/settings/secret-keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSecretKey, secretKeysIn } from "@/features/settings/secret-keys";

describe("isSecretKey", () => {
  it("flags every listed credential", () => {
    for (const key of [
      "bkash_app_secret",
      "bkash_password",
      "steadfast_api_key",
      "cloudinary_api_secret",
      "google_sheets_private_key",
      "google_sheets_spreadsheet_id",
    ]) {
      expect(isSecretKey(key)).toBe(true);
    }
  });

  it("flags credential-shaped keys that aren't listed", () => {
    expect(isSecretKey("fraud_pathao_user")).toBe(true);
    expect(isSecretKey("sms_api_token")).toBe(true);
  });

  it("leaves ordinary settings alone", () => {
    expect(isSecretKey("site_name")).toBe(false);
    expect(isSecretKey("shipping_inside_dhaka")).toBe(false);
  });
});

describe("secretKeysIn", () => {
  it("returns only the secret keys", () => {
    expect(secretKeysIn(["site_name", "bkash_app_secret", "currency"])).toEqual(["bkash_app_secret"]);
  });

  it("returns nothing for ordinary settings", () => {
    expect(secretKeysIn(["site_name", "currency", "shipping_outside_dhaka"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/settings/secret-keys.test.ts`
Expected: FAIL, the import of `@/features/settings/secret-keys` cannot be resolved.

- [ ] **Step 3: Create `features/settings/secret-keys.ts`**

```ts
// Credentials that must never leave the server through the public settings
// GET, and that only an ADMIN may change. The public endpoint exposes only a
// "<key>_set" flag for each so the admin UI can show configured state; raw
// values are served by the ADMIN-only /secrets endpoint.
// (cloudinary_cloud_name stays public — it is visible in every image URL.)
export const SECRET_SETTING_KEYS = [
  "steadfast_api_key",
  "steadfast_secret_key",
  "bdcourier_api_key",
  "cloudinary_api_key",
  "cloudinary_api_secret",
  "google_sheets_client_email",
  "google_sheets_private_key",
  "google_sheets_spreadsheet_id",
  "bkash_app_key",
  "bkash_app_secret",
  "bkash_username",
  "bkash_password",
] as const;

// Safety net for credential-shaped rows that aren't in the list above (the
// DB contains orphaned logins like fraud_steadfast_* / fraud_pathao_* from
// older versions). Anything matching this is treated as a secret too.
const SECRET_KEY_PATTERN = /password|secret|api_key|token|_pass$|^fraud_/i;

export const isSecretKey = (key: string) =>
  (SECRET_SETTING_KEYS as readonly string[]).includes(key) ||
  SECRET_KEY_PATTERN.test(key);

/** The secret keys among `keys`, in their original order. */
export function secretKeysIn(keys: readonly string[]): string[] {
  return keys.filter(isSecretKey);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test features/settings/secret-keys.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Use the module in the route and enforce ADMIN on writes**

1. Run `grep -n "SECRET_SETTING_KEYS\|isSecretKey\|SECRET_KEY_PATTERN" features/settings/server/route.ts` to see which names the file uses after line 43.
2. Delete lines 17-43 (the `SECRET_SETTING_KEYS` list, `SECRET_KEY_PATTERN` and `isSecretKey`). In their place, import the names the file still uses, plus `secretKeysIn`. For example:

```ts
import { SECRET_SETTING_KEYS, isSecretKey, secretKeysIn } from "@/features/settings/secret-keys";
```

3. In the PATCH handler, directly after `const changedKeys = updates.map(([key]) => key);`, insert:

```ts
      // Reading credentials is ADMIN-only (/secrets); changing them must be
      // too, or settings:write could swap the bKash merchant account or the
      // courier login for one the caller controls.
      const lockedKeys = secretKeysIn(changedKeys);
      if (lockedKeys.length > 0 && user?.role !== "ADMIN") {
        return c.json({ error: "Only an admin can change credentials", keys: lockedKeys }, 403);
      }
```

- [ ] **Step 6: Verify**

Run: `pnpm test features/settings && pnpm typecheck`
Expected: PASS and no type errors.

Manual check (local dev, signed in as a staff user with `settings:write` but not ADMIN):
- Saving Settings → Currency succeeds.
- Saving the Steadfast credentials shows the toast "Only an admin can change credentials".

- [ ] **Step 7: Commit**

```bash
git add features/settings/secret-keys.ts features/settings/secret-keys.test.ts features/settings/server/route.ts
git commit -F - <<'EOF'
fix(security): only an admin may change stored credentials

settings:write could overwrite the bKash, Steadfast, Cloudinary and Sheets
credentials even though reading them was ADMIN-only. Secret keys in the
settings PATCH now require ADMIN.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Contain privileges for users and roles

**Files:**
- Modify: `lib/permissions.ts` (append helpers)
- Modify: `lib/permissions.test.ts` (extend the import, append tests)
- Modify: `features/users/server/route.ts` (create, role change, password reset)
- Modify: `features/roles/server/route.ts` (create, edit, delete)

**Interfaces:**
- Consumes: the existing `expandPermissions`, `MODULES`, `LEGACY_MAP` and `ModuleDef` in `lib/permissions.ts`.
- Produces, from `lib/permissions.ts`:
  - `ALL_PERMISSIONS: ReadonlySet<string>`
  - `isKnownPermission(permission: string): boolean`
  - `holdsAll(actor: AuthUser, wanted: readonly string[] | null | undefined): boolean`
  - `canManageUser(actor: AuthUser, target: { role: string; permissions: readonly string[] | null | undefined }): boolean`

- [ ] **Step 1: Write the failing tests**

In `lib/permissions.test.ts`, change the first import to:

```ts
import { can, isAllowed, expandPermissions, landingPath, perm, holdsAll, isKnownPermission, canManageUser } from "@/lib/permissions";
```

Append to the end of the file:

```ts
describe("isKnownPermission", () => {
  it("accepts granular and legacy permissions", () => {
    expect(isKnownPermission("orders:write")).toBe(true);
    expect(isKnownPermission("orders:cancel")).toBe(true);
    expect(isKnownPermission("manage_orders")).toBe(true);
  });

  it("rejects strings no module defines", () => {
    expect(isKnownPermission("orders:view")).toBe(false);
    expect(isKnownPermission("superuser")).toBe(false);
    expect(isKnownPermission("toString")).toBe(false);
  });
});

describe("holdsAll", () => {
  const staff = { role: "USER", permissions: ["orders:write", "users:write"] };

  it("lets ADMIN grant anything", () => {
    expect(holdsAll({ role: "ADMIN" }, ["settings:write"])).toBe(true);
  });

  it("allows a subset of the actor's own permissions, after expansion", () => {
    expect(holdsAll(staff, ["orders:read", "orders:cancel"])).toBe(true);
    expect(holdsAll({ role: "USER", permissions: ["manage_orders"] }, ["orders:refund"])).toBe(true);
  });

  it("refuses anything the actor doesn't hold", () => {
    expect(holdsAll(staff, ["settings:write"])).toBe(false);
    expect(holdsAll(staff, ["orders:read", "roles:write"])).toBe(false);
  });

  it("refuses a signed-out actor", () => {
    expect(holdsAll(null, [])).toBe(false);
  });
});

describe("canManageUser", () => {
  const manager = { role: "USER", permissions: ["users:write", "orders:write"] };

  it("never lets a non-admin manage an ADMIN", () => {
    expect(canManageUser(manager, { role: "ADMIN", permissions: [] })).toBe(false);
  });

  it("refuses a target with permissions the actor lacks", () => {
    expect(canManageUser(manager, { role: "USER", permissions: ["settings:write"] })).toBe(false);
  });

  it("allows a target whose permissions the actor fully holds", () => {
    expect(canManageUser(manager, { role: "USER", permissions: ["orders:read"] })).toBe(true);
    expect(canManageUser(manager, { role: "USER", permissions: null })).toBe(true);
  });

  it("lets ADMIN manage anyone", () => {
    expect(canManageUser({ role: "ADMIN" }, { role: "ADMIN", permissions: [] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test lib/permissions.test.ts`
Expected: FAIL, because `holdsAll`, `isKnownPermission` and `canManageUser` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `lib/permissions.ts`:

```ts
/** Every granular permission string the role editor can grant. */
export const ALL_PERMISSIONS: ReadonlySet<string> = new Set(
  (MODULES as readonly ModuleDef[]).flatMap((m) => [
    ...m.actions.map((a) => `${m.key}:${a}`),
    ...(m.extras ?? []).map((e) => `${m.key}:${e.key}`),
  ])
);

/** A granular permission from MODULES, or a legacy flat string that is still honoured. */
export function isKnownPermission(permission: string): boolean {
  return (
    ALL_PERMISSIONS.has(permission) ||
    Object.prototype.hasOwnProperty.call(LEGACY_MAP, permission)
  );
}

/**
 * Does `actor` hold every permission in `wanted`? Both sides are expanded
 * first, so legacy strings and write-implies-read/extras count. ADMIN holds
 * everything.
 */
export function holdsAll(actor: AuthUser, wanted: readonly string[] | null | undefined): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  const mine = expandPermissions(actor.permissions);
  for (const p of expandPermissions(wanted ? [...wanted] : [])) {
    if (!mine.has(p)) return false;
  }
  return true;
}

/**
 * May `actor` change `target`'s role or password? Only an ADMIN may touch an
 * ADMIN, and anyone else only users whose permissions they fully hold.
 * Otherwise users:write is a path to every other permission: reset a
 * stronger account's password, then sign in as it.
 */
export function canManageUser(
  actor: AuthUser,
  target: { role: string; permissions: readonly string[] | null | undefined }
): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  if (target.role === "ADMIN") return false;
  return holdsAll(actor, target.permissions);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test lib/permissions.test.ts`
Expected: PASS (the existing tests plus 10 new ones).

- [ ] **Step 5: Enforce the rules in `features/users/server/route.ts`**

1. Change the permissions import to `import { can, canManageUser, holdsAll } from "@/lib/permissions";`

2. **POST `/` (create staff).** Directly after `const { name, email, password, roleId } = c.req.valid("json");` insert:

```ts
      if (roleId) {
        const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
        if (!role) {
          return c.json({ error: "Role not found" }, 404);
        }
        if (!holdsAll(user, role.permissions)) {
          return c.json({ error: "You can't assign a role with more access than you" }, 403);
        }
      }
```

3. **PATCH `/:id/role`.** Replace everything from `const id = c.req.param("id");` down to the end of the `const [oldRole, newRole] = await Promise.all([ … ]);` statement with:

```ts
      const id = c.req.param("id");
      const { roleId } = c.req.valid("json");

      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
        with: { assignedRole: true },
      });

      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }

      if (targetUser.email === process.env.SUPER_ADMIN_EMAIL) {
        return c.json({ error: "Cannot change role of super admin" }, 400);
      }

      // users:write must not be a path to more access: no changing your own
      // role, no touching anyone stronger, no handing out a role you couldn't
      // have been given yourself.
      if (id === user!.id && user!.role !== "ADMIN") {
        return c.json({ error: "You can't change your own role" }, 403);
      }
      if (!canManageUser(user, { role: targetUser.role, permissions: targetUser.assignedRole?.permissions })) {
        return c.json({ error: "You can't manage a user with more access than you" }, 403);
      }

      const newRole = roleId
        ? await db.query.roles.findFirst({ where: eq(roles.id, roleId) })
        : null;
      if (roleId && !newRole) {
        return c.json({ error: "Role not found" }, 404);
      }
      if (newRole && !holdsAll(user, newRole.permissions)) {
        return c.json({ error: "You can't assign a role with more access than you" }, 403);
      }
      const oldRole = targetUser.assignedRole;
```

The rest of the handler (`db.update(users).set({ roleId })`, `invalidateSessionUser(id)`, and `setActivityMeta` using `oldRole?.name` / `newRole?.name`) stays unchanged.

4. **PATCH `/:id/password`.** Replace from `const targetUser = await db.query.users.findFirst({ where: eq(users.id, id) });` through the super-admin `if` block with:

```ts
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
        with: { assignedRole: true },
      });

      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }

      if (targetUser.email === process.env.SUPER_ADMIN_EMAIL) {
        return c.json({ error: "Cannot reset password of super admin" }, 400);
      }

      // Resetting a stronger account's password is the same as taking it over.
      if (!canManageUser(user, { role: targetUser.role, permissions: targetUser.assignedRole?.permissions })) {
        return c.json({ error: "You can't manage a user with more access than you" }, 403);
      }
```

- [ ] **Step 6: Enforce the rules in `features/roles/server/route.ts`**

1. Change the permissions import to `import { can, holdsAll, isKnownPermission } from "@/lib/permissions";`

2. Add this helper above `const app = new Hono()`:

```ts
// A role editor may only grant what they hold, and only real permissions.
// An unknown string is either a typo or an attempt to sneak access past the
// role editor UI.
function grantProblem(user: Parameters<typeof holdsAll>[0], permissions: string[]) {
  const unknown = permissions.filter((p) => !isKnownPermission(p));
  if (unknown.length > 0) {
    return { status: 400 as const, body: { error: "Unknown permissions", permissions: unknown } };
  }
  if (!holdsAll(user, permissions)) {
    return { status: 403 as const, body: { error: "You can't grant permissions you don't have" } };
  }
  return null;
}
```

3. **POST `/`.** Directly after `const { name, permissions, landingUrl } = c.req.valid("json");` insert:

```ts
      const problem = grantProblem(user, permissions);
      if (problem) return c.json(problem.body, problem.status);
```

4. **PATCH `/:id`.** Directly after `const { name, permissions, landingUrl } = c.req.valid("json");` insert:

```ts
      const problem = grantProblem(user, permissions);
      if (problem) return c.json(problem.body, problem.status);

      const before = await db.query.roles.findFirst({ where: eq(roles.id, id) });
      if (!before) {
        return c.json({ error: "Role not found" }, 404);
      }
      if (!holdsAll(user, before.permissions)) {
        return c.json({ error: "You can't edit a role with more access than you" }, 403);
      }
```

   Then delete the later line `const before = await db.query.roles.findFirst({ where: eq(roles.id, id) });` (it was line 90).

5. **DELETE `/:id`.** Directly after `const id = c.req.param("id");` insert:

```ts
      const role = await db.query.roles.findFirst({ where: eq(roles.id, id) });
      if (!role) {
        return c.json({ error: "Role not found" }, 404);
      }
      if (!holdsAll(user, role.permissions)) {
        return c.json({ error: "You can't delete a role with more access than you" }, 403);
      }
```

- [ ] **Step 7: Verify**

Run: `pnpm test lib/permissions.test.ts && pnpm typecheck`
Expected: PASS and no type errors.

Owner, before deploying: run `SELECT name, permissions FROM roles;` in psql. Any string that is neither a `module:action` from `lib/permissions.ts` nor a legacy name will make that role's next save return 400. Remove such strings from the role in the admin first.

- [ ] **Step 8: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts features/users/server/route.ts features/roles/server/route.ts
git commit -F - <<'EOF'
fix(security): stop users:write and roles:write from escalating access

A staff member with users:write could reset a stronger account's password
or give themselves any role, and roles:write accepted any permission
string. Callers can now only grant, assign or manage access they hold.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Make sessions revocable

**Files:**
- Create: `lib/session-token.ts`
- Create: `lib/session-token.test.ts`
- Modify: `db/schema.ts` (`users` table: add `tokenVersion`)
- Create (generated): `db/migrations/0032_user_token_version.sql`, plus `db/migrations/meta/*`
- Modify: `lib/session-middleware.ts:36` and the cookie branch
- Modify: `lib/get-session-user.ts`
- Modify: `lib/is-authenticated.ts`
- Modify: `features/auth/server/route.ts` (login, profile password change)
- Modify: `features/users/server/route.ts` (admin password reset)

**Interfaces:**
- Consumes: `canManageUser` from Task 4 (already in the password-reset handler).
- Produces, from `lib/session-token.ts`:
  - `type SessionClaims = { id: string; email: string; tv?: number }`
  - `signSessionToken(user: { id: string; email: string; tokenVersion: number }): string`
  - `isTokenCurrent(claims: Pick<SessionClaims, "tv">, user: { tokenVersion: number }): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/session-token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { isTokenCurrent, signSessionToken } from "@/lib/session-token";

describe("isTokenCurrent", () => {
  it("accepts a token whose version matches", () => {
    expect(isTokenCurrent({ tv: 3 }, { tokenVersion: 3 })).toBe(true);
  });

  it("rejects a token from before the last bump", () => {
    expect(isTokenCurrent({ tv: 2 }, { tokenVersion: 3 })).toBe(false);
  });

  it("treats tokens issued before versioning as version 0", () => {
    expect(isTokenCurrent({}, { tokenVersion: 0 })).toBe(true);
    expect(isTokenCurrent({}, { tokenVersion: 1 })).toBe(false);
  });
});

describe("signSessionToken", () => {
  it("embeds the user's current token version", () => {
    process.env.JWT_SECRET = "test-secret-0123456789abcdef0123456789";
    const token = signSessionToken({ id: "u1", email: "a@b.c", tokenVersion: 4 });
    const claims = jwt.verify(token, process.env.JWT_SECRET) as { id: string; tv: number };
    expect(claims).toMatchObject({ id: "u1", tv: 4 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/session-token.test.ts`
Expected: FAIL, the import of `@/lib/session-token` cannot be resolved.

- [ ] **Step 3: Implement `lib/session-token.ts`**

```ts
import jwt from "jsonwebtoken";

/** What the login cookie's JWT carries. `tv` is User.tokenVersion at sign-in. */
export type SessionClaims = { id: string; email: string; tv?: number };

export function signSessionToken(user: { id: string; email: string; tokenVersion: number }): string {
  const claims: SessionClaims = { id: user.id, email: user.email, tv: user.tokenVersion };
  return jwt.sign(claims, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

/**
 * A token stays valid only while its version matches the user's current one,
 * so bumping User.tokenVersion (password reset or change) signs every existing
 * session out at once. Tokens from before this field existed carry no `tv`
 * and count as version 0 (the column default), so the deploy itself logs
 * nobody out.
 */
export function isTokenCurrent(
  claims: Pick<SessionClaims, "tv">,
  user: { tokenVersion: number }
): boolean {
  return (claims.tv ?? 0) === user.tokenVersion;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/session-token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the column and generate the migration**

In `db/schema.ts`, inside the `users` table, add this after the `lockedUntil` line:

```ts
  // Bumped whenever the password is reset or changed; JWTs carry the value
  // they were signed with, so older sessions stop working (lib/session-token.ts).
  tokenVersion: integer("tokenVersion").default(0).notNull(),
```

Run: `pnpm db:generate --name user_token_version`
Expected: `db/migrations/0032_user_token_version.sql` containing exactly:

```sql
ALTER TABLE "User" ADD COLUMN "tokenVersion" integer DEFAULT 0 NOT NULL;
```

If it contains anything else, trim it to this statement and read `db/migrations/README.md`.

- [ ] **Step 6: Check the version everywhere a session is read**

1. **`lib/session-middleware.ts`**
   - Add `import { isTokenCurrent, type SessionClaims } from '@/lib/session-token'`.
   - Change line 36 to:

```ts
const sessionCache = new Map<string, { user: SessionUser; tokenVersion: number; expiresAt: number }>()
```

   - In the cookie branch, replace the body of the `try { … }` with:

```ts
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SessionClaims

    // The cache is keyed by user id, so it must also remember the version:
    // otherwise an old token would ride on the cache entry a fresh login
    // created.
    const cached = sessionCache.get(decoded.id)
    if (cached && cached.expiresAt > Date.now() && isTokenCurrent(decoded, cached)) {
      c.set('user', cached.user)
      return await next()
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.id),
      with: { assignedRole: true },
    })

    if (!user || !isTokenCurrent(decoded, user)) {
      sessionCache.delete(decoded.id)
      c.set('user', null)
      deleteCookie(c, AUTH_COOKIE, { path: "/" })
      return await next()
    }

    const isSuperAdmin = user.email === process.env.SUPER_ADMIN_EMAIL;

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: isSuperAdmin ? 'ADMIN' : user.role,
      permissions: user.assignedRole ? user.assignedRole.permissions : [],
      landingUrl: user.assignedRole ? user.assignedRole.landingUrl : null,
      phone: user.phone,
      address: user.address
    }

    sessionCache.set(user.id, { user: sessionUser, tokenVersion: user.tokenVersion, expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
    c.set('user', sessionUser)
```

2. **`lib/get-session-user.ts`**
   - Add `import { isTokenCurrent, type SessionClaims } from "@/lib/session-token";`.
   - Change the `decoded` cast to `as SessionClaims`.
   - Replace `if (!user) return null;` with `if (!user || !isTokenCurrent(decoded, user)) return null;`.

3. **`lib/is-authenticated.ts`**
   - Same import.
   - Change the `decoded` cast to `as SessionClaims`.
   - Replace `if (!user) return null;` with `if (!user || !isTokenCurrent(decoded, user)) return null;`.

4. **`features/auth/server/route.ts`**
   - Delete `import Jwt from "jsonwebtoken";`.
   - Add `import { signSessionToken } from "@/lib/session-token";`.
   - Change `import { eq } from "drizzle-orm";` to `import { eq, sql } from "drizzle-orm";`.
   - Add below the imports:

```ts
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days, matches the JWT
} as const;
```

   - In login, replace the `const token = Jwt.sign(…);` statement and the `setCookie(c, AUTH_COOKIE, token, { … });` call that follows it with:

```ts
      const token = signSessionToken(user);
      setCookie(c, AUTH_COOKIE, token, SESSION_COOKIE_OPTIONS);
```

   - In the profile update handler, change `.set(updateData)` to:

```ts
      .set({
        ...updateData,
        // A new password signs every other session out (lib/session-token.ts).
        ...(body.newPassword ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
      })
```

   - Then add this directly after `invalidateSessionUser(user.id);` in that handler:

```ts
    if (body.newPassword) {
      // The version bump above signed this browser out too; give it a fresh cookie.
      const fresh = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, email: true, tokenVersion: true },
      });
      if (fresh) setCookie(c, AUTH_COOKIE, signSessionToken(fresh), SESSION_COOKIE_OPTIONS);
    }
```

5. **`features/users/server/route.ts`** (admin password reset)
   - Change the update to:

```ts
      await db.update(users)
        .set({
          password: hashedPassword,
          failedLoginAttempts: 0,
          lockedUntil: null,
          // Every session the old password opened stops working.
          tokenVersion: sql`${users.tokenVersion} + 1`,
        })
        .where(eq(users.id, id));
      invalidateSessionUser(id);
```

- [ ] **Step 7: Verify**

Run: `pnpm test lib/session-token.test.ts && pnpm typecheck`
Expected: PASS and no type errors.

Manual check (local dev with the migration applied to the local DB):
1. Sign in as a staff user in two browsers.
2. Reset that user's password from the admin in a third session.
3. Both browsers are signed out on their next API request.
4. Sign in again and change the password from the profile page. The current browser stays signed in; any other browser is signed out.

- [ ] **Step 8: Commit**

```bash
git add lib/session-token.ts lib/session-token.test.ts db/schema.ts db/migrations/0032_user_token_version.sql db/migrations/meta lib/session-middleware.ts lib/get-session-user.ts lib/is-authenticated.ts features/auth/server/route.ts features/users/server/route.ts
git commit -F - <<'EOF'
fix(security): sign out every session when a password changes

JWTs lasted 7 days with no way to revoke them, so a reset password left
the old sessions working. Sessions now carry User.tokenVersion, which a
password reset or change bumps.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 9 (owner, before pushing): Apply the migration**

Apply `db/migrations/0032_user_token_version.sql` to production with psql **before** the push that contains this task (see "Deployment order").
Then check with `\d "User"`: `tokenVersion` is present as `integer not null default 0`.

---

### Task 6: Make track-order lookups private

**Files:**
- Create: `features/order/server/track-order.ts`
- Create: `features/order/server/track-order.test.ts`
- Modify: `features/order/server/route.ts:874-925` (the `/by-phone` handler)
- Modify: `app/(client)/track-order/page.tsx`
- Modify: `app/(client)/order-success/page.tsx:299`
- Modify: `hooks/use-language.ts` (two keys in `en` near line 119 and two in `bn` near line 463)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - From `features/order/server/track-order.ts`: `toOrderSummary(row)` and `sameOrderNumber(a: string, b: string): boolean`.
  - `GET /api/orders/by-phone?phone=…[&order=…]` returns `{ verified: boolean, orders: [...] }`.

- [ ] **Step 1: Write the failing test**

Create `features/order/server/track-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sameOrderNumber, toOrderSummary } from "@/features/order/server/track-order";

const row = {
  id: "ord_1",
  orderNumber: "ORD-1042",
  status: "SHIPPED",
  paymentMethod: "COD",
  totalAmount: 2500,
  subtotal: 2380,
  deliveryCharge: 120,
  shippingAddress: "House 12, Road 5, Mirpur 10, Dhaka",
  guestPhone: "01712345678",
  guestName: "Rahim Uddin",
  note: "Call before delivery",
  trackingNumber: "SF123456",
  createdAt: new Date("2026-10-01T10:00:00Z"),
  items: [
    { id: "it_1", quantity: 1, price: 2380, size: "King", color: null, product: { id: "p1", name: "Cotton Bedsheet", images: ["a.jpg"] } },
    { id: "it_2", quantity: 2, price: 0, size: null, color: null, product: null },
  ],
};

describe("toOrderSummary", () => {
  it("drops everything that identifies the customer or unlocks the order", () => {
    const json = JSON.stringify(toOrderSummary(row));
    for (const secret of ["ord_1", "ORD-1042", "Rahim", "Mirpur", "Call before", "SF123456", "01712345678"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("keeps what a customer needs to recognise the order", () => {
    expect(toOrderSummary(row)).toMatchObject({
      status: "SHIPPED",
      totalAmount: 2500,
      items: [{ id: "it_1", quantity: 1, product: { name: "Cotton Bedsheet" } }, { id: "it_2", product: null }],
    });
  });
});

describe("sameOrderNumber", () => {
  it("ignores case and spaces", () => {
    expect(sameOrderNumber("ORD-1042", " ord-1042 ")).toBe(true);
  });

  it("rejects a different number", () => {
    expect(sameOrderNumber("ORD-1042", "ORD-1043")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/order/server/track-order.test.ts`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement `features/order/server/track-order.ts`**

```ts
// Helpers for the public "track your order" lookup. A phone number is not a
// secret (anyone can type one in), so on its own it may only show what was
// ordered and where it stands. The order number unlocks the full order.

type TrackableRow = {
  status: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: Date | string;
  items: {
    id: string;
    quantity: number;
    price: number;
    size: string | null;
    color: string | null;
    product: { name: string; images: string[] } | null;
  }[];
};

/** No name, address, note, order id/number or tracking code. */
export function toOrderSummary(row: TrackableRow) {
  return {
    status: row.status,
    paymentMethod: row.paymentMethod,
    totalAmount: row.totalAmount,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: item.price,
      size: item.size,
      color: item.color,
      product: item.product ? { name: item.product.name, images: item.product.images } : null,
    })),
  };
}

/** Customers type order numbers in any case, sometimes with spaces. */
export function sameOrderNumber(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  return norm(a) === norm(b);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test features/order/server/track-order.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite the `/by-phone` handler**

In `features/order/server/route.ts`, add `import { sameOrderNumber, toOrderSummary } from "@/features/order/server/track-order";` beside the other imports. Then replace the whole `.get("/by-phone", … )` handler (line 874 through its closing `})`) with:

```ts
.get("/by-phone", rateLimit("orders-by-phone", 20, 5 * 60_000), async (c) => {
  const { phone, order: orderNumber } = c.req.query();

  if (!phone) {
    return c.json({ error: "Phone number is required" }, 400);
  }

  try {
    const ordersList = await db.query.orders.findMany({
      where: eq(orders.guestPhone, phone),
      // No `id`: the order id is the capability for GET /:id, so it must
      // never come back from a lookup keyed by something as guessable as a
      // phone number.
      columns: {
        orderNumber: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        subtotal: true,
        deliveryCharge: true,
        shippingAddress: true,
        guestPhone: true,
        guestName: true,
        note: true,
        trackingNumber: true,
        createdAt: true,
      },
      with: {
        items: {
          columns: { id: true, quantity: true, price: true, size: true, color: true },
          with: {
            product: {
              columns: { id: true, name: true, images: true }
            }
          }
        },
      },
      orderBy: (fields, { desc }) => [desc(fields.createdAt)],
    });

    // Phone alone: a summary of each order (what and where it stands).
    if (!orderNumber) {
      return c.json({ verified: false, orders: ordersList.map(toOrderSummary) });
    }

    // Phone + order number: that one order in full, as the invoice needs it.
    // Customers see the delivery charge they paid, never the admin's courier cost.
    const match = ordersList.find((o) => sameOrderNumber(o.orderNumber, orderNumber));
    if (!match) {
      return c.json({ verified: false, orders: [] });
    }
    const { deliveryCharge, ...rest } = match;
    return c.json({ verified: true, orders: [{ ...rest, shippingCost: deliveryCharge }] });
  } catch (error) {
    console.error("Failed to fetch orders by phone:", error);
    return c.json({ error: "Failed to fetch orders" }, 500);
  }
})
```

- [ ] **Step 6: Update the track-order page**

In `app/(client)/track-order/page.tsx`:

1. Replace `interface OrderItem { … }` and `interface Order { … }` (lines 16-40) with:

```tsx
interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  size?: string | null;
  color?: string | null;
  product: { id?: string; name: string; images: string[] } | null;
}

// A phone number alone returns a summary (no order number, name, address,
// note or tracking). Phone + order number returns the full order, so those
// fields are optional and present only when the lookup is `verified`.
interface Order {
  orderNumber?: string;
  status: string;
  paymentMethod: string;
  totalAmount: number;
  subtotal?: number;
  shippingCost?: number;
  shippingAddress?: string;
  guestPhone?: string | null;
  createdAt: string;
  guestName?: string | null;
  note?: string | null;
  items: OrderItem[];
  trackingNumber?: string | null;
}
```

2. Under `const phoneParam = …;` add `const orderParam = searchParams.get("order") || "";`. Under `const [phone, setPhone] = useState(phoneParam);` add:

```tsx
  const [orderNo, setOrderNo] = useState(orderParam);
  const [verified, setVerified] = useState(false);
```

3. Replace `performSearch`, the `useEffect` that calls it, and `handleSearchSubmit` with:

```tsx
  const performSearch = async (phoneNumber: string, orderNumber: string) => {
    if (!phoneNumber.trim()) return;
    setLoading(true);
    setError("");
    setSearched(false);
    setCurrentPage(1);

    try {
      const query = new URLSearchParams({ phone: phoneNumber.trim() });
      if (orderNumber.trim()) query.set("order", orderNumber.trim());
      const res = await fetch(`/api/orders/by-phone?${query}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("errorFetchOrders"));
        setOrders([]);
        setVerified(false);
      } else {
        setOrders(data.orders || []);
        setVerified(Boolean(data.verified));
      }
    } catch {
      setError(t("errorSomethingWentWrong"));
      setOrders([]);
      setVerified(false);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  useEffect(() => {
    if (phoneParam && (!initialOrders || initialOrders.length === 0)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing the editable inputs from the URL params this effect already has to run for (performSearch is a required side effect, not derivable during render).
      setPhone(phoneParam);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- same as above.
      setOrderNo(orderParam);
      performSearch(phoneParam, orderParam);
    }
  }, [phoneParam, orderParam]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    const query = new URLSearchParams({ phone: phone.trim() });
    if (orderNo.trim()) query.set("order", orderNo.trim());
    router.push(`/track-order?${query}`);
  };
```

4. At the top of `handleDownloadInvoice`, before `try {`, add:

```tsx
    // Only a verified (phone + order number) lookup carries what the invoice needs.
    if (!order.orderNumber || order.shippingAddress == null || order.subtotal == null || order.shippingCost == null) return;
```

   In its `items` map, use these three lines in place of the existing `id`, `name` and `image` lines:

```tsx
        id: item.product?.id ?? item.id,
        name: item.product?.name ?? "",
        image: item.product?.images?.[0] || undefined,
```

5. In the search `<form>`, insert this after the `<div className="relative flex-1">…</div>` that wraps the phone input:

```tsx
            <div className="relative sm:w-48">
              <Input
                type="text"
                placeholder={t("orderNumberOptional")}
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value)}
                className="h-14 bg-background/50 backdrop-blur-sm border-border/50 rounded-2xl px-5 text-base focus-visible:ring-2 focus-visible:ring-primary/50 shadow-inner"
              />
            </div>
```

6. In the order cards:
   - Change `.map((order) => {` to `.map((order, index) => {`.
   - Change `key={order.id}` to ``key={order.orderNumber ?? `${order.createdAt}-${index}`}``.
   - Wrap the order-number `<div className="flex items-center gap-2">…</div>` in `{order.orderNumber && ( … )}`.
   - Change `{item.product.name}` to `{item.product?.name}`.
   - Replace the "download invoice" `<Button …>…</Button>` with:

```tsx
                {verified ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadInvoice(order)}
                    className="rounded-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                  >
                    <Download className="h-3.5 w-3.5 mr-2" />
                    {t("downloadInvoice")}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground max-w-[14rem]">{t("enterOrderNumberForDetails")}</p>
                )}
```

7. In `hooks/use-language.ts`:
   - In `en`, after `noOrdersFound: …,` add:

```ts
    orderNumberOptional: "Order no. (optional)",
    enterOrderNumberForDetails: "Add your order number to see the full details and invoice.",
```

   - In `bn`, after `noOrdersFound: …,` add:

```ts
    orderNumberOptional: "অর্ডার নম্বর (ঐচ্ছিক)",
    enterOrderNumberForDetails: "পুরো তথ্য আর ইনভয়েস দেখতে অর্ডার নম্বর দিন।",
```

8. In `app/(client)/order-success/page.tsx` line 299, carry the order number so customers arriving from checkout see full details:

```tsx
            <Link href={`/track-order?phone=${encodeURIComponent(order.guestPhone || phone || "")}&order=${encodeURIComponent(order.orderNumber)}`} className="flex-1">
```

- [ ] **Step 7: Verify**

Run: `pnpm test features/order/server/track-order.test.ts && pnpm typecheck && pnpm lint "app/(client)/track-order/page.tsx"`
Expected: PASS, no type errors, no lint errors.

Manual check (local dev):
- Search by phone only. You see status, items and total; no order number, no address, no invoice button.
- Search by phone and order number (try lower case). You see the full order, and the invoice downloads.
- Use the order-success page's "Track my order" link. It opens verified.

- [ ] **Step 8: Commit**

```bash
git add features/order/server/track-order.ts features/order/server/track-order.test.ts features/order/server/route.ts "app/(client)/track-order/page.tsx" "app/(client)/order-success/page.tsx" hooks/use-language.ts
git commit -F - <<'EOF'
fix(security): hide customer details from phone-only order lookups

GET /api/orders/by-phone returned name, address, note and order ids for
any phone number. A phone alone now returns a summary; the full order
needs the order number too.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Customer order view without cost prices

**Files:**
- Create: `features/order/server/customer-order.ts`
- Create: `features/order/server/customer-order.test.ts`
- Modify: `features/order/server/route.ts` (the non-staff branch of `GET /:id`, after line 941)

**Interfaces:**
- Consumes: nothing.
- Produces: `withoutCostPrices<T extends { items: ItemLike[] }>(order: T): T`.

- [ ] **Step 1: Write the failing test**

Create `features/order/server/customer-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { withoutCostPrices } from "@/features/order/server/customer-order";

const order = {
  orderNumber: "ORD-1",
  items: [
    { id: "i1", price: 1500, costPrice: 900, product: { name: "Sheet", addOns: [{ name: "Pillow cover", price: 200, costPrice: 80 }] } },
    { id: "i2", price: 500, costPrice: null, product: null },
  ],
};

describe("withoutCostPrices", () => {
  it("blanks line-item and add-on cost prices", () => {
    const out = withoutCostPrices(order);
    expect(out.items[0].costPrice).toBeNull();
    expect(JSON.stringify(out)).not.toContain("900");
    expect(JSON.stringify(out)).not.toContain('"costPrice":80');
  });

  it("keeps selling prices and everything else", () => {
    const out = withoutCostPrices(order);
    expect(out.orderNumber).toBe("ORD-1");
    expect(out.items[0].price).toBe(1500);
    expect(out.items[0].product?.addOns[0]).toEqual({ name: "Pillow cover", price: 200 });
    expect(out.items[1].product).toBeNull();
  });

  it("does not mutate the input", () => {
    withoutCostPrices(order);
    expect(order.items[0].costPrice).toBe(900);
    expect(order.items[0].product?.addOns[0].costPrice).toBe(80);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/order/server/customer-order.test.ts`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement `features/order/server/customer-order.ts`**

```ts
type ItemLike = {
  costPrice: number | null;
  product: { addOns: { name: string; price: number; costPrice?: number }[] } | null;
};

/**
 * The order as a customer may see it: the same shape staff get (the RPC
 * client types off one handler) with what the store paid blanked, meaning
 * each line item's cost price and the cost price of every add-on on the
 * embedded product.
 */
export function withoutCostPrices<T extends { items: ItemLike[] }>(order: T): T {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      costPrice: null,
      product: item.product
        ? {
            ...item.product,
            addOns: item.product.addOns.map((addOn) => {
              const copy = { ...addOn };
              delete copy.costPrice;
              return copy;
            }),
          }
        : item.product,
    })),
  } as T;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test features/order/server/customer-order.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Use it in the route**

In `features/order/server/route.ts`:
1. Add `import { withoutCostPrices } from "@/features/order/server/customer-order";`.
2. In the non-staff branch of `.get("/:id", …)`, change `...order,` (the first line inside the returned `order: { … }` object) to:

```ts
        ...withoutCostPrices(order),
```

- [ ] **Step 6: Verify**

Run: `pnpm test features/order/server && pnpm typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add features/order/server/customer-order.ts features/order/server/customer-order.test.ts features/order/server/route.ts
git commit -F - <<'EOF'
fix(security): stop sending cost prices to customers

GET /api/orders/:id returned each line item's costPrice and the product's
add-on cost prices to anyone holding the order link. Both are now blanked
for non-staff.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Guard the bKash callback

**Files:**
- Create: `lib/bkash-reference.ts`
- Create: `lib/bkash-reference.test.ts`
- Modify: `lib/bkash-orders.ts:85-91`
- Modify: `features/bkash/server/route.ts:160-163`

**Interfaces:**
- Consumes: nothing.
- Produces, from `lib/bkash-reference.ts`:
  - `paymentIdRef(paymentID: string): string`
  - `matchesIssuedPayment(reference: string | null, paymentID: string): boolean`, still re-exported from `lib/bkash-orders.ts`
  - `canSettleCallback(reference: string | null, paymentID: string | undefined): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/bkash-reference.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canSettleCallback, matchesIssuedPayment, paymentIdRef } from "@/lib/bkash-reference";

describe("canSettleCallback", () => {
  const reference = paymentIdRef("TR0011abc");

  it("accepts the paymentID issued for this order", () => {
    expect(canSettleCallback(reference, "TR0011abc")).toBe(true);
  });

  it("rejects a missing paymentID", () => {
    expect(canSettleCallback(reference, undefined)).toBe(false);
    expect(canSettleCallback(reference, "")).toBe(false);
  });

  it("rejects another order's paymentID", () => {
    expect(canSettleCallback(reference, "TR0099zzz")).toBe(false);
  });

  it("rejects when no payment was ever issued", () => {
    expect(canSettleCallback(null, "TR0011abc")).toBe(false);
  });
});

describe("matchesIssuedPayment", () => {
  it("matches only the exact reference", () => {
    expect(matchesIssuedPayment(paymentIdRef("A"), "A")).toBe(true);
    expect(matchesIssuedPayment(paymentIdRef("A"), "B")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/bkash-reference.test.ts`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement `lib/bkash-reference.ts`**

```ts
// The order's `reference` column remembers which bKash paymentID we issued
// for it, so a callback can prove it belongs to this order. Kept free of DB
// imports so it can be tested directly.
export const paymentIdRef = (paymentID: string) => `bKash paymentID: ${paymentID}`;

/** True when `reference` is the paymentID we issued for this order. */
export function matchesIssuedPayment(reference: string | null, paymentID: string): boolean {
  return reference === paymentIdRef(paymentID);
}

/**
 * May this callback change the order at all? bKash's redirect always carries
 * the paymentID (success, failure or cancel). A request without the one we
 * issued didn't come from bKash's page for this order (for example, someone
 * who only knows the order id) and must not cancel it.
 */
export function canSettleCallback(reference: string | null, paymentID: string | undefined): boolean {
  if (!paymentID) return false;
  return matchesIssuedPayment(reference, paymentID);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/bkash-reference.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Use it**

1. In `lib/bkash-orders.ts`:
   - Add `import { matchesIssuedPayment, paymentIdRef } from "@/lib/bkash-reference";` beside the other imports.
   - Replace lines 85-91 (the local `paymentIdRef`, the `trxIdRef` line and the `matchesIssuedPayment` function) with:

```ts
const trxIdRef = (trxID: string) => `bKash TrxID: ${trxID}`;

export { matchesIssuedPayment };
```

2. In `features/bkash/server/route.ts`:
   - Add `import { canSettleCallback } from "@/lib/bkash-reference";`.
   - Replace the `if (status !== "success") { … }` block with:

```ts
  if (status !== "success") {
    // Only the customer coming back from bKash's page for this order carries
    // the paymentID we issued. Without it, leave the order alone; if it's
    // never paid, the stale-order sweep releases the stock.
    if (!canSettleCallback(order.reference, paymentID)) return toCheckout("failed");
    await failBkashOrder(order.id, status === "cancel" ? "customer cancelled" : "payment failed");
    return toCheckout(status === "cancel" ? "cancelled" : "failed");
  }
```

- [ ] **Step 6: Verify**

Run: `pnpm test lib/bkash-reference.test.ts lib/bkash.test.ts && pnpm typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/bkash-reference.ts lib/bkash-reference.test.ts lib/bkash-orders.ts features/bkash/server/route.ts
git commit -F - <<'EOF'
fix(security): ignore bKash cancel callbacks without our paymentID

Anyone who knew an order id could cancel a pending bKash order through
the public callback. A failure or cancel now only settles the order when
it carries the paymentID issued for it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Refuse double Steadfast bookings

**Files:**
- Create: `features/steadfast/booking-guard.ts`
- Create: `features/steadfast/booking-guard.test.ts`
- Modify: `features/steadfast/server/route.ts:149-178` (the `/book` handler)
- Modify: `features/steadfast/api/use-steadfast.ts:40-62` (`useBookCourier`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `isAlreadyBooked(order: { trackingNumber: string | null }, force?: boolean): boolean`
  - `/api/steadfast/book` accepts `force?: boolean` and answers 409 `{ error, code: "ALREADY_BOOKED", trackingNumber }`.

- [ ] **Step 1: Write the failing test**

Create `features/steadfast/booking-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isAlreadyBooked } from "@/features/steadfast/booking-guard";

describe("isAlreadyBooked", () => {
  it("blocks an order that already has a tracking number", () => {
    expect(isAlreadyBooked({ trackingNumber: "SF123" })).toBe(true);
  });

  it("allows an order with no tracking number", () => {
    expect(isAlreadyBooked({ trackingNumber: null })).toBe(false);
    expect(isAlreadyBooked({ trackingNumber: "   " })).toBe(false);
  });

  it("allows an explicit re-book", () => {
    expect(isAlreadyBooked({ trackingNumber: "SF123" }, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test features/steadfast/booking-guard.test.ts`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement `features/steadfast/booking-guard.ts`**

```ts
/**
 * True when booking would create a second consignment for an order that
 * already has one. Steadfast charges per consignment and the customer could
 * receive two parcels, so a re-book has to be explicit (`force`).
 */
export function isAlreadyBooked(order: { trackingNumber: string | null }, force = false): boolean {
  return !force && Boolean(order.trackingNumber?.trim());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test features/steadfast/booking-guard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into the route and the client hook**

1. In `features/steadfast/server/route.ts`:
   - Add `import { isAlreadyBooked } from "@/features/steadfast/booking-guard";`.
   - In the `/book` zod object, add `force: z.boolean().optional(),` after the `costPrices` field.
   - Change the destructuring to `const { orderId, recipient_phone, note, costPrices, force } = c.req.valid("json");`.
   - Directly after `if (!order) return c.json({ error: "Order not found" }, 404);` insert:

```ts
      // Before anything is written (cost prices included): a second
      // consignment means a second parcel and a second courier charge.
      if (isAlreadyBooked(order, force)) {
        return c.json(
          { error: `Already booked (tracking ${order.trackingNumber})`, code: "ALREADY_BOOKED", trackingNumber: order.trackingNumber },
          409
        );
      }
```

2. In `features/steadfast/api/use-steadfast.ts`, replace the `mutationFn` of `useBookCourier` with:

```ts
    mutationFn: async (json: BookRequestType["json"]) => {
      let res = await client.api.steadfast.book["$post"]({ json });
      if (res.status === 409) {
        const conflict = (await res.json()) as { trackingNumber?: string | null };
        const again = window.confirm(
          `This order is already booked (tracking ${conflict.trackingNumber ?? "unknown"}). Book a second parcel anyway?`
        );
        if (!again) throw new Error("Not booked: the order already has a consignment");
        res = await client.api.steadfast.book["$post"]({ json: { ...json, force: true } });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(
          "error" in err ? (err as { error: string }).error : "Booking failed"
        );
      }
      return res.json();
    },
```

   Bulk booking goes through the same hook, so it asks once per already-booked order. Answering Cancel skips that order.

- [ ] **Step 6: Verify**

Run: `pnpm test features/steadfast && pnpm typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add features/steadfast/booking-guard.ts features/steadfast/booking-guard.test.ts features/steadfast/server/route.ts features/steadfast/api/use-steadfast.ts
git commit -F - <<'EOF'
fix(orders): refuse to book an order with Steadfast twice

/book never checked for an existing tracking number, so a double click or
a repeated bulk booking created a second consignment. It now answers 409
unless the caller confirms a re-book.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: Quality gate (lint errors + CI `verify` job)

**Files:**
- Modify: `app/(dashboard)/dashboard/images/images-client.tsx:162-163`
- Modify: `app/(dashboard)/dashboard/orders/page.tsx:551-554`, `:768-777`
- Modify: `app/(dashboard)/dashboard/pos/pos-client.tsx:138-142`
- Modify: `features/checkout/components/order-summery-card.tsx:5,13-22`
- Modify: `features/product/api/use-get-products.ts:44`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `useHasMounted` from `hooks/use-has-mounted.ts` (already exists).
- Produces: a `verify` job that `build-and-push` depends on.

- [ ] **Step 1: Confirm the failing gate**

Run: `pnpm lint 2>&1 | grep -B1 " error "`
Expected: exactly these 6 errors:
- `images-client.tsx` 162 no-explicit-any
- `orders/page.tsx` 553 set-state-in-effect
- `orders/page.tsx` 768 preserve-manual-memoization
- `pos-client.tsx` 140 set-state-in-effect
- `order-summery-card.tsx` 21 set-state-in-effect
- `use-get-products.ts` 44 no-explicit-any

- [ ] **Step 2: Fix the six errors**

1. `app/(dashboard)/dashboard/images/images-client.tsx`:
   - Change `} catch (err: any) {` to `} catch (err) {`.
   - Change the next line to:

```tsx
      toast.error(err instanceof Error && err.message ? err.message : "Failed to sync products to n8n");
```

2. `app/(dashboard)/dashboard/orders/page.tsx`. `useHasMounted` is already imported at line 89. Replace:

```tsx
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
```

   with:

```tsx
  const mounted = useHasMounted();
```

3. Same file. Replace the `configuredFbPages` memo with:

```tsx
  // Read once into a local so the memo's dependency is exactly what it uses.
  const fbPagesSetting = settings?.pos_facebook_pages;
  const configuredFbPages: { id: string; name: string }[] = React.useMemo(() => {
    if (!fbPagesSetting) return [{ id: "default", name: "Sleep Sheet" }];
    try {
      const parsed = JSON.parse(fbPagesSetting);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: "default", name: "Sleep Sheet" }];
    } catch {
      return [{ id: "default", name: "Sleep Sheet" }];
    }
  }, [fbPagesSetting]);
```

   (The "Sleep Sheet" default goes away in SP-1's white-label work, not here.)

4. `app/(dashboard)/dashboard/pos/pos-client.tsx`. Replace the effect at lines 138-142 with the following. It uses the same justified-disable pattern as the effect directly below it.

```tsx
  useEffect(() => {
    if (defaultFbPage && !reference) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the default page arrives once settings load; reference stays user-editable afterward, so it can't be purely derived.
      setReference(defaultFbPage)
    }
  }, [defaultFbPage, reference])
```

5. `features/checkout/components/order-summery-card.tsx`:
   - Change line 5 to `import React from "react";`.
   - Add `import { useHasMounted } from "@/hooks/use-has-mounted";`.
   - Replace `const [mounted, setMounted] = useState(false);` and the `useEffect(() => { setMounted(true); }, []);` block with:

```tsx
  const mounted = useHasMounted();
```

6. `features/product/api/use-get-products.ts`. Replace line 44 (`      data: any[];`) with:

```ts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pages come from two sources (server-rendered ProductSummary[] and the RPC response) whose row types differ; tightening this belongs to the SP-7 catalogue work.
      data: any[];
```

- [ ] **Step 3: Verify the local gate is green**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected:
- typecheck: no errors.
- lint: `0 errors` (warnings are allowed).
- test: all test files pass.

- [ ] **Step 4: Add the `verify` job**

In `.github/workflows/deploy.yml`:
- Insert this as the first job under `jobs:`.
- Add `needs: verify` to `build-and-push`, directly under its `build-and-push:` key.

```yaml
  verify:
    runs-on: ubuntu-latest
    env:
      # Dummy values: nothing here talks to a database or signs real tokens,
      # but some modules validate that these exist when imported.
      DATABASE_URL: postgres://x:x@127.0.0.1:1/x
      JWT_SECRET: ci-only-not-a-real-secret-0123456789abcdef
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.32.1

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Route/page types that `next build` would normally generate.
      - name: Generate Next.js types
        run: pnpm exec next typegen

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

```

Also update the comment in `next.config.ts` near `ignoreBuildErrors` and the matching note in `deploy/README.md` to say: typecheck runs in the CI `verify` job, which the image build depends on.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/images/images-client.tsx" "app/(dashboard)/dashboard/orders/page.tsx" "app/(dashboard)/dashboard/pos/pos-client.tsx" features/checkout/components/order-summery-card.tsx features/product/api/use-get-products.ts .github/workflows/deploy.yml next.config.ts deploy/README.md
git commit -F - <<'EOF'
ci: typecheck, lint and test before building the image

CI built and deployed without running any checks, and the Docker build
skips the typecheck. A verify job now gates the image build. The six
existing lint errors are fixed so the gate starts green.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 6 (after the next push): Confirm the gate**

In GitHub → Actions, the run shows `verify` succeeding before `build-and-push` starts.
(Optional proof: a scratch branch with a deliberate type error fails `verify`, and no image is pushed. Delete the branch afterwards.)

---

### Task 11: API error alerting

**Files:**
- Create: `lib/error-alert.ts`
- Create: `lib/error-alert.test.ts`
- Modify: `app/api/[[...route]]/route.ts` (after `const app = new Hono().basePath("/api");`)
- Modify: `lib/env.ts` (beside `N8N_ORDER_WEBHOOK_URL`)
- Modify: `.env.example` (beside `N8N_ORDER_WEBHOOK_URL`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `shouldSendAlert(key: string, now: number, windowMs?: number): boolean`
  - `resetAlertThrottle(): void`
  - `notifyServerError(details: { method: string; path: string; message: string }): void`

- [ ] **Step 1: Write the failing test**

Create `lib/error-alert.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { resetAlertThrottle, shouldSendAlert } from "@/lib/error-alert";

describe("shouldSendAlert", () => {
  beforeEach(() => resetAlertThrottle());

  it("sends the first alert for an error", () => {
    expect(shouldSendAlert("GET /api/x boom", 0)).toBe(true);
  });

  it("suppresses repeats inside the window", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("GET /api/x boom", 60_000)).toBe(false);
  });

  it("sends again once the window has passed", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("GET /api/x boom", 5 * 60_000)).toBe(true);
  });

  it("tracks different errors separately", () => {
    shouldSendAlert("GET /api/x boom", 0);
    expect(shouldSendAlert("POST /api/y bang", 1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test lib/error-alert.test.ts`
Expected: FAIL, the import cannot be resolved.

- [ ] **Step 3: Implement `lib/error-alert.ts`**

```ts
import { after } from "next/server";

const ALERT_WINDOW_MS = 5 * 60_000;
const lastSent = new Map<string, number>();

/**
 * One alert per distinct error per window, so a crash loop sends one
 * Telegram message instead of hundreds. In-process, like the rate limiter:
 * enough for one container.
 */
export function shouldSendAlert(key: string, now: number, windowMs = ALERT_WINDOW_MS): boolean {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  lastSent.set(key, now);
  if (lastSent.size > 500) {
    for (const [k, t] of lastSent) if (now - t >= windowMs) lastSent.delete(k);
  }
  return true;
}

export function resetAlertThrottle(): void {
  lastSent.clear();
}

/** Fire-and-forget alert to n8n (→ Telegram). No-op unless N8N_ERROR_WEBHOOK_URL is set. */
export function notifyServerError(details: { method: string; path: string; message: string }): void {
  const webhookUrl = process.env.N8N_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;
  if (!shouldSendAlert(`${details.method} ${details.path} ${details.message}`, Date.now())) return;

  after(() =>
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...details, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    }).catch((error) => {
      console.error("n8n error alert failed:", error);
    })
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test lib/error-alert.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Install the handler and the env var**

1. In `app/api/[[...route]]/route.ts`:
   - Add `import { HTTPException } from "hono/http-exception";` and `import { notifyServerError } from "@/lib/error-alert";`.
   - Directly after `const app = new Hono().basePath("/api");` add:

```ts
// Anything a handler throws lands here instead of Hono's bare "Internal
// Server Error" text: log it, alert (throttled) and answer with JSON the
// client hooks can read. The error message never reaches the caller.
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  const path = c.req.routePath || new URL(c.req.url).pathname;
  console.error(`[api] ${c.req.method} ${path}`, err);
  notifyServerError({ method: c.req.method, path, message: String(err.message ?? err).slice(0, 300) });
  return c.json({ error: "Internal server error" }, 500);
});
```

2. In `lib/env.ts`, add beside `N8N_ORDER_WEBHOOK_URL`:

```ts
  // n8n webhook that forwards unexpected API errors to Telegram (optional).
  N8N_ERROR_WEBHOOK_URL: z.string().url().optional(),
```

3. In `.env.example`, add beside `N8N_ORDER_WEBHOOK_URL=""`:

```
N8N_ERROR_WEBHOOK_URL=""
```

- [ ] **Step 6: Verify**

Run: `pnpm test lib/error-alert.test.ts lib/env.test.ts && pnpm typecheck`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add lib/error-alert.ts lib/error-alert.test.ts "app/api/[[...route]]/route.ts" lib/env.ts .env.example
git commit -F - <<'EOF'
feat(ops): alert on unexpected API errors through n8n

Unhandled errors only reached the container log. The API now logs them,
returns a JSON 500 and, when N8N_ERROR_WEBHOOK_URL is set, sends one
throttled alert per distinct error to n8n for Telegram.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 8 (owner): Create the n8n workflow and set the variable**

1. In n8n, create a workflow: **Webhook** (POST) → **Telegram** (reuse the order-alert credential and chat). Message:

```
🚨 API error
{{$json.body.method}} {{$json.body.path}}
{{$json.body.message}}
{{$json.body.at}}
```

2. Activate it, and set the production URL as `N8N_ERROR_WEBHOOK_URL` in Dokploy's environment for the app.

---

### Task 12: Operations: prove backups, lock the origin to Cloudflare

**Files:**
- Modify: `deploy/README.md` (add "Backups" and "Origin firewall" sections)

**Interfaces:**
- Consumes: Task 1, which assumes only Cloudflare reaches the origin.
- Produces: a recorded restore drill and a firewall that drops non-Cloudflare traffic on 80/443.

- [ ] **Step 1 (owner): Find the backups**

On the VPS:
- `docker ps --format '{{.Names}}' | grep -i -E 'backup|cron'`
- Check whether Dokploy's own database-backup feature is enabled for this Postgres.

Expected: one of the two is producing dated dumps, and you know where they are.
If neither is, stop here and set up Dokploy's scheduled Postgres backup (daily, keep at least 14) before going on.

- [ ] **Step 2 (owner): Restore drill**

Restore the newest dump into a scratch database:
- `createdb restore_test`
- Then either `pg_restore -d restore_test <dump>` (custom format) or `psql restore_test < <dump.sql>`.

Compare `SELECT count(*) FROM orders;` between `restore_test` and production; the counts should match up to the dump time. Then `dropdb restore_test`.

- [ ] **Step 3 (owner): Lock 80/443 to Cloudflare**

Docker publishes ports through its own iptables chain, which **bypasses ufw**, so the rule must go in `DOCKER-USER`.

Prerequisites, all of which must hold before you start:
- Every hostname on this server (site and n8n) is proxied (orange cloud) in Cloudflare.
- No Traefik router uses Let's Encrypt HTTP-01; the site already uses a Cloudflare Origin CA certificate.
- You have an SSH session open as a fallback.

```bash
sudo iptables -I DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  sudo iptables -I DOCKER-USER -p tcp -m multiport --dports 80,443 -s "$ip" -j RETURN
done
sudo ip6tables -I DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  sudo ip6tables -I DOCKER-USER -p tcp -m multiport --dports 80,443 -s "$ip" -j RETURN
done
sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
```

Verify:
- `curl -sI https://www.sleepsheetbd.com` returns 200.
- The n8n hostname loads.
- `curl -m 5 -sI http://<VPS_IP>` from outside times out.

- [ ] **Step 4: Record it**

Add to `deploy/README.md`:
- A **Backups** section: where the dumps are, the schedule, retention, and "Restore drill: <date>, orders count matched".
- An **Origin firewall** section: the commands above, why `DOCKER-USER` (not ufw), and a note to refresh the Cloudflare ranges if Cloudflare publishes new ones.

```bash
git add deploy/README.md
git commit -F - <<'EOF'
docs(deploy): record the backup restore drill and origin firewall

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### SP-0 exit checklist

- [ ] All 12 tasks committed, with migrations applied in the order given in "Deployment order".
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green locally, and `verify` green in Actions.
- [ ] Manual checks done: Task 3, Task 5, Task 6, Task 9 (re-book prompt).
- [ ] Mobile Lighthouse for Home, Product and Checkout is within 3 points of the baseline in `brief.md` §2. Only track-order changed on the storefront.
- [ ] `docs/brief.md` updated: SP-0 marked done, with the date.

---

## Roadmap after SP-0

Each sub-project starts with its own design pass: superpowers brainstorming against its section of `brief.md` §4. That pass produces `docs/plans/sp-<n>-<slug>.md` in this format before any code is written. These plans are not written yet on purpose, because each depends on decisions made in the sub-projects before it.

**Gate between sub-projects**
- Every task is committed.
- `verify` is green.
- Mobile Lighthouse is within budget.
- The owner signs off.

| ID | Sub-project | Depends on | Estimate | Detailed plan |
|---|---|---|---|---|
| SP-0 | Safety | n/a | ~1 week | this file |
| SP-1 | Settings engine and store profile | SP-0 | 1–2 weeks | `docs/plans/sp-1-settings-engine.md` |
| SP-2 | Bangladesh checkout and delivery accuracy | SP-1 | 2–3 weeks | `docs/plans/sp-2-bd-checkout.md` |
| SP-3 | Theme system | SP-1 | 2–3 weeks | `docs/plans/sp-3-theme.md` |
| SP-5a | AI copilot and content AI | SP-1 | 2–3 weeks | `docs/plans/sp-5a-ai-copilot.md` |
| SP-5b | Social AI chat (Messenger, then WhatsApp) | SP-1; chat orders use SP-2; WhatsApp ships with SP-4 | 3–4 weeks + Meta setup | `docs/plans/sp-5b-social-ai-chat.md` |
| SP-4 | Courier, payment and notification hub | SP-1, SP-2 | 3–4 weeks | `docs/plans/sp-4-integrations-hub.md` |
| SP-6 | Marketing and growth | SP-2, SP-4 | 3–4 weeks | `docs/plans/sp-6-marketing.md` |
| SP-7 | Admin UX and operations | n/a | continuous | one plan per item |

**Order:** SP-0 → SP-1 → SP-2 → (SP-3, SP-5a and SP-5b v1, in any order) → SP-4 (with SP-5b v3, WhatsApp) → SP-6. SP-7 runs alongside.

### Milestones per sub-project

Each milestone below is a shippable slice that its design pass turns into tasks.

**SP-1, Settings engine and store profile**
1. Typed registry (`lib/settings/registry.ts`) and typed reads (`getSetting`, `getSettingsGroup`) with per-group cache tags; the settings PATCH validates against the registry.
2. Secret encryption (AES-256-GCM, `SETTINGS_ENCRYPTION_KEY`, `enc:v1:`), plus a one-off script to encrypt existing rows.
3. The `store.*` profile wired into `generateMetadata`, JSON-LD, manifest, OG image, invoice and footer; `lib/seo/config.ts` becomes defaults only.
4. Dead keys wired or removed; business-rules group; hardcoded fallbacks removed (GTM, GA4, n8n, LUXSTORE, image host); `cacheTag()` helper.
5. Cookie rename (`luxestore-session` to a neutral name) at a low-traffic hour.

**SP-2, Bangladesh checkout and delivery accuracy**
1. Location dataset (licence checked) with district/thana pickers at checkout; the server derives the zone.
2. Shipping zones table, weight-based charge, ETA on the product page.
3. Smart COD rules engine (BDCourier ratio, own history, advance via bKash, flag/block) with a decision log.
4. `transitionOrder()` service, a manual status control, and courier sync through the same path.
5. Variants with SKU/stock, `stock_movements` ledger, auto-restock on return.
6. Net profit per order (product cost default, actual courier charge, return cost).

**SP-3, Theme system**
1. Brand tokens and Tailwind mapping; all hardcoded brand hex replaced.
2. Server-rendered theme `<style>` from settings, presets, fonts.
3. Seasonal schedule with boundary revalidation from the cron container.
4. Home section builder (registry + `@dnd-kit` editor).
5. Menus, announcement bar, CMS `pages` table replacing the hardcoded about/FAQ/policy copy.

**SP-5a, AI copilot and content AI**
1. AI SDK with BYOK settings, a usage log and budget caps.
2. Copilot panel using the MCP tool registry under the staff member's permissions, with confirm-before-write.
3. "Write with AI" buttons in the product, category, blog and review forms.
4. Daily owner summary via n8n → Telegram.

**SP-5b, Social AI chat**
1. v1: Meta webhook gateway, `conversations` / `conversation_messages`, Inbox with takeover, bot-scoped API key + `/api/bot/*`, n8n template provisioning via the n8n API, AI Chat settings page, playground. Messenger only.
2. v2: chat orders (pending orders with source and page), plus comment-to-inbox private replies.
3. v3: WhatsApp Cloud API channel (after re-checking pricing and coexistence for Bangladesh).
4. v4: photo search, voice notes.

**SP-4, Courier, payment and notification hub**
1. `CourierProvider` with Steadfast as the first adapter; Pathao, then RedX; `courier_area_map`; courier webhooks.
2. COD payout reconciliation.
3. `PaymentProvider` with bKash as the first adapter; Nagad; SSLCommerz; bKash refund.
4. Outbox + `pg-boss` worker container; dead-letter view; signed outbound webhooks.
5. SMS/email channels, templates and triggers; Integrations page with Test and health.

**SP-6, Marketing and growth**
1. Coupons and automatic discounts (server-validated, recorded on orders).
2. Campaigns and flash sales on the existing `campaigns` table; ad landing pages.
3. Incomplete-checkout capture and call-back list; SMS follow-up.
4. Customer CRM (profile, tags, notes, segments, export).
5. Reviews with photos and moderation; back-in-stock alerts; pre-orders; working newsletter.

**SP-7, Admin UX and operations** (one small plan per item, picked as capacity allows)
- Bangla admin
- Cmd+K search (phone included)
- Real-time order alerts
- Role dashboards and saved views
- Invoice/label designer
- POS barcode and receipts
- CSV import/export and bulk edit
- Staff invite, deactivate and 2FA
- Split `orders/page.tsx`
