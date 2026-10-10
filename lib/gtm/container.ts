/**
 * Which GTM container to load, and from where. Both come from settings
 * (gtm_web_id, gtm_server_url): the server container on the VPS serves
 * gtm.js from a first-party subdomain so blockers that match
 * googletagmanager.com don't drop it. No hardcoded fallback — a store
 * without a container loads none.
 */
const GOOGLE_HOST = "https://www.googletagmanager.com";

export type GtmContainer = { id: string; host: string };

export function gtmContainer(settings: Record<string, string> | null | undefined, envId?: string): GtmContainer | null {
  const id = settings?.gtm_web_id?.trim() || envId?.trim() || "";
  if (!/^GTM-[A-Z0-9]+$/.test(id)) return null;
  const host = (settings?.gtm_server_url?.trim() || GOOGLE_HOST).replace(/\/+$/, "");
  return { id, host };
}
