import { db } from "@workspace/db";
import {
  usersTable, followsTable, postsTable, postViewsTable, likesTable, repostsTable, bookmarksTable, commentsTable, directMessagesTable,
  commentLikesTable, pollVotesTable, storiesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";

export const avatarFrameTransformSchemaReady = db.execute(sql`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_frame_transform jsonb
`).catch((error) => {
  console.error("Avatar frame transform schema migration failed:", error);
  throw error;
});

export const storyPreviewSchemaReady = db.execute(sql`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS story_preview_url text
`).catch((error) => {
  console.error("Story preview schema migration failed:", error);
  throw error;
});

export async function getUserWithStats(userId: number, viewerId?: number) {
  await Promise.all([avatarFrameTransformSchemaReady, storyPreviewSchemaReady]);
  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user[0]) return null;

  const [followerCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(followsTable)
    .where(eq(followsTable.followingId, userId));

  const [followingCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(followsTable)
    .where(eq(followsTable.followerId, userId));

  const [postCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(postsTable)
    .where(eq(postsTable.userId, userId));

  const [storyCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(storiesTable)
    .where(eq(storiesTable.userId, userId));

  // Toplam beğeni — kullanıcının tüm gönderilerindeki beğeni sayısı
  const [likeCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(likesTable)
    .innerJoin(postsTable, eq(likesTable.postId, postsTable.id))
    .where(eq(postsTable.userId, userId));

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const follow = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, userId)))
      .limit(1);
    isFollowing = follow.length > 0;
  }

  const thoughtExpired = user[0].thought && user[0].thoughtUpdatedAt && user[0].thoughtUpdatedAt.getTime() <= Date.now() - 24 * 60 * 60 * 1000;
  if (thoughtExpired) {
    await db.update(usersTable).set({ thought: null, thoughtUpdatedAt: null }).where(eq(usersTable.id, userId));
  }

  return {
    id: user[0].id,
    username: user[0].username,
    displayName: user[0].displayName,
    bio: user[0].bio,
    locationCity: user[0].locationCity,
    locationCountry: user[0].locationCountry,
    authorBio: user[0].authorBio,
    avatarUrl: user[0].avatarUrl,
    bannerUrl: user[0].bannerUrl,
    storyPreviewUrl: user[0].storyPreviewUrl,
    profileIntroVideoUrl: user[0].profileIntroVideoUrl,
    profileIntroVideoTransparencyMode: user[0].profileIntroVideoTransparencyMode,
    profileIntroVideoEdgeFade: user[0].profileIntroVideoEdgeFade,
    spotifyTrackId: user[0].spotifyTrackId,
    thoughtSpotifyTrackId: thoughtExpired ? null : user[0].thoughtSpotifyTrackId,
    thought: thoughtExpired ? null : user[0].thought,
    role: user[0].role,
    badge: user[0].badge,
    badgeLabel: user[0].badgeLabel,
    avatarFrame: user[0].avatarFrame,
    badgeAssetId: user[0].badgeAssetId,
    badgeVisible: user[0].badgeVisible,
    badgeAssetUrl: user[0].badgeVisible ? (await db.execute(sql`SELECT image_url FROM badge_assets WHERE id = ${user[0].badgeAssetId} AND published = true LIMIT 1`)).rows[0]?.image_url ?? null : null,
    emblemAssetId: user[0].emblemAssetId,
    emblemVisible: user[0].emblemVisible,
    emblemAssetUrl: user[0].emblemVisible ? (await db.execute(sql`SELECT image_url FROM emblem_assets WHERE id = ${user[0].emblemAssetId} AND published = true LIMIT 1`)).rows[0]?.image_url ?? null : null,
    avatarFrameAssetId: user[0].avatarFrameAssetId,
    avatarFrameVisible: user[0].avatarFrameVisible,
    avatarFrameTransform: user[0].avatarFrameTransform,
    avatarFrameAssetUrl: user[0].avatarFrameVisible ? (await db.execute(sql`SELECT image_url FROM frame_assets WHERE id = ${user[0].avatarFrameAssetId} AND published = true LIMIT 1`)).rows[0]?.image_url ?? null : null,
    isBanned: user[0].isBanned,
    followerCount: followerCount?.count ?? 0,
    followingCount: followingCount?.count ?? 0,
    postCount: postCount?.count ?? 0,
    storyCount: storyCount?.count ?? 0,
    likeCount: likeCount?.count ?? 0,
    isFollowing,
    createdAt: user[0].createdAt.toISOString(),
  };
}

export async function getPostWithDetails(postId: number, viewerId?: number) {
  const post = await db
    .select()
    .from(postsTable)
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!post[0]) return null;
  return enrichPost(post[0], viewerId);
}

