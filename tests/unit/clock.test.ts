import { describe, expect, it } from 'vitest';
import { clockFromConfig, endOfQuarter, fixedClock, offsetClock } from '../../src/server/clock.js';

describe('clocks', () => {
  it('fixed clock always returns the configured instant', () => {
    const clock = fixedClock('2028-11-11T09:00:00Z');
    expect(clock.now()).toBe('2028-11-11T09:00:00.000Z');
    expect(clock.today()).toBe('2028-11-11');
  });

  it('offset clock starts at the configured instant and advances with real time', () => {
    let real = 1_000_000;
    const clock = offsetClock('2028-11-11T09:00:00Z', () => real);
    expect(clock.now()).toBe('2028-11-11T09:00:00.000Z');
    real += 1500;
    expect(clock.now()).toBe('2028-11-11T09:00:01.500Z');
  });

  it('rejects bad configuration', () => {
    expect(() => fixedClock('not a date')).toThrow(/Invalid clock/);
    expect(() => clockFromConfig('2028-11-11T09:00:00Z', 'sometimes')).toThrow(/CLOCK_MODE/);
  });
});

describe('endOfQuarter', () => {
  it.each([
    ['2028-11-11', '2028-12-31'],
    ['2028-01-01', '2028-03-31'],
    ['2028-03-31', '2028-03-31'],
    ['2028-04-01', '2028-06-30'],
    ['2028-08-15', '2028-09-30'],
  ])('%s ends its quarter on %s', (date, expected) => {
    expect(endOfQuarter(date)).toBe(expected);
  });
});
