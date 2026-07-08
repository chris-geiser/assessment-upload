import { cx, focusRing } from "../kit/cx.js";

interface NavItem {
  label: string;
  active?: boolean;
}

// Static left-nav mirroring the School Portal shell. Only "Assessment Data" is live
// in this app; the other items echo the portal for visual continuity and are inert.
const NAV: NavItem[] = [
  { label: "Assessment Data", active: true },
  { label: "Students" },
  { label: "Session Attendance" },
  { label: "Learn More" },
  { label: "Sign Out" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white lg:block">
      <div className="flex h-full flex-col">
        <div className="px-6 py-6">
          <span className="text-lg font-bold text-brand">Ignite Reading</span>
          <span className="mt-1 block text-xs uppercase tracking-wide text-neutral-500">School Portal</span>
        </div>
        <nav aria-label="Main navigation" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <span
                  aria-current={item.active ? "page" : undefined}
                  tabIndex={0}
                  className={cx(
                    "flex items-center rounded-md px-3 py-2 text-sm",
                    focusRing,
                    item.active
                      ? "bg-brand-50 font-semibold text-brand-800"
                      : "text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
