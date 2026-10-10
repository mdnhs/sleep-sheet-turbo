import { describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/seo/config";
import { siteSeoFromSettings, storeProfileFromSettings } from "@/lib/settings/store-profile";
import { localBusinessSchema, organizationSchema, websiteSchema } from "@/lib/seo/json-ld";

const store = storeProfileFromSettings({
  site_name: "Nimbus Linen",
  footer_phone: "+8801700000000",
  footer_address: "Road 2",
  store_city: "Chattogram",
  logo_url: "/brand.png",
  store_bin: "000123456-0101",
});

describe("store JSON-LD", () => {
  it("builds the Organization from the store profile", () => {
    const org = JSON.parse(organizationSchema(store));
    expect(org).toMatchObject({
      name: "Nimbus Linen",
      legalName: "Nimbus Linen",
      vatID: "000123456-0101",
      logo: `${siteUrl}/brand.png`,
      address: { streetAddress: "Road 2", addressLocality: "Chattogram", addressCountry: "BD" },
      contactPoint: { telephone: "+8801700000000" },
    });
  });

  it("keeps an absolute logo URL as it is", () => {
    const org = JSON.parse(organizationSchema({ ...store, logoUrl: "https://cdn.example/l.png" }));
    expect(org.logo).toBe("https://cdn.example/l.png");
  });

  it("names the WebSite after the store and describes it with the SEO description", () => {
    const site = JSON.parse(websiteSchema(store, siteSeoFromSettings({ seo_default_description: "Soft sheets." })));
    expect(site).toMatchObject({ name: "Nimbus Linen", description: "Soft sheets." });
  });

  it("lists the social profiles that exist", () => {
    expect(JSON.parse(localBusinessSchema(store)).sameAs).toEqual(store.sameAs);
  });
});

describe("jsonLd script-safety", () => {
  it("escapes '<' so a </script> in a value cannot break out, and round-trips", async () => {
    const { jsonLd } = await import("@/lib/seo/json-ld");
    const evil = { name: "</script><script>alert(1)</script>", nested: { a: ["<!--", "x"] } };
    const out = jsonLd(evil);
    expect(out).not.toMatch(/<\/script/i);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual({ "@context": "https://schema.org", ...evil });
  });
});
