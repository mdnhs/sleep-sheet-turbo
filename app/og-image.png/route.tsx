import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { seoConfig } from "@/lib/seo";
import { getStoreProfile } from "@/lib/settings/store";

// Site-wide default share image (seoConfig.defaultImage). It used to point at
// /logo.png, a 400×600 portrait logo, while the metadata declared it as
// 1200×630 — social cards got a mis-sized, awkwardly cropped logo. This
// renders a real 1200×630 card. It is rendered at build with the default
// profile, then re-rendered after each deploy (lib/startup-revalidate.ts) and
// each settings save (it carries the "settings" tag via getStoreProfile).
export const dynamic = "force-static";

const logo = await readFile(join(process.cwd(), "public/logo.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export async function GET() {
  const store = await getStoreProfile();
  const host = new URL(seoConfig.siteUrl).host;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          backgroundImage: "linear-gradient(135deg, #FFF5F8 0%, #FBE3EC 100%)",
          padding: "0 90px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) only renders plain <img>. */}
        <img src={logoSrc} width={300} height={450} alt="" />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 70, width: 640 }}>
          <div style={{ fontSize: 76, color: "#1a1a1a", lineHeight: 1.1 }}>{store.name}</div>
          <div style={{ fontSize: 34, color: "#555", marginTop: 24, lineHeight: 1.35 }}>
            {store.description.length > 140 ? `${store.description.slice(0, 137)}…` : store.description}
          </div>
          <div style={{ fontSize: 26, color: "#B8245A", marginTop: 36 }}>{host}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
