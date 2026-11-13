import { describe, expect, it } from 'vitest';
import { checksumSuffix, formatId, isValidId, toId18 } from '../../src/server/db/ids.js';
import { OBJECTS } from '../../src/server/metadata/index.js';
import { readSeed } from '../seed.js';

const seedIds = [
  ...readSeed('leads.csv').map((r) => r['Lead ID']!),
  ...readSeed('users-core.csv').map((r) => r['User ID']!),
];

describe('checksum suffix', () => {
  it('reproduces the suffix of every real ID in the seed', () => {
    expect(seedIds).toHaveLength(21637);
    const mismatches = seedIds.filter((id) => checksumSuffix(id.slice(0, 15)) !== id.slice(15));
    expect(mismatches).toEqual([]);
  });

  it('accepts 15 and 18-character IDs and rejects bad ones', () => {
    const id18 = seedIds[0]!;
    expect(isValidId(id18)).toBe(true);
    expect(isValidId(id18.slice(0, 15))).toBe(true);
    expect(isValidId(id18.slice(0, 17) + (id18[17] === 'A' ? 'B' : 'A'))).toBe(false);
    expect(isValidId('00Q-not-an-id!!')).toBe(false);
    expect(isValidId('')).toBe(false);
  });

  it('converts 15-character IDs to 18 characters', () => {
    const id18 = seedIds[0]!;
    expect(toId18(id18.slice(0, 15))).toBe(id18);
    expect(toId18(id18)).toBe(id18);
    expect(() => toId18('bad')).toThrow(/Invalid Salesforce ID/);
  });
});

describe('formatId', () => {
  it('builds valid 18-character IDs with the object key prefix', () => {
    for (const object of OBJECTS) {
      const id = formatId(object.keyPrefix, 1);
      expect(id).toHaveLength(18);
      expect(id.startsWith(object.keyPrefix)).toBe(true);
      expect(isValidId(id)).toBe(true);
    }
  });

  it('gives distinct IDs for distinct counters, including across base-62 boundaries', () => {
    const ids = [1, 61, 62, 63, 3843, 3844, 1_000_000].map((n) => formatId('001', n));
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(isValidId(id)).toBe(true));
  });

  it('never collides with a seed ID because of its pod characters', () => {
    expect(seedIds.some((id) => id.slice(3, 6) === 'SB0')).toBe(false);
  });

  it('rejects invalid counters', () => {
    expect(() => formatId('001', 0)).toThrow();
    expect(() => formatId('001', 1.5)).toThrow();
    expect(() => formatId('001', Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
});
