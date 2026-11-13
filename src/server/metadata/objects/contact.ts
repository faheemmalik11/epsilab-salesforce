import { addressFields, auditFields, checkbox, derived, field, idField, ownerField, picklist, reference } from '../fields.js';
import { LEAD_SOURCE, SALUTATION } from '../picklists.js';
import type { ObjectDef } from '../types.js';

export const Contact: ObjectDef = {
  name: 'Contact',
  label: 'Contact',
  labelPlural: 'Contacts',
  keyPrefix: '003',
  fields: [
    idField(),
    ownerField('Contact Owner'),
    reference('AccountId', 'Account Name', ['Account']),
    picklist('Salutation', 'Salutation', SALUTATION),
    field('FirstName', 'First Name', 'string', { length: 40 }),
    field('LastName', 'Last Name', 'string', { required: true, length: 80 }),
    derived('Name', 'Name', 'string'),
    field('Title', 'Title', 'string', { length: 128 }),
    field('Department', 'Department', 'string', { length: 80 }),
    field('Email', 'Email', 'email', { length: 80 }),
    field('Phone', 'Phone', 'phone', { length: 40 }),
    field('MobilePhone', 'Mobile', 'phone', { length: 40 }),
    field('Fax', 'Fax', 'phone', { length: 40 }),
    ...addressFields('Mailing', 'Mailing'),
    picklist('LeadSource', 'Lead Source', LEAD_SOURCE),
    field('Description', 'Description', 'textarea', { length: 32000 }),
    checkbox('DoNotCall', 'Do Not Call'),
    checkbox('HasOptedOutOfEmail', 'Email Opt Out'),
    checkbox('HasOptedOutOfFax', 'Fax Opt Out'),
    derived('LastActivityDate', 'Last Activity', 'date'),
    ...auditFields(),
  ],
};
