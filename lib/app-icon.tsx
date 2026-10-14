import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const logo = await readFile(join(process.cwd(), "public/logo.png"));
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

/**
 * The home-screen icon at `size`×`size`: the logo on a white square. The logo
 * itself is transparent and portrait, which iOS and Android would otherwise
 * show on black. Proportions are those of the original 180px apple-touch-icon
 * (a 100×150 logo), scaled with the square.
 */
export function appIcon(size: number): ImageResponse {
  const scale = size / 180;
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
        <img src={logoSrc} width={Math.round(100 * scale)} height={Math.round(150 * scale)} alt="" />
      </div>
    ),
    { width: size, height: size },
  );
}
