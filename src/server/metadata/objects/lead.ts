import { addressFields, auditFields, checkbox, derived, field, idField, ownerField, picklist, reference } from '../fields.js';
import { INDUSTRY, LEAD_SOURCE, LEAD_STATUS, RATING, SALUTATION } from '../picklists.js';
import type { ObjectDef } from '../types.js';

const conversionOnly = { createable: false, updateable: false };

export const Lead: ObjectDef = {
  name: 'Lead',
  label: 'Lead',
  labelPlural: 'Leads',
  keyPrefix: '00Q',
  fields: [
    idField(),
    ownerField('Lead Owner'),
    picklist('Salutation', 'Salutation', SALUTATION),
    field('FirstName', 'First Name', 'string', { length: 40 }),
    field('LastName', 'Last Name', 'string', { required: true, length: 80 }),
    derived('Name', 'Name', 'string'),
    field('Title', 'Title', 'string', { length: 128 }),
    field('Company', 'Company', 'string', { required: true, length: 255 }),
    field('Email', 'Email', 'email', { length: 80 }),
    field('Phone', 'Phone', 'phone', { length: 40 }),
    field('MobilePhone', 'Mobile', 'phone', { length: 40 }),
    field('Fax', 'Fax', 'phone', { length: 40 }),
    field('Website', 'Website', 'url', { length: 255 }),
    ...addressFields('', ''),
    picklist('Status', 'Lead Status', LEAD_STATUS),
    picklist('Rating', 'Rating', RATING),
    picklist('LeadSource', 'Lead Source', LEAD_SOURCE),
    picklist('Industry', 'Industry', INDUSTRY),
    field('AnnualRevenue', 'Annual Revenue', 'currency'),
    field('NumberOfEmployees', 'No. of Employees', 'int'),
    field('Description', 'Description', 'textarea', { length: 32000 }),
    checkbox('IsConverted', 'Converted', conversionOnly),
    field('ConvertedDate', 'Converted Date', 'date', conversionOnly),
    reference('ConvertedAccountId', 'Converted Account', ['Account'], conversionOnly),
    reference('ConvertedContactId', 'Converted Contact', ['Contact'], conversionOnly),
    reference('ConvertedOpportunityId', 'Converted Opportunity', ['Opportunity'], conversionOnly),
    checkbox('IsUnreadByOwner', 'Unread By Owner'),
    checkbox('DoNotCall', 'Do Not Call'),
    checkbox('HasOptedOutOfEmail', 'Email Opt Out'),
    checkbox('HasOptedOutOfFax', 'Fax Opt Out'),
    derived('LastActivityDate', 'Last Activity', 'date'),
    ...auditFields(),
  ],
};
