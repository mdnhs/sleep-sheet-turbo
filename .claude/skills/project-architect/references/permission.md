# Permission System Reference

## Overview

Bit-compressed permission system using base64-encoded bitfields for efficient storage in sessions/cookies.
Permissions are stored as a compact `CompressedPermissions` string (base64 of a Uint8Array bitfield),
reducing session payload size drastically compared to storing raw permission strings.

**Why this design matters for cost:** permissions travel inside the signed session token, so
authorising a request is pure CPU — no database read. A permission system that queries a
`user_permissions` table per request would wake Neon on every page view and prevent the compute
endpoint from ever suspending. Keep it that way: never add a DB lookup to the auth path.

**Server-side checks are the real ones.** `PermissionGate` and `usePermissions` control what the UI
shows; they are trivially bypassed. Every protected operation must also be gated on the server —
`requirePermission('...')` on the Hono route (see `hono-api.md`), using the same permission keys
defined here.

## Setup commands to append

No additional packages required. The system uses built-in browser APIs (`btoa`/`atob`).

---

## Files to generate

When Permission is selected, generate the following files with **full implementations** (not empty shells).

---

### `src/lib/permission/utils.ts`

Core compression/decompression logic and permission checker factory.

```ts
// lib/permission-compression.ts
import { PERMISSIONS } from './permissions';

// Types
type PermissionKey = keyof typeof PERMISSIONS;
type PermissionValue = (typeof PERMISSIONS)[PermissionKey];
type CompressedPermissions = string;

// Constants
const TOTAL_PERMISSIONS = Object.keys(PERMISSIONS).length;
const BYTE_LENGTH = Math.ceil(TOTAL_PERMISSIONS / 8);

// Create bit mapping from your permission constants
const createPermissionBitMap = (): Record<PermissionKey, number> => {
  const entries = Object.keys(PERMISSIONS) as PermissionKey[];
  return entries.reduce<Record<PermissionKey, number>>(
    (acc, key, index) => ({
      ...acc,
      [key]: index,
    }),
    {} as Record<PermissionKey, number>,
  );
};

const createBitToPermissionMap = (): Record<number, PermissionKey> => {
  const entries = Object.keys(PERMISSIONS) as PermissionKey[];
  return entries.reduce<Record<number, PermissionKey>>(
    (acc, key, index) => ({
      ...acc,
      [index]: key,
    }),
    {} as Record<number, PermissionKey>,
  );
};

// Static mappings
const PERMISSION_BIT_MAP = createPermissionBitMap();
const BIT_TO_PERMISSION_MAP = createBitToPermissionMap();

// Helper functions
const getPermissionConstantKey = (permissionValue: string): PermissionKey | undefined => {
  return (Object.entries(PERMISSIONS) as [PermissionKey, string][]).find(
    ([_, value]) => value === permissionValue,
  )?.[0];
};

const setBitInArray = (bitArray: Uint8Array, bitIndex: number): Uint8Array => {
  const newArray = new Uint8Array(bitArray);
  const byteIndex = Math.floor(bitIndex / 8);
  const bitOffset = bitIndex % 8;
  newArray[byteIndex] |= 1 << bitOffset;
  return newArray;
};

const isBitSetInArray = (bitArray: Uint8Array, bitIndex: number): boolean => {
  const byteIndex = Math.floor(bitIndex / 8);
  const bitOffset = bitIndex % 8;
  return !!(bitArray[byteIndex] & (1 << bitOffset));
};

const stringToUint8Array = (str: string): Uint8Array => {
  const array = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    array[i] = str.charCodeAt(i);
  }
  return array;
};

const uint8ArrayToBase64 = (array: Uint8Array): string => {
  return btoa(String.fromCharCode(...array));
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  return stringToUint8Array(binaryString);
};

// Core compression functions
export const compressPermissions = (permissions: PermissionValue[]): CompressedPermissions => {
  const initialBitArray = new Uint8Array(BYTE_LENGTH);

  const compressedBitArray = permissions.reduce<Uint8Array>((bitArray, permission) => {
    const constantKey = getPermissionConstantKey(permission);

    if (!constantKey || PERMISSION_BIT_MAP[constantKey] === undefined) {
      console.warn(`Unknown permission: ${permission}`);
      return bitArray;
    }

    const bitIndex = PERMISSION_BIT_MAP[constantKey];
    return setBitInArray(bitArray, bitIndex);
  }, initialBitArray);

  return uint8ArrayToBase64(compressedBitArray);
};

export const decompressPermissions = (compressedData: CompressedPermissions): PermissionValue[] => {
  try {
    const bitArray = base64ToUint8Array(compressedData);

    const permissions: PermissionValue[] = [];

    for (let bitIndex = 0; bitIndex < TOTAL_PERMISSIONS; bitIndex++) {
      if (isBitSetInArray(bitArray, bitIndex)) {
        const constantKey = BIT_TO_PERMISSION_MAP[bitIndex];
        if (constantKey && PERMISSIONS[constantKey]) {
          permissions.push(PERMISSIONS[constantKey]);
        }
      }
    }

    return permissions;
  } catch (error) {
    console.error('Failed to decompress permissions:', error);
    return [];
  }
};

// Permission checking functions
export const createPermissionChecker = (compressedPermissions: CompressedPermissions) => {
  let bitArray: Uint8Array | null = null;

  // Lazy initialization
  const getBitArray = (): Uint8Array => {
    if (!bitArray) {
      try {
        bitArray = base64ToUint8Array(compressedPermissions);
      } catch {
        bitArray = new Uint8Array(BYTE_LENGTH);
      }
    }
    return bitArray;
  };

  const hasPermissionByKey = (permissionKey: PermissionKey): boolean => {
    const bitIndex = PERMISSION_BIT_MAP[permissionKey];
    if (bitIndex === undefined) return false;
    return isBitSetInArray(getBitArray(), bitIndex);
  };

  const hasPermissionByValue = (permissionValue: PermissionValue): boolean => {
    const constantKey = getPermissionConstantKey(permissionValue);
    return constantKey ? hasPermissionByKey(constantKey) : false;
  };

  const hasAnyPermissionByKeys = (permissionKeys: PermissionKey[]): boolean => {
    return permissionKeys.some(hasPermissionByKey);
  };

  const hasAnyPermissionByValues = (permissionValues: PermissionValue[]): boolean => {
    return permissionValues.some(hasPermissionByValue);
  };

  const hasAllPermissionsByKeys = (permissionKeys: PermissionKey[]): boolean => {
    return permissionKeys.every(hasPermissionByKey);
  };

  const hasAllPermissionsByValues = (permissionValues: PermissionValue[]): boolean => {
    return permissionValues.every(hasPermissionByValue);
  };

  const getAllPermissions = (): PermissionValue[] => {
    return decompressPermissions(compressedPermissions);
  };

  const getPermissionCount = (): number => {
    const bits = getBitArray();
    let count = 0;
    for (let bitIndex = 0; bitIndex < TOTAL_PERMISSIONS; bitIndex++) {
      if (isBitSetInArray(bits, bitIndex)) {
        count++;
      }
    }
    return count;
  };

  return {
    hasPermissionByKey,
    hasPermissionByValue,
    hasAnyPermissionByKeys,
    hasAnyPermissionByValues,
    hasAllPermissionsByKeys,
    hasAllPermissionsByValues,
    getAllPermissions,
    getPermissionCount,
  } as const;
};

// Utility functions for working with permission constants
export const getPermissionValue = (key: PermissionKey): PermissionValue => PERMISSIONS[key];

export const getPermissionKey = (value: PermissionValue): PermissionKey | undefined => {
  return getPermissionConstantKey(value);
};

export const getAllPermissionKeys = (): PermissionKey[] => {
  return Object.keys(PERMISSIONS) as PermissionKey[];
};

export const getAllPermissionValues = (): PermissionValue[] => {
  return Object.values(PERMISSIONS);
};

// Validation functions
export const isValidPermissionKey = (key: string): key is PermissionKey => {
  return key in PERMISSIONS;
};

export const isValidPermissionValue = (value: string): value is PermissionValue => {
  return Object.values(PERMISSIONS).includes(value as PermissionValue);
};

// Debugging utilities
export const getCompressionStats = (
  permissions: PermissionValue[],
): {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  savedBytes: number;
} => {
  const originalSize = permissions.reduce((acc, perm) => acc + perm.length, 0);
  const compressed = compressPermissions(permissions);
  const compressedSize = compressed.length;

  return {
    originalSize,
    compressedSize,
    compressionRatio: ((originalSize - compressedSize) / originalSize) * 100,
    savedBytes: originalSize - compressedSize,
  };
};

export const debugCompressedPermissions = (
  compressedData: CompressedPermissions,
): {
  isValid: boolean;
  permissionCount: number;
  byteLength: number;
  permissions: PermissionValue[];
} => {
  try {
    const permissions = decompressPermissions(compressedData);
    const bitArray = base64ToUint8Array(compressedData);

    return {
      isValid: true,
      permissionCount: permissions.length,
      byteLength: bitArray.length,
      permissions,
    };
  } catch {
    return {
      isValid: false,
      permissionCount: 0,
      byteLength: 0,
      permissions: [],
    };
  }
};

// Migration utilities
export const migrateUncompressedPermissions = (permissions: PermissionValue[]): CompressedPermissions => {
  return compressPermissions(permissions);
};

export const validateCompressedPermissions = (compressedData: CompressedPermissions): boolean => {
  try {
    const decompressed = decompressPermissions(compressedData);
    const recompressed = compressPermissions(decompressed);
    return recompressed === compressedData;
  } catch {
    return false;
  }
};

// Export type helpers for better TypeScript support
export type { PermissionKey, PermissionValue, CompressedPermissions };
export type PermissionChecker = ReturnType<typeof createPermissionChecker>;
```

