import { fixedClock } from '../clock.js';
import type { Db } from '../db/connection.js';
import { LEAD_SOURCE, OPPORTUNITY_STAGE } from '../metadata/picklists.js';
import type { ServiceContext } from '../services/context.js';
import { createRecord, updateRecord } from '../services/records/records.js';
import type { SObject } from '../services/records/values.js';
import { createRandom, type Random } from './random.js';
import {
  CALL_NOTES, COMPANY_SUFFIXES, DEAL_ACTIVITY, DEALS, INDUSTRIES, LEAD_ACTIVITY, LEAD_FOLLOW_UPS, LOSS_REASONS,
  NAME_WORDS, NEXT_STEPS, PLACES, STREETS, TITLES, TRADES,
} from './vocabulary.js';

export interface GenerateOptions {
  profile: string;
  /** ISO instant the generated history ends at (the CLOCK setting). */
  clock: string;
}

export interface GenerateReport {
  Account: number;
  Contact: number;
  Opportunity: number;
  OpportunityContactRole: number;
  Task: number;
}

export interface Profile {
  /** Accounts named after companies shared by several seed leads (the convert dialog finds them). */
  seedAccounts: number;
  /** Accounts with generated company names. */
  syntheticAccounts: number;
  /** Share of synthetic accounts that get a near-duplicate twin ("Acme Inc." and "Acme, Inc."). */
  nearDuplicateRate: number;
  /** Seed leads that get call history and follow-ups. */
  leadsWithActivity: number;
}

/**
 * SEED_PROFILE volumes. "default" is a 7-rep sales team two years into working the 21,628 seed leads;
 * "small" is the same shape at a tenth of the size, for quick runs. See TRADEOFFS.md for the reasoning.
 */
export const PROFILES: Record<string, Profile> = {
  default: { seedAccounts: 300, syntheticAccounts: 1500, nearDuplicateRate: 0.025, leadsWithActivity: 1800 },
  small: { seedAccounts: 30, syntheticAccounts: 150, nearDuplicateRate: 0.025, leadsWithActivity: 180 },
};

const DAY = 86_400_000;
/** History reaches back two years from the clock. */
const HISTORY_DAYS = 730;
const OPEN_STAGES = OPPORTUNITY_STAGE.values.filter((s) => !s.closed).map((s) => s.value);
const QUALIFICATION_INDEX = OPEN_STAGES.indexOf('Qualification');
const PROPOSAL_INDEX = OPEN_STAGES.indexOf('Proposal/Price Quote');
const SOURCES = LEAD_SOURCE.values.map((v) => v.value);
/** Active reps carry different workloads, as in a real team. */
const OWNER_WEIGHTS = [24, 18, 15, 13, 12, 10, 8];

interface User {
  Id: string;
  weight: number;
}

interface SeedPerson {
  FirstName: string | null;
  LastName: string | null;
  Title: string | null;
  Email: string | null;
  Phone: string | null;
  State: string | null;
  Country: string | null;
  CreatedDate: string;
}

interface Gen {
  db: Db;
  rng: Random;
  now: number;
  owners: User[];
  /** Inactive users: they created some of the oldest records before they left. */
  formerUsers: string[];
  firstNames: string[];
  lastNames: string[];
  usedNames: Set<string>;
  report: GenerateReport;
}

interface ContactRef {
  Id: string;
  created: number;
  senior: boolean;
}

// ---------- time ----------

/** A business-hours instant (13:00 to 22:00 UTC, US working hours) `days` before the clock, never after it. */
function instant(gen: Gen, days: number): number {
  const midnight = Math.floor(gen.now / DAY) * DAY - Math.max(0, Math.round(days)) * DAY;
  const at = midnight + 13 * 3_600_000 + gen.rng.int(0, 540) * 60_000;
  return Math.min(at, gen.now - 60_000);
}

const iso = (ms: number) => new Date(ms).toISOString();
const isoDate = (ms: number) => iso(ms).slice(0, 10);
const daysBefore = (gen: Gen, ms: number) => (gen.now - ms) / DAY;

