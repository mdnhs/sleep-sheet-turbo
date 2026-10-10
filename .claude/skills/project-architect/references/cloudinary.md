# Cloudinary Media

All media — images, user uploads, video — lives in Cloudinary and is delivered by its global CDN.
No large files pass through Vercel, and Cloudinary (not Next.js) does the optimisation.

This is a cost decision as much as a performance one: routing media through Vercel bills bandwidth
**and** image-optimization transforms, and uploading through a Route Handler bills function duration
for the whole transfer. Signed direct upload plus a custom loader takes both to zero.

```text
Browser → signed upload → Cloudinary → global CDN → user
```

## Setup commands to append

```bash
pnpm add cloudinary next-cloudinary
```

## Environment variables

```text
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   # public, safe in the browser
CLOUDINARY_API_KEY                  # server only
CLOUDINARY_API_SECRET               # server only — never expose
```

---

## `src/lib/cloudinary/server.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export const destroyAsset = (publicId: string) => cloudinary.uploader.destroy(publicId);
```

---

## Signed direct upload

The browser uploads **straight to Cloudinary**. The Vercel function only signs the request, so no
file bytes ever touch a serverless function.

### `src/server/api/media.ts`

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@/server/lib/validator';
import { requireAuth, type AuthEnv } from '@/server/middleware/auth';
import { rateLimit } from '@/server/middleware/rate-limit';
import { ok } from '@/server/lib/response';
import { cloudinary, destroyAsset } from '@/lib/cloudinary/server';

const signSchema = z.object({ folder: z.string().min(1).max(64) });

export const media = new Hono<AuthEnv>()
  .use('*', requireAuth)

  .post('/sign', rateLimit(30), zValidator('json', signSchema), (c) => {
    const { folder } = c.req.valid('json');
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET!,
    );

    return ok(c, {
      signature,
      timestamp,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    });
  })

  .delete('/:publicId{.+}', async (c) => {
    await destroyAsset(c.req.param('publicId'));
    return ok(c, null);
  });
```

Store only the `public_id` (plus width/height/format if needed) in Postgres — never the full URL.
URLs are derived at render time so transformations can change without a migration.

---

## Delivery — `src/lib/cloudinary/url.ts`

```typescript
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

interface CldOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'thumb' | 'scale';
  gravity?: 'auto' | 'face';
}

/** f_auto + q_auto → AVIF/WebP where supported, sized at the edge. */
export const cldUrl = (publicId: string, opts: CldOptions = {}): string => {
  const parts = ['f_auto', 'q_auto'];
  if (opts.width) parts.push(`w_${opts.width}`);
  if (opts.height) parts.push(`h_${opts.height}`);
  if (opts.crop) parts.push(`c_${opts.crop}`);
  if (opts.gravity) parts.push(`g_${opts.gravity}`);
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${parts.join(',')}/${publicId}`;
};
```

---

## No double optimisation

Cloudinary already resizes and re-encodes. Running Next.js Image Optimization on top of it costs a
second transform, a Vercel image-optimisation billing unit, and nothing in return.

### `next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Cloudinary is the optimiser. Next.js only lays out the element.
    loader: 'custom',
    loaderFile: './src/lib/cloudinary/loader.ts',
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default nextConfig;
```

### `src/lib/cloudinary/loader.ts`

```typescript
'use client';

// next/image passes src/width/quality here; we return a Cloudinary URL and skip
// Vercel's optimiser entirely.
export default function cloudinaryLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const transforms = ['f_auto', `q_${quality ?? 'auto'}`, `w_${width}`, 'c_limit'];
  const publicId = src.replace(/^\//, '');
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(',')}/${publicId}`;
}
```

With the custom loader, `<Image src="folder/public-id" width={640} height={480} alt="…" sizes="…" />`
gets responsive Cloudinary URLs and **zero Vercel image-optimization units** — that meter should
read 0 for the life of the project. Confirm it in the Vercel usage dashboard after the first deploy.

> If some images are **not** on Cloudinary (local `/public` assets), either keep them as plain
> `<img>` / static imports, or branch inside the loader on `src.startsWith('/')` and return `src`
> unchanged. Do not add a second `images` config to work around it.

Always set `sizes` on any non-fixed image so the browser requests the right width.

---

## Open Graph images

Cloudinary text overlays are the cheap way to give every record its own share image — no Vercel
render per crawl. See the `seo` skill's `references/og-images.md`.
