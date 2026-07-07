import {
  schoolsForUser,
  USERS,
  type Role,
  type SchoolContext,
  type SeedUser,
} from "./seed-data.js";

export interface Session {
  userId: string;
  name: string;
  role: Role;
  /** The schools this session may read/write. Empty set is never valid. */
  schools: SchoolContext[];
}

// P2: route authorization depends only on this interface. Production swaps in a
// Sphinx Gate implementation (D4) touching this one file plus wiring.
export interface AuthProvider {
  getSession(): Promise<Session | null>;
}

export interface DevAuthProvider extends AuthProvider {
  switchSession(input: { role: Role; schoolId?: string }): Promise<Session>;
}

function buildSession(user: SeedUser): Session {
  return {
    userId: user.userId,
    name: user.name,
    role: user.role,
    schools: schoolsForUser(user),
  };
}

// MVP mock (D4): holds the current dev session in memory, defaults to SCHOOL_ADMIN,
// and exposes a switcher used by the dev-only /api/session/switch route.
export class MockAuthProvider implements DevAuthProvider {
  private current: Session;

  constructor(role: Role = "SCHOOL_ADMIN") {
    this.current = buildSession(USERS[role]);
  }

  async getSession(): Promise<Session> {
    return this.current;
  }

  async switchSession(input: { role: Role; schoolId?: string }): Promise<Session> {
    const user = { ...USERS[input.role] };
    if (input.role === "SCHOOL_ADMIN" && input.schoolId) {
      user.schoolId = input.schoolId;
    }
    this.current = buildSession(user);
    return this.current;
  }
}

// ── Scoping helpers (single source of truth, used by every route) ─────────────

/** Accessible school ids, or null meaning "all schools" (IGNITE_ADMIN). */
export function accessibleSchoolIds(session: Session): string[] | null {
  if (session.role === "IGNITE_ADMIN") return null;
  return session.schools.map((s) => s.schoolId);
}

export function canAccessSchool(session: Session, schoolId: string): boolean {
  const ids = accessibleSchoolIds(session);
  return ids === null || ids.includes(schoolId);
}

export function schoolContext(
  session: Session,
  schoolId: string,
): SchoolContext | undefined {
  return session.schools.find((s) => s.schoolId === schoolId);
}
