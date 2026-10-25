/** Run the idempotent maintenance job once (`pnpm maintenance`); schedule hourly. */
import { disconnectDB } from "@/lib/db";
import { runMaintenance } from "@/modules/admin/maintenance.service";

runMaintenance()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((err) => {
    console.error("Maintenance failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
