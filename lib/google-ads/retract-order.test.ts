import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retractGoogleAdsConversion } from "./retract-order";

// Mock getStoredSettings so tests run offline without database
vi.mock("@/lib/settings/read", () => ({
  getStoredSettings: vi.fn().mockResolvedValue({
    google_ads_client_id: "test-client-id",
    google_ads_client_secret: "test-client-secret",
    google_ads_refresh_token: "test-refresh-token",
    google_ads_developer_token: "test-dev-token",
    google_ads_customer_id: "7930659050",
    google_ads_conversion_action_id: "7769300841",
  }),
}));

describe("retractGoogleAdsConversion", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("ignores orders that do not start with ORD-", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const res = await retractGoogleAdsConversion(["POS-12345", "OTHER-999"]);
    expect(res.success).toBe(true);
    expect(res.orderIds).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores empty input or non-string values safely", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const res = await retractGoogleAdsConversion([]);
    expect(res.success).toBe(true);
    expect(res.orderIds).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters out non-ORD orders and sends retraction for valid ORD- orders", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("oauth2.googleapis.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: "mock-access-token" }),
        });
      }
      if (url.includes("uploadConversionAdjustments")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ jobId: "job-123", results: [{ orderId: "ORD-202610-001" }] }),
        });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    globalThis.fetch = fetchMock;

    const res = await retractGoogleAdsConversion([
      "POS-12345",
      "ORD-202610-001",
      "ORD-202610-002",
    ]);

    expect(res.success).toBe(true);
    expect(res.orderIds).toEqual(["ORD-202610-001", "ORD-202610-002"]);
    expect(res.jobId).toBe("job-123");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify upload payload
    const uploadCall = fetchMock.mock.calls[1];
    const body = JSON.parse(uploadCall[1].body);
    expect(body.customerId).toBe("7930659050");
    expect(body.conversionAdjustments).toHaveLength(2);
    expect(body.conversionAdjustments[0].adjustmentType).toBe("RETRACTION");
    expect(body.conversionAdjustments[0].orderId).toBe("ORD-202610-001");
    expect(body.conversionAdjustments[0].conversionAction).toBe(
      "customers/7930659050/conversionActions/7769300841",
    );
  });

  it("handles OAuth failure gracefully without crashing", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("oauth2.googleapis.com")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve("invalid_grant"),
        });
      }
      return Promise.reject(new Error("Unexpected URL"));
    });

    globalThis.fetch = fetchMock;

    const res = await retractGoogleAdsConversion("ORD-FAIL-01");
    expect(res.success).toBe(false);
    expect(res.error).toContain("OAuth token refresh failed");
  });
});
