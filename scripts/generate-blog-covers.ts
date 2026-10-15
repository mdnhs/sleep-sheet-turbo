// Makes a 1200×630 cover for every blog post that has none: the post's title
// beside a flat 2D illustration of its topic (scripts/blog-cover-art.ts), on a
// twill-textured blush ground, with the logo. Uploads it to R2 and sets it as
// the post's coverImage.
//
//   npx tsx --env-file=.env scripts/generate-blog-covers.ts           # dry run: writes the JPEGs to tmp/blog-covers to look at
//   npx tsx --env-file=.env scripts/generate-blog-covers.ts --write   # upload and set posts.coverImage
//
// --replace-generated also redoes posts whose cover this script made before
// (anything under blog/covers/ in the bucket); covers uploaded by hand are
// never touched.
//
// Reads posts and R2 settings from DATABASE_URL. Preview and production share
// one bucket and the same posts, so the --write run also prints the SQL that
// gives the other database the same covers (one object per cover, never a
// second upload).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull, like, or } from "drizzle-orm";
import sharp, { type OverlayOptions } from "sharp";
import { db } from "../db";
import { posts } from "../db/schema";
import { r2Put } from "../lib/r2";
import { getR2Config } from "../lib/server-config";
import { INK, MAGENTA, art, artFor, type ArtName } from "./blog-cover-art";

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 64;
const TEXT_WIDTH = 560;
const GROUND = "#FBEFF1";
const WEAVE = "#F3DCE3";
const COVER_FOLDER = "blog/covers";
// The illustrations are drawn in a 400px box; the cushion is a little bigger.
const ART_SCALE = 1.1;

