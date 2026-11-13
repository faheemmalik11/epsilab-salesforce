import { auditFields, checkbox, idField, picklist, reference } from '../fields.js';
import { CONTACT_ROLE } from '../picklists.js';
import type { ObjectDef } from '../types.js';

export const OpportunityContactRole: ObjectDef = {
  name: 'OpportunityContactRole',
  label: 'Contact Role',
  labelPlural: 'Contact Roles',
  keyPrefix: '00K',
  fields: [
    idField(),
    reference('OpportunityId', 'Opportunity', ['Opportunity'], { required: true, updateable: false }),
    reference('ContactId', 'Contact', ['Contact'], { required: true }),
    picklist('Role', 'Role', CONTACT_ROLE),
    checkbox('IsPrimary', 'Primary'),
    ...auditFields(),
  ],
};
