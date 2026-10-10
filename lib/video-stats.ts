// Reels analytics: fire-and-forget counters for one video (see
// POST /api/products/videos/:id/stats). sendBeacon survives the page being
// closed or navigated away (e.g. by the Order Now tap it is reporting);
// a keepalive fetch is the fallback.
export interface VideoStatsDelta {
  views?: number;
  watchSeconds?: number;
  orderClicks?: number;
  shares?: number;
}

export function sendVideoStats(productId: string, delta: VideoStatsDelta): void {
  if (!delta.views && !delta.watchSeconds && !delta.orderClicks && !delta.shares) return;
  const url = `/api/products/videos/${encodeURIComponent(productId)}/stats`;
  const body = JSON.stringify({
    ...delta,
    ...(delta.watchSeconds !== undefined && { watchSeconds: Math.min(600, Math.round(delta.watchSeconds)) }),
  });
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
