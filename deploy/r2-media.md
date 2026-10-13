# Media on Cloudflare R2

Uploads go to whichever provider **Settings → CDN** selects (`media_provider`).
Stored URLs keep working regardless: delivery, deletes and video validation go
by the URL's host (`res.cloudinary.com` vs the R2 public URL).

| Piece | Code |
| --- | --- |
| Upload / delete / video upload ticket / connection test | `lib/media.ts` |
| R2 S3 API (SigV4 via aws4fetch, presigned PUT) | `lib/r2.ts` |
| Delivery URLs (`/cdn-cgi/image`, `/cdn-cgi/media`) | `lib/media-url.ts`, `lib/image-loader.ts`, `lib/product-video.ts` |
| Settings | `media_provider`, `r2_bucket`, `r2_public_url` (public, admin-write); `r2_account_id`, `r2_access_key_id`, `r2_secret_access_key` (secrets) |

## One-time setup

1. **Bucket.** Use a bucket that holds media only, because step 2 makes every
   object in it public. The production bucket is `sleep-sheet-media`. The
   `sleep-sheet` bucket holds the Dokploy database backups and must never get
   a public domain.
2. **Public access.** Connect a custom domain to the bucket. That domain's zone
   must be in the **same Cloudflare account as the bucket**. A subdomain of a
   zone held by another account can't be attached. `r2.dev` works for testing,
   but it is rate-limited and not meant for production.
3. **API token.** Create an R2 → *Manage API tokens* token with **Object Read &
   Write** on that bucket only. Enter it under Settings → CDN, together with
   the account ID, the bucket name and the public URL.
4. **CORS** (bucket → Settings → CORS policy). Product videos are uploaded by
   the browser with a presigned PUT:

   ```json
   [
     {
       "AllowedOrigins": ["https://sleepsheetbd.com", "https://www.sleepsheetbd.com", "https://test.sleepsheetbd.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type", "cache-control"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

5. **Transformations**, on the zone named by `NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN`
   (the Dockerfile defaults it to `https://sleepsheetbd.com`):
   - Images → Transformations → enable for the zone.
   - Under *Sources*, allow the bucket's public domain.
   - Turn on Media Transformations (video) as well.
   - Media Transformations takes MP4 (H.264) input of up to 100 MB and 10
     minutes. The upload form accepts MP4/MOV of up to 60 MB.
6. **Test.** Click *Test connection* in Settings → CDN. It uploads a file,
   fetches it back through the public URL, and then deletes it.
7. **Switch.** Set *Upload new files to* → Cloudflare R2.

`NEXT_PUBLIC_MEDIA_TRANSFORM_ORIGIN` is unset locally. R2 files are then
served untransformed, and R2 videos show `/placeholder.jpg` as their poster.
