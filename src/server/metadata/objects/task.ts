import { auditFields, derived, field, idField, ownerField, picklist, reference } from '../fields.js';
import { TASK_PRIORITY, TASK_STATUS, TASK_SUBTYPE } from '../picklists.js';
import type { ObjectDef } from '../types.js';

export const Task: ObjectDef = {
  name: 'Task',
  label: 'Task',
  labelPlural: 'Tasks',
  keyPrefix: '00T',
  fields: [
    idField(),
    ownerField('Assigned To'),
    field('Subject', 'Subject', 'string', { length: 255 }),
    picklist('Status', 'Status', TASK_STATUS),
    picklist('Priority', 'Priority', TASK_PRIORITY),
    field('ActivityDate', 'Due Date', 'date'),
    reference('WhoId', 'Name', ['Lead', 'Contact']),
    reference('WhatId', 'Related To', ['Account', 'Opportunity']),
    picklist('TaskSubtype', 'Task Subtype', TASK_SUBTYPE, { updateable: false }),
    field('Description', 'Comments', 'textarea', { length: 32000 }),
    derived('IsClosed', 'Closed', 'boolean', { defaultValue: false }),
    ...auditFields(),
  ],
};
