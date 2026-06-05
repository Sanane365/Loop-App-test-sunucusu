import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("text"),
  content: text("content"),
  gifUrl: text("gif_url"),
  voiceUrl: text("voice_url"),
  voiceDuration: integer("voice_duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceRoomsTable = pgTable("voice_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  isActive: text("is_active").default("true").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceRoomParticipantsTable = pgTable("voice_room_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => voiceRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type VoiceRoom = typeof voiceRoomsTable.$inferSelect;
