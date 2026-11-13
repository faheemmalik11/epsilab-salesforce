import { addressFields, auditFields, derived, field, idField, ownerField, picklist, reference } from '../fields.js';
import { ACCOUNT_TYPE, INDUSTRY, LEAD_SOURCE, RATING } from '../picklists.js';
import type { ObjectDef } from '../types.js';

export const Account: ObjectDef = {
  name: 'Account',
  label: 'Account',
  labelPlural: 'Accounts',
  keyPrefix: '001',
  fields: [
    idField(),
    ownerField('Account Owner'),
    field('Name', 'Account Name', 'string', { required: true, length: 255 }),
    picklist('Type', 'Type', ACCOUNT_TYPE),
    picklist('Industry', 'Industry', INDUSTRY),
    picklist('Rating', 'Rating', RATING),
    picklist('AccountSource', 'Account Source', LEAD_SOURCE),
    reference('ParentId', 'Parent Account', ['Account']),
    field('Phone', 'Phone', 'phone', { length: 40 }),
    field('Fax', 'Fax', 'phone', { length: 40 }),
    field('Website', 'Website', 'url', { length: 255 }),
    field('AnnualRevenue', 'Annual Revenue', 'currency'),
    field('NumberOfEmployees', 'Employees', 'int'),
    ...addressFields('Billing', 'Billing'),
    ...addressFields('Shipping', 'Shipping'),
    field('Description', 'Description', 'textarea', { length: 32000 }),
    derived('LastActivityDate', 'Last Activity', 'date'),
    ...auditFields(),
  ],
};