---

### `src/lib/permission/permissions.ts`

**Project-specific** — replace the PERMISSIONS object with this project's actual permissions.
The constant keys use `SCREAMING_SNAKE_CASE` and values use `module.resource.action` dot notation.

```ts
// Replace with this project's actual permissions.
// Pattern: KEY: 'module.resource.action'
export const PERMISSIONS = {
  // USER MANAGEMENT
  USER_MANAGEMENT_USER_VIEW_LIST: 'user_management.user.view_list',
  USER_MANAGEMENT_USER_CREATE: 'user_management.user.create',
  USER_MANAGEMENT_USER_EDIT: 'user_management.user.edit',
  USER_MANAGEMENT_USER_DISABLE: 'user_management.user.disable',
  USER_MANAGEMENT_USER_ENABLE: 'user_management.user.enable',
  USER_MANAGEMENT_ROLE_VIEW_LIST: 'user_management.role.view_list',
  USER_MANAGEMENT_ROLE_CREATE: 'user_management.role.create',
  USER_MANAGEMENT_ROLE_EDIT: 'user_management.role.edit',
  USER_MANAGEMENT_PERMISSION_VIEW: 'user_management.permission.view',
} as const;
```

---

### `src/lib/permission/permission-gate.tsx`

Server component that guards UI by permissions. Uses `getServerPermissionChecker` from `server-utils.ts`.

