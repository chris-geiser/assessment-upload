import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { healthRoutes } from "./routes/health.js";

export interface BuildServerOptions {
  logger?: boolean;
}

// App factory. Kept side-effect free so tests can build a fresh instance and
// drive it with supertest via `app.server` after `app.ready()`.
export async function buildServer(
  opts: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes, { prefix: "/api" });

  return app;
}