function contextAt(gen: Gen, ms: number, actingUserId: string): ServiceContext {
  return { db: gen.db, clock: fixedClock(iso(ms)), actingUserId };
}

function create(gen: Gen, ms: number, actor: string, object: keyof GenerateReport, fields: Record<string, unknown>): SObject {
  gen.report[object]++;
  return createRecord(contextAt(gen, ms, actor), object, fields);
}

// ---------- people and places ----------

function pickOwner(gen: Gen): string {
  return gen.rng.weighted(gen.owners.map((u) => [u.Id, u.weight] as const));
}

function pickPlace(gen: Gen) {
  return gen.rng.weighted(PLACES.map((p) => [p, p.weight] as const));
}

function phone(gen: Gen, areaCode: string): string {
  // 555-0100 to 555-0199 is reserved for fiction, as in the seed.
  return `+1 ${areaCode}-555-01${String(gen.rng.int(0, 99)).padStart(2, '0')}`;
}

function slug(text: string): string {
  return text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
}

function companyName(gen: Gen, industry: string): string {
  for (;;) {
    const base = `${gen.rng.pick(NAME_WORDS)} ${gen.rng.pick(TRADES[industry] ?? TRADES.Other!)}`;
    const name = `${base}${gen.rng.pick(COMPANY_SUFFIXES)}`;
    if (!gen.usedNames.has(base)) {
      gen.usedNames.add(base);
      return name;
    }
  }
}

/** A name that differs from the original only in punctuation, spacing or case, as duplicates do. */
function nearDuplicateName(gen: Gen, name: string): string {
  const variants = [
    name.replace(/ Inc\.$/, ', Inc.').replace(/ LLC$/, ', LLC'),
    `${name} `,
    name.replace(' & ', ' and '),
    name.toUpperCase(),
    name.replace(/( LLC| Inc\.| Co\.| Corp\.)$/, ''),
    `${name} Inc`,
  ].filter((v) => v !== name);
  return gen.rng.pick(variants);
}

function personFields(gen: Gen, domain: string | null, areaCode: string) {
  const first = gen.rng.pick(gen.firstNames);
  const last = gen.rng.pick(gen.lastNames);
  const role = gen.rng.weighted(TITLES.map((t) => [t, t.weight] as const));
  return {
    fields: {
      FirstName: first,
      LastName: last,
      Title: gen.rng.chance(0.15) ? null : role.title,
      Department: gen.rng.chance(0.4) ? null : role.department,
      Email: domain && !gen.rng.chance(0.12) ? `${slug(first)}.${slug(last)}@${domain}` : null,
      Phone: gen.rng.chance(0.25) ? null : phone(gen, areaCode),
      MobilePhone: gen.rng.chance(0.6) ? null : phone(gen, areaCode),
      LeadSource: gen.rng.chance(0.3) ? null : gen.rng.pick(SOURCES),
    },
    senior: role.senior,
  };
}

// ---------- deals ----------

interface DealPlan {
  name: string;
  type: string;
  amount: number | null;
  createdDays: number;
  /** When the deal was last worked: its close for closed deals. */
  touchedDays: number;
  stage: string;
  closeDate: string;
  nextStep: string | null;
  stale: boolean;
}

/** Deal sizes scale with the account's size tier (0 small to 3 large). */
function dealAmount(gen: Gen, deal: (typeof DEALS)[number], tier: number): number {
  const factor = [0.6, 1, 1.8, 3.5][tier]!;
  return Math.round((gen.rng.int(deal.min, deal.max) * 1000 * factor) / 500) * 500;
}

