import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../app.js";
import { MockAuthProvider } from "../adapters/auth-provider.js";

let app: FastifyInstance;

afterEach(async () => {
  if (app) await app.close();
});

async function boot(role: "SCHOOL_ADMIN" | "DISTRICT_ADMIN" | "IGNITE_ADMIN") {
  app = await buildServer({ authProvider: new MockAuthProvider(role) });
  await app.ready();
  return app;
}

describe("session routes", () => {
  it("GET /api/session returns the current session with scoped schools", async () => {
    await boot("SCHOOL_ADMIN");
    const res = await request(app.server).get("/api/session");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("SCHOOL_ADMIN");
    expect(res.body.schools).toHaveLength(1);
  });

  it("POST /api/session/switch swaps the dev session", async () => {
    await boot("SCHOOL_ADMIN");
    const res = await request(app.server)
      .post("/api/session/switch")
      .send({ role: "DISTRICT_ADMIN" });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("DISTRICT_ADMIN");
    expect(res.body.schools.length).toBeGreaterThan(1);

    const after = await request(app.server).get("/api/session");
    expect(after.body.role).toBe("DISTRICT_ADMIN");
  });

  it("POST /api/session/switch rejects an invalid role", async () => {
    await boot("SCHOOL_ADMIN");
    const res = await request(app.server)
      .post("/api/session/switch")
      .send({ role: "SUPERUSER" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_ROLE");
  });
});
