import { appIcon } from "@/lib/app-icon";

// Listed in the web app manifest (app/manifest.webmanifest/route.ts) but never
// existed: Android Chrome asked for it ~230 times a day and got a 404.
// Rendered once at build time.
export const dynamic = "force-static";

export async function GET() {
  return appIcon(192);
}