function planDeal(gen: Gen, accountDays: number, tier: number, existing: boolean, accountName: string): DealPlan {
  const { rng } = gen;
  const deal = rng.pick(DEALS.filter((d) => d.type === 'Any' || d.type === (existing ? 'Existing Business' : 'New Business')));
  const createdDays = rng.int(1, Math.max(1, Math.floor(accountDays) - 1));
  const cycle = rng.int(21, 150);
  const overdue = createdDays - cycle;
  let stage: string;
  let touchedDays: number;
  let closeDays: number;
  let stale = false;

  if (overdue > 0 && rng.chance(0.85)) {
    const winRate = existing ? 0.6 : 0.3;
    stage = rng.chance(winRate) ? 'Closed Won' : 'Closed Lost';
    closeDays = Math.max(1, overdue);
    touchedDays = closeDays;
  } else {
    const progress = Math.min(1, createdDays / cycle) * (0.5 + rng.next() * 0.5);
    stage = OPEN_STAGES[Math.min(OPEN_STAGES.length - 1, Math.floor(progress * OPEN_STAGES.length))]!;
    // Open past its close date and untouched for 90+ days: the stale pipeline every org carries.
    stale = overdue > 90 && createdDays > 100;
    if (stale) {
      touchedDays = Math.max(90, createdDays - rng.int(0, 10));
      closeDays = rng.int(5, Math.min(120, touchedDays));
    } else {
      touchedDays = rng.int(0, Math.min(20, createdDays));
      closeDays = -rng.int(7, 120);
    }
  }

  const stageIndex = OPEN_STAGES.indexOf(stage);
  const early = stageIndex >= 0 && stageIndex <= QUALIFICATION_INDEX;
  const closed = stageIndex < 0;
  const closeYear = new Date(gen.now - closeDays * DAY).getUTCFullYear();
  return {
    name: `${accountName.trim()} - ${deal.name === 'Renewal' ? `Renewal ${closeYear}` : deal.name}`,
    type: existing ? 'Existing Business' : 'New Business',
    amount: early && rng.chance(0.35) ? null : dealAmount(gen, deal, tier),
    createdDays,
    touchedDays,
    stage,
    closeDate: isoDate(gen.now - closeDays * DAY),
    nextStep: closed || rng.chance(0.2) ? null : NEXT_STEPS[Math.min(NEXT_STEPS.length - 1, Math.max(0, stageIndex))]!,
    stale,
  };
}

// ---------- activity ----------

type TaskLink = { WhoId?: string | null; WhatId?: string | null };

function completedTask(
  gen: Gen,
  ms: number,
  owner: string,
  [subject, subtype]: readonly [string, 'Call' | 'Email' | 'Task'],
  link: TaskLink,
): void {
  create(gen, ms, owner, 'Task', {
    Subject: subject,
    TaskSubtype: subtype,
    Status: 'Completed',
    Priority: 'Normal',
    ActivityDate: isoDate(ms),
    Description: subtype === 'Call' && gen.rng.chance(0.5) ? gen.rng.pick(CALL_NOTES) : null,
    ...link,
  });
}

/** An open task: mostly due soon, sometimes overdue. It is never created before `notBefore`. */
function openTask(
  gen: Gen,
  notBefore: number,
  owner: string,
  subject: string,
  link: TaskLink,
  priority = 'Normal',
): void {
  const { rng } = gen;
  let overdue = rng.chance(0.12);
  const created = Math.min(gen.now - 60_000, Math.max(notBefore + 60_000, instant(gen, rng.int(overdue ? 15 : 0, 30))));
  let due = overdue ? gen.now - rng.int(1, 14) * DAY : gen.now + rng.int(1, 21) * DAY;
  if (due < created) {
    overdue = false;
    due = gen.now + rng.int(1, 21) * DAY;
  }
  create(gen, created, owner, 'Task', {
    Subject: subject,
    TaskSubtype: 'Task',
    Status: rng.chance(0.2) ? 'In Progress' : 'Not Started',
    Priority: priority,
    ActivityDate: isoDate(due),
    ...link,
  });
}

/** A contact that existed by `ms`, preferring senior people for decisions. */
function contactBy(gen: Gen, contacts: ContactRef[], ms: number, senior = false): ContactRef | null {
  const available = contacts.filter((c) => c.created <= ms);
  const preferred = senior ? available.filter((c) => c.senior) : [];
  const pool = preferred.length > 0 ? preferred : available;
  return pool.length > 0 ? gen.rng.pick(pool) : null;
}

