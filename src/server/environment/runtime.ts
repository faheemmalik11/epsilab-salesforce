import { clockFromConfig, type Clock } from '../clock.js';
import { fail } from '../services/errors.js';
import type { DbStore } from './store.js';

export interface ClockSetting {
  start: string;
  mode: string;
}

export interface SnapshotConfig {
  /** Folder holding baseline-<profile>.db and named snapshots, each with a .sha256 file. */
  dir: string;
  /** SEED_PROFILE: which baseline "baseline" refers to. */
  profile: string;
}

/**
 * The one runtime object every REST route and MCP tool reads at request time. Reset replaces
 * the database inside `store`, and the clock endpoints replace `clock`, so nothing may copy it.
 */
export interface Runtime {
  readonly store: DbStore;
  clock: Clock;
  clockSetting: ClockSetting;
  readonly defaultUserId: string | null;
  readonly snapshots: SnapshotConfig;
}

export function createRuntime(options: {
  store: DbStore;
  clock: ClockSetting;
  snapshots: SnapshotConfig;
  defaultUserId?: string | null;
}): Runtime {
  return {
    store: options.store,
    clock: clockFromConfig(options.clock.start, options.clock.mode),
    clockSetting: options.clock,
    defaultUserId: options.defaultUserId ?? null,
    snapshots: options.snapshots,
  };
}

/** Replaces the app clock at runtime. Invalid settings are rejected before anything changes. */
export function setClock(runtime: Runtime, setting: ClockSetting): void {
  let clock: Clock;
  try {
    clock = clockFromConfig(setting.start, setting.mode);
  } catch (error) {
    return fail('INVALID_FIELD', (error as Error).message, [Number.isNaN(Date.parse(setting.start)) ? 'start' : 'mode']);
  }
  runtime.clock = clock;
  runtime.clockSetting = setting;
}

export function describeClock(runtime: Runtime) {
  return { now: runtime.clock.now(), today: runtime.clock.today(), start: runtime.clockSetting.start, mode: runtime.clockSetting.mode };
}
