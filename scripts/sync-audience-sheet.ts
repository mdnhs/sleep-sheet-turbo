import { extractCustomerList } from "../features/audiences/server/route";
import { syncGoogleAdsCustomerMatchSheet } from "../lib/google-sheets";

async function main() {
  console.log("⏳ Extracting verified customers from Neon DB...");
  const customers = await extractCustomerList();
  console.log(`✅ Extracted ${customers.length} customers.`);

  console.log("⏳ Syncing to Google Sheets 'Google Ad' tab...");
  const result = await syncGoogleAdsCustomerMatchSheet(customers, "Google Ad");
  console.log(`🎉 Successfully synced ${result.updatedRows} rows to 'Google Ad' tab!`);
}

main().catch((err) => {
  console.error("Sync error:", err);
  process.exit(1);
});
