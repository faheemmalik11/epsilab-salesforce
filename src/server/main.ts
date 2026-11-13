import { buildApiApp, buildGuiApp } from './app.js';
import { databasePath, loadConfig, snapshotDir } from './config.js';
import { createRuntime } from './environment/runtime.js';
import { prepareWorkingDatabase } from './environment/snapshots.js';
import { DbStore } from './environment/store.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const snapshots = { dir: snapshotDir(config), profile: config.seedProfile };
  const working = databasePath(config);
  const prepared = prepareWorkingDatabase(snapshots, working);

  const runtime = createRuntime({
    store: new DbStore(working),
    clock: { start: config.clock, mode: config.clockMode },
    snapshots,
    defaultUserId: config.defaultUserId,
  });
  const options = { mcpAllowedHosts: config.mcpAllowedHosts, logger: true };

  const api = await buildApiApp(runtime, options);
  const gui = await buildGuiApp(runtime, { ...options, webDir: config.webDir });
  api.log.info(`Working database ${prepared} from the "${config.seedProfile}" baseline`);

  await api.listen({ host: config.host, port: config.apiPort });
  await gui.listen({ host: config.host, port: config.guiPort });

  const shutdown = async () => {
    await Promise.all([api.close(), gui.close()]);
    runtime.store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
