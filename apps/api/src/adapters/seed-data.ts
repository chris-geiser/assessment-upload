// Fixed seed identities for the mock environment. Deterministic UUIDs so the seed
// script, MockAuthProvider, and tests all agree.

export interface SchoolContext {
  schoolId: string;
  schoolName: string;
  districtId: string;
  districtName: string;
}

export const DISTRICTS = {
  springfield: { id: "11111111-1111-1111-1111-111111111111", name: "Springfield USD" },
  riverside: { id: "22222222-2222-2222-2222-222222222222", name: "Riverside ISD" },
} as const;

export const SCHOOLS: SchoolContext[] = [
  { schoolId: "aaaaaaaa-0000-0000-0000-000000000001", schoolName: "Lincoln Elementary", districtId: DISTRICTS.springfield.id, districtName: DISTRICTS.springfield.name },
  { schoolId: "aaaaaaaa-0000-0000-0000-000000000002", schoolName: "Washington Elementary", districtId: DISTRICTS.springfield.id, districtName: DISTRICTS.springfield.name },
  { schoolId: "aaaaaaaa-0000-0000-0000-000000000003", schoolName: "Jefferson Elementary", districtId: DISTRICTS.springfield.id, districtName: DISTRICTS.springfield.name },
  { schoolId: "bbbbbbbb-0000-0000-0000-000000000001", schoolName: "Riverdale Elementary", districtId: DISTRICTS.riverside.id, districtName: DISTRICTS.riverside.name },
];

export type Role = "SCHOOL_ADMIN" | "DISTRICT_ADMIN" | "IGNITE_ADMIN";

export interface SeedUser {
  userId: string;
  name: string;
  role: Role;
  /** Home school (SCHOOL_ADMIN) or district anchor. */
  schoolId?: string;
  districtId?: string;
}

export const USERS: Record<Role, SeedUser> = {
  SCHOOL_ADMIN: {
    userId: "cccccccc-0000-0000-0000-000000000001",
    name: "Sam Carter",
    role: "SCHOOL_ADMIN",
    schoolId: SCHOOLS[0].schoolId,
  },
  DISTRICT_ADMIN: {
    userId: "cccccccc-0000-0000-0000-000000000002",
    name: "Dana Lopez",
    role: "DISTRICT_ADMIN",
    districtId: DISTRICTS.springfield.id,
  },
  IGNITE_ADMIN: {
    userId: "cccccccc-0000-0000-0000-000000000003",
    name: "Ignite Admin",
    role: "IGNITE_ADMIN",
  },
};

/** Schools a role can act within (drives all data scoping). */
export function schoolsForUser(user: SeedUser): SchoolContext[] {
  switch (user.role) {
    case "SCHOOL_ADMIN":
      return SCHOOLS.filter((s) => s.schoolId === user.schoolId);
    case "DISTRICT_ADMIN":
      return SCHOOLS.filter((s) => s.districtId === user.districtId);
    case "IGNITE_ADMIN":
      return SCHOOLS;
  }
}
