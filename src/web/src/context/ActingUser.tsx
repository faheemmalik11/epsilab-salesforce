import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setActingUser } from '../api/client';
import type { User } from '../api/types';
import { Spinner } from '../components/Spinner';

const STORAGE_KEY = 'actingUserId';

interface ActingUserState {
  users: User[];
  current: User | null;
  switchTo(userId: string): void;
}

const ActingUserContext = createContext<ActingUserState | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Holds the seeded user the GUI acts as. Without a stored choice it asks the API who the default is,
 * so the default-user rule stays on the server.
 */
export function ActingUserProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const stored = readStored();
    setActingUser(stored);
    return stored;
  });
  const users = useQuery({ queryKey: ['users'], queryFn: api.users, staleTime: Infinity });
  const fallback = useQuery({ queryKey: ['users', 'current-default'], queryFn: api.currentUser, enabled: !selectedId });

  const current = useMemo(() => {
    const list = users.data ?? [];
    const chosen = selectedId ? list.find((u) => u.Id === selectedId && u.IsActive) : undefined;
    return chosen ?? fallback.data ?? null;
  }, [users.data, selectedId, fallback.data]);

  useEffect(() => {
    if (current) setActingUser(current.Id);
  }, [current]);

  const value: ActingUserState = {
    users: users.data ?? [],
    current,
    switchTo(userId) {
      setActingUser(userId);
      setSelectedId(userId);
      try {
        localStorage.setItem(STORAGE_KEY, userId);
      } catch {
        // The choice still applies for this page view.
      }
      void queryClient.invalidateQueries();
    },
  };

  if (!current) {
    return (
      <Spinner overlay />
    );
  }
  return <ActingUserContext.Provider value={value}>{children}</ActingUserContext.Provider>;
}

export function useActingUser(): ActingUserState {
  const value = useContext(ActingUserContext);
  if (!value) throw new Error('useActingUser must be used inside ActingUserProvider');
  return value;
}
