import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").default("image").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storyViewsTable = pgTable("story_views", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull().references(() => storiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (t) => [unique().on(t.storyId, t.userId)]);

export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true, createdAt: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof storiesTable.$inferSelect;
