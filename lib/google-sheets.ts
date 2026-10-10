import type { sheets_v4 } from "googleapis";
import { getGoogleSheetsConfig } from "@/lib/server-config";

const SHEET_NAME = "Sheet1";
const HEADER_ROW = [
  "Date",
  "Order ID",
  "Customer",
  "Phone",
  "Address",
  "Qty",
  "Amount",
  "Cost",
  "Shipping",
  "Profit",
  "Channel",
];

export interface SheetOrderRow {
  date: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  address: string;
  quantity: number;
  totalAmount: number;
  boughtCost: number;
  shippingCost: number;
  channel: string;
}

async function getSheetsClient() {
  const config = await getGoogleSheetsConfig();
  if (!config.clientEmail || !config.privateKey || !config.spreadsheetId) {
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

  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, spreadsheetId: config.spreadsheetId };
}

async function ensureHeaderRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:Z1`,
  });
  const firstRow = res.data.values?.[0] as string[] | undefined;

  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  } else {
    // If the sheet already exists with headers but lacks "Channel", add it to the next column
    const hasChannel = firstRow.some(
      (h) => h?.toLowerCase().includes("channel") || h?.toLowerCase().includes("page")
    );
    if (!hasChannel) {
      const nextColLetter = String.fromCharCode(65 + firstRow.length);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!${nextColLetter}1`,
        valueInputOption: "RAW",
        requestBody: { values: [["Channel"]] },
      });
    }
  }
}

// Appends one row per order to the configured spreadsheet, writing the
// header row first if the sheet is still empty. Order is a single flat log
// (not one tab per day) — the Date column is what makes it sortable/
// filterable by day in Sheets itself.
export async function appendOrdersToSheet(rows: SheetOrderRow[]): Promise<void> {
  if (rows.length === 0) return;

  const { sheets, spreadsheetId } = await getSheetsClient();
  await ensureHeaderRow(sheets, spreadsheetId);

  const values = rows.map((r) => [
    // Leading apostrophe forces USER_ENTERED to treat this as literal text
    // instead of auto-parsing "2026-08-30" into a date serial number, which
    // then rendered as a raw number (e.g. 46264) with no date format applied.
    // ISO-formatted text still sorts correctly, so nothing is lost.
    `'${r.date}`,
    r.orderNumber,
    r.customerName,
    r.phone,
    r.address,
    r.quantity,
    r.totalAmount,
    r.boughtCost,
    r.shippingCost,
    // Profit (column J) is filled in below as a live =G-H-I formula once we
    // know which row(s) these landed on, so editing Amount/Cost/Shipping by
    // hand in the sheet keeps Profit correct instead of leaving it stale.
    "",
    // Channel / Source (column K) as like report ("Website" or "[Page Name] (POS)")
    r.channel,
  ]);

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:A`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  const updatedRange = appendRes.data.updates?.updatedRange;
  const startRowMatch = updatedRange?.match(/![A-Z]+(\d+):/);
  if (startRowMatch) {
    const startRow = Number(startRowMatch[1]);
    const profitFormulas = rows.map((_, i) => {
      const row = startRow + i;
      return [`=G${row}-H${row}-I${row}`];
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!J${startRow}:J${startRow + rows.length - 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: profitFormulas },
    });
  }
}

export interface CustomerMatchSheetRow {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  country: string;
  zip: string;
}

export async function syncGoogleAdsCustomerMatchSheet(
  rows: CustomerMatchSheetRow[],
  targetTab = "Google Ad"
): Promise<{ updatedRows: number }> {
  const { sheets, spreadsheetId } = await getSheetsClient();
  const header = ["Email", "Phone", "First Name", "Last Name", "Country", "Zip"];
  const sheetValues = [
    header,
    ...rows.map((r) => [r.email, r.phone, r.firstName, r.lastName, r.country, r.zip]),
  ];

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${targetTab}'!A1:Z5000`,
  });

  const res = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${targetTab}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: sheetValues },
  });

  return { updatedRows: res.data.updatedRows ?? sheetValues.length };
}

