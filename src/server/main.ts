import { buildApiApp, buildGuiApp } from './app.js';
import { clockFromConfig } from './clock.js';
import { databasePath, loadConfig } from './config.js';
import { openDatabase } from './db/connection.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDatabase(databasePath(config));
  const deps = {
    db,
    clock: clockFromConfig(config.clock, config.clockMode),
    defaultUserId: config.defaultUserId,
    mcpAllowedHosts: config.mcpAllowedHosts,
    logger: true,
  };

  const api = await buildApiApp(deps);
  const gui = await buildGuiApp({ ...deps, webDir: config.webDir });

  await api.listen({ host: config.host, port: config.apiPort });
  await gui.listen({ host: config.host, port: config.guiPort });

  const shutdown = async () => {
    await Promise.all([api.close(), gui.close()]);
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
