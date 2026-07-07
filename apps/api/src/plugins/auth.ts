import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import type { AuthProvider, Session } from "../adapters/auth-provider.js";
import { canAccessSchool } from "../adapters/auth-provider.js";
import type { Role } from "../adapters/seed-data.js";

declare module "fastify" {
  interface FastifyInstance {
    auth: AuthProvider;
  }
  interface FastifyRequest {
    session: Session | null;
  }
}

// Registered at root scope in buildServer so the decorators are visible to every
// route without an encapsulation-breaking plugin wrapper.
export function registerAuth(app: FastifyInstance, provider: AuthProvider): void {
  app.decorate("auth", provider);
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (req) => {
    req.session = await app.auth.getSession();
  });
}

/** 401 if there is no session (production behavior; the mock always has one). */
export function requireSession(req: FastifyRequest, reply: FastifyReply): Session | null {
  if (!req.session) {
    reply.code(401).send({ error: { code: "NO_SESSION", message: "Sign in to continue." } });
    return null;
  }
  return req.session;
}

/** preHandler factory: only the listed roles may proceed (FR-001). */
export function requireRoles(...roles: Role[]): preHandlerHookHandler {
  return async (req, reply) => {
    const session = requireSession(req, reply);
    if (!session) return reply;
    if (!roles.includes(session.role)) {
      reply.code(403).send({
        error: { code: "ROLE_FORBIDDEN", message: "Your role cannot access this area." },
      });
      return reply;
    }
    return;
  };
}

/** 403 SCHOOL_SCOPE when the session cannot act on the target school. */
export function assertSchoolAccess(
  req: FastifyRequest,
  reply: FastifyReply,
  schoolId: string,
): boolean {
  const session = req.session;
  if (!session) {
    reply.code(401).send({ error: { code: "NO_SESSION", message: "Sign in to continue." } });
    return false;
  }
  if (!canAccessSchool(session, schoolId)) {
    reply.code(403).send({
      error: {
        code: "SCHOOL_SCOPE",
        message: "You can only upload for schools you administer.",
      },
    });
    return false;
  }
  return true;
}