function writeDeal(gen: Gen, plan: DealPlan, accountId: string, owner: string, contacts: ContactRef[]): boolean {
  const { rng } = gen;
  const createdMs = instant(gen, plan.createdDays);
  const touchedMs = Math.max(createdMs + 60_000, instant(gen, plan.touchedDays));
  const finalIndex = OPEN_STAGES.indexOf(plan.stage);
  const startStage = finalIndex >= 0 && finalIndex <= QUALIFICATION_INDEX ? plan.stage : 'Prospecting';
  const leadSource = rng.chance(0.25) ? null : rng.pick(SOURCES);

  // Created at an early stage, then moved to where the deal stands, so the history is consistent.
  const opp = create(gen, createdMs, owner, 'Opportunity', {
    Name: plan.name,
    AccountId: accountId,
    OwnerId: owner,
    StageName: startStage,
    CloseDate: plan.closeDate < isoDate(createdMs) ? isoDate(createdMs) : plan.closeDate,
    Amount: startStage === plan.stage ? plan.amount : null,
    Type: plan.type,
    LeadSource: leadSource,
    NextStep: startStage === plan.stage ? plan.nextStep : NEXT_STEPS[0],
  });
  if (startStage !== plan.stage) {
    updateRecord(contextAt(gen, touchedMs, owner), 'Opportunity', String(opp.Id), {
      StageName: plan.stage,
      Amount: plan.amount,
      CloseDate: plan.closeDate < isoDate(createdMs) ? isoDate(touchedMs) : plan.closeDate,
      NextStep: plan.nextStep,
      Description: plan.stage === 'Closed Lost' ? rng.pick(LOSS_REASONS) : null,
    });
  }

  // Contact roles: the buyer first (usually primary), then the people who weighed in.
  const roles = Math.min(contacts.length, rng.weighted([[1, 45], [2, 35], [3, 20]] as const));
  const chosen = new Set<string>();
  for (let i = 0; i < roles; i++) {
    const contact = contactBy(gen, contacts.filter((c) => !chosen.has(c.Id)), touchedMs, i === 0);
    if (!contact) break;
    chosen.add(contact.Id);
    create(gen, Math.max(createdMs, contact.created) + 60_000, owner, 'OpportunityContactRole', {
      OpportunityId: opp.Id,
      ContactId: contact.Id,
      Role:
        i === 0
          ? rng.weighted([['Decision Maker', 5], ['Economic Buyer', 3], ['Economic Decision Maker', 1]] as const)
          : rng.weighted([['Influencer', 4], ['Technical Buyer', 3], ['Evaluator', 3], ['Business User', 2], ['Executive Sponsor', 1], ['Other', 1]] as const),
      IsPrimary: i === 0 && rng.chance(0.85),
    });
  }

  // Completed activity between creation and the last touch, more for deals that went further.
  const depth = finalIndex >= 0 ? finalIndex + 1 : plan.stage === 'Closed Won' ? rng.int(4, 7) : rng.int(1, 5);
  const span = Math.max(0, touchedMs - createdMs);
  for (let i = 0; i < depth; i++) {
    const ms = createdMs + Math.floor((span * (i + 1)) / (depth + 1));
    const step = DEAL_ACTIVITY[Math.min(DEAL_ACTIVITY.length - 1, Math.floor((i * DEAL_ACTIVITY.length) / Math.max(depth, 1)))]!;
    const who = contactBy(gen, contacts, ms);
    completedTask(gen, ms, owner, step, { WhoId: who?.Id ?? null, WhatId: String(opp.Id) });
  }

  if (finalIndex >= 0) {
    if (!plan.stale) openTask(gen, touchedMs, owner, plan.nextStep ?? 'Follow up', { WhoId: contactBy(gen, contacts, gen.now)?.Id ?? null, WhatId: String(opp.Id) }, finalIndex >= PROPOSAL_INDEX ? 'High' : 'Normal');
    else if (rng.chance(0.5)) {
      // The follow-up that never happened, long overdue.
      const due = gen.now - Math.max(1, plan.touchedDays - 7) * DAY;
      create(gen, touchedMs, owner, 'Task', {
        Subject: plan.nextStep ?? 'Follow up',
        TaskSubtype: 'Task',
        Status: 'Not Started',
        Priority: 'Normal',
        ActivityDate: isoDate(Math.max(due, touchedMs)),
        WhatId: String(opp.Id),
      });
    }
  }
  return plan.stage === 'Closed Won';
}

