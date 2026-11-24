import { pgTable, text, serial, integer, timestamp, unique, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// Anlık paylaşılan fotoğraflar
export const loopPhotosTable = pgTable("loop_photos", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  mediaItems: text("media_items").notNull().default("[]"),
  title: text("title").notNull().default("Yeni Loop"),
  caption: text("caption").notNull().default(""),
  tags: text("tags").notNull().default(""),
  audio: text("audio").notNull().default("Orijinal ses"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Kimlerin hangi fotoğrafı gördüğü
export const loopPhotoViewsTable = pgTable("loop_photo_views", {
  id: serial("id").primaryKey(),
  photoId: integer("photo_id").notNull().references(() => loopPhotosTable.id, { onDelete: "cascade" }),
  viewerId: integer("viewer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

// WebRTC arama sinyalleri (offer/answer/ICE — restart'a dayanıklı)
export const callSignalsTable = pgTable("call_signals", {
  id:        text("id").primaryKey(),          // UUID — callId
  callType:  text("call_type").notNull(),       // "voice" | "video"
  callerId:  integer("caller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  calleeId:  integer("callee_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  offerSdp:  text("offer_sdp"),                // JSON string
  answerSdp: text("answer_sdp"),               // JSON string
  callerIce: text("caller_ice").notNull().default("[]"), // JSON array string
  calleeIce: text("callee_ice").notNull().default("[]"), // JSON array string
  ended:     boolean("ended").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LoopPhoto = typeof loopPhotosTable.$inferSelect;
export type ThoughtLike = typeof thoughtLikesTable.$inferSelect;
