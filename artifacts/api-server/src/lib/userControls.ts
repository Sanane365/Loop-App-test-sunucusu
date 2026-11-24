import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type ProfileControl = "blocked" | "restricted" | "posts_hidden";

const userControlsReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS user_profile_controls (
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked boolean NOT NULL DEFAULT false,
    restricted boolean NOT NULL DEFAULT false,
    posts_hidden boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, target_user_id),
    CHECK (user_id <> target_user_id)
  )
`);

export type UserPrivacySettings = {
  privateAccount: boolean;
  allowMessages: "everyone" | "followers" | "mutuals" | "requests" | "nobody";
  followerListVisibility: "everyone" | "followers" | "only_me";
  followingListVisibility: "everyone" | "followers" | "only_me";
  bulletinAudience: "everyone" | "followers";
  mentionReplyAudience: "everyone" | "followers" | "nobody";
};

const defaultPrivacySettings: UserPrivacySettings = {
  privateAccount: false,
  allowMessages: "everyone",
  followerListVisibility: "everyone",
  followingListVisibility: "everyone",
  bulletinAudience: "everyone",
  mentionReplyAudience: "everyone",
};

const userPrivacyReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    private_account boolean NOT NULL DEFAULT false,
    allow_messages text NOT NULL DEFAULT 'everyone',
    follower_list_visibility text NOT NULL DEFAULT 'everyone',
    following_list_visibility text NOT NULL DEFAULT 'everyone',
    bulletin_audience text NOT NULL DEFAULT 'everyone',
    mention_reply_audience text NOT NULL DEFAULT 'everyone',
    updated_at timestamp NOT NULL DEFAULT now(),
    CHECK (follower_list_visibility IN ('everyone', 'followers', 'only_me')),
    CHECK (following_list_visibility IN ('everyone', 'followers', 'only_me')),
    CHECK (bulletin_audience IN ('everyone', 'followers'))
  )
`).then(async () => {
  await db.execute(sql`
    ALTER TABLE user_privacy_settings
    ADD COLUMN IF NOT EXISTS mention_reply_audience text NOT NULL DEFAULT 'everyone'
  `);
  await db.execute(sql`
    ALTER TABLE user_privacy_settings
    DROP CONSTRAINT IF EXISTS user_privacy_settings_mention_reply_audience_check
  `);
  await db.execute(sql`
    ALTER TABLE user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_mention_reply_audience_check
    CHECK (mention_reply_audience IN ('everyone', 'followers', 'nobody'))
  `);
  await db.execute(sql`
    ALTER TABLE user_privacy_settings
    DROP CONSTRAINT IF EXISTS user_privacy_settings_allow_messages_check
  `);
  await db.execute(sql`
    ALTER TABLE user_privacy_settings
    ADD CONSTRAINT user_privacy_settings_allow_messages_check
    CHECK (allow_messages IN ('everyone', 'followers', 'mutuals', 'requests', 'nobody'))
  `);
});

export const followRequestsReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS follow_requests (
    requester_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY (requester_id, target_user_id),
    CHECK (requester_id <> target_user_id)
  )
`);

export async function hasPendingFollowRequest(requesterId: number, targetUserId: number) {
  await followRequestsReady;
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM follow_requests
      WHERE requester_id = ${requesterId} AND target_user_id = ${targetUserId}
    ) AS pending
  `);
  return Boolean(result.rows[0]?.pending);
}

export async function getUserPrivacySettings(userId: number): Promise<UserPrivacySettings> {
  await userPrivacyReady;
  const result = await db.execute(sql`
    SELECT
      private_account AS "privateAccount",
      allow_messages AS "allowMessages",
      follower_list_visibility AS "followerListVisibility",
      following_list_visibility AS "followingListVisibility",
      bulletin_audience AS "bulletinAudience",
      mention_reply_audience AS "mentionReplyAudience"
    FROM user_privacy_settings
    WHERE user_id = ${userId}
  `);
  return result.rows[0]
    ? { ...defaultPrivacySettings, ...result.rows[0] as UserPrivacySettings }
    : defaultPrivacySettings;
}