// ---------- accounts ----------

interface AccountSpec {
  name: string;
  people?: SeedPerson[];
  /** Days ago the account was created, at the earliest. */
  minDays?: number;
  duplicateOf?: SObject;
}

function writeAccount(gen: Gen, spec: AccountSpec): SObject {
  const { rng } = gen;
  const industry = rng.weighted(INDUSTRIES);
  const place = spec.people?.[0]?.State
    ? (PLACES.find((p) => p.state === spec.people![0]!.State) ?? pickPlace(gen))
    : pickPlace(gen);
  const tier = rng.weighted([[0, 40], [1, 35], [2, 18], [3, 7]] as const);
  const [minEmployees, maxEmployees] = ([[3, 20], [21, 75], [76, 250], [251, 1500]] as const)[tier];
  const employees = rng.int(minEmployees, maxEmployees);
  const domain = rng.chance(0.3) ? null : `${slug(spec.name.trim()).slice(0, 40)}.example`;
  const owner = pickOwner(gen);
  const accountDays = rng.int(Math.min(HISTORY_DAYS - 1, (spec.minDays ?? 30) + 1), HISTORY_DAYS);
  const createdMs = instant(gen, accountDays);
  const creator = accountDays > 420 && rng.chance(0.25) && gen.formerUsers.length > 0 ? rng.pick(gen.formerUsers) : owner;

  // Deals are planned first, so the account's Type reflects whether it ever bought.
  const dealCount = spec.duplicateOf ? rng.weighted([[0, 70], [1, 30]] as const) : rng.weighted([[0, 15], [1, 30], [2, 25], [3, 15], [4, 9], [5, 4], [6, 2]] as const);
  const deals: DealPlan[] = [];
  let won = false;
  for (let i = 0; i < dealCount; i++) {
    const plan = planDeal(gen, daysBefore(gen, createdMs), tier, won, spec.name);
    deals.push(plan);
    if (plan.stage === 'Closed Won') won = true;
  }
  const type = won ? 'Customer' : rng.weighted([['Prospect', 90], ['Partner', 4], ['Reseller', 3], ['Other', 3]] as const);

  const account = create(gen, createdMs, creator, 'Account', {
    Name: spec.name,
    OwnerId: owner,
    Type: type,
    Industry: rng.chance(0.08) ? null : industry,
    Rating: rng.chance(0.5) ? null : rng.weighted([['Hot', 2], ['Warm', 3], ['Cold', 2]] as const),
    AccountSource: rng.chance(0.4) ? null : rng.pick(SOURCES),
    Phone: spec.duplicateOf?.Phone ?? (rng.chance(0.15) ? null : phone(gen, place.areaCode)),
    Website: domain && !rng.chance(0.2) ? `https://www.${domain}` : null,
    NumberOfEmployees: rng.chance(0.2) ? null : employees,
    AnnualRevenue: rng.chance(0.35) ? null : Math.round((employees * rng.int(90, 180)) / 10) * 10_000,
    BillingStreet: rng.chance(0.25) ? null : `${rng.int(10, 9800)} ${rng.pick(STREETS)}`,
    BillingCity: rng.chance(0.1) ? null : rng.pick(place.cities),
    BillingState: place.state,
    BillingPostalCode: rng.chance(0.3) ? null : String(rng.int(10000, 99999)),
    BillingCountry: rng.chance(0.05) ? null : 'United States',
  });

  // People: seed leads at this company first (the duplicates every org has), then generated ones.
  const contacts: ContactRef[] = [];
  const addContact = (fields: Record<string, unknown>, senior: boolean) => {
    const early = rng.chance(0.8);
    const days = early ? accountDays - rng.int(0, Math.min(20, accountDays - 1)) : rng.int(1, accountDays);
    const ms = Math.max(createdMs + 60_000, instant(gen, days));
    const contact = create(gen, ms, owner, 'Contact', { AccountId: account.Id, OwnerId: owner, MailingState: place.state, MailingCountry: 'United States', ...fields });
    contacts.push({ Id: String(contact.Id), created: ms, senior });
  };
  for (const person of spec.people ?? []) {
    if (!person.LastName) continue;
    addContact(
      { FirstName: person.FirstName, LastName: person.LastName, Title: person.Title, Email: person.Email, Phone: person.Phone, MailingState: person.State, MailingCountry: person.Country },
      /owner|president|ceo/i.test(person.Title ?? ''),
    );
  }
  const generated = spec.duplicateOf ? rng.int(0, 1) : rng.int(1, 2 + tier * 2);
  for (let i = 0; i < generated; i++) {
    const person = personFields(gen, domain, place.areaCode);
    addContact(person.fields, person.senior);
  }

  let everWon = false;
  for (const plan of deals) everWon = writeDeal(gen, plan, String(account.Id), owner, contacts) || everWon;

  // Accounts with no deals still show some outreach.
  if (deals.length === 0 && rng.chance(0.5)) {
    const ms = Math.max(createdMs + 60_000, instant(gen, rng.int(1, Math.floor(accountDays))));
    completedTask(gen, ms, owner, ['Intro call', 'Call'], { WhoId: contactBy(gen, contacts, ms)?.Id ?? null, WhatId: String(account.Id) });
  }
  if (everWon && rng.chance(0.3)) openTask(gen, createdMs, owner, 'Quarterly business review', { WhoId: contactBy(gen, contacts, gen.now, true)?.Id ?? null, WhatId: String(account.Id) });
  return account;
}

