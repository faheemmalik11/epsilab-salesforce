import { databasePath, loadConfig } from '../src/server/config.js';
import { buildDatabase } from '../src/server/db/build.js';

const config = loadConfig();
const dbFile = databasePath(config);
buildDatabase(dbFile, config.seedDir);
console.log(`Built ${dbFile}`);
