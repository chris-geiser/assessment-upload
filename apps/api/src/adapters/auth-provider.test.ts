import { describe, expect, it } from "vitest";
import {
  MockAuthProvider,
  accessibleSchoolIds,
  canAccessSchool,
} from "./auth-provider.js";
import { SCHOOLS } from "./seed-data.js";

const lincoln = SCHOOLS[0].schoolId;
const washington = SCHOOLS[1].schoolId;
const riverdale = SCHOOLS[3].schoolId;

describe("MockAuthProvider scoping", () => {
  it("SCHOOL_ADMIN sees only their own school", async () => {
    const p = new MockAuthProvider("SCHOOL_ADMIN");
    const s = await p.getSession();
    expect(s.role).toBe("SCHOOL_ADMIN");
    expect(accessibleSchoolIds(s)).toEqual([lincoln]);
    expect(canAccessSchool(s, lincoln)).toBe(true);
    expect(canAccessSchool(s, washington)).toBe(false);
  });

  it("DISTRICT_ADMIN sees all schools in their district but not other districts", async () => {
    const p = new MockAuthProvider("DISTRICT_ADMIN");
    const s = await p.getSession();
    const ids = accessibleSchoolIds(s)!;
    expect(ids).toContain(lincoln);
    expect(ids).toContain(washington);
    expect(ids).not.toContain(riverdale);
  });

  it("IGNITE_ADMIN sees everything (null scope)", async () => {
    const p = new MockAuthProvider("IGNITE_ADMIN");
    const s = await p.getSession();
    expect(accessibleSchoolIds(s)).toBeNull();
    expect(canAccessSchool(s, riverdale)).toBe(true);
  });

  it("switches the dev session, including a specific school for SCHOOL_ADMIN", async () => {
    const p = new MockAuthProvider("SCHOOL_ADMIN");
    const s = await p.switchSession({ role: "SCHOOL_ADMIN", schoolId: washington });
    expect(accessibleSchoolIds(s)).toEqual([washington]);
    const d = await p.switchSession({ role: "DISTRICT_ADMIN" });
    expect(d.role).toBe("DISTRICT_ADMIN");
  });
});
