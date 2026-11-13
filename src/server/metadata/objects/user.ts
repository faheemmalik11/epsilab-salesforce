import { auditFields, checkbox, derived, field, idField } from '../fields.js';
import type { ObjectDef } from '../types.js';

// Users are seeded only, so no field is createable or updateable through the API.
const readOnly = { createable: false, updateable: false };

export const User: ObjectDef = {
  name: 'User',
  label: 'User',
  labelPlural: 'Users',
  keyPrefix: '005',
  fields: [
    idField(),
    field('Username', 'Username', 'string', readOnly),
    field('FirstName', 'First Name', 'string', readOnly),
    field('LastName', 'Last Name', 'string', readOnly),
    derived('Name', 'Full Name', 'string'),
    field('Alias', 'Alias', 'string', readOnly),
    field('Email', 'Email', 'email', readOnly),
    field('Title', 'Title', 'string', readOnly),
    checkbox('IsActive', 'Active', readOnly),
    field('ProfileName', 'Profile', 'string', readOnly),
    field('TimeZoneSidKey', 'Time Zone', 'string', readOnly),
    field('LocaleSidKey', 'Locale', 'string', readOnly),
    field('LanguageLocaleKey', 'Language', 'string', readOnly),
    derived('LastLoginDate', 'Last Login', 'datetime'),
    ...auditFields(),
  ],
};
