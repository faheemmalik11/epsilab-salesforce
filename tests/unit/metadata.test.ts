import { describe, expect, it } from 'vitest';
import { OBJECTS, getObject, objectForId, type ObjectName } from '../../src/server/metadata/index.js';
import {
  LEAD_SOURCE,
  LEAD_STATUS,
  OPPORTUNITY_STAGE,
  convertedLeadStatuses,
  defaultValueOf,
  stageOf,
} from '../../src/server/metadata/picklists.js';
import { readSeed, seedManifest } from '../seed.js';

function requiredFields(name: ObjectName): string[] {
  return getObject(name).fields.filter((f) => f.required).map((f) => f.name).sort();
}

describe('objects', () => {
  it('use the key prefixes from the brief', () => {
    const prefixes = Object.fromEntries(OBJECTS.map((o) => [o.name, o.keyPrefix]));
    expect(prefixes).toEqual({
      User: '005',
      Account: '001',
      Contact: '003',
      Lead: '00Q',
      Opportunity: '006',
      OpportunityContactRole: '00K',
      Task: '00T',
    });
  });

  it('resolve an object from an ID prefix', () => {
    expect(objectForId('00Q000000000001AAA')?.name).toBe('Lead');
    expect(objectForId('XYZ000000000001AAA')).toBeUndefined();
  });

  it('declare the documented required fields', () => {
    expect(requiredFields('Lead')).toEqual(['Company', 'LastName']);
    expect(requiredFields('Account')).toEqual(['Name']);
    expect(requiredFields('Contact')).toEqual(['LastName']);
    expect(requiredFields('Opportunity')).toEqual(['CloseDate', 'Name', 'StageName']);
    expect(requiredFields('OpportunityContactRole')).toEqual(['ContactId', 'OpportunityId']);
    expect(requiredFields('Task')).toEqual([]);
  });

  it('have unique field names, an Id field and audit fields', () => {
    for (const object of OBJECTS) {
      const names = object.fields.map((f) => f.name);
      expect(new Set(names).size, object.name).toBe(names.length);
      for (const name of ['Id', 'CreatedById', 'CreatedDate', 'LastModifiedById', 'LastModifiedDate']) {
        expect(names, `${object.name}.${name}`).toContain(name);
      }
    }
  });

  it('only reference objects that exist', () => {
    const known = new Set(OBJECTS.map((o) => o.name));
    for (const object of OBJECTS) {
      for (const field of object.fields.filter((f) => f.type === 'reference')) {
        expect(field.referenceTo?.length, `${object.name}.${field.name}`).toBeGreaterThan(0);
        field.referenceTo!.forEach((target) => expect(known.has(target)).toBe(true));
      }
    }
  });

  it('give every picklist field a picklist and no required field a default', () => {
    for (const object of OBJECTS) {
      for (const field of object.fields) {
        if (field.type === 'picklist') expect(field.picklist, `${object.name}.${field.name}`).toBeDefined();
        if (field.required) expect(field.defaultValue, `${object.name}.${field.name}`).toBeUndefined();
      }
    }
  });

  it('keep conversion fields out of reach of normal writes', () => {
    const lead = getObject('Lead');
    for (const name of ['IsConverted', 'ConvertedDate', 'ConvertedAccountId', 'ConvertedContactId', 'ConvertedOpportunityId']) {
      const field = lead.fields.find((f) => f.name === name)!;
      expect(field.createable || field.updateable, name).toBe(false);
    }
  });
});

describe('Lead Status picklist', () => {
  const values = LEAD_STATUS.values.map((v) => v.value);

  it('keeps every seed status', () => {
    for (const status of Object.keys(seedManifest.counts.status)) expect(values).toContain(status);
  });

  it('adds the workflow statuses', () => {
    expect(values).toEqual(expect.arrayContaining(['Working - Contacted', 'Closed - Converted', 'Closed - Not Converted']));
  });

  it('has exactly one converted status and defaults to Open - Not Contacted', () => {
    expect(convertedLeadStatuses()).toEqual(['Closed - Converted']);
    expect(defaultValueOf(LEAD_STATUS)).toBe('Open - Not Contacted');
  });
});

describe('Lead Source picklist', () => {
  it('contains every Lead Source value in the seed', () => {
    const seedValues = new Set(readSeed('leads.csv').map((r) => r['Lead Source']!).filter((v) => v !== '-'));
    expect(seedValues.size).toBe(seedManifest.counts.lead_source_values);
    const values = LEAD_SOURCE.values.map((v) => v.value);
    seedValues.forEach((v) => expect(values).toContain(v));
  });
});

describe('Opportunity stages', () => {
  it('follow the documented defaults', () => {
    expect(OPPORTUNITY_STAGE.values.map((s) => [s.value, s.probability, s.forecastCategory])).toEqual([
      ['Prospecting', 10, 'Pipeline'],
      ['Qualification', 10, 'Pipeline'],
      ['Needs Analysis', 20, 'Pipeline'],
      ['Value Proposition', 50, 'Pipeline'],
      ['Id. Decision Makers', 60, 'Pipeline'],
      ['Perception Analysis', 70, 'Best Case'],
      ['Proposal/Price Quote', 75, 'Best Case'],
      ['Negotiation/Review', 90, 'Commit'],
      ['Closed Won', 100, 'Closed'],
      ['Closed Lost', 0, 'Omitted'],
    ]);
  });

  it('mark only the two closed stages as closed, and only Closed Won as won', () => {
    expect(OPPORTUNITY_STAGE.values.filter((s) => s.closed).map((s) => s.value)).toEqual(['Closed Won', 'Closed Lost']);
    expect(stageOf('Closed Won')?.won).toBe(true);
    expect(stageOf('Closed Lost')?.won).toBe(false);
    expect(stageOf('Nope')).toBeUndefined();
  });
});
