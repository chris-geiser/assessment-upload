import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/session.js";
import { registerAuth } from "./plugins/auth.js";
import { MockAuthProvider, type AuthProvider } from "./adapters/auth-provider.js";
import { LocalFsStorage, type StorageAdapter } from "./adapters/storage-adapter.js";
import { PostgresStubLoader, type WarehouseLoader } from "./adapters/warehouse-loader.js";

export interface BuildServerOptions {
  logger?: boolean;
  // Injectable infrastructure (P2) so tests can supply mocks/stubs.
  authProvider?: AuthProvider;
  storage?: StorageAdapter;
  warehouse?: WarehouseLoader;
}

export interface AppServices {
  storage: StorageAdapter;
  warehouse: WarehouseLoader;
}

// App factory. Kept side-effect free so tests can build a fresh instance and drive
// it with supertest via `app.server` after `app.ready()`.
export async function buildServer(
  opts: BuildServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const services: AppServices = {
    storage: opts.storage ?? new LocalFsStorage(),
    warehouse: opts.warehouse ?? new PostgresStubLoader(),
  };
  app.decorate("services", services);

  registerAuth(app, opts.authProvider ?? new MockAuthProvider());

  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(sessionRoutes, { prefix: "/api" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    services: AppServices;
  }
}