// Hind Siliguri, the site's Bengali face, for the titles and for the few
// characters inside the illustrations (৳, ১০). Pango and librsvg (inside
// sharp) do the Bengali shaping — conjuncts and vowel signs — which
// Satori/next/og can't.
const FONT_DIR = join(process.cwd(), "scripts/assets/fonts");
const fontConfig = join(tmpdir(), "sleep-sheet-blog-covers-fonts.conf");
writeFileSync(
  fontConfig,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${join(tmpdir(), "sleep-sheet-fontconfig-cache")}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = fontConfig;

// The illustration for each post that existed when covers were introduced.
// Later posts get one picked from their title (artFor).
const ART_FOR_POST: Record<string, ArtName> = {
  "bedsheet-dhowar-niyom-o-jotno": "washing",
  "top-10-comforter-brands-in-bangladesh": "trophy",
  "pillow-cover-kolbalish-cover-size-guide": "pillowSize",
  "comforter-vs-duvet-vs-quilt-parthokko": "threeStack",
  "shiter-age-bichana-prostut-korar-tips": "winterPrep",
  "twill-cotton-vs-sadharon-cotton-bedsheet": "twillVsPlain",
  "bedsheet-size-guide-bangladesh": "bedSize",
  "bed-sheet-price-in-bangladesh-2026": "sheetPrice",
  "notun-songshar-bedroom-shopping-checklist": "checklist",
  "comforter-rong-o-design-baccha-guide": "palette",
  "lep-vs-kombol-vs-comforter-parthokko": "threeKinds",
  "shitey-priyojonke-comforter-upohar": "gift",
  "comforter-jotno-o-rokkhonabekkhon": "care",
  "comforter-price-in-bangladesh-২০২৬-সম্পূর্ণ-দাম-ও-তুলনা-গাইড": "comforterPrice",
  "শীতে-আরামদায়ক-ঘুমের-জন্য-সেরা-comforter-কেনার-সম্পূর্ণ-গাইড-বাংলাদেশ-২০২৬": "cozyNight",
};

const escapeMarkup = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Text wrapped to `width`, as an RGBA image. */
async function textImage(text: string, opts: { size: number; weight: "Bold" | "SemiBold"; color: string; width: number; spacing?: number }) {
  return sharp({
    text: {
      text: `<span foreground="${opts.color}">${escapeMarkup(text)}</span>`,
      font: `Hind Siliguri ${opts.weight} ${opts.size}`,
      width: opts.width,
      dpi: 72,
      rgba: true,
      wrap: "word",
      spacing: opts.spacing ?? 0,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
}

/** "Headline — subtitle" titles get the two parts set apart. */
function splitTitle(title: string): { headline: string; subtitle: string | null } {
  const i = title.indexOf(" — ");
  if (i === -1) return { headline: title.trim(), subtitle: null };
  return { headline: title.slice(0, i).trim(), subtitle: title.slice(i + 3).trim() || null };
}

/**
 * The ground and the cushion: blush with a faint twill weave (the fabric the
 * store sells), and a tilted cushion with a quilting stitch around its edge
 * holding the illustration.
 */
function backdrop(name: ArtName): Buffer {
  const { svg, tint } = art(name);
  const cushion = { x: 700, y: 72, w: 436, h: 486 };
  const cx = cushion.x + cushion.w / 2;
  const cy = cushion.y + cushion.h / 2;
  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="twill" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="18" stroke="${WEAVE}" stroke-width="5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="${GROUND}"/>
      <rect width="100%" height="100%" fill="url(#twill)"/>
      <g transform="rotate(-3 ${cx} ${cy})">
        <rect x="${cushion.x + 10}" y="${cushion.y + 14}" width="${cushion.w}" height="${cushion.h}" rx="64" fill="${INK}" opacity="0.12"/>
        <rect x="${cushion.x}" y="${cushion.y}" width="${cushion.w}" height="${cushion.h}" rx="64" fill="${tint}" stroke="${INK}" stroke-width="5"/>
        <rect x="${cushion.x + 18}" y="${cushion.y + 18}" width="${cushion.w - 36}" height="${cushion.h - 36}" rx="48" fill="none" stroke="${MAGENTA}" stroke-width="3" stroke-dasharray="10 8" stroke-linecap="round" opacity="0.7"/>
        <g transform="translate(${cx - 200 * ART_SCALE} ${cy - 200 * ART_SCALE}) scale(${ART_SCALE})">${svg}</g>
      </g>
    </svg>`,
  );
}

async function renderCover(title: string, name: ArtName): Promise<Buffer> {
  const { headline, subtitle } = splitTitle(title);
  const top = PAD + 8;
  const bottom = HEIGHT - PAD - 80 - 32; // above the logo row
  const room = bottom - top;

  // The largest headline size whose block, with the subtitle under it, fits.
  let head = await textImage(headline, { size: 64, weight: "Bold", color: INK, width: TEXT_WIDTH, spacing: 6 });
  let sub = subtitle ? await textImage(subtitle, { size: 30, weight: "SemiBold", color: MAGENTA, width: TEXT_WIDTH, spacing: 4 }) : null;
  for (const size of [60, 56, 52, 48, 44, 40]) {
    if (head.info.height + (sub ? 24 + sub.info.height : 0) <= room) break;
    head = await textImage(headline, { size, weight: "Bold", color: INK, width: TEXT_WIDTH, spacing: 5 });
  }
  // Still too tall: the subtitle goes (the full title is on the page itself).
  if (sub && head.info.height + 24 + sub.info.height > room) sub = null;

  // The logo artwork has a wide transparent margin; trimmed, it reads at 80px.
  const logo = await sharp(join(process.cwd(), "public/logo.webp")).trim().resize({ height: 80 }).png().toBuffer({ resolveWithObject: true });
  const site = await textImage("sleepsheetbd.com", { size: 26, weight: "SemiBold", color: INK, width: 300 });
  const logoTop = HEIGHT - PAD - 80;

  const layers: OverlayOptions[] = [
    { input: head.data, left: PAD, top },
    { input: logo.data, left: PAD, top: logoTop },
    { input: site.data, left: PAD + logo.info.width + 18, top: logoTop + 40 - Math.round(site.info.height / 2) },
  ];
  if (sub) layers.push({ input: sub.data, left: PAD, top: top + head.info.height + 24 });

  return sharp(backdrop(name)).composite(layers).jpeg({ quality: 86, progressive: true, mozjpeg: true }).toBuffer();
}

async function main() {
  const write = process.argv.includes("--write");
  const replace = process.argv.includes("--replace-generated");
  const { publicUrl } = await getR2Config();
  const generatedPrefix = `${publicUrl.replace(/\/+$/, "")}/${COVER_FOLDER}/`;

  const targets = await db
    .select({ id: posts.id, slug: posts.slug, title: posts.title, coverImage: posts.coverImage })
    .from(posts)
    .where(replace ? or(isNull(posts.coverImage), like(posts.coverImage, `${generatedPrefix}%`)) : isNull(posts.coverImage));
  console.log(
    `${targets.length} posts to cover${replace ? " (including ones this script covered before)" : ""}${write ? "" : " (dry run — pass --write to upload and save)"}`,
  );
  if (targets.length === 0) return;

  const outDir = join(process.cwd(), "tmp/blog-covers");
  mkdirSync(outDir, { recursive: true });
  const sql: string[] = [];

  for (const post of targets) {
    const name = ART_FOR_POST[post.slug] ?? artFor(post.title, post.slug);
    const cover = await renderCover(post.title, name);
    // Content-addressed: R2 objects are served as immutable, so a remade cover
    // has to be a new URL.
    const hash = createHash("sha1").update(cover).digest("hex").slice(0, 10);
    const key = `${COVER_FOLDER}/${post.id}-${hash}.jpg`;
    writeFileSync(join(outDir, `${post.id}.jpg`), cover);

    if (!write) {
      console.log(`  would upload ${key} (${Math.round(cover.length / 1024)} KB, ${name}) for ${post.slug}`);
      continue;
    }
    const url = await r2Put(key, cover, "image/jpeg");
    // Only if the cover is still the one we read: never overwrite a cover
    // someone set in the meantime.
    const unchanged = post.coverImage === null ? isNull(posts.coverImage) : eq(posts.coverImage, post.coverImage);
    await db.update(posts).set({ coverImage: url }).where(and(eq(posts.id, post.id), unchanged));
    console.log(`  ${url}  ← ${post.slug} (${name})`);
    const was = post.coverImage === null ? `"coverImage" IS NULL` : `"coverImage" = '${post.coverImage}'`;
    sql.push(`UPDATE posts SET "coverImage" = '${url}' WHERE id = '${post.id}' AND ${was};`);
  }

  console.log(`\nCovers written to ${outDir}`);
  if (sql.length) {
    console.log("\nSame covers for the other database (one bucket, so no second upload):\n");
    console.log(["BEGIN;", ...sql, "COMMIT;"].join("\n"));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
