import type { sheets_v4 } from "googleapis";
import { getGoogleSheetsConfig } from "@/lib/server-config";

// A separate, purpose-built spreadsheet feeding an n8n automation — unrelated
// to the order-log sheet in lib/google-sheets.ts, so it gets its own file
// and its own hardcoded spreadsheet id rather than a Settings field.
const PRODUCTS_SPREADSHEET_ID = "1hkkNvnm6MrS-JOZpCUiPAila4XRTfOvXkdv1bf6rFwg";
const SHEET_NAME = "products";
// Column names (including the "Catagory" spelling) match what the n8n
// workflow already expects from this sheet — do not "fix" the typo here.
const HEADER_ROW = ["Name", "Catagory", "price", "is_available", "Image URL"];

export interface ProductSheetRow {
  name: string;
  category: string;
  price: number;
  isAvailable: boolean;
  imageUrl: string;
}

async function getSheetsClient() {
  const config = await getGoogleSheetsConfig();
  if (!config.clientEmail || !config.privateKey) {
    throw new Error("Google Sheets is not configured. Set it up in Settings > Shipping & Courier.");
  }

  const { google } = await import("googleapis");

  const auth = new google.auth.JWT({
    email: config.clientEmail,
    // The key is pasted into a plain text setting field, so literal "\n"
    // sequences (not real newlines) are how it survives that round trip.
    key: config.privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function ensureProductsSheetExists(sheets: sheets_v4.Sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: PRODUCTS_SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: PRODUCTS_SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
      },
    });
  }
}

// Full resync, not an append: the admin picks a set of categories and this
// replaces whatever was in the "products" tab with exactly those products'
// images, one row per image. The n8n automation reading this sheet expects
// it to reflect only the currently-selected categories, not accumulate.
export async function replaceProductsSheet(rows: ProductSheetRow[]): Promise<void> {
  const sheets = await getSheetsClient();
  await ensureProductsSheetExists(sheets);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: PRODUCTS_SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const values = [
    HEADER_ROW,
    ...rows.map((r) => [
      r.name,
      r.category,
      `${r.price}bdt`,
      r.isAvailable ? "yes" : "no",
      r.imageUrl,
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: PRODUCTS_SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
