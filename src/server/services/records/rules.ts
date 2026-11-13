import type { ObjectName } from '../../metadata/index.js';
import type { ServiceContext } from '../context.js';
import type { SObject } from './values.js';

export interface WriteEvent {
  ctx: ServiceContext;
  kind: 'create' | 'update';
  /** The record as it will be saved. Rules may set derived fields on it. */
  next: SObject;
  /** The saved record before this write, or null on create. */
  previous: SObject | null;
  /** Field names the caller supplied. */
  supplied: ReadonlySet<string>;
  /** True for writes made by the system itself, such as lead conversion. */
  system: boolean;
}

export interface Dependent {
  object: ObjectName;
  ids: string[];
}

/** Lets rules make follow-up writes through the engine without importing it. */
export interface RuleOps {
  updateSystem(object: ObjectName, id: string, values: SObject): void;
}

export interface ObjectRules {
  /** Runs before any field validation on update, for locks such as a converted lead. */
  guard?(ctx: ServiceContext, previous: SObject, system: boolean): void;
  /** Runs after field validation passes. Validates and derives fields; throws to reject. */
  beforeWrite?(event: WriteEvent): void;
  afterWrite?(event: WriteEvent & { saved: SObject }, ops: RuleOps): void;
  beforeDelete?(ctx: ServiceContext, record: SObject): void;
  /** Records deleted together with this one, as Salesforce cascades them. */
  dependents?(ctx: ServiceContext, record: SObject): Dependent[];
}
