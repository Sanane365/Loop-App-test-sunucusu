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
let emblemAssetsTableMigration: Promise<void> | undefined;
let storyVisibilityExclusionsTableMigration: Promise<void> | undefined;
let questionsTablesMigration: Promise<void> | undefined;

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

export function ensureEmblemAssetsTable(): Promise<void> {
  if (!emblemAssetsTableMigration) {
    emblemAssetsTableMigration = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS emblem_assets (
        id serial PRIMARY KEY,
        name text NOT NULL,
        image_url text NOT NULL,
        published boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
    })();
  }
  return emblemAssetsTableMigration;
}

export function ensureStoryVisibilityExclusionsTable(): Promise<void> {
  if (!storyVisibilityExclusionsTableMigration) {
    storyVisibilityExclusionsTableMigration = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS story_visibility_exclusions (
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        excluded_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, excluded_user_id),
        CHECK (user_id <> excluded_user_id)
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS story_visibility_exclusions_excluded_user_id_idx
        ON story_visibility_exclusions (excluded_user_id)`);
    })();
  }
  return storyVisibilityExclusionsTableMigration;
}

export function ensureQuestionsTables(): Promise<void> {
  if (!questionsTablesMigration) {
    questionsTablesMigration = (async () => {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS questions (
        id serial PRIMARY KEY,
        to_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_text text NOT NULL,
        answer_text text,
        answered_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS questions_to_user_id_created_at_idx
        ON questions (to_user_id, created_at DESC)`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS question_comments (
        id serial PRIMARY KEY,
        question_id integer NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS question_comments_question_id_created_at_idx
        ON question_comments (question_id, created_at ASC)`);
    })();
  }
  return questionsTablesMigration;
}

export * from "./schema";
