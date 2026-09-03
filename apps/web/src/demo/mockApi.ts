// Browser-only demo backend for the static (GitHub Pages) build. Enabled via
// VITE_DEMO=true. It stubs the three endpoints the UI calls so the full P1
// experience (upload → detect → map → validate → fix inline) runs with no server.
// The validation engine itself already runs client-side. All data is synthetic.

interface School {
  schoolId: string;
  schoolName: string;
  districtId: string;
  districtName: string;
}

const SPRINGFIELD = { id: "d1", name: "Springfield USD" };
const RIVERSIDE = { id: "d2", name: "Riverside ISD" };

const SCHOOLS: School[] = [
  { schoolId: "s1", schoolName: "Lincoln Elementary", districtId: SPRINGFIELD.id, districtName: SPRINGFIELD.name },
  { schoolId: "s2", schoolName: "Washington Elementary", districtId: SPRINGFIELD.id, districtName: SPRINGFIELD.name },
  { schoolId: "s3", schoolName: "Jefferson Elementary", districtId: SPRINGFIELD.id, districtName: SPRINGFIELD.name },
  { schoolId: "s4", schoolName: "Riverdale Elementary", districtId: RIVERSIDE.id, districtName: RIVERSIDE.name },
];

type Role = "SCHOOL_ADMIN" | "DISTRICT_ADMIN" | "IGNITE_ADMIN";

function sessionFor(role: Role, schoolId?: string) {
  let schools: School[];
  let name: string;
  if (role === "SCHOOL_ADMIN") {
    schools = SCHOOLS.filter((s) => s.schoolId === (schoolId ?? "s1"));
    name = "Sam Carter";
  } else if (role === "DISTRICT_ADMIN") {
    schools = SCHOOLS.filter((s) => s.districtId === SPRINGFIELD.id);
    name = "Dana Lopez";
  } else {
    schools = SCHOOLS;
    name = "Ignite Admin";
  }
  return { userId: `${role}-1`, name, role, schools };
}

let current = sessionFor("SCHOOL_ADMIN");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function installMockApi(): void {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, "");

    if (path.endsWith("/api/session") && method === "GET") {
      return json(current);
    }
    if (path.endsWith("/api/session/switch") && method === "POST") {
      let body: { role?: Role; schoolId?: string } = {};
      try {
        body = init?.body ? JSON.parse(init.body as string) : {};
      } catch {
        /* ignore */
      }
      current = sessionFor(body.role ?? "SCHOOL_ADMIN", body.schoolId);
      return json(current);
    }
    if (path.endsWith("/api/uploads") && method === "POST") {
      const uploadId =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `up-${Date.now()}`;
      // The client already computes detection locally; this response only needs an id.
      return json(
        { uploadId, detection: { detected: null, confidence: 0, ambiguous: false, scores: {}, ranked: [] }, duplicate: null },
        201,
      );
    }

    return original(input, init);
  };
}
