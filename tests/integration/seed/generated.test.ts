import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isValidId } from '../../../src/server/db/ids.js';
import { OPPORTUNITY_STAGE } from '../../../src/server/metadata/picklists.js';
import { PROFILES } from '../../../src/server/seed/generate.js';
import { BUILD_CLOCK, cachedBaseline } from '../../baselines.js';
import { readSeed } from '../../seed.js';

// Phase 7: the generated org is large, consistent and realistically messy, in both SEED_PROFILEs.

const TODAY = BUILD_CLOCK.slice(0, 10);
const PREFIX: Record<string, string> = { Account: '001', Contact: '003', Opportunity: '006', OpportunityContactRole: '00K', Task: '00T' };

for (const profile of Object.keys(PROFILES)) {
  describe(`generated data, profile "${profile}"`, () => {
    let db: Database.Database;
    beforeAll(() => {
      db = new Database(cachedBaseline(profile).file, { readonly: true, fileMustExist: true });
    });
    afterAll(() => db.close());

    const n = (sql: string, ...params: unknown[]) => (db.prepare(sql).get(...params) as { n: number }).n;
    const rows = <T>(sql: string) => db.prepare(sql).all() as T[];
    const scale = profile === 'default' ? 1 : 0.1;

    it('has the planned volume of every object', () => {
      const generated = cachedBaseline(profile).generated;
      const expected = PROFILES[profile]!;
      const planned = expected.seedAccounts + expected.syntheticAccounts + Math.round(expected.syntheticAccounts * expected.nearDuplicateRate);
      expect(generated.Account).toBe(planned);
      for (const [object, count] of Object.entries(generated)) expect(n(`SELECT COUNT(*) AS n FROM "${object}"`), object).toBe(count);
      expect(generated.Contact).toBeGreaterThan(2.5 * generated.Account);
      expect(generated.Opportunity).toBeGreaterThan(1.5 * generated.Account);
      expect(generated.OpportunityContactRole).toBeGreaterThan(generated.Opportunity);
      expect(generated.Task).toBeGreaterThan(4 * generated.Opportunity);
      expect(generated.Account).toBeGreaterThan(1500 * scale);
    });

    it('keeps the seed exactly: 21,628 leads, 9 users, 7,111 Hot, nothing converted or added', () => {
      expect(n('SELECT COUNT(*) AS n FROM "Lead"')).toBe(21628);
      expect(n('SELECT COUNT(*) AS n FROM "User"')).toBe(9);
      expect(n(`SELECT COUNT(*) AS n FROM "Lead" WHERE "Rating" = 'Hot' AND "IsConverted" = 0`)).toBe(7111);
      expect(n('SELECT COUNT(*) AS n FROM "Lead" WHERE "IsConverted" = 1')).toBe(0);
      const seedIds = new Set(readSeed('leads.csv').map((l) => l['Lead ID']));
      const leadIds = rows<{ Id: string }>('SELECT "Id" FROM "Lead"').map((r) => r.Id);
      expect(leadIds.every((id) => seedIds.has(id))).toBe(true);
      // Every lead row is untouched: audit fields still come from the seed, not the generator's clock.
      expect(n(`SELECT COUNT(*) AS n FROM "Lead" WHERE "LastModifiedDate" > ?`, BUILD_CLOCK.replace('Z', '.000Z'))).toBe(0);
    });

    it('uses valid Salesforce IDs with the right key prefix for every generated record', () => {
      for (const [object, prefix] of Object.entries(PREFIX)) {
        const ids = rows<{ Id: string }>(`SELECT "Id" FROM "${object}"`).map((r) => r.Id);
        expect(ids.every((id) => isValidId(id) && id.length === 18 && id.startsWith(prefix)), object).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it('has no orphaned references', () => {
      expect(n('SELECT COUNT(*) AS n FROM "Contact" WHERE "AccountId" IS NULL OR "AccountId" NOT IN (SELECT "Id" FROM "Account")')).toBe(0);
      expect(n('SELECT COUNT(*) AS n FROM "Opportunity" WHERE "AccountId" IS NULL OR "AccountId" NOT IN (SELECT "Id" FROM "Account")')).toBe(0);
      expect(
        n(`SELECT COUNT(*) AS n FROM "OpportunityContactRole"
           WHERE "OpportunityId" NOT IN (SELECT "Id" FROM "Opportunity") OR "ContactId" NOT IN (SELECT "Id" FROM "Contact")`),
      ).toBe(0);
      // A contact role's contact belongs to the opportunity's account.
      expect(
        n(`SELECT COUNT(*) AS n FROM "OpportunityContactRole" r JOIN "Opportunity" o ON o."Id" = r."OpportunityId"
           JOIN "Contact" c ON c."Id" = r."ContactId" WHERE c."AccountId" <> o."AccountId"`),
      ).toBe(0);
      expect(
        n(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhoId" IS NOT NULL
           AND "WhoId" NOT IN (SELECT "Id" FROM "Lead") AND "WhoId" NOT IN (SELECT "Id" FROM "Contact")`),
      ).toBe(0);
      expect(
        n(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhatId" IS NOT NULL
           AND "WhatId" NOT IN (SELECT "Id" FROM "Account") AND "WhatId" NOT IN (SELECT "Id" FROM "Opportunity")`),
      ).toBe(0);
      expect(n('SELECT COUNT(*) AS n FROM "Task" WHERE "WhoId" IS NULL AND "WhatId" IS NULL')).toBe(0);
      // Salesforce does not relate a lead's task to an account or opportunity.
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhoId" LIKE '00Q%' AND "WhatId" IS NOT NULL`)).toBe(0);
      // A task about a deal names a contact at that deal's account.
      expect(
        n(`SELECT COUNT(*) AS n FROM "Task" t JOIN "Opportunity" o ON o."Id" = t."WhatId" JOIN "Contact" c ON c."Id" = t."WhoId"
           WHERE c."AccountId" <> o."AccountId"`),
      ).toBe(0);
    });

    it('assigns records only to active users, with uneven workloads, and keeps former users as creators', () => {
      for (const object of ['Account', 'Contact', 'Opportunity', 'Task']) {
        expect(n(`SELECT COUNT(*) AS n FROM "${object}" WHERE "OwnerId" NOT IN (SELECT "Id" FROM "User" WHERE "IsActive" = 1)`), object).toBe(0);
      }
      const perOwner = rows<{ n: number }>('SELECT COUNT(*) AS n FROM "Opportunity" GROUP BY "OwnerId" ORDER BY n DESC').map((r) => r.n);
      expect(perOwner).toHaveLength(7);
      expect(perOwner[0]!).toBeGreaterThan(2 * perOwner[perOwner.length - 1]!);
      expect(n(`SELECT COUNT(*) AS n FROM "Account" WHERE "CreatedById" IN (SELECT "Id" FROM "User" WHERE "IsActive" = 0)`)).toBeGreaterThan(0);
    });

    it('covers every opportunity stage, with won and lost deals and consistent stage fields', () => {
      const stages = rows<{ StageName: string; n: number }>('SELECT "StageName", COUNT(*) AS n FROM "Opportunity" GROUP BY "StageName"');
      expect(stages.map((s) => s.StageName).sort()).toEqual(OPPORTUNITY_STAGE.values.map((s) => s.value).sort());
      const total = stages.reduce((sum, s) => sum + s.n, 0);
      const share = (stage: string) => (stages.find((s) => s.StageName === stage)?.n ?? 0) / total;
      expect(share('Closed Won')).toBeGreaterThan(0.1);
      expect(share('Closed Lost')).toBeGreaterThan(share('Closed Won') * 0.8);
      for (const stage of OPPORTUNITY_STAGE.values) {
        expect(
          n(
            `SELECT COUNT(*) AS n FROM "Opportunity" WHERE "StageName" = ? AND ("IsClosed" <> ? OR "IsWon" <> ? OR "Probability" <> ? OR "ForecastCategoryName" <> ?)`,
            stage.value, stage.closed ? 1 : 0, stage.won ? 1 : 0, stage.probability, stage.forecastCategory,
          ),
          stage.value,
        ).toBe(0);
      }
      // The Amount rule holds everywhere; early stages sometimes have no Amount yet.
      expect(n(`SELECT COUNT(*) AS n FROM "Opportunity" WHERE "Amount" IS NULL AND "StageName" NOT IN ('Prospecting', 'Qualification')`)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Opportunity" WHERE "Amount" IS NULL`)).toBeGreaterThan(0);
      expect(n('SELECT COUNT(*) AS n FROM "Opportunity" WHERE "Amount" <= 0')).toBe(0);
      const amounts = rows<{ Amount: number }>('SELECT "Amount" FROM "Opportunity" WHERE "Amount" IS NOT NULL ORDER BY "Amount"').map((r) => r.Amount);
      expect(new Set(amounts).size).toBeGreaterThan(amounts.length / 10);
      expect(amounts[amounts.length - 1]!).toBeGreaterThan(20 * amounts[0]!);
    });

    it('has dates that make sense: nothing in the future, closes after creation, past closes for closed deals', () => {
      for (const object of Object.keys(PREFIX)) {
        expect(n(`SELECT COUNT(*) AS n FROM "${object}" WHERE "CreatedDate" > ? OR "LastModifiedDate" < "CreatedDate"`, BUILD_CLOCK.replace('Z', '.000Z')), object).toBe(0);
      }
      expect(n(`SELECT COUNT(*) AS n FROM "Opportunity" WHERE "CloseDate" < substr("CreatedDate", 1, 10)`)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Opportunity" WHERE "IsClosed" = 1 AND "CloseDate" > ?`, TODAY)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "Status" = 'Completed' AND "ActivityDate" > ?`, TODAY)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "ActivityDate" < substr("CreatedDate", 1, 10) AND "Status" = 'Completed'`)).toBe(0);
      // Contacts and tasks never predate what they belong to.
      expect(n(`SELECT COUNT(*) AS n FROM "Contact" c JOIN "Account" a ON a."Id" = c."AccountId" WHERE c."CreatedDate" < a."CreatedDate"`)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Opportunity" o JOIN "Account" a ON a."Id" = o."AccountId" WHERE o."CreatedDate" < a."CreatedDate"`)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" t JOIN "Lead" l ON l."Id" = t."WhoId" WHERE t."CreatedDate" < l."CreatedDate"`)).toBe(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" t JOIN "Opportunity" o ON o."Id" = t."WhatId" WHERE t."CreatedDate" < o."CreatedDate"`)).toBe(0);
      // Two years of history, spread out, not one timestamp.
      expect(n('SELECT COUNT(DISTINCT substr("CreatedDate", 1, 7)) AS n FROM "Opportunity"')).toBeGreaterThanOrEqual(20);
    });

    it('gives most deals a primary contact role, and never two', () => {
      expect(n(`SELECT COUNT(*) AS n FROM (SELECT "OpportunityId" FROM "OpportunityContactRole" WHERE "IsPrimary" = 1 GROUP BY "OpportunityId" HAVING COUNT(*) > 1)`)).toBe(0);
      const withRoles = n('SELECT COUNT(DISTINCT "OpportunityId") AS n FROM "OpportunityContactRole"');
      const withPrimary = n('SELECT COUNT(DISTINCT "OpportunityId") AS n FROM "OpportunityContactRole" WHERE "IsPrimary" = 1');
      expect(withPrimary / withRoles).toBeGreaterThan(0.75);
      expect(withPrimary).toBeLessThan(withRoles);
      expect(n(`SELECT COUNT(DISTINCT "Role") AS n FROM "OpportunityContactRole"`)).toBeGreaterThanOrEqual(6);
      expect(n(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM "OpportunityContactRole" GROUP BY "OpportunityId", "ContactId" HAVING COUNT(*) > 1)`)).toBe(0);
    });

    it('has the account shapes of a real org: several contacts and deals per account', () => {
      expect(n(`SELECT COUNT(*) AS n FROM (SELECT "AccountId" FROM "Contact" GROUP BY "AccountId" HAVING COUNT(*) >= 3)`)).toBeGreaterThan(300 * scale);
      expect(n(`SELECT COUNT(*) AS n FROM (SELECT "AccountId" FROM "Opportunity" GROUP BY "AccountId" HAVING COUNT(*) >= 3)`)).toBeGreaterThan(200 * scale);
      expect(n(`SELECT COUNT(*) AS n FROM "Account" WHERE "Id" NOT IN (SELECT "AccountId" FROM "Opportunity")`)).toBeGreaterThan(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Account" WHERE "Type" = 'Customer' AND "Id" NOT IN (SELECT "AccountId" FROM "Opportunity" WHERE "IsWon" = 1)`)).toBe(0);
      expect(n(`SELECT COUNT(DISTINCT "Industry") AS n FROM "Account"`)).toBeGreaterThanOrEqual(10);
      expect(n(`SELECT COUNT(DISTINCT "Title") AS n FROM "Contact"`)).toBeGreaterThanOrEqual(12);
      expect(n(`SELECT COUNT(DISTINCT "BillingState") AS n FROM "Account"`)).toBeGreaterThanOrEqual(10);
      // Generated names are varied, not "Company 1, Company 2".
      expect(n('SELECT COUNT(DISTINCT "Name") AS n FROM "Account"') / n('SELECT COUNT(*) AS n FROM "Account"')).toBeGreaterThan(0.97);
      expect(n(`SELECT COUNT(*) AS n FROM "Account" WHERE "Name" GLOB '*[0-9][0-9]*' AND "Name" NOT LIKE 'Business %'`)).toBe(0);
      // Some accounts are named after seed companies, so converting their leads finds a match.
      expect(n(`SELECT COUNT(*) AS n FROM "Account" a WHERE EXISTS (SELECT 1 FROM "Lead" l WHERE l."Company" = a."Name")`)).toBe(PROFILES[profile]!.seedAccounts);
    });

    it('has calls and follow-ups on leads, contacts, accounts and deals, done, upcoming and overdue', () => {
      expect(n(`SELECT COUNT(DISTINCT "WhoId") AS n FROM "Task" WHERE "WhoId" LIKE '00Q%' AND "TaskSubtype" = 'Call' AND "Status" = 'Completed'`)).toBeGreaterThan(1000 * scale);
      expect(n(`SELECT COUNT(DISTINCT "WhoId") AS n FROM "Task" WHERE "WhoId" LIKE '00Q%' AND "IsClosed" = 0`)).toBeGreaterThan(300 * scale);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhoId" LIKE '003%' AND "TaskSubtype" = 'Call' AND "Status" = 'Completed'`)).toBeGreaterThan(1000 * scale);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "WhatId" LIKE '001%'`)).toBeGreaterThan(0);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "IsClosed" = 0 AND "ActivityDate" >= ?`, TODAY)).toBeGreaterThan(500 * scale);
      expect(n(`SELECT COUNT(*) AS n FROM "Task" WHERE "IsClosed" = 0 AND "ActivityDate" < ?`, TODAY)).toBeGreaterThan(50 * scale);
      expect(n(`SELECT COUNT(DISTINCT "TaskSubtype") AS n FROM "Task"`)).toBe(3);
      expect(n(`SELECT COUNT(DISTINCT "Status") AS n FROM "Task"`)).toBeGreaterThanOrEqual(3);
      // Every open deal that isn't stale has a next activity planned.
      expect(
        n(`SELECT COUNT(*) AS n FROM "Opportunity" o WHERE o."IsClosed" = 0 AND o."CloseDate" >= ?
           AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t."WhatId" = o."Id" AND t."IsClosed" = 0)`, TODAY),
      ).toBe(0);
      // Owners differ in how much they log.
      const perOwner = rows<{ n: number }>(`SELECT COUNT(*) AS n FROM "Task" GROUP BY "OwnerId" ORDER BY n DESC`).map((r) => r.n);
      expect(perOwner[0]!).toBeGreaterThan(2 * perOwner[perOwner.length - 1]!);
    });

    it('is realistically messy: near-duplicate accounts, stale pipeline, missing optional fields', () => {
      // Names that a dedupe rule would match: case, punctuation, "and" for "&", and legal suffixes ignored.
      const normal = (name: string) =>
        name.toLowerCase().replace(/ and /g, ' & ').replace(/[.,]/g, '').replace(/\s+(inc|llc|co|corp)$/, '').trim();
      const seen = new Map<string, number>();
      for (const { Name } of rows<{ Name: string }>('SELECT "Name" FROM "Account"')) seen.set(normal(Name), (seen.get(normal(Name)) ?? 0) + 1);
      const duplicates = [...seen.values()].filter((count) => count > 1).length;
      expect(duplicates).toBeGreaterThanOrEqual(Math.round(PROFILES[profile]!.syntheticAccounts * PROFILES[profile]!.nearDuplicateRate * 0.75));
      expect(
        n(`SELECT COUNT(*) AS n FROM "Opportunity" WHERE "IsClosed" = 0 AND "CloseDate" < ? AND "LastModifiedDate" < ?`,
          TODAY, new Date(Date.parse(BUILD_CLOCK) - 90 * 86_400_000).toISOString()),
      ).toBeGreaterThan(20 * scale);
      const missing = (object: string, field: string) =>
        n(`SELECT COUNT(*) AS n FROM "${object}" WHERE "${field}" IS NULL`) / n(`SELECT COUNT(*) AS n FROM "${object}"`);
      for (const [object, field, min, max] of [
        ['Account', 'Phone', 0.05, 0.3], ['Account', 'Website', 0.2, 0.6], ['Account', 'Industry', 0.02, 0.2],
        ['Contact', 'Email', 0.05, 0.5], ['Contact', 'Title', 0.05, 0.3], ['Contact', 'Phone', 0.1, 0.4],
        ['Opportunity', 'NextStep', 0.4, 0.8],
      ] as const) {
        const rate = missing(object, field);
        expect(rate, `${object}.${field}`).toBeGreaterThan(min);
        expect(rate, `${object}.${field}`).toBeLessThan(max);
      }
    });

    it('leaves the mutation log empty and no write journal', () => {
      expect(n('SELECT COUNT(*) AS n FROM mutation_log')).toBe(0);
    });
  });
}

describe('profiles', () => {
  it('small is the same shape at about a tenth of the default volume', () => {
    const big = cachedBaseline('default').generated;
    const small = cachedBaseline('small').generated;
    for (const object of Object.keys(big) as (keyof typeof big)[]) {
      const ratio = small[object] / big[object];
      expect(ratio, object).toBeGreaterThan(0.06);
      expect(ratio, object).toBeLessThan(0.16);
    }
    expect(cachedBaseline('small').sha256).not.toBe(cachedBaseline('default').sha256);
  });
});
