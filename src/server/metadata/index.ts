import { Account } from './objects/account.js';
import { Contact } from './objects/contact.js';
import { Lead } from './objects/lead.js';
import { Opportunity } from './objects/opportunity.js';
import { OpportunityContactRole } from './objects/opportunityContactRole.js';
import { Task } from './objects/task.js';
import { User } from './objects/user.js';
import type { FieldDef, ObjectDef, ObjectName } from './types.js';

export * from './types.js';

/** In dependency order, so tables can be created and filled front to back. */
export const OBJECTS: readonly ObjectDef[] = [User, Account, Contact, Lead, Opportunity, OpportunityContactRole, Task];

const byName = new Map<string, ObjectDef>(OBJECTS.map((o) => [o.name, o]));
const byPrefix = new Map<string, ObjectDef>(OBJECTS.map((o) => [o.keyPrefix, o]));

export function isObjectName(name: string): name is ObjectName {
  return byName.has(name);
}

export function getObject(name: ObjectName): ObjectDef {
  const def = byName.get(name);
  if (!def) throw new Error(`Unknown object ${name}`);
  return def;
}

export function objectForId(id: string): ObjectDef | undefined {
  return byPrefix.get(id.slice(0, 3));
}

export function getField(object: ObjectDef, fieldName: string): FieldDef | undefined {
  return object.fields.find((f) => f.name === fieldName);
}
