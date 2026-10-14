// Makes a 1200×630 cover for every blog post that has none: the post's title
// on the brand colour beside a photo of one of the store's own products, with
// the logo. Uploads it to R2 and sets it as the post's coverImage.
//
//   npx tsx --env-file=.env scripts/generate-blog-covers.ts           # dry run: writes the JPEGs to tmp/blog-covers to look at
//   npx tsx --env-file=.env scripts/generate-blog-covers.ts --write   # upload and set posts.coverImage
//
// Reads posts, products and R2 settings from DATABASE_URL. Preview and
// production share one bucket and the same posts, so the --write run also
// prints the SQL that gives the other database the same covers (one object
// per cover, never a second upload).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import sharp, { type OverlayOptions } from "sharp";
import { db } from "../db";
import { posts, products } from "../db/schema";
import { r2Put } from "../lib/r2";

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO_X = 600; // the product photo fills the right half
const PAD = 64;
const TEXT_WIDTH = 520;
const BG_FROM = "#4A0C24";
const BG_TO = "#9E1F4F";

// Hind Siliguri, the site's Bengali face. Pango (inside sharp) does the
// Bengali shaping — conjuncts and vowel signs — which Satori/next/og can't.
const FONT_DIR = join(process.cwd(), "scripts/assets/fonts");
const fontConfig = join(tmpdir(), "sleep-sheet-blog-covers-fonts.conf");
writeFileSync(
  fontConfig,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${join(tmpdir(), "sleep-sheet-fontconfig-cache")}</cachedir></fontconfig>`,
);
process.env.FONTCONFIG_FILE = fontConfig;

// Hand-picked photos for the posts that existed when covers were introduced,
// each matching its topic (a bed sheet post gets a bed sheet, the gift post a
// set in its Sleep Sheet bag, and so on). Posts added later get a photo from
// the matching category, picked by their id.
const PHOTO_FOR_POST: Record<string, string> = {
  "bedsheet-dhowar-niyom-o-jotno": "exclusive-twill-cotton-king-size-bed-sheet-67z19m",
  "top-10-comforter-brands-in-bangladesh": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-cx117s",
  "pillow-cover-kolbalish-cover-size-guide": "twill-cotton-king-size-bed-sheet-beige-leopard-blhqri",
  "comforter-vs-duvet-vs-quilt-parthokko": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-3ql48y",
  "shiter-age-bichana-prostut-korar-tips": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-n6sxx8",
  "twill-cotton-vs-sadharon-cotton-bedsheet": "twill-cotton-king-size-bed-sheet-beige-leopard-kfw72b",
  "bedsheet-size-guide-bangladesh": "exclusive-twill-cotton-king-size-bed-sheet-0ipij2",
  "bed-sheet-price-in-bangladesh-2026": "exclusive-twill-cotton-king-size-bed-sheet-tzx9qg",
  "notun-songshar-bedroom-shopping-checklist": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-46w8lw",
  "comforter-rong-o-design-baccha-guide": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-okl6s9",
  "lep-vs-kombol-vs-comforter-parthokko": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-bslnoq",
  "shitey-priyojonke-comforter-upohar": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-fni94t",
  "comforter-jotno-o-rokkhonabekkhon": "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-lzq1mg",
  "comforter-price-in-bangladesh-২০২৬-সম্পূর্ণ-দাম-ও-তুলনা-গাইড":
    "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-kf5gln",
  "শীতে-আরামদায়ক-ঘুমের-জন্য-সেরা-comforter-কেনার-সম্পূর্ণ-গাইড-বাংলাদেশ-২০২৬":
    "premium-quality-luxury-twill-cotton-fabrics-comforter-5-pcs-set-l56ewi",
};

const escapeMarkup = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** White (or tinted) text wrapped to `width`, as an RGBA image. */
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

async function renderCover(title: string, photo: Buffer): Promise<Buffer> {
  const { headline, subtitle } = splitTitle(title);
  const top = 150; // below the "ব্লগ" pill
  const bottom = HEIGHT - PAD - 72 - 28; // above the logo row
  const room = bottom - top;

  // The largest headline size whose block, with the subtitle under it, fits.
  let head = await textImage(headline, { size: 58, weight: "Bold", color: "#FFFFFF", width: TEXT_WIDTH, spacing: 6 });
  let sub = subtitle ? await textImage(subtitle, { size: 26, weight: "SemiBold", color: "#FBD3E0", width: TEXT_WIDTH, spacing: 4 }) : null;
  for (const size of [54, 50, 46, 42, 38]) {
    if (head.info.height + (sub ? 22 + sub.info.height : 0) <= room) break;
    head = await textImage(headline, { size, weight: "Bold", color: "#FFFFFF", width: TEXT_WIDTH, spacing: 5 });
  }
  // Still too tall: the subtitle goes (the full title is on the page itself).
  if (sub && head.info.height + 22 + sub.info.height > room) sub = null;

  const background = Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${BG_FROM}"/><stop offset="1" stop-color="${BG_TO}"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#FF6FA5"/><stop offset="1" stop-color="#B8245A"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect x="${PAD}" y="${PAD}" width="186" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.14"/>
      <rect x="${PAD}" y="${PAD + 58}" width="64" height="5" rx="2.5" fill="url(#accent)"/>
    </svg>`,
  );

  // The photo fills the right part, fading in over its left edge: an alpha
  // ramp on the photo itself, so it melts into whatever the diagonal
  // gradient is behind it (a solid-colour fade left a visible seam).
  const photoWidth = WIDTH - PHOTO_X;
  const photoPanel = await sharp(photo)
    .resize(photoWidth, HEIGHT, { fit: "cover", position: "attention" })
    .ensureAlpha()
    .composite([
      {
        input: Buffer.from(
          `<svg width="${photoWidth}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#fff" stop-opacity="0"/>
              <stop offset="0.3" stop-color="#fff" stop-opacity="1"/>
            </linearGradient></defs>
            <rect width="100%" height="100%" fill="url(#fade)"/>
          </svg>`,
        ),
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const pill = await textImage("Sleep Sheet ব্লগ", { size: 22, weight: "SemiBold", color: "#FFFFFF", width: 170 });
  // The logo artwork has a wide transparent margin; trimmed, it reads at 84px.
  const logo = await sharp(join(process.cwd(), "public/dark-logo.webp")).trim().resize({ height: 84 }).png().toBuffer({ resolveWithObject: true });
  const site = await textImage("sleepsheetbd.com", { size: 26, weight: "SemiBold", color: "#FFFFFF", width: 300 });
  const logoTop = HEIGHT - PAD - 84 + 16;

  const layers: OverlayOptions[] = [
    { input: photoPanel, left: PHOTO_X, top: 0 },
    { input: pill.data, left: PAD + 93 - Math.round(pill.info.width / 2), top: PAD + 22 - Math.round(pill.info.height / 2) },
    { input: head.data, left: PAD, top },
    { input: logo.data, left: PAD, top: logoTop },
    { input: site.data, left: PAD + logo.info.width + 18, top: logoTop + 42 - Math.round(site.info.height / 2) },
  ];
  if (sub) layers.push({ input: sub.data, left: PAD, top: top + head.info.height + 22 });

  return sharp(background).composite(layers).jpeg({ quality: 84, progressive: true, mozjpeg: true }).toBuffer();
}

function isBedSheetPost(title: string, slug: string) {
  const text = `${title} ${slug}`.toLowerCase();
  return /bed ?sheet|bedsheet|বেডশিট|চাদর|pillow|বালিশ/.test(text) && !/comforter|কম্ফোর্টার/.test(text);
}

async function main() {
  const write = process.argv.includes("--write");
  const missing = await db
    .select({ id: posts.id, slug: posts.slug, title: posts.title })
    .from(posts)
    .where(isNull(posts.coverImage));
  console.log(`${missing.length} posts without a cover${write ? "" : " (dry run — pass --write to upload and save)"}`);
  if (missing.length === 0) return;

  const catalog = await db.select({ slug: products.slug, images: products.images, name: products.name }).from(products);
  const withPhoto = catalog.filter((p) => p.images.length > 0);
  const photoOf = new Map(withPhoto.map((p) => [p.slug, p.images[0]]));
  const bedSheets = withPhoto.filter((p) => /bed[- ]?sheet/i.test(`${p.slug} ${p.name}`));
  const comforters = withPhoto.filter((p) => /comforter/i.test(`${p.slug} ${p.name}`));

  const outDir = join(process.cwd(), "tmp/blog-covers");
  mkdirSync(outDir, { recursive: true });
  const sql: string[] = [];

  for (const post of missing) {
    let photoUrl = photoOf.get(PHOTO_FOR_POST[post.slug] ?? "");
    if (!photoUrl) {
      const pool = isBedSheetPost(post.title, post.slug) ? bedSheets : comforters;
      const pick = pool[parseInt(createHash("sha1").update(post.id).digest("hex").slice(0, 8), 16) % pool.length];
      photoUrl = pick?.images[0];
    }
    if (!photoUrl) {
      console.log(`  skip (no product photo): ${post.slug}`);
      continue;
    }
    const res = await fetch(photoUrl);
    if (!res.ok) {
      console.log(`  skip (photo ${res.status}): ${post.slug}`);
      continue;
    }
    const cover = await renderCover(post.title, Buffer.from(await res.arrayBuffer()));
    // Content-addressed: R2 objects are served as immutable, so a remade cover
    // has to be a new URL.
    const hash = createHash("sha1").update(cover).digest("hex").slice(0, 10);
    const key = `blog/covers/${post.id}-${hash}.jpg`;
    writeFileSync(join(outDir, `${post.id}.jpg`), cover);

    if (!write) {
      console.log(`  would upload ${key} (${Math.round(cover.length / 1024)} KB) for ${post.slug}`);
      continue;
    }
    const url = await r2Put(key, cover, "image/jpeg");
    await db
      .update(posts)
      .set({ coverImage: url })
      .where(and(eq(posts.id, post.id), isNull(posts.coverImage)));
    console.log(`  ${url}  ← ${post.slug}`);
    sql.push(`UPDATE posts SET "coverImage" = '${url}' WHERE id = '${post.id}' AND "coverImage" IS NULL;`);
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