// ---------- seed leads ----------

/** Call history and follow-ups on seed leads. Tasks never change the lead rows themselves. */
function workLeads(gen: Gen, count: number): void {
  const { rng, db } = gen;
  const leads = db
    .prepare(`SELECT "Id", "Status", "CreatedDate", "OwnerId" FROM "Lead" WHERE "IsConverted" = 0 ORDER BY "Id"`)
    .all() as { Id: string; Status: string; CreatedDate: string; OwnerId: string }[];
  // Leads whose status says they were worked come first; the rest is a random sample.
  const worked = leads.filter((l) => !['Prospecting', 'Duplicate'].includes(l.Status));
  const others = leads.filter((l) => l.Status === 'Prospecting');
  const sample = [...worked];
  const taken = new Set<string>();
  while (sample.length < count && taken.size < others.length) {
    const lead = rng.pick(others);
    if (taken.has(lead.Id)) continue;
    taken.add(lead.Id);
    sample.push(lead);
  }

  for (const lead of sample.slice(0, count)) {
    const leadCreated = Date.parse(lead.CreatedDate);
    const sinceDays = Math.min(240, Math.max(1, Math.floor(daysBefore(gen, leadCreated))));
    const owner = rng.chance(0.75) ? lead.OwnerId : pickOwner(gen);
    const calls = rng.weighted([[1, 50], [2, 30], [3, 20]] as const);
    const days = Array.from({ length: calls }, () => rng.int(1, sinceDays)).sort((a, b) => b - a);
    const at = (d: number) => Math.max(leadCreated + 60_000, instant(gen, d));
    for (const d of days) completedTask(gen, at(d), owner, rng.pick(LEAD_ACTIVITY), { WhoId: lead.Id });
    if (lead.Status === 'Demo Completed') completedTask(gen, at(rng.int(1, sinceDays)), owner, ['Product demo', 'Task'], { WhoId: lead.Id });
    if (rng.chance(0.4)) openTask(gen, leadCreated, owner, rng.pick(LEAD_FOLLOW_UPS), { WhoId: lead.Id });
  }
}

// ---------- entry point ----------

