import type {
  ApiErrorItem,
  ClockInfo,
  ConvertResult,
  ObjectDescribe,
  ObjectName,
  QueryInput,
  QueryResult,
  SRecord,
  User,
} from './types';

/** The Salesforce error array from the API, unchanged, so the GUI shows exactly what REST returns. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errors: ApiErrorItem[],
  ) {
    super(errors.map((e) => e.message).join('\n'));
  }

  fieldErrors(field: string): ApiErrorItem[] {
    return this.errors.filter((e) => e.fields?.includes(field));
  }
}

let actingUserId: string | null = null;

/** Every request carries the acting user, which the API uses for ownership and audit fields. */
export function setActingUser(id: string | null): void {
  actingUserId = id;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (actingUserId) headers['x-user-id'] = actingUserId;
  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const errors = Array.isArray(data) ? data : [{ errorCode: 'UNKNOWN_EXCEPTION', message: `Request failed (${response.status})` }];
    throw new ApiError(response.status, errors);
  }
  return data as T;
}

export const api = {
  users: () => request<User[]>('GET', '/api/users'),
  currentUser: () => request<User>('GET', '/api/users/current'),
  describe: (object: ObjectName) => request<ObjectDescribe>('GET', `/api/sobjects/${object}/describe`),
  get: (object: ObjectName, id: string) => request<SRecord>('GET', `/api/sobjects/${object}/${id}`),
  query: (input: QueryInput) => request<QueryResult>('POST', '/api/query', input),
  create: (object: ObjectName, fields: Record<string, unknown>) =>
    request<{ id: string }>('POST', `/api/sobjects/${object}`, fields),
  update: (object: ObjectName, id: string, fields: Record<string, unknown>) =>
    request<null>('PATCH', `/api/sobjects/${object}/${id}`, fields),
  convertLead: (leadId: string, input: Record<string, unknown>) =>
    request<ConvertResult>('POST', `/api/leads/${leadId}/convert`, input),
  clock: () => request<ClockInfo>('GET', '/api/admin/clock'),
  logCall: (input: Record<string, unknown>) => request<{ id: string }>('POST', '/api/tasks/log-call', input),
};
