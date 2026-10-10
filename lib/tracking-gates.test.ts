import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every Meta Pixel event on this site is fired by the GTM web container —
 * base code and PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
 * and Search all live in GTM-PQ667JWQ. The app's own Pixel and Conversions
 * API code was deleted when that moved (lib/meta-pixel/*, lib/meta-capi/*),
 * leaving only the click-id capture in lib/meta-fbc.ts.
 *
 * That split is the invariant worth protecting: if the app starts firing its
 * own Pixel again, every one of those six events is counted twice, and the
 * duplicates carry no event_id so Meta cannot collapse them.
 *
 * What stood here before was a pair of gate expressions copied into the test
 * file and asserted against themselves. It passed whatever the app did,
 * because the gates it described no longer existed anywhere — the code that
 * read `meta_pixel_enabled` and `meta_capi_enabled` went out with the
 * directories above. These read the source instead, so they can actually
 * fail.
 */

const ROOT = join(__dirname, "..");
const SOURCE_DIRS = ["app", "components", "features", "lib", "provider", "hooks"];
const SOURCE_EXT = /\.(ts|tsx)$/;

function sourceFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(abs);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = join(abs, entry);
    if (statSync(full).isDirectory()) return sourceFiles(join(dir, entry));
    return SOURCE_EXT.test(entry) && !entry.endsWith(".test.ts") ? [full] : [];
  });
}

const files = SOURCE_DIRS.flatMap(sourceFiles).map((f) => ({
  path: relative(ROOT, f),
  body: readFileSync(f, "utf8"),
}));

describe("the app does not fire Meta events itself", () => {
  it("finds source files to check (guards against the scan silently matching nothing)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("never calls the Pixel directly — GTM owns fbq", () => {
    const offenders = files
      .filter((f) => /\bfbq\s*\(/.test(f.body))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never loads the Pixel script itself", () => {
    const offenders = files
      .filter((f) => /connect\.facebook\.net/.test(f.body))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("never posts to the Conversions API — the server container does that", () => {
    const offenders = files
      .filter((f) => /graph\.facebook\.com\/[^"'`\s]*\/events/.test(f.body))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });
});

describe("identifiers sent to Meta", () => {
  it("hashes email and phone before they travel as GA4 parameters", async () => {
    const { hashIdentifiers } = await import("./gtm");
    const { email_sha256, phone_sha256 } = await hashIdentifiers({
      email: "  Customer@Example.COM ",
      phone: "01700000000",
    });

    // Fixed digests, not a shape check: these are SHA-256 of exactly what
    // Meta expects to receive — the email trimmed and lowercased, the phone
    // reduced to digits carrying its country code. Getting the normalisation
    // wrong still produces a well-formed 64-character hash, so only the
    // literal value catches it.
    expect(email_sha256).toBe(
      "e233d4a29013e9d87150c6237c6777bedf379ebf1acdc5d6126fec7e8bb74fb5",
    );
    expect(phone_sha256).toBe(
      "12c84ad04eb79fc11a96dc89aa966423ff15513b1257bcacacdd93db3c509112",
    );

    // Same input, same digest — the value has to be stable for Meta to match.
    const again = await hashIdentifiers({ email: "customer@example.com", phone: "+8801700000000" });
    expect(again.email_sha256).toBe(email_sha256);
    expect(again.phone_sha256).toBe(phone_sha256);
  });

  it("returns nothing rather than a wrong hash when an identifier is missing", async () => {
    const { hashIdentifiers } = await import("./gtm");
    expect(await hashIdentifiers({})).toEqual({
      email_sha256: undefined,
      phone_sha256: undefined,
    });
  });
});
