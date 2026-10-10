// Manual/cron entry point for the retention sweep:
//   npx tsx scripts/purge-old-data.ts
import "dotenv/config";
import {
  purgeOldActivityLogs,
  ACTIVITY_RETENTION_DAYS,
} from "../lib/data-retention";

(async () => {
  await purgeOldActivityLogs();
  console.log(`Purged activity logs older than ${ACTIVITY_RETENTION_DAYS} days`);
})();
