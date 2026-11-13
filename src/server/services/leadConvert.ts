import { endOfQuarter } from '../clock.js';
import { isValidId, toId18 } from '../db/ids.js';
import { convertedLeadStatuses, defaultValueOf, OPPORTUNITY_STAGE } from '../metadata/picklists.js';
import type { ServiceContext } from './context.js';
import { fail, requiredFieldsMissing, ServiceError } from './errors.js';
import { createRecord, getRecord, updateRecord } from './records/records.js';
import type { FieldValue, SObject } from './records/values.js';

/** Mirrors the LeadConvert arguments the trial supports (docs/reference/behavior-and-validation.md). */
export interface ConvertLeadInput {
  leadId: string;
  convertedStatus?: string;
  accountId?: string | null;
  doNotCreateOpportunity?: boolean;
  opportunityName?: string | null;
  ownerId?: string | null;
}

export interface ConvertLeadResult {
  leadId: string;
  accountId: string;
  contactId: string;
  opportunityId: string | null;
  success: true;
}

const OPPORTUNITY_NAME_MAX = 80;

/** Copies the listed lead fields to target field names: [leadField, targetField]. */
function mapFields(lead: SObject, pairs: readonly (readonly [string, string])[]): SObject {
  const values: SObject = {};
  for (const [from, to] of pairs) values[to] = lead[from] ?? null;
  return values;
}

// Official Lead Conversion Field Mapping, business accounts only.
const ACCOUNT_MAP = [
  ['Company', 'Name'],
  ['Street', 'BillingStreet'],
  ['City', 'BillingCity'],
  ['State', 'BillingState'],
  ['PostalCode', 'BillingPostalCode'],
  ['Country', 'BillingCountry'],
  ['Phone', 'Phone'],
  ['Fax', 'Fax'],
  ['Website', 'Website'],
  ['Industry', 'Industry'],
  ['AnnualRevenue', 'AnnualRevenue'],
  ['NumberOfEmployees', 'NumberOfEmployees'],
  ['Rating', 'Rating'],
  ['LeadSource', 'AccountSource'],
] as const;

const CONTACT_MAP = [
  ['FirstName', 'FirstName'],
  ['LastName', 'LastName'],
  ['Title', 'Title'],
  ['Email', 'Email'],
  ['MobilePhone', 'MobilePhone'],
  ['Phone', 'Phone'],
  ['Fax', 'Fax'],
  ['Street', 'MailingStreet'],
  ['City', 'MailingCity'],
  ['State', 'MailingState'],
  ['PostalCode', 'MailingPostalCode'],
  ['Country', 'MailingCountry'],
  ['LeadSource', 'LeadSource'],
  ['Description', 'Description'],
  ['DoNotCall', 'DoNotCall'],
  ['HasOptedOutOfEmail', 'HasOptedOutOfEmail'],
  ['HasOptedOutOfFax', 'HasOptedOutOfFax'],
] as const;

/** When merging into an existing account, only empty target fields are filled. */
function fillEmpty(existing: SObject, candidate: SObject): SObject {
  const changes: SObject = {};
  for (const [name, value] of Object.entries(candidate)) {
    if (name === 'Name') continue;
    const current: FieldValue = existing[name] ?? null;
    if ((current === null || current === '') && value !== null) changes[name] = value;
  }
  return changes;
}

function validateArguments(input: ConvertLeadInput): void {
  if (!input.convertedStatus) throw new ServiceError([requiredFieldsMissing(['convertedStatus'])]);
  if (!convertedLeadStatuses().includes(input.convertedStatus)) {
    fail('INVALID_STATUS', `Converted Status: "${input.convertedStatus}" is not a converted lead status.`, [
      'convertedStatus',
    ]);
  }
  if (input.doNotCreateOpportunity && input.opportunityName) {
    fail('FIELD_INTEGRITY_EXCEPTION', 'opportunityName must be blank when doNotCreateOpportunity is true.', [
      'opportunityName',
    ]);
  }
  if (input.opportunityName && input.opportunityName.length > OPPORTUNITY_NAME_MAX) {
    fail('STRING_TOO_LONG', `Opportunity Name: data value too large (max length=${OPPORTUNITY_NAME_MAX})`, [
      'opportunityName',
    ]);
  }
  if (input.accountId && !isValidId(input.accountId)) {
    fail('MALFORMED_ID', `Account ID: id value of incorrect type: ${input.accountId}`, ['accountId']);
  }
}

/**
 * Converts a lead in one transaction: account (new or existing), new contact, optional
 * opportunity linked to the contact by a contact role, then the lead is marked converted.
 * Any failure rolls back every write, including the mutation log entries.
 */
export function convertLead(ctx: ServiceContext, input: ConvertLeadInput): ConvertLeadResult {
  const lead = getRecord(ctx, 'Lead', input.leadId);
  if (lead.IsConverted) fail('CANNOT_UPDATE_CONVERTED_LEAD', 'This lead has already been converted.');
  validateArguments(input);

  const ownerId = input.ownerId || String(lead.OwnerId);
  const accountCandidate = { ...mapFields(lead, ACCOUNT_MAP), OwnerId: ownerId };

  return ctx.db.transaction((): ConvertLeadResult => {
    let accountId: string;
    if (input.accountId) {
      const accountId18 = toId18(input.accountId);
      if (!ctx.db.prepare('SELECT 1 FROM "Account" WHERE "Id" = ?').get(accountId18)) {
        fail('INVALID_CROSS_REFERENCE_KEY', 'Account ID: invalid cross reference id', ['accountId']);
      }
      const account = getRecord(ctx, 'Account', accountId18);
      const changes = fillEmpty(account, accountCandidate);
      delete changes.OwnerId;
      if (Object.keys(changes).length > 0) updateRecord(ctx, 'Account', accountId18, changes, { system: true });
      accountId = accountId18;
    } else {
      accountId = String(createRecord(ctx, 'Account', accountCandidate).Id);
    }

    const contact = createRecord(ctx, 'Contact', {
      ...mapFields(lead, CONTACT_MAP),
      AccountId: accountId,
      OwnerId: ownerId,
    });
    const contactId = String(contact.Id);

    let opportunityId: string | null = null;
    if (!input.doNotCreateOpportunity) {
      const opportunity = createRecord(ctx, 'Opportunity', {
        Name: input.opportunityName || lead.Company,
        AccountId: accountId,
        StageName: defaultValueOf(OPPORTUNITY_STAGE),
        CloseDate: endOfQuarter(ctx.clock.today()),
        LeadSource: lead.LeadSource ?? null,
        OwnerId: ownerId,
      });
      opportunityId = String(opportunity.Id);
      createRecord(ctx, 'OpportunityContactRole', {
        OpportunityId: opportunityId,
        ContactId: contactId,
        IsPrimary: false,
      });
    }

    updateRecord(
      ctx,
      'Lead',
      String(lead.Id),
      {
        IsConverted: true,
        ConvertedDate: ctx.clock.today(),
        ConvertedAccountId: accountId,
        ConvertedContactId: contactId,
        ConvertedOpportunityId: opportunityId,
        Status: input.convertedStatus!,
      },
      { system: true },
    );

    return { leadId: String(lead.Id), accountId, contactId, opportunityId, success: true };
  })();
}
