import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/server/config.js';

describe('loadConfig', () => {
  it('uses documented defaults when nothing is set', () => {
    expect(loadConfig({})).toMatchObject({
      host: '0.0.0.0',
      guiPort: 3000,
      apiPort: 8080,
      seedProfile: 'default',
      clock: '2028-11-11T09:00:00Z',
      clockMode: 'offset',
      defaultUserId: null,
      mcpAllowedHosts: ['localhost', '127.0.0.1', '[::1]'],
    });
  });

  it('reads ports, seed profile, clock, default user and paths from the environment', () => {
    const config = loadConfig({
      HOST: '127.0.0.1',
      GUI_PORT: '4000',
      API_PORT: '9090',
      SEED_PROFILE: 'small',
      CLOCK: '2029-01-15T12:00:00Z',
      CLOCK_MODE: 'fixed',
      DEFAULT_USER_ID: '005pT7h9JXvwEqzQYE',
      DATA_DIR: '/var/data',
      MCP_ALLOWED_HOSTS: 'localhost, app.internal ,',
    });
    expect(config).toMatchObject({
      host: '127.0.0.1',
      guiPort: 4000,
      apiPort: 9090,
      seedProfile: 'small',
      clock: '2029-01-15T12:00:00Z',
      clockMode: 'fixed',
      defaultUserId: '005pT7h9JXvwEqzQYE',
      dataDir: path.resolve('/var/data'),
      mcpAllowedHosts: ['localhost', 'app.internal'],
    });
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ API_PORT: 'eighty' })).toThrow(/API_PORT must be a port number/);
    expect(() => loadConfig({ GUI_PORT: '70000' })).toThrow(/GUI_PORT/);
  });
});
