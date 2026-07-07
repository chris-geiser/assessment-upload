// Central runtime configuration, read once from the environment.

export interface AppConfig {
  databaseUrl: string;
  port: number;
  storageDir: string;
  isProduction: boolean;
  isTest: boolean;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  return {
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgres://postgres@127.0.0.1:5432/assessment_ingest",
    port: Number(process.env.PORT ?? 3001),
    storageDir: process.env.STORAGE_DIR ?? "storage",
    isProduction: nodeEnv === "production",
    isTest: nodeEnv === "test",
  };
}
