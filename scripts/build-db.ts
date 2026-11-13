import { databasePath, loadConfig } from '../src/server/config.js';
import { buildDatabase } from '../src/server/db/build.js';

const config = loadConfig();
const dbFile = databasePath(config);
const report = buildDatabase(dbFile, config.seedDir, { profile: config.seedProfile, clock: config.clock });

console.log(`Built ${dbFile}`);
console.log(`Imported ${report.import.users} users and ${report.import.leads} leads`);
console.log(`Dropped lead columns: ${report.import.droppedLeadColumns.join(', ')}`);
console.log(`Dropped user columns: ${report.import.droppedUserColumns.length} (${report.import.droppedUserColumns.join(', ')})`);
for (const ref of report.import.unresolvedUserReferences) console.log(`Unresolved user reference (stored as null): ${ref}`);
console.log(`Leads kept with a blank required field: ${report.import.leadsMissingRequiredFields.join(', ') || 'none'}`);
console.log(`Generated: ${JSON.stringify(report.generated)}`);
