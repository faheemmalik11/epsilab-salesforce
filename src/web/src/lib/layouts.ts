import type { ObjectName } from '../api/types';

// Page layouts: which fields each screen shows and in what order. Validation and rules live in the API.

export interface Column {
  field: string;
  /** Show the nested relationship's Name instead of the raw ID. */
  relationship?: string;
  label?: string;
  link?: boolean;
}

export interface Section {
  title: string;
  fields: string[];
}

export interface RelatedList {
  object: ObjectName;
  title: string;
  /** The field on the related object that points back to this record. */
  parentField: string;
  columns: Column[];
}

export interface Layout {
  object: ObjectName;
  icon: string;
  tabLabel: string;
  tab: boolean;
  columns: Column[];
  defaultSort: string;
  highlights: Column[];
  sections: Section[];
  related: RelatedList[];
  /** Tasks attach to this record through WhoId (people) or WhatId (business records). */
  activityField?: 'WhoId' | 'WhatId';
}

const owner: Column = { field: 'OwnerId', relationship: 'Owner', label: 'Owner' };

const SYSTEM: Section = { title: 'System Information', fields: ['CreatedById', 'CreatedDate', 'LastModifiedById', 'LastModifiedDate'] };

const contactRoles = (parentField: string, column: Column): RelatedList => ({
  object: 'OpportunityContactRole',
  title: 'Contact Roles',
  parentField,
  columns: [column, { field: 'Role' }, { field: 'IsPrimary', label: 'Primary' }],
});