```tsx
import { type PermissionValue } from '@/lib/permission/utils';
import { getServerPermissionChecker } from '@/lib/permission/server-utils';

interface PermissionGateProps {
  permissions: PermissionValue[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export async function PermissionGate({
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const checker = await getServerPermissionChecker();

  if (!checker) {
    return <>{fallback}</>;
  }

  const hasAccess = requireAll
    ? checker.hasAllPermissionsByValues(permissions)
    : checker.hasAnyPermissionByValues(permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

---

### `src/lib/permission/client-permission-gate.tsx`

Client component equivalent of `PermissionGate`. Reads compressed permissions from the session via `usePermissions`.

```tsx
'use client';
import { usePermissions } from '@/lib/permission/usePermissions';
import { type PermissionValue } from '@/lib/permission/utils';

interface ClientPermissionGateProps {
  permissions: PermissionValue[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ClientPermissionGate({
  permissions,
  requireAll = false,
  fallback = null,
  loadingFallback = null,
  children,
}: ClientPermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
```

---

### `src/lib/permission/usePermissions.ts`

Client-side hook. Reads `compressedPermissions` from the NextAuth session and creates a checker instance.

```ts
'use client';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { createPermissionChecker, type PermissionKey, type PermissionValue } from '@/lib/permission/utils';

export function usePermissions() {
  // const { data: session, status } = useSession();
  const session = null;
  const status = null;

  const checker = useMemo(() => {
    if (status !== 'authenticated' || !session?.user?.compressedPermissions) {
      return null;
    }
    return createPermissionChecker(session.user.compressedPermissions);
  }, [session?.user?.compressedPermissions, status]);

  const hasPermission = (permission: PermissionValue): boolean => {
    return checker?.hasPermissionByValue(permission) ?? false;
  };

  const hasPermissionByKey = (permissionKey: PermissionKey): boolean => {
    return checker?.hasPermissionByKey(permissionKey) ?? false;
  };

  const hasAnyPermission = (permissions: PermissionValue[]): boolean => {
    return checker?.hasAnyPermissionByValues(permissions) ?? false;
  };

  const hasAllPermissions = (permissions: PermissionValue[]): boolean => {
    return checker?.hasAllPermissionsByValues(permissions) ?? false;
  };

  const getAllPermissions = (): PermissionValue[] => {
    return checker?.getAllPermissions() ?? [];
  };

  const getPermissionCount = (): number => {
    return checker?.getPermissionCount() ?? 0;
  };

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated';

  return {
    hasPermission,
    hasPermissionByKey,
    hasAnyPermission,
    hasAllPermissions,
    getAllPermissions,
    getPermissionCount,
    isLoading,
    isAuthenticated,
  };
}
```

---

### `src/lib/permission/route-permissions.ts`

Maps app routes to required permission values. Used by middleware and `server-utils.ts` for route-level access control.
Dynamic segments use `:param` syntax. An empty array `[]` means the route is publicly accessible.

```ts
import { PERMISSIONS } from './permissions';

type RoutePermissionConfig = Record<string, PermissionValue[]>;

// Types
type PermissionKey = keyof typeof PERMISSIONS;
type PermissionValue = (typeof PERMISSIONS)[PermissionKey];

export const ROUTE_PERMISSIONS: RoutePermissionConfig = {
  // USER MANAGEMENT
  '/users': ['user_management.user.view_list'],
  '/users/create': ['user_management.user.create'],
  '/users/:id/edit': ['user_management.user.edit'],
  '/roles': ['user_management.role.view_list'],
  '/roles/create': ['user_management.role.create'],
  '/roles/:id/edit': ['user_management.role.edit'],

  // Add more routes here as features are built out
};
```

---

### `src/lib/permission/server-utils.ts`

Server-side helpers. Reads `compressedPermissions` from the NextAuth session (via `auth()`).
Also exposes `validateRouteAccess` for use in middleware.

```ts
// lib/permission/server-utils.ts
import { ROUTE_PERMISSIONS } from '@/lib/permission/route-permissions';
import { auth } from '../../../auth';
import {
  type CompressedPermissions,
  createPermissionChecker,
  decompressPermissions,
  type PermissionChecker,
  type PermissionValue,
} from './utils';

// Server-side permission helpers
export const getCompressedPermissionsFromSession = async (): Promise<CompressedPermissions | null> => {
  try {
    const session = await auth();
    return session?.user?.compressedPermissions || null;
  } catch {
    return null;
  }
};

export const getServerPermissionChecker = async (): Promise<PermissionChecker | null> => {
  const compressedPermissions = await getCompressedPermissionsFromSession();
  return compressedPermissions ? createPermissionChecker(compressedPermissions) : null;
};

export const getDecompressedPermissions = async (): Promise<PermissionValue[]> => {
  const compressedPermissions = await getCompressedPermissionsFromSession();
  return compressedPermissions ? decompressPermissions(compressedPermissions) : [];
};

export function getRequiredPermissions(pathname: string): PermissionValue[] {
  // Exact match first
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname];
  }

  // Pattern matching for dynamic routes
  for (const [routePattern, permissions] of Object.entries(ROUTE_PERMISSIONS)) {
    if (matchesPattern(pathname, routePattern)) {
      return permissions;
    }
  }

  return [];
}

function matchesPattern(pathname: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/:[^/]+/g, '[^/]+') // :id -> [^/]+
    .replace(/\*/g, '.*'); // * -> .*

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(pathname);
}

