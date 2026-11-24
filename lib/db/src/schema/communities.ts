import { pgTable, serial, integer, text, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { voiceRoomsTable } from "./chat";

export type CommunityPermissions = {
  manageCommunity?: boolean;
  manageMembers?: boolean;
  manageRoles?: boolean;
  manageChannels?: boolean;
  manageMessages?: boolean;
  sendMessages?: boolean;
  connectVoice?: boolean;
  inviteMembers?: boolean;
};

export const communitiesTable = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("🌙"),
  coverImageUrl: text("cover_image_url"),
  accentColor: text("accent_color").notNull().default("#8b5cf6"),
  accessMode: text("access_mode").notNull().default("public"),
  inviteCode: text("invite_code").notNull().unique(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityRolesTable = pgTable("community_roles", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b5cf6"),
  permissions: jsonb("permissions").$type<CommunityPermissions>().notNull().default({}),
  position: integer("position").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").references(() => communityRolesTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("active"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [unique().on(table.communityId, table.userId)]);

export const communityChannelsTable = pgTable("community_channels", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  position: integer("position").notNull().default(0),
  voiceRoomId: integer("voice_room_id").references(() => voiceRoomsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const communityMessagesTable = pgTable("community_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => communityChannelsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
