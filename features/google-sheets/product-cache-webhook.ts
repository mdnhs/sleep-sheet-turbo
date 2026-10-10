/** The n8n product-cache webhook, or null when this deployment has none. */
export function productCacheWebhookUrl(env: Record<string, string | undefined> = process.env): string | null {
  return env.N8N_PRODUCT_CACHE_WEBHOOK_URL?.trim() || null;
}
