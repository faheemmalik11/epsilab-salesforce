import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { FieldDescribe, ObjectName, QueryInput } from './types';

export function useDescribe(object: ObjectName) {
  return useQuery({ queryKey: ['describe', object], queryFn: () => api.describe(object), staleTime: Infinity });
}

export function useFieldMap(object: ObjectName): Map<string, FieldDescribe> | undefined {
  const describe = useDescribe(object);
  return describe.data ? new Map(describe.data.fields.map((f) => [f.name, f])) : undefined;
}

export function useClock() {
  return useQuery({ queryKey: ['clock'], queryFn: api.clock, staleTime: 60_000 });
}

export function useRecord(object: ObjectName, id: string) {
  return useQuery({ queryKey: ['record', object, id], queryFn: () => api.get(object, id) });
}

export function useRecordQuery(input: QueryInput, enabled = true) {
  return useQuery({ queryKey: ['query', input], queryFn: () => api.query(input), enabled });
}

/** After a save, refetch record data only; users and object descriptions don't change. */
export function refreshRecords(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ predicate: (query) => !['users', 'describe'].includes(String(query.queryKey[0])) });
}
