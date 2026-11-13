import { auditFields, derived, field, idField, ownerField, picklist, reference } from '../fields.js';
import { FORECAST_CATEGORY, LEAD_SOURCE, OPPORTUNITY_STAGE, OPPORTUNITY_TYPE } from '../picklists.js';
import type { ObjectDef } from '../types.js';

export const Opportunity: ObjectDef = {
  name: 'Opportunity',
  label: 'Opportunity',
  labelPlural: 'Opportunities',
  keyPrefix: '006',
  fields: [
    idField(),
    ownerField('Opportunity Owner'),
    field('Name', 'Opportunity Name', 'string', { required: true, length: 120 }),
    reference('AccountId', 'Account Name', ['Account']),
    // The stage list has a default for picklist metadata, but a create must still name a stage.
    picklist('StageName', 'Stage', OPPORTUNITY_STAGE, { required: true, defaultValue: undefined }),
    field('CloseDate', 'Close Date', 'date', { required: true }),
    field('Amount', 'Amount', 'currency'),
    field('Probability', 'Probability (%)', 'percent'),
    picklist('ForecastCategoryName', 'Forecast Category', FORECAST_CATEGORY),
    derived('IsClosed', 'Closed', 'boolean', { defaultValue: false }),
    derived('IsWon', 'Won', 'boolean', { defaultValue: false }),
    field('NextStep', 'Next Step', 'string', { length: 255 }),
    picklist('Type', 'Type', OPPORTUNITY_TYPE),
    picklist('LeadSource', 'Lead Source', LEAD_SOURCE),
    field('Description', 'Description', 'textarea', { length: 32000 }),
    derived('LastActivityDate', 'Last Activity', 'date'),
    ...auditFields(),
  ],
};
