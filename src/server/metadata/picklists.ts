import type { Picklist, PicklistValue } from './types.js';

// Sources and reasoning for every list: docs/reference/picklists.md.

export interface LeadStatusValue extends PicklistValue {
  converted: boolean;
}

export interface StageValue extends PicklistValue {
  probability: number;
  forecastCategory: ForecastCategory;
  closed: boolean;
  won: boolean;
}

export type ForecastCategory = 'Pipeline' | 'Best Case' | 'Commit' | 'Closed' | 'Omitted';

function values(list: readonly string[], defaultValue?: string): PicklistValue[] {
  return list.map((value) => (value === defaultValue ? { value, isDefault: true } : { value }));
}

export const LEAD_STATUS: Picklist<LeadStatusValue> = {
  restricted: true,
  values: [
    { value: 'Open - Not Contacted', converted: false, isDefault: true },
    { value: 'Prospecting', converted: false },
    { value: 'Working - Contacted', converted: false },
    { value: 'MQL', converted: false },
    { value: 'Registered', converted: false },
    { value: 'Demo Completed', converted: false },
    { value: 'NQ_Nurture_Trade', converted: false },
    { value: 'Duplicate', converted: false },
    { value: 'Disqualified - Bad Contact', converted: false },
    { value: 'Disqualified - Out of Business', converted: false },
    { value: 'Unqualified - Not a Contractor', converted: false },
    { value: 'Closed - Not Converted', converted: false },
    { value: 'Closed - Converted', converted: true },
  ],
};

export const OPPORTUNITY_STAGE: Picklist<StageValue> = {
  restricted: true,
  values: [
    { value: 'Prospecting', probability: 10, forecastCategory: 'Pipeline', closed: false, won: false, isDefault: true },
    { value: 'Qualification', probability: 10, forecastCategory: 'Pipeline', closed: false, won: false },
    { value: 'Needs Analysis', probability: 20, forecastCategory: 'Pipeline', closed: false, won: false },
    { value: 'Value Proposition', probability: 50, forecastCategory: 'Pipeline', closed: false, won: false },
    { value: 'Id. Decision Makers', probability: 60, forecastCategory: 'Pipeline', closed: false, won: false },
    { value: 'Perception Analysis', probability: 70, forecastCategory: 'Best Case', closed: false, won: false },
    { value: 'Proposal/Price Quote', probability: 75, forecastCategory: 'Best Case', closed: false, won: false },
    { value: 'Negotiation/Review', probability: 90, forecastCategory: 'Commit', closed: false, won: false },
    { value: 'Closed Won', probability: 100, forecastCategory: 'Closed', closed: true, won: true },
    { value: 'Closed Lost', probability: 0, forecastCategory: 'Omitted', closed: true, won: false },
  ],
};

export const FORECAST_CATEGORY: Picklist = {
  restricted: true,
  values: values(['Pipeline', 'Best Case', 'Commit', 'Closed', 'Omitted']),
};

export const RATING: Picklist = { restricted: false, values: values(['Hot', 'Warm', 'Cold']) };

/** The 22 seed values, then the Salesforce defaults the seed doesn't already use. */
export const LEAD_SOURCE: Picklist = {
  restricted: false,
  values: values([
    'Salesforce Import',
    'Partner',
    'Event',
    'Direct Traffic',
    'Trade Magazine',
    'Referral',
    'Organic Social',
    'Regional Cold Call',
    'Brand A Website',
    'Brand B Website',
    'Brand C Website',
    'Brand D Website',
    'Organic Referral',
    'Sales',
    'Direct Mail',
    'Organic Search',
    'Paid Search',
    'Social Media',
    'TradeShow',
    'Paid Social',
    'InfoUSA 2020',
    'Other',
    'Advertisement',
    'Employee Referral',
    'External Referral',
    'Public Relations',
    'Seminar Internal',
    'Seminar Partner',
    'Trade Show',
    'Web',
    'Word of mouth',
  ]),
};

export const SALUTATION: Picklist = { restricted: false, values: values(['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.']) };

export const INDUSTRY: Picklist = {
  restricted: false,
  values: values([
    'Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemicals', 'Communications', 'Construction',
    'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering', 'Entertainment', 'Environmental',
    'Finance', 'Food & Beverage', 'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Machinery',
    'Manufacturing', 'Media', 'Not for Profit', 'Recreation', 'Retail', 'Shipping', 'Technology',
    'Telecommunications', 'Transportation', 'Utilities', 'Other',
  ]),
};

export const ACCOUNT_TYPE: Picklist = {
  restricted: false,
  values: values([
    'Analyst', 'Competitor', 'Customer', 'Integrator', 'Investor', 'Partner', 'Press', 'Prospect', 'Reseller',
    'Other',
  ]),
};

export const OPPORTUNITY_TYPE: Picklist = { restricted: false, values: values(['Existing Business', 'New Business']) };

export const CONTACT_ROLE: Picklist = {
  restricted: true,
  values: values([
    'Business User', 'Decision Maker', 'Economic Buyer', 'Economic Decision Maker', 'Evaluator',
    'Executive Sponsor', 'Influencer', 'Technical Buyer', 'Other',
  ]),
};

export const TASK_STATUS: Picklist = {
  restricted: true,
  values: values(['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'], 'Not Started'),
};

export const CLOSED_TASK_STATUSES: ReadonlySet<string> = new Set(['Completed']);

export const TASK_PRIORITY: Picklist = {
  restricted: true,
  values: values(['High', 'Normal', 'Low'], 'Normal'),
};

/** The standard Task Type picklist (unrestricted, as in Salesforce, where orgs add their own values). */
export const TASK_TYPE: Picklist = { restricted: false, values: values(['Call', 'Email', 'Meeting', 'Other']) };

export const TASK_SUBTYPE: Picklist = { restricted: true, values: values(['Task', 'Call', 'Email'], 'Task') };

export function defaultValueOf(picklist: Picklist): string | undefined {
  return picklist.values.find((v) => v.isDefault)?.value;
}

export function convertedLeadStatuses(): string[] {
  return LEAD_STATUS.values.filter((v) => v.converted).map((v) => v.value);
}

export function stageOf(stageName: string): StageValue | undefined {
  return OPPORTUNITY_STAGE.values.find((v) => v.value === stageName);
}
