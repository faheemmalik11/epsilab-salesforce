import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listUsers, resolveActingUser } from '../../../src/server/services/index.js';
import { createServiceFixture, errorsOf, type ServiceFixture } from '../../services.js';

let f: ServiceFixture;
beforeEach(() => (f = createServiceFixture()));
afterEach(() => f.cleanup());

describe('acting user', () => {
  it('defaults to the first active user by name', () => {
    expect(resolveActingUser(f.db)).toBe(f.users.manager);
  });

  it('uses the configured default, then an explicit request over it', () => {
    expect(resolveActingUser(f.db, undefined, f.users.rep)).toBe(f.users.rep);
    expect(resolveActingUser(f.db, f.users.manager, f.users.rep)).toBe(f.users.manager);
  });

  it('accepts a 15-character ID', () => {
    expect(resolveActingUser(f.db, f.users.rep.slice(0, 15))).toBe(f.users.rep);
  });

  it('rejects inactive, unknown and malformed users', () => {
    expect(errorsOf(() => resolveActingUser(f.db, f.users.inactive))).toEqual([
      expect.objectContaining({ errorCode: 'INACTIVE_OWNER_OR_USER' }),
    ]);
    expect(errorsOf(() => resolveActingUser(f.db, f.users.rep.slice(0, 14) + 'Z'))).toEqual([
      expect.objectContaining({ errorCode: 'INVALID_CROSS_REFERENCE_KEY' }),
    ]);
    expect(errorsOf(() => resolveActingUser(f.db, 'x'))).toEqual([expect.objectContaining({ errorCode: 'MALFORMED_ID' })]);
  });

  it('lists users with active flags', () => {
    expect(listUsers(f.db).map((u) => [u.Name, u.IsActive])).toEqual([
      ['Ina Inactive', false],
      ['Morgan Manager', true],
      ['Riley Rep', true],
    ]);
  });
});
