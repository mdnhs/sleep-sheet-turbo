import { getStoredSettings } from "@/lib/settings/read";

export interface GoogleAdsRetractionResult {
  success: boolean;
  orderIds: string[];
  jobId?: string;
  error?: string;
}

/**
 * Retracts one or more conversion orders in Google Ads.
 * Used when an admin deletes a fake or fraudulent order starting with "ORD-".
 *
 * This notifies Google Ads Smart Bidding (and conversion reporting) to remove
 * the conversion value and stop optimizing toward fake or fraudulent users.
 */
export async function retractGoogleAdsConversion(
  orderInput: string | string[],
): Promise<GoogleAdsRetractionResult> {
  const rawList = Array.isArray(orderInput) ? orderInput : [orderInput];
  const orderIds = rawList
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.toUpperCase().startsWith("ORD-"));

  if (orderIds.length === 0) {
    return { success: true, orderIds: [] };
  }

  try {
    const settings = await getStoredSettings().catch(() => ({} as Record<string, string>));

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID || settings.google_ads_client_id;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET || settings.google_ads_client_secret;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN || settings.google_ads_refresh_token;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || settings.google_ads_developer_token;
    const customerId = (
      process.env.GOOGLE_ADS_DEFAULT_CUSTOMER_ID ||
      settings.google_ads_customer_id ||
      "7930659050"
    ).replace(/\D/g, "");
    const conversionActionId = (
      process.env.GOOGLE_ADS_CONVERSION_ACTION_ID ||
      settings.google_ads_conversion_action_id ||
      "7769300841"
    ).replace(/\D/g, "");

    if (!clientId || !clientSecret || !refreshToken || !developerToken || !customerId || !conversionActionId) {
      const msg = "Missing Google Ads credentials for conversion retraction";
      console.warn(`[google-ads] ${msg}`);
      return { success: false, orderIds, error: msg };
    }

    // Refresh OAuth access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      const msg = `OAuth token refresh failed: ${tokenRes.status} ${errText}`;
      console.error(`[google-ads] ${msg}`);
      return { success: false, orderIds, error: msg };
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      const msg = "OAuth response missing access_token";
      console.error(`[google-ads] ${msg}`);
      return { success: false, orderIds, error: msg };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    };

    const adjustmentDateTime =
      new Date().toISOString().replace("T", " ").substring(0, 19) + "+00:00";

    const payload = {
      customerId,
      conversionAdjustments: orderIds.map((orderId) => ({
        conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
        adjustmentType: "RETRACTION",
        orderId,
        adjustmentDateTime,
      })),
      partialFailure: true,
    };

    const res = await fetch(
      `https://googleads.googleapis.com/v26/customers/${customerId}:uploadConversionAdjustments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );

    const data = (await res.json()) as {
      jobId?: string;
      partialFailureError?: { message?: string };
      results?: Array<{ orderId?: string }>;
    };

    if (!res.ok) {
      const msg = `Google Ads API HTTP error: ${res.status} ${JSON.stringify(data)}`;
      console.error(`[google-ads] ${msg}`);
      return { success: false, orderIds, error: msg };
    }

    if (data.partialFailureError) {
      console.warn(
        `[google-ads] Retraction partial failure for orders ${orderIds.join(", ")}:`,
        data.partialFailureError.message,
      );
    } else {
      console.info(
        `[google-ads] Retraction successfully uploaded for ${orderIds.length} orders:`,
        orderIds,
        `Job ID: ${data.jobId ?? "unknown"}`,
      );
    }

    return {
      success: true,
      orderIds,
      jobId: data.jobId,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[google-ads] Conversion retraction error:", error);
    return { success: false, orderIds, error };
  }
}
