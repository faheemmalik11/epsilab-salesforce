import type { Db } from './connection.js';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SUFFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
const ID_15 = /^[0-9A-Za-z]{15}$/;
const ID_18 = /^[0-9A-Za-z]{18}$/;

/** Generated IDs use pod "SB0" so they can never collide with the real IDs in the seed. */
const POD = 'SB0';
const COUNTER_LENGTH = 9;

/**
 * The case-safe suffix: for each 5-character chunk, set bit i when character i is
 * an uppercase letter, then map the 5-bit value into A-Z0-5.
 */
export function checksumSuffix(id15: string): string {
  let suffix = '';
  for (let chunk = 0; chunk < 3; chunk++) {
    let bits = 0;
    for (let i = 0; i < 5; i++) {
      const c = id15.charCodeAt(chunk * 5 + i);
      if (c >= 65 && c <= 90) bits |= 1 << i;
    }
    suffix += SUFFIX_ALPHABET[bits];
  }
  return suffix;
}

export function isValidId(id: string): boolean {
  if (ID_15.test(id)) return true;
  return ID_18.test(id) && checksumSuffix(id.slice(0, 15)) === id.slice(15);
}

/** Converts a valid 15 or 18-character ID to the canonical 18-character form. */
export function toId18(id: string): string {
  if (!isValidId(id)) throw new Error(`Invalid Salesforce ID: ${id}`);
  return id.length === 18 ? id : id + checksumSuffix(id);
}

export function formatId(keyPrefix: string, counter: number): string {
  if (!Number.isSafeInteger(counter) || counter < 1) throw new Error(`Invalid ID counter ${counter}`);
  let encoded = '';
  for (let n = counter; n > 0; n = Math.floor(n / 62)) encoded = BASE62[n % 62] + encoded;
  const id15 = keyPrefix + POD + encoded.padStart(COUNTER_LENGTH, '0');
  return id15 + checksumSuffix(id15);
}

/** Returns the next ID for a key prefix. Deterministic: counters live in the database. */
export function nextId(db: Db, keyPrefix: string): string {
  const row = db
    .prepare(
      `INSERT INTO id_sequence (key_prefix, last_value) VALUES (?, 1)
       ON CONFLICT (key_prefix) DO UPDATE SET last_value = last_value + 1
       RETURNING last_value`,
    )
    .get(keyPrefix) as { last_value: number };
  return formatId(keyPrefix, row.last_value);
}
