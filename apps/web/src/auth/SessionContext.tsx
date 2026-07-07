import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "../lib/api.js";

export type Role = "SCHOOL_ADMIN" | "DISTRICT_ADMIN" | "IGNITE_ADMIN";

export interface SchoolContext {
  schoolId: string;
  schoolName: string;
  districtId: string;
  districtName: string;
}

export interface Session {
  userId: string;
  name: string;
  role: Role;
  schools: SchoolContext[];
}

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  switchRole: (role: Role, schoolId?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSession(await apiGet<Session>("/api/session"));
    } finally {
      setLoading(false);
    }
  }, []);

  const switchRole = useCallback(async (role: Role, schoolId?: string) => {
    const next = await apiPost<Session>("/api/session/switch", { role, schoolId });
    setSession(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SessionContext.Provider value={{ session, loading, switchRole, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
