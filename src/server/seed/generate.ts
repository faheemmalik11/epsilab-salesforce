import { fixedClock } from '../clock.js';
import type { Db } from '../db/connection.js';
import type { ServiceContext } from '../services/context.js';
import { createRecord } from '../services/records/records.js';
import type { SObject } from '../services/records/values.js';
import { resolveActingUser } from '../services/users.js';
import { createRandom, type Random } from './random.js';

// The minimal deterministic set planned for Phase 4. Phase 7 adds volume and realistic mess.

export interface GenerateOptions {
  profile: string;
  /** ISO instant the generated dates are anchored to (the CLOCK setting). */
  clock: string;
}

export interface GenerateReport {
  Account: number;
  Contact: number;
  Opportunity: number;
  OpportunityContactRole: number;
  Task: number;
}

const ACCOUNT_COUNT = 5;
const CONTACTS_PER_ACCOUNT = 2;
const STAGES = ['Prospecting', 'Qualification', 'Value Proposition', 'Closed Won', 'Closed Lost'] as const;
const DEALS = ['Annual Subscription', 'Pilot', 'Expansion', 'Renewal', 'Services'] as const;

interface LeadSource {
  FirstName: string | null;
  LastName: string;
  Title: string | null;
  Email: string | null;
  Phone: string | null;
  State: string | null;
  Country: string | null;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Companies shared by several seed leads, most shared first: realistic candidates for existing accounts. */
function sharedCompanies(db: Db): string[] {
  return (
    db
      .prepare(
        `SELECT "Company" AS company FROM "Lead" GROUP BY "Company" HAVING COUNT(*) > 1
         ORDER BY COUNT(*) DESC, "Company" LIMIT ?`,
      )
      .all(ACCOUNT_COUNT) as { company: string }[]
  ).map((r) => r.company);
}

function leadsAt(db: Db, company: string): LeadSource[] {
  return db
    .prepare(
      `SELECT "FirstName", "LastName", "Title", "Email", "Phone", "State", "Country"
       FROM "Lead" WHERE "Company" = ? ORDER BY "Id" LIMIT ?`,
    )
    .all(company, CONTACTS_PER_ACCOUNT) as LeadSource[];
}

function activeUserIds(db: Db): string[] {
  return (
    db.prepare('SELECT "Id" FROM "User" WHERE "IsActive" = 1 ORDER BY "Name" COLLATE NOCASE, "Id"').all() as {
      Id: string;
    }[]
  ).map((r) => r.Id);
}

function opportunityFor(rng: Random, today: string, account: SObject, index: number, ownerId: string) {
  const stage = STAGES[index % STAGES.length]!;
  const closed = stage.startsWith('Closed');
  return {
    Name: `${String(account.Name)} - ${DEALS[index % DEALS.length]}`,
    AccountId: account.Id,
    OwnerId: ownerId,
    StageName: stage,
    Amount: rng.int(5, 250) * 1000,
    CloseDate: closed ? addDays(today, -rng.int(5, 60)) : addDays(today, rng.int(20, 120)),
    Type: rng.pick(['New Business', 'Existing Business']),
    NextStep: closed ? null : rng.pick(['Schedule discovery call', 'Send pricing', 'Book demo']),
  };
}

/**
 * Creates accounts from companies shared by seed leads, with contacts, one opportunity each,
 * a primary contact role and tasks. It never creates, edits or converts a lead.
 */
export function generateMinimal(db: Db, options: GenerateOptions): GenerateReport {
  const rng = createRandom(`epsilab:${options.profile}`);
  const clock = fixedClock(options.clock);
  const ctx: ServiceContext = { db, clock, actingUserId: resolveActingUser(db) };
  const today = clock.today();
  const owners = activeUserIds(db);
  const report: GenerateReport = { Account: 0, Contact: 0, Opportunity: 0, OpportunityContactRole: 0, Task: 0 };

  db.transaction(() => {
    sharedCompanies(db).forEach((company, index) => {
      const ownerId = owners[index % owners.length]!;
      const people = leadsAt(db, company);
      const account = createRecord(ctx, 'Account', {
        Name: company,
        OwnerId: ownerId,
        Type: index % 2 === 0 ? 'Prospect' : 'Customer',
        BillingState: people[0]?.State ?? null,
        BillingCountry: people[0]?.Country ?? null,
        Phone: people[0]?.Phone ?? null,
      });
      report.Account++;

      const contacts = people.map((person) => {
        report.Contact++;
        return createRecord(ctx, 'Contact', {
          AccountId: account.Id,
          OwnerId: ownerId,
          FirstName: person.FirstName,
          LastName: person.LastName,
          Title: person.Title,
          Email: person.Email,
          Phone: person.Phone,
          MailingState: person.State,
          MailingCountry: person.Country,
        });
      });

      const opportunity = createRecord(ctx, 'Opportunity', opportunityFor(rng, today, account, index, ownerId));
      report.Opportunity++;

      if (contacts[0]) {
        createRecord(ctx, 'OpportunityContactRole', {
          OpportunityId: opportunity.Id,
          ContactId: contacts[0].Id,
          Role: 'Decision Maker',
          IsPrimary: true,
        });
        report.OpportunityContactRole++;

        createRecord(ctx, 'Task', {
          Subject: 'Call',
          TaskSubtype: 'Call',
          Status: 'Completed',
          ActivityDate: addDays(today, -rng.int(1, 30)),
          WhoId: contacts[0].Id,
          WhatId: opportunity.Id,
          OwnerId: ownerId,
        });
        report.Task++;
      }

      if (!opportunity.IsClosed) {
        createRecord(ctx, 'Task', {
          Subject: String(opportunity.NextStep),
          ActivityDate: addDays(today, rng.int(1, 14)),
          WhatId: opportunity.Id,
          OwnerId: ownerId,
        });
        report.Task++;
      }
    });

    // The baseline holds no history: the mutation log starts empty after a build or reset.
    db.prepare('DELETE FROM mutation_log').run();
  })();

  return report;
}
