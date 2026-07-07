import type { FastifyInstance } from "fastify";
import type { DevAuthProvider } from "../adapters/auth-provider.js";
import type { Role } from "../adapters/seed-data.js";
import { loadConfig } from "../config.js";
import { requireSession } from "../plugins/auth.js";

const ROLES: Role[] = ["SCHOOL_ADMIN", "DISTRICT_ADMIN", "IGNITE_ADMIN"];

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/session — current session (contracts/api.md).
  app.get("/session", async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return reply;
    return {
      userId: session.userId,
      name: session.name,
      role: session.role,
      schools: session.schools,
    };
  });

  // POST /api/session/switch — dev-only mock role/school switcher (D4). Excluded
  // from production builds.
  if (!loadConfig().isProduction) {
    app.post<{ Body: { role?: Role; schoolId?: string } }>(
      "/session/switch",
      async (req, reply) => {
        const provider = app.auth as DevAuthProvider;
        if (typeof provider.switchSession !== "function") {
          return reply.code(404).send({
            error: { code: "NOT_AVAILABLE", message: "Session switching is not available." },
          });
        }
        const { role, schoolId } = req.body ?? {};
        if (!role || !ROLES.includes(role)) {
          return reply.code(400).send({
            error: { code: "BAD_ROLE", message: "Choose a valid role to switch to." },
          });
        }
        const session = await provider.switchSession({ role, schoolId });
        return {
          userId: session.userId,
          name: session.name,
          role: session.role,
          schools: session.schools,
        };
      },
    );
  }
}
