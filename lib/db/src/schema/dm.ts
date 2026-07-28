import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const directMessagesTable = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  receiverId: integer("receiver_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  voiceUrl: text("voice_url"),
  voiceDuration: integer("voice_duration"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dmGroupsTable = pgTable("dm_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dmGroupMembersTable = pgTable("dm_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => dmGroupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

export const dmGroupMessagesTable = pgTable("dm_group_messages", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => dmGroupsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  voiceUrl: text("voice_url"),
  voiceDuration: integer("voice_duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type DmGroup = typeof dmGroupsTable.$inferSelect;
export type DmGroupMember = typeof dmGroupMembersTable.$inferSelect;
export type DmGroupMessage = typeof dmGroupMessagesTable.$inferSelect;
