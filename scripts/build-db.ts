import { loadConfig, snapshotDir } from '../src/server/config.js';
import { buildBaselines } from '../src/server/db/build.js';

const config = loadConfig();
for (const report of buildBaselines(snapshotDir(config), config.seedDir, config.clock)) {
  console.log(`Baseline "${report.profile}": sha256 ${report.snapshot.sha256} (${report.snapshot.bytes} bytes)`);
  console.log(`  Imported ${report.import.users} users and ${report.import.leads} leads`);
  console.log(`  Generated: ${JSON.stringify(report.generated)}`);
}
