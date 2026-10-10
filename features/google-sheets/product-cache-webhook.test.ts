import { describe, expect, it } from "vitest";
import { productCacheWebhookUrl } from "@/features/google-sheets/product-cache-webhook";

describe("productCacheWebhookUrl", () => {
  it("is the configured URL", () => {
    expect(productCacheWebhookUrl({ N8N_PRODUCT_CACHE_WEBHOOK_URL: "https://n8n.example/webhook/x" })).toBe(
      "https://n8n.example/webhook/x",
    );
  });

  it("is null when unset, instead of a hardcoded instance", () => {
    expect(productCacheWebhookUrl({})).toBeNull();
  });
});