export async function canMentionOrReplyToUser(senderId: number, receiverId: number) {
  if (senderId === receiverId) return true;
  const settings = await getUserPrivacySettings(receiverId);
  if (settings.mentionReplyAudience === "nobody") return false;
  if (settings.mentionReplyAudience === "followers") {
    return isFollower(senderId, receiverId);
  }
  return true;
}

async function isFollower(viewerId: number | undefined, targetUserId: number) {
  if (viewerId === targetUserId) return true;
  if (!viewerId) return false;
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = ${viewerId} AND following_id = ${targetUserId}
    ) AS following
  `);
  return Boolean(result.rows[0]?.following);
}

export async function canViewUserContent(
  viewerId: number | undefined,
  targetUserId: number,
  contentType?: string,
) {
  if (viewerId === targetUserId) return true;
  const settings = await getUserPrivacySettings(targetUserId);
  const following = await isFollower(viewerId, targetUserId);
  if (settings.privateAccount && !following) return false;
  if (contentType === "bulletin" && settings.bulletinAudience === "followers" && !following) {
    return false;
  }
  return true;
}

export async function canViewUserList(
  viewerId: number | undefined,
  targetUserId: number,
  list: "followers" | "following",
) {
  if (viewerId === targetUserId) return true;
  const settings = await getUserPrivacySettings(targetUserId);
  const visibility = list === "followers"
    ? settings.followerListVisibility
    : settings.followingListVisibility;
  if (visibility === "only_me") return false;
  if (visibility === "followers" && !(await isFollower(viewerId, targetUserId))) return false;
  return true;
}

export async function getProfileControls(userId: number, targetUserId: number) {
  await userControlsReady;
  const result = await db.execute(sql`
    SELECT blocked, restricted, posts_hidden AS "postsHidden"
    FROM user_profile_controls
    WHERE user_id = ${userId} AND target_user_id = ${targetUserId}
  `);
  return result.rows[0] as
    | { blocked: boolean; restricted: boolean; postsHidden: boolean }
    | undefined;
}

export async function getHiddenProfileUserIds(userId: number) {
  await userControlsReady;
  const result = await db.execute(sql`
    SELECT target_user_id AS id
    FROM user_profile_controls
    WHERE user_id = ${userId} AND (blocked = true OR posts_hidden = true)
    UNION
    SELECT user_id AS id
    FROM user_profile_controls
    WHERE target_user_id = ${userId} AND blocked = true
  `);
  return new Set(result.rows.map((row) => Number(row.id)));
}

export async function getBlockedUserIds(userId: number) {
  await userControlsReady;
  const result = await db.execute(sql`
    SELECT target_user_id AS id
    FROM user_profile_controls
    WHERE user_id = ${userId} AND blocked = true
    UNION
    SELECT user_id AS id
    FROM user_profile_controls
    WHERE target_user_id = ${userId} AND blocked = true
  `);
  return new Set(result.rows.map((row) => Number(row.id)));
}

export async function getBlockStatus(userId: number, targetUserId: number) {
  await userControlsReady;
  const result = await db.execute(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM user_profile_controls
        WHERE user_id = ${userId} AND target_user_id = ${targetUserId} AND blocked = true
      ) AS "blockedByMe",
      EXISTS (
        SELECT 1 FROM user_profile_controls
        WHERE user_id = ${targetUserId} AND target_user_id = ${userId} AND blocked = true
      ) AS "blockedByThem"
  `);
  return result.rows[0] as { blockedByMe: boolean; blockedByThem: boolean };
}

export async function getInteractionRestrictionStatus(
  senderId: number,
  receiverId: number,
) {
  await userControlsReady;
  const result = await db.execute(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM user_profile_controls
        WHERE user_id = ${senderId} AND target_user_id = ${receiverId} AND blocked = true
      ) OR EXISTS (
        SELECT 1 FROM user_profile_controls
        WHERE user_id = ${receiverId} AND target_user_id = ${senderId} AND blocked = true
      ) AS blocked,
      EXISTS (
        SELECT 1 FROM user_profile_controls
        WHERE user_id = ${receiverId} AND target_user_id = ${senderId}
          AND (restricted = true OR blocked = true)
      ) AS "restrictedByReceiver"
  `);
  return result.rows[0] as { blocked: boolean; restrictedByReceiver: boolean };
}
