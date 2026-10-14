import { appIcon } from "@/lib/app-icon";

// Listed in the web app manifest (app/manifest.webmanifest/route.ts) but never
// existed: Android Chrome asked for it ~240 times a day and got a 404. It is
// also the splash-screen icon of the installed app. Rendered once at build time.
export const dynamic = "force-static";

export async function GET() {
  return appIcon(512);
}
