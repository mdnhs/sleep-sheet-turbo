import { revalidatePath, revalidateTag } from "next/cache";
import { DATA_CACHE_TAGS, DATA_ROUTE_HANDLERS, STARTUP_TOKEN_HEADER } from "@/lib/startup-revalidate";

// Called once by the server itself right after it starts (see
// lib/startup-revalidate.ts) to drop the pages `next build` rendered without
// a database. The token exists only in this process's memory, so a request
// from outside always gets a 404.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.STARTUP_REVALIDATE_TOKEN;
  if (!token || request.headers.get(STARTUP_TOKEN_HEADER) !== token) {
    return new Response("Not found", { status: 404 });
  }

  // Data cache first: unstable_cache entries written during the build are
  // shipped in the image too (the Dockerfile now deletes them, this covers
  // anything that still slips through).
  for (const tag of DATA_CACHE_TAGS) revalidateTag(tag, { expire: 0 });
  revalidatePath("/", "layout");
  for (const path of DATA_ROUTE_HANDLERS) revalidatePath(path);

  return Response.json({ ok: true });
}
