import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

let messageLikesTableMigration: Promise<void> | undefined;

export function ensureMessageLikesTable(): Promise<void> {
  if (!messageLikesTableMigration) {
    messageLikesTableMigration = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS message_likes (
        message_type text NOT NULL,
        message_id integer NOT NULL,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji text NOT NULL DEFAULT '❤️',
        created_at timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY (message_type, message_id, user_id)
      )`);
      await db.execute(sql`ALTER TABLE message_likes ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '❤️'`);
    })();
  }
  return messageLikesTableMigration;
}

export * from "./schema";
