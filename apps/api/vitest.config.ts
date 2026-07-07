import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // DB-backed suites must not run concurrently against the same test database.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://postgres@127.0.0.1:5432/assessment_ingest_test",
      PORT: "3001",
      STORAGE_DIR: ".test-storage",
    },
  },
});
