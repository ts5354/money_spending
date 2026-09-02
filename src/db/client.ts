import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema.ts";

export type AppDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(connectionString: string) {
  return drizzle(connectionString, { schema });
}

export function getDatabase(): AppDatabase {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return createDatabase(connectionString);
}
