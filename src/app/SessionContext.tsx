import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authService } from '../controllers';
import type { Session } from '../services/auth';

type SessionState = { session: Session | null; loading: boolean; error: string };

const SessionContext = createContext<SessionState>({ session: null, loading: true, error: '' });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true, error: '' });
  useEffect(() => authService.watch((session, error) => setState({ session, loading: false, error: error ?? '' })), []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