export const LAYOUTS: Record<Exclude<ObjectName, 'User' | 'OpportunityContactRole'>, Layout> = {
  Lead: {
    object: 'Lead',
    tabLabel: 'Leads',
    icon: 'lead',
    tab: true,
    columns: [
      { field: 'Name', link: true },
      { field: 'Title' },
      { field: 'Company' },
      { field: 'Phone' },
      { field: 'Email' },
      { field: 'Status' },
      { field: 'Rating' },
      owner,
    ],
    defaultSort: 'Name',
    highlights: [{ field: 'Title' }, { field: 'Company' }, { field: 'Phone' }, { field: 'Email' }, owner],
    sections: [
      {
        title: 'Lead Information',
        fields: [
          'Salutation', 'FirstName', 'LastName', 'Company', 'Title', 'Email', 'Phone', 'MobilePhone', 'Website',
          'Status', 'Rating', 'LeadSource', 'Industry', 'AnnualRevenue', 'NumberOfEmployees', 'OwnerId',
        ],
      },
      { title: 'Address Information', fields: ['Street', 'City', 'State', 'PostalCode', 'Country'] },
      { title: 'Additional Information', fields: ['Description'] },
      SYSTEM,
    ],
    related: [],
    activityField: 'WhoId',
  },
  Account: {
    object: 'Account',
    tabLabel: 'Accounts',
    icon: 'account',
    tab: true,
    columns: [{ field: 'Name', link: true }, { field: 'Type' }, { field: 'Phone' }, { field: 'BillingState' }, owner],
    defaultSort: 'Name',
    highlights: [{ field: 'Type' }, { field: 'Phone' }, { field: 'Website' }, owner],
    sections: [
      {
        title: 'Account Information',
        fields: [
          'Name', 'Type', 'Industry', 'Rating', 'AccountSource', 'ParentId', 'Phone', 'Fax', 'Website', 'AnnualRevenue',
          'NumberOfEmployees', 'OwnerId',
        ],
      },
      { title: 'Billing Address', fields: ['BillingStreet', 'BillingCity', 'BillingState', 'BillingPostalCode', 'BillingCountry'] },
      { title: 'Shipping Address', fields: ['ShippingStreet', 'ShippingCity', 'ShippingState', 'ShippingPostalCode', 'ShippingCountry'] },
      { title: 'Additional Information', fields: ['Description'] },
      SYSTEM,
    ],
    related: [
      {
        object: 'Contact',
        title: 'Contacts',
        parentField: 'AccountId',
        columns: [{ field: 'Name', link: true }, { field: 'Title' }, { field: 'Email' }, { field: 'Phone' }],
      },
      {
        object: 'Opportunity',
        title: 'Opportunities',
        parentField: 'AccountId',
        columns: [{ field: 'Name', link: true }, { field: 'StageName' }, { field: 'Amount' }, { field: 'CloseDate' }],
      },
    ],
    activityField: 'WhatId',
  },
  Contact: {
    object: 'Contact',
    tabLabel: 'Contacts',
    icon: 'contact',
    tab: true,
    columns: [
      { field: 'Name', link: true },
      { field: 'AccountId', relationship: 'Account', label: 'Account Name' },
      { field: 'Title' },
      { field: 'Phone' },
      { field: 'Email' },
      owner,
    ],
    defaultSort: 'Name',
    highlights: [{ field: 'Title' }, { field: 'AccountId', relationship: 'Account', label: 'Account Name' }, { field: 'Phone' }, { field: 'Email' }],
    sections: [
      {
        title: 'Contact Information',
        fields: [
          'Salutation', 'FirstName', 'LastName', 'AccountId', 'Title', 'Department', 'Email', 'Phone', 'MobilePhone',
          'LeadSource', 'OwnerId',
        ],
      },
      { title: 'Address Information', fields: ['MailingStreet', 'MailingCity', 'MailingState', 'MailingPostalCode', 'MailingCountry'] },
      { title: 'Additional Information', fields: ['Description'] },
      SYSTEM,
    ],
    related: [contactRoles('ContactId', { field: 'OpportunityId', relationship: 'Opportunity', label: 'Opportunity', link: true })],
    activityField: 'WhoId',
  },
  Opportunity: {
    object: 'Opportunity',
    tabLabel: 'Opportunities',
    icon: 'opportunity',
    tab: true,
    columns: [
      { field: 'Name', link: true },
      { field: 'AccountId', relationship: 'Account', label: 'Account Name' },
      { field: 'Amount' },
      { field: 'CloseDate' },
      { field: 'StageName' },
      owner,
    ],
    defaultSort: 'Name',
    highlights: [
      { field: 'AccountId', relationship: 'Account', label: 'Account Name' },
      { field: 'CloseDate' },
      { field: 'Amount' },
      owner,
    ],
    sections: [
      {
        title: 'Opportunity Information',
        fields: [
          'Name', 'AccountId', 'CloseDate', 'StageName', 'Amount', 'Probability', 'ForecastCategoryName', 'NextStep',
          'Type', 'LeadSource', 'OwnerId',
        ],
      },
      { title: 'Additional Information', fields: ['Description'] },
      SYSTEM,
    ],
    related: [contactRoles('OpportunityId', { field: 'ContactId', relationship: 'Contact', label: 'Contact Name', link: true })],
    activityField: 'WhatId',
  },
  Task: {
    object: 'Task',
    tabLabel: 'Tasks',
    icon: 'task',
    tab: true,
    columns: [
      { field: 'Subject', link: true },
      { field: 'WhoId', relationship: 'Who', label: 'Name' },
      { field: 'WhatId', relationship: 'What', label: 'Related To' },
      { field: 'ActivityDate' },
      { field: 'Status' },
      { field: 'Priority' },
      { ...owner, label: 'Assigned To' },
    ],
    defaultSort: 'ActivityDate',
    highlights: [{ field: 'ActivityDate' }, { field: 'Status' }, { field: 'Priority' }, { ...owner, label: 'Assigned To' }],
    sections: [
      { title: 'Task Information', fields: ['Subject', 'ActivityDate', 'Status', 'Priority', 'WhoId', 'WhatId', 'OwnerId', 'TaskSubtype'] },
      { title: 'Description Information', fields: ['Description'] },
      SYSTEM,
    ],
    related: [],
  },
};

export type TabObject = keyof typeof LAYOUTS;

export const TAB_ORDER: TabObject[] = ['Lead', 'Account', 'Contact', 'Opportunity', 'Task'];

export function layoutFor(object: string): Layout | undefined {
  return (LAYOUTS as Record<string, Layout>)[object];
}

/** The text that names a record: Subject for tasks, Name for everything else. */
export function recordTitle(record: Record<string, unknown>): string {
  return String(record.Name ?? record.Subject ?? record.Id ?? '');
}