// Permission validation helpers
export const validateRouteAccess = (compressedPermissions: CompressedPermissions, pathname: string): boolean => {
  const trimmedPathname = pathname.split('?')[0];

  const requiredPermissions = getRequiredPermissions(trimmedPathname);
  if (requiredPermissions.length === 0) return true; // No permissions required

  const checker = createPermissionChecker(compressedPermissions);
  return checker.hasAnyPermissionByValues(requiredPermissions);
};
```

---

## Notes

- `session.user.compressedPermissions` must be set in your NextAuth `jwt` and `session` callbacks. After login, call `compressPermissions(userPermissionsArray)` and store the result on the token.
- `permissions.ts` is project-specific — replace the `PERMISSIONS` object with the actual permissions returned by your backend API.
- `server-utils.ts` imports from `auth` — adjust the import path to match your NextAuth config location.
- `ROUTE_PERMISSIONS` in `route-permissions.ts` maps Next.js route paths (not file paths) to required permissions. Add entries as you build features.
- `validateRouteAccess` is called from **`proxy.ts`** — Next.js 16 renamed `middleware.ts`. Keep that
  file free of database access: it runs on nearly every request, and each run is billed.
- The bitfield is a snapshot taken at login. When a user's role or permissions change, the token
  must be re-issued or invalidated — otherwise the old bitfield stays valid until it expires.
- `btoa`/`atob` exist in both the Node and Edge runtimes; no polyfill needed. For binary-safe
  round-tripping of the `Uint8Array`, keep the latin1 handling in `utils.ts` intact.