/** The first two seed leads at each shared company, read in one pass rather than one scan per company. */
function seedPeopleByCompany(db: Db, companies: string[]): Map<string, SeedPerson[]> {
  const wanted = new Set(companies);
  const people = new Map<string, SeedPerson[]>();
  const rows = db
    .prepare(`SELECT "Company", "FirstName", "LastName", "Title", "Email", "Phone", "State", "Country", "CreatedDate" FROM "Lead" ORDER BY "Id"`)
    .all() as (SeedPerson & { Company: string })[];
  for (const { Company, ...person } of rows) {
    if (!wanted.has(Company)) continue;
    const list = people.get(Company) ?? [];
    if (list.length < 2) people.set(Company, [...list, person]);
  }
  return people;
}

function namePool(db: Db, column: 'FirstName' | 'LastName'): string[] {
  return (
    db
      .prepare(
        `SELECT DISTINCT "${column}" AS v FROM "Lead"
         WHERE "${column}" IS NOT NULL AND LENGTH("${column}") BETWEEN 2 AND 20
           AND "${column}" GLOB '[A-Z][a-z]*' AND "${column}" NOT GLOB '*[0-9]*' AND "${column}" <> 'No'
         ORDER BY "${column}"`,
      )
      .all() as { v: string }[]
  ).map((r) => r.v);
}

/**
 * Generates the rest of the org from the seed: accounts (some named after seed companies), contacts,
 * opportunities through every stage, contact roles and two years of tasks, through the service layer
 * so every save rule holds. It never creates, edits or converts a seed lead or user.
 */
export function generateData(db: Db, options: GenerateOptions): GenerateReport {
  const profile = PROFILES[options.profile];
  if (!profile) throw new Error(`Unknown SEED_PROFILE "${options.profile}". Use one of: ${Object.keys(PROFILES).join(', ')}`);
  const users = db.prepare('SELECT "Id", "IsActive" FROM "User" ORDER BY "Name" COLLATE NOCASE, "Id"').all() as { Id: string; IsActive: number }[];
  const gen: Gen = {
    db,
    rng: createRandom(`epsilab:${options.profile}`),
    now: Date.parse(options.clock),
    owners: users.filter((u) => u.IsActive === 1).map((u, i) => ({ Id: u.Id, weight: OWNER_WEIGHTS[i % OWNER_WEIGHTS.length]! })),
    formerUsers: users.filter((u) => u.IsActive !== 1).map((u) => u.Id),
    firstNames: namePool(db, 'FirstName'),
    lastNames: namePool(db, 'LastName'),
    usedNames: new Set(),
    report: { Account: 0, Contact: 0, Opportunity: 0, OpportunityContactRole: 0, Task: 0 },
  };
  if (gen.owners.length === 0) throw new Error('The seed has no active users to own generated records.');

  db.transaction(() => {
    const shared = db
      .prepare(`SELECT "Company" AS company FROM "Lead" GROUP BY "Company" HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC, "Company" LIMIT ?`)
      .all(profile.seedAccounts) as { company: string }[];
    const peopleByCompany = seedPeopleByCompany(db, shared.map((r) => r.company));
    for (const { company } of shared) {
      const people = peopleByCompany.get(company)!;
      const newest = Math.max(...people.map((p) => Date.parse(p.CreatedDate)));
      writeAccount(gen, { name: company, people, minDays: Math.floor(Math.min(HISTORY_DAYS - 2, Math.max(0, daysBefore(gen, newest)))) });
    }

    const synthetic: SObject[] = [];
    for (let i = 0; i < profile.syntheticAccounts; i++) synthetic.push(writeAccount(gen, { name: companyName(gen, gen.rng.weighted(INDUSTRIES)) }));

    const duplicates = Math.round(profile.syntheticAccounts * profile.nearDuplicateRate);
    for (let i = 0; i < duplicates; i++) {
      const original = synthetic[Math.floor((i * synthetic.length) / duplicates)]!;
      writeAccount(gen, { name: nearDuplicateName(gen, String(original.Name)), duplicateOf: original });
    }

    workLeads(gen, profile.leadsWithActivity);

    // The baseline holds no history: the mutation log starts empty after a build or reset.
    db.prepare('DELETE FROM mutation_log').run();
  })();
  // Reclaim the pages the generation's mutation log used, so the baseline file is compact.
  db.exec('VACUUM');
  return gen.report;
}
