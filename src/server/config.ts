import path from 'node:path';

export interface AppConfig {
  host: string;
  guiPort: number;
  apiPort: number;
  dataDir: string;
  seedDir: string;
  webDir: string;
  seedProfile: string;
  clock: string;
  mcpAllowedHosts: string[];
}

function readPort(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${name} must be a port number, got "${raw}"`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const root = process.cwd();
  return {
    host: env.HOST || '0.0.0.0',
    guiPort: readPort('GUI_PORT', 3000),
    apiPort: readPort('API_PORT', 8080),
    dataDir: path.resolve(root, env.DATA_DIR || 'data'),
    seedDir: path.resolve(root, env.SEED_DIR || 'seed'),
    webDir: path.resolve(root, env.WEB_DIR || 'dist/web'),
    seedProfile: env.SEED_PROFILE || 'default',
    clock: env.CLOCK || '2028-11-11T09:00:00Z',
    mcpAllowedHosts: (env.MCP_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  };
}

export function databasePath(config: Pick<AppConfig, 'dataDir'>): string {
  return path.join(config.dataDir, 'app.db');
}
