// Generates the stored poster and renditions (lib/video-derivatives.ts) for
// every R2 product video that doesn't have them yet — the videos uploaded
// before derivatives existed.
//
//   npx tsx --env-file=.env scripts/backfill-video-derivatives.ts          # dry run: list what's missing
//   npx tsx --env-file=.env scripts/backfill-video-derivatives.ts --write  # generate and upload
//
// Reads products and R2 settings from DATABASE_URL. Preview and production
// share one bucket, so running it against either database covers both.
import { isNotNull } from "drizzle-orm";
import { db } from "../db";
import { products } from "../db/schema";
import { isCloudinaryUrl } from "../lib/media-url";
import { VIDEO_DERIVATIVES, videoDerivativeKey, type VideoDerivative } from "../lib/product-video";
import { r2Exists, r2KeyFromUrl } from "../lib/r2";
import { getR2Config } from "../lib/server-config";
import { ensureVideoDerivatives } from "../lib/video-derivatives";

async function main() {
  const write = process.argv.includes("--write");
  const { publicUrl } = await getR2Config();
  const rows = await db.select({ video: products.video }).from(products).where(isNotNull(products.video));
  const videos = [...new Set(rows.map((r) => r.video!).filter((v) => v && !isCloudinaryUrl(v)))];
  console.log(`${videos.length} R2 product videos${write ? "" : " (dry run — pass --write to generate)"}`);

  let failed = 0;
  for (const url of videos) {
    const key = r2KeyFromUrl(url, publicUrl);
    if (!key) {
      console.log(`  skip (not in this bucket): ${url}`);
      continue;
    }
    const missing: VideoDerivative[] = [];
    for (const kind of Object.keys(VIDEO_DERIVATIVES) as VideoDerivative[]) {
      const target = videoDerivativeKey(key, kind);
      if (target && !(await r2Exists(target))) missing.push(kind);
    }
    if (missing.length === 0) {
      console.log(`  ok       ${key}`);
      continue;
    }
    if (!write) {
      console.log(`  missing  ${key}: ${missing.join(", ")}`);
      continue;
    }
    const result = await ensureVideoDerivatives(url);
    if (result.ok) console.log(`  made     ${key}: ${result.made.join(", ")}`);
    else {
      failed++;
      console.log(`  FAILED   ${key}: ${result.error}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
