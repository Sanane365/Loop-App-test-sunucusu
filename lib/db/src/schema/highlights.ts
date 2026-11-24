import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const highlightsTable = pgTable("profile_highlights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull().default("image"),
  coverMediaUrl: text("cover_media_url"),
  coverMediaType: text("cover_media_type"),
  label: text("label").notNull(),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const highlightViewsTable = pgTable("profile_highlight_views", {
  id: serial("id").primaryKey(),
  highlightId: integer("highlight_id").notNull().references(() => highlightsTable.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
}, (table) => ({ uniqueView: unique().on(table.highlightId, table.viewerId) }));