export async function enrichPost(post: typeof postsTable.$inferSelect, viewerId?: number) {
  const isOwner = Number(viewerId) === Number(post.userId);
  const user = await getUserWithStats(post.userId, viewerId);

  const [likeCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(likesTable)
    .where(eq(likesTable.postId, post.id));

  const [commentCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(commentsTable)
    .where(eq(commentsTable.postId, post.id));

  const [repostCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(repostsTable)
    .where(eq(repostsTable.postId, post.id));

  const [bookmarkCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(bookmarksTable)
    .where(eq(bookmarksTable.postId, post.id));

  const [shareCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(directMessagesTable)
    .where(sql`${directMessagesTable.content} LIKE ${`__LOOP_POST_SHARE__:${post.id}:%`}`);

  const [viewCount] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(postViewsTable)
    .where(eq(postViewsTable.postId, post.id));

  let isLiked = false;
  let isBookmarked = false;
  let isReposted = false;
  let myPollVote: number | null = null;

  if (viewerId) {
    const like = await db.select().from(likesTable)
      .where(and(eq(likesTable.userId, viewerId), eq(likesTable.postId, post.id))).limit(1);
    isLiked = like.length > 0;

    const bookmark = await db.select().from(bookmarksTable)
      .where(and(eq(bookmarksTable.userId, viewerId), eq(bookmarksTable.postId, post.id))).limit(1);
    isBookmarked = bookmark.length > 0;

    const repost = await db.select().from(repostsTable)
      .where(and(eq(repostsTable.userId, viewerId), eq(repostsTable.postId, post.id))).limit(1);
    isReposted = repost.length > 0;

    if (post.postType === "poll") {
      const vote = await db.select().from(pollVotesTable)
        .where(and(eq(pollVotesTable.userId, viewerId), eq(pollVotesTable.postId, post.id))).limit(1);
      myPollVote = vote[0]?.optionIndex ?? null;
    }
  }

  // Poll vote counts per option
  let pollVoteCounts: number[] | null = null;
  if (post.postType === "poll" && post.pollOptions) {
    const opts = post.pollOptions as string[];
    const counts = await Promise.all(
      opts.map((_, i) =>
        db.select({ count: sql<number>`cast(count(*) as int)` }).from(pollVotesTable)
          .where(and(eq(pollVotesTable.postId, post.id), eq(pollVotesTable.optionIndex, i)))
          .then(r => r[0]?.count ?? 0)
      )
    );
    pollVoteCounts = counts;
  }

  return {
    id: post.id,
    userId: post.userId,
    user,
    content: post.content,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    backgroundUrl: post.backgroundUrl,
    postType: post.postType,
    pollOptions: post.pollOptions as string[] | null,
    pollVoteCounts,
    myPollVote,
    likeCount: post.hideLikeCount && !isOwner ? 0 : (likeCount?.count ?? 0),
    commentCount: commentCount?.count ?? 0,
    repostCount: post.hideRepostCount && !isOwner ? 0 : (repostCount?.count ?? 0),
    bookmarkCount: post.hideBookmarkCount && !isOwner ? 0 : (bookmarkCount?.count ?? 0),
    shareCount: shareCount?.count ?? 0,
    viewCount: viewCount?.count ?? 0,
    isLiked,
    isBookmarked,
    isReposted,
    archived: post.archived,
    hideLikeCount: post.hideLikeCount && !isOwner,
    hideRepostCount: post.hideRepostCount && !isOwner,
    hideBookmarkCount: post.hideBookmarkCount && !isOwner,
    commentsDisabled: post.commentsDisabled,
    pinnedProfile: post.pinnedProfile,
    createdAt: post.createdAt.toISOString(),
  };
}
