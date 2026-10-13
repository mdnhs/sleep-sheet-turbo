// Typed, decrypted reads of the integrations group (lib/settings/registry.ts).
// The group holds credentials, so it comes from the in-process snapshot,
// which the settings PATCH drops on every save.
import { getSettingsGroup } from "@/lib/settings/read";

export async function getCloudinaryConfig() {
  const s = await getSettingsGroup("integrations");
  return { cloudName: s.cloudinary_cloud_name, apiKey: s.cloudinary_api_key, apiSecret: s.cloudinary_api_secret };
}

export async function getR2Config() {
  const s = await getSettingsGroup("integrations");
  return {
    accountId: s.r2_account_id,
    bucket: s.r2_bucket,
    publicUrl: s.r2_public_url,
    accessKeyId: s.r2_access_key_id,
    secretAccessKey: s.r2_secret_access_key,
  };
}

export async function getMediaProvider() {
  const s = await getSettingsGroup("integrations");
  return s.media_provider;
}

export async function getSteadfastConfig() {
  const s = await getSettingsGroup("integrations");
  return { apiKey: s.steadfast_api_key, secretKey: s.steadfast_secret_key };
}

export async function getBdCourierConfig() {
  const s = await getSettingsGroup("integrations");
  return { apiKey: s.bdcourier_api_key };
}

export async function getGoogleSheetsConfig() {
  const s = await getSettingsGroup("integrations");
  return {
    clientEmail: s.google_sheets_client_email,
    privateKey: s.google_sheets_private_key,
    spreadsheetId: s.google_sheets_spreadsheet_id,
  };
}
