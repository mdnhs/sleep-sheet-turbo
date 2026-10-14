import { appIcon } from "@/lib/app-icon";

// Referenced by the root layout's `icons.apple` but never existed, so iOS
// home-screen bookmarks (and the crawlers that check for it) got a 404.
// Rendered once at build time.
export const dynamic = "force-static";

export async function GET() {
  return appIcon(180);
}
