import { Select } from "../kit/index.js";
import { useSession, type Role } from "./SessionContext.js";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "SCHOOL_ADMIN", label: "School Admin" },
  { value: "DISTRICT_ADMIN", label: "District Admin" },
  { value: "IGNITE_ADMIN", label: "Ignite Admin" },
];

// Dev-only role/school switcher (D4). Wired to /api/session via SessionContext.
export function RoleSwitcher() {
  const { session, switchRole } = useSession();
  if (!session) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-brand-100 bg-brand-50 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Dev role switcher</span>
      <Select
        label="Role"
        value={session.role}
        options={ROLE_OPTIONS}
        onChange={(e) => void switchRole(e.target.value as Role)}
      />
      {session.role === "SCHOOL_ADMIN" && session.schools.length > 0 && (
        <Select
          label="School"
          value={session.schools[0].schoolId}
          options={session.schools.map((s) => ({ value: s.schoolId, label: s.schoolName }))}
          onChange={(e) => void switchRole("SCHOOL_ADMIN", e.target.value)}
        />
      )}
      <span className="text-sm text-gray-600">
        {session.name} · {session.schools.length} school{session.schools.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}
