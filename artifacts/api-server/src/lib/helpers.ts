import { db } from "@workspace/db";
import {
  usersTable, followsTable, postsTable, likesTable, repostsTable, bookmarksTable, commentsTable,
} from "@workspace/db";
import { eq, sql, and, inArray, desc } from "drizzle-orm";

export async function getUserWithStats(userId: number, viewerId?: number) {
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

  let isFollowing = false;
  if (viewerId && viewerId !== userId) {
    const follow = await db
      .select()
      .from(followsTable)
      .where(and(eq(followsTable.followerId, viewerId), eq(followsTable.followingId, userId)))
      .limit(1);
    isFollowing = follow.length > 0;
  }

  return {
    id: user[0].id,
    username: user[0].username,
    displayName: user[0].displayName,
    bio: user[0].bio,
    avatarUrl: user[0].avatarUrl,
    bannerUrl: user[0].bannerUrl,
    spotifyTrackId: user[0].spotifyTrackId,
    thought: user[0].thought,
    role: user[0].role,
    isBanned: user[0].isBanned,
    followerCount: followerCount?.count ?? 0,
    followingCount: followingCount?.count ?? 0,
    postCount: postCount?.count ?? 0,
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

  let isLiked = false;
  let isBookmarked = false;
  let isReposted = false;

  if (viewerId) {
    const like = await db
      .select()
      .from(likesTable)
      .where(and(eq(likesTable.userId, viewerId), eq(likesTable.postId, post.id)))
      .limit(1);
    isLiked = like.length > 0;

    const bookmark = await db
      .select()
      .from(bookmarksTable)
      .where(and(eq(bookmarksTable.userId, viewerId), eq(bookmarksTable.postId, post.id)))
      .limit(1);
    isBookmarked = bookmark.length > 0;

    const repost = await db
      .select()
      .from(repostsTable)
      .where(and(eq(repostsTable.userId, viewerId), eq(repostsTable.postId, post.id)))
      .limit(1);
    isReposted = repost.length > 0;
  }

  return {
    id: post.id,
    userId: post.userId,
    user,
    content: post.content,
    mediaUrl: post.mediaUrl,
    mediaType: post.mediaType,
    likeCount: likeCount?.count ?? 0,
    commentCount: commentCount?.count ?? 0,
    repostCount: repostCount?.count ?? 0,
    isLiked,
    isBookmarked,
    isReposted,
    createdAt: post.createdAt.toISOString(),
  };
}
