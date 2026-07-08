import { Select } from "../kit/index.js";
import { useSession, type Role } from "./SessionContext.js";

const ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: "SCHOOL_ADMIN", label: "School Admin" },
  { value: "DISTRICT_ADMIN", label: "District Admin" },
  { value: "IGNITE_ADMIN", label: "Ignite Admin" },
];

// Dev-only role/school switcher (D4), presented as a distinct full-bleed prototype
// banner so it reads as scaffolding, not part of the product experience.
export function RoleSwitcher() {
  const { session, switchRole } = useSession();
  if (!session) return null;

  return (
    <div
      role="region"
      aria-label="Prototype controls"
      className="w-full border-b-2 border-amber-400 bg-amber-50"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2">
        <span className="inline-flex items-center rounded bg-amber-400 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-950">
          Prototype Controls
        </span>
        <span className="text-xs font-medium text-amber-900">Role Switcher</span>

        <div className="ml-auto flex flex-wrap items-end gap-3">
          <Select
            label="Role"
            hideLabel
            value={session.role}
            options={ROLE_OPTIONS}
            onChange={(e) => void switchRole(e.target.value as Role)}
          />
          {session.role === "SCHOOL_ADMIN" && session.schools.length > 0 && (
            <Select
              label="School"
              hideLabel
              value={session.schools[0].schoolId}
              options={session.schools.map((s) => ({ value: s.schoolId, label: s.schoolName }))}
              onChange={(e) => void switchRole("SCHOOL_ADMIN", e.target.value)}
            />
          )}
          <span className="pb-2 text-xs text-amber-900">
            {session.name} · {session.schools.length} school{session.schools.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
