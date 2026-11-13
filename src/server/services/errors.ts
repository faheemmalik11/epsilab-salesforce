/** Codes from the Salesforce StatusCode list (docs/reference/behavior-and-validation.md). */
export type ErrorCode =
  | 'REQUIRED_FIELD_MISSING'
  | 'FIELD_CUSTOM_VALIDATION_EXCEPTION'
  | 'INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST'
  | 'INVALID_FIELD'
  | 'INVALID_FIELD_FOR_INSERT_UPDATE'
  | 'INVALID_TYPE_ON_FIELD_IN_RECORD'
  | 'STRING_TOO_LONG'
  | 'MALFORMED_ID'
  | 'INVALID_CROSS_REFERENCE_KEY'
  | 'INACTIVE_OWNER_OR_USER'
  | 'CANNOT_UPDATE_CONVERTED_LEAD'
  | 'INVALID_STATUS'
  | 'FIELD_INTEGRITY_EXCEPTION'
  | 'NOT_FOUND'
  | 'INSUFFICIENT_ACCESS_OR_READONLY'
  | 'MALFORMED_QUERY'
  | 'INVALID_QUERY_FILTER_OPERATOR'
  | 'JSON_PARSER_ERROR'
  | 'UNKNOWN_EXCEPTION'
  /** Not a Salesforce code: admin snapshot and reset errors. */
  | 'INVALID_SNAPSHOT';

export interface ApiError {
  errorCode: ErrorCode;
  message: string;
  fields?: string[];
}

/** The one error type every surface (REST, MCP, GUI) renders as the Salesforce error array. */
export class ServiceError extends Error {
  readonly errors: ApiError[];

  constructor(errors: ApiError[]) {
    super(errors.map((e) => e.message).join('; '));
    this.name = 'ServiceError';
    this.errors = errors;
  }

  get isNotFound(): boolean {
    return this.errors.every((e) => e.errorCode === 'NOT_FOUND');
  }
}

export function apiError(errorCode: ErrorCode, message: string, fields?: string[]): ApiError {
  return fields && fields.length > 0 ? { errorCode, message, fields } : { errorCode, message };
}

export function fail(errorCode: ErrorCode, message: string, fields?: string[]): never {
  throw new ServiceError([apiError(errorCode, message, fields)]);
}

export function notFound(): never {
  return fail('NOT_FOUND', 'The requested resource does not exist');
}

export function requiredFieldsMissing(fields: string[]): ApiError {
  return apiError('REQUIRED_FIELD_MISSING', `Required fields are missing: [${fields.join(', ')}]`, fields);
}
