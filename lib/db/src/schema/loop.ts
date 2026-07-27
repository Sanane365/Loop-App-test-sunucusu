import { pgTable, text, serial, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Anlık paylaşılan fotoğraflar
export const loopPhotosTable = pgTable("loop_photos", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Kimlerin hangi fotoğrafı gördüğü
export const loopPhotoViewsTable = pgTable("loop_photo_views", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").notNull().references(() => loopPhotosTable.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.photoId, t.viewerId)]);

// Fotoğraf emoji tepkileri
export const loopPhotoReactionsTable = pgTable("loop_photo_reactions", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").notNull().references(() => loopPhotosTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.photoId, t.userId)]);

// Fotoğrafa yazılan yanıtlar
export const loopPhotoRepliesTable = pgTable("loop_photo_replies", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").notNull().references(() => loopPhotosTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Düşünce balonu beğenileri
export const thoughtLikesTable = pgTable("thought_likes", {
  id: serial("id").primaryKey(),
  thoughtOwnerId: integer("thought_owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  likerId: integer("liker_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.thoughtOwnerId, t.likerId)]);

export type LoopPhoto = typeof loopPhotosTable.$inferSelect;
export type ThoughtLike = typeof thoughtLikesTable.$inferSelect;
