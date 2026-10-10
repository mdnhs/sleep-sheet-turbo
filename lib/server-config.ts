// Was a second, uncached copy of this query: every getSteadfastConfig() /
// getCloudinaryConfig() / getBdCourierConfig() call woke the Neon compute for
// a table that changes a few times a month. The shared map is cached
// in-process for 60s and dropped immediately when settings are saved
// (the settings PATCH calls invalidateSettingsCache).
import { getSettingsMap } from "@/lib/settings-cache";

export async function getCloudinaryConfig() {
  const map = await getSettingsMap();
  return {
    cloudName: map.cloudinary_cloud_name || "",
    apiKey: map.cloudinary_api_key || "",
    apiSecret: map.cloudinary_api_secret || "",
  };
}

export async function getSteadfastConfig() {
  const map = await getSettingsMap();
  return {
    apiKey: map.steadfast_api_key || "",
    secretKey: map.steadfast_secret_key || "",
  };
}

export async function getBdCourierConfig() {
  const map = await getSettingsMap();
  return {
    apiKey: map.bdcourier_api_key || "",
  };
}

export async function getGoogleSheetsConfig() {
  const map = await getSettingsMap();
  return {
    clientEmail: map.google_sheets_client_email || "",
    privateKey: map.google_sheets_private_key || "",
    spreadsheetId: map.google_sheets_spreadsheet_id || "",
  };
}
