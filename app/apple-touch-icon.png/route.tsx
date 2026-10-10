import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Referenced by the root layout's `icons.apple` but never existed, so iOS
// home-screen bookmarks (and the crawlers that check for it) got a 404.
// Renders the logo on a white 180×180 square once at build time — the logo
// itself is transparent and portrait, which iOS would otherwise show on black.
export const dynamic = "force-static";

const logo = await readFile(join(process.cwd(), "public/logo.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) only renders plain <img>. */}
        <img src={logoSrc} width={100} height={150} alt="" />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
