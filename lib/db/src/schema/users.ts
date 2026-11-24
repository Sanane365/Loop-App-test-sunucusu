import { pgTable, text, serial, integer, boolean, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  locationCity: text("location_city"),
  locationCountry: text("location_country"),
  authorBio: text("author_bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  storyPreviewUrl: text("story_preview_url"),
  profileIntroVideoUrl: text("profile_intro_video_url"),
  profileIntroVideoTransparencyMode: text("profile_intro_video_transparency_mode").notNull().default("auto"),
  profileIntroVideoEdgeFade: boolean("profile_intro_video_edge_fade").notNull().default(true),
  spotifyTrackId: text("spotify_track_id"),
  thoughtSpotifyTrackId: text("thought_spotify_track_id"),
  thought: text("thought"),
  thoughtUpdatedAt: timestamp("thought_updated_at"),
  role: text("role").notNull().default("user"),
  badge: text("badge"),
  badgeLabel: text("badge_label"),
  avatarFrame: text("avatar_frame"),
  badgeAssetId: integer("badge_asset_id"),
  badgeVisible: boolean("badge_visible").notNull().default(true),
  emblemAssetId: integer("emblem_asset_id"),
  emblemVisible: boolean("emblem_visible").notNull().default(true),
  avatarFrameAssetId: integer("avatar_frame_asset_id"),
  avatarFrameVisible: boolean("avatar_frame_visible").notNull().default(true),
  avatarFrameTransform: jsonb("avatar_frame_transform").$type<{ x: number; y: number; scale: number } | null>(),
  isBanned: boolean("is_banned").notNull().default(false),
  banReason: text("ban_reason"),
  bannedAt: timestamp("banned_at"),
  lastSeenAt: timestamp("last_seen_at"),
  lastIpAddress: text("last_ip_address"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  followingId: integer("following_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [unique().on(t.followerId, t.followingId)]);

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bansTable = pgTable("bans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  reason: text("reason"),
  banType: text("ban_type").notNull().default("user"),
  bannedBy: integer("banned_by").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type Follow = typeof followsTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Ban = typeof bansTable.$inferSelect;
