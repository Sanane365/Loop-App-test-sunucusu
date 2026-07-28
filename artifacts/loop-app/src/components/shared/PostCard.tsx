import { Post, useLikePost, useUnlikePost, useRepostPost, useBookmarkPost, getListPostsQueryKey, useListComments, useCreateComment, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal, Music2, Plus, Share2, X, Smile, ImagePlus } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + " Mn";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + " B";
  return String(n);
}

function extractHashtags(content: string): { text: string; tags: string[] } {
  const tags: string[] = [];
  const cleaned = content.replace(/#(\w+)/g, (_, tag) => {
    tags.push(tag);
    return "";
  }).trim();
  return { text: cleaned, tags };
}

// ── Instagram-style draggable comment bottom sheet ─────────────────────────
function CommentBottomSheet({
  postId,
  commentCount,
  isOpen,
  onClose,
}: {
  postId: number;
  commentCount: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [commentLikes, setCommentLikes] = useState<Record<number, { liked: boolean; count: number }>>({});
  const [dragOffset, setDragOffset] = useState(0);
  const [visible, setVisible] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: comments, isLoading: commentsLoading } = useListComments(postId, {
    query: { enabled: isOpen, queryKey: getListCommentsQueryKey(postId) }
  });
  const createCommentMutation = useCreateComment();

  // Animate in
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    setDragOffset(Math.max(0, dy));
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (dragOffset > 120) {
      onClose();
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
    startYRef.current = null;
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(
      { postId, data: { content: newComment, replyToId: replyingToId ?? undefined } as any },
      {
        onSuccess: () => {
          setNewComment("");
          setReplyingToId(null);
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        }
      }
    );
  };

  const handleReply = (comment: any) => {
    const prefix = `@${comment.user?.username ?? comment.userId} `;
    setNewComment(prefix);
    setReplyingToId(comment.id);
    setTimeout(() => {
      inputRef.current?.focus();
      const len = prefix.length;
      inputRef.current?.setSelectionRange(len, len);
    }, 50);
  };

  const handleToggleCommentLike = async (comment: any) => {
    const prev = commentLikes[comment.id] ?? {
      liked: comment.isLiked ?? false,
      count: comment.likeCount ?? 0,
    };
    const next = { liked: !prev.liked, count: prev.count + (prev.liked ? -1 : 1) };
    setCommentLikes(s => ({ ...s, [comment.id]: next }));
    try {
      const method = prev.liked ? "DELETE" : "POST";
      await fetch(`/api/posts/${postId}/comments/${comment.id}/like`, { method });
    } catch {
      setCommentLikes(s => ({ ...s, [comment.id]: prev }));
    }
  };

  const isSliding = dragOffset > 0;

  return (
    <div
      className="fixed inset-0 z-[60]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-background rounded-t-[28px] flex flex-col"
        style={{
          maxHeight: "88vh",
          transform: `translateY(${isSliding ? dragOffset : visible ? 0 : "100%"}px)`,
          transition: isSliding ? "none" : "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle area — only this area triggers drag */}
        <div
          className="flex flex-col items-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 pb-3 pt-1">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="font-bold text-[15px] leading-tight">Yorumlar</p>
            <p className="text-[12px] text-muted-foreground">{formatCount(commentCount)} yorum</p>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/60 mx-4" />

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 min-h-0">
          {commentsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : comments?.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">İlk yorumu sen yap!</p>
            </div>
          ) : (
            comments?.map(comment => {
              const cl = commentLikes[comment.id] ?? { liked: (comment as any).isLiked ?? false, count: (comment as any).likeCount ?? 0 };
              return (
              <div key={comment.id} className="flex gap-3">
                <Link href={`/profile/${comment.userId}`} onClick={onClose}>
                  <Avatar className="w-9 h-9 cursor-pointer flex-shrink-0">
                    <AvatarImage src={comment.user?.avatarUrl || ""} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {comment.user?.displayName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-[13px] text-foreground leading-tight">
                          {comment.user?.displayName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          · {formatDistanceToNow(new Date(comment.createdAt), { locale: tr, addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[14px] text-foreground leading-[1.45] break-words whitespace-pre-wrap">
                        {comment.content}
                      </p>
                      <button
                        onClick={() => handleReply(comment)}
                        className="text-[12px] text-muted-foreground mt-1.5 font-medium hover:text-foreground transition-colors"
                      >
                        Yanıtla
                      </button>
                    </div>
                    <button
                      onClick={() => handleToggleCommentLike(comment)}
                      className="flex flex-col items-center gap-0.5 flex-shrink-0 mt-0.5 p-1"
                    >
                      <Heart className={`w-4 h-4 transition-colors ${cl.liked ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                      {cl.count > 0 && <span className="text-[10px] text-muted-foreground">{cl.count}</span>}
                    </button>
                  </div>
                </div>
              </div>
              );
            })
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-border/60 px-3 py-3 flex items-center gap-2.5 bg-background">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
              {user?.displayName?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex flex-col bg-muted/60 rounded-2xl px-4 py-2 border border-border/30 gap-1">
            {replyingToId && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-primary font-medium">Yanıt olarak</span>
                <button onClick={() => { setReplyingToId(null); setNewComment(""); }} className="text-muted-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <input
              ref={inputRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Yorumunuz..."
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none h-6"
              onKeyDown={e => e.key === "Enter" && handleAddComment()}
            />
          </div>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
            <Smile className="w-5 h-5" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground flex-shrink-0">
            <ImagePlus className="w-5 h-5" />
          </button>
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim() || createCommentMutation.isPending}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-primary/90 transition-colors shadow"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        {/* Safe area bottom padding */}
        <div className="h-safe-area-inset-bottom" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}

// Poll fields are returned by the API but not in the generated schema
type PostWithPoll = Post & {
  postType?: string | null;
  pollOptions?: string[] | null;
  pollVoteCounts?: number[] | null;
  myPollVote?: number | null;
};

export function PostCard({ post: postRaw }: { post: Post }) {
  const post = postRaw as PostWithPoll;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Poll state
  const [myPollVote, setMyPollVote] = useState<number | null>(post.myPollVote ?? null);
  const [pollVoteCounts, setPollVoteCounts] = useState<number[]>(post.pollVoteCounts ?? []);
  const [isVoting, setIsVoting] = useState(false);

  const handlePollVote = async (optionIndex: number) => {
    if (myPollVote !== null || isVoting) return;
    setIsVoting(true);
    // Optimistic update
    const prev = { myPollVote, pollVoteCounts: [...pollVoteCounts] };
    const newCounts = [...pollVoteCounts];
    newCounts[optionIndex] = (newCounts[optionIndex] ?? 0) + 1;
    setMyPollVote(optionIndex);
    setPollVoteCounts(newCounts);
    try {
      const res = await fetch(`/api/posts/${post.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Vote failed");
      const updated = await res.json() as PostWithPoll;
      setMyPollVote(updated.myPollVote ?? optionIndex);
      setPollVoteCounts(updated.pollVoteCounts ?? newCounts);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch {
      // Rollback
      setMyPollVote(prev.myPollVote);
      setPollVoteCounts(prev.pollVoteCounts);
      toast({ title: "Oy gönderilemedi", variant: "destructive" });
    } finally {
      setIsVoting(false);
    }
  };

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();
  const repostMutation = useRepostPost();
  const bookmarkMutation = useBookmarkPost();

  const hasMedia = !!(post.mediaUrl);
  const { text: postText, tags } = extractHashtags(post.content || "");

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      unlikeMutation.mutate({ postId: post.id }, {
        onError: () => { setIsLiked(true); setLikeCount(prev => prev + 1); },
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      });
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      likeMutation.mutate({ postId: post.id }, {
        onError: () => { setIsLiked(false); setLikeCount(prev => prev - 1); },
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      });
    }
  };

  const handleRepost = () => {
    repostMutation.mutate({ postId: post.id }, {
      onSuccess: () => {
        toast({ title: "Yeniden paylaşıldı" });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  const handleBookmark = () => {
    setIsBookmarked(prev => !prev);
    bookmarkMutation.mutate({ postId: post.id }, {
      onError: () => setIsBookmarked(prev => !prev),
      onSuccess: () => {
        toast({ title: isBookmarked ? "Kaydedilenlerden çıkarıldı" : "Kaydedildi" });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  if (hasMedia) {
    // Full-bleed media card (TikTok style)
    return (
      <>
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden relative bg-black" style={{ minHeight: 420 }}>
          {/* Media */}
          {post.mediaType === "video" ? (
            <video
              src={post.mediaUrl!}
              className="w-full object-cover"
              style={{ maxHeight: 520 }}
              controls
              playsInline
              loop
            />
          ) : (
            <img
              src={post.mediaUrl!}
              alt="Post"
              className="w-full object-cover"
              style={{ maxHeight: 520 }}
            />
          )}

          {/* Top overlay: user info */}
          <div className="absolute top-0 left-0 right-12 p-3 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent">
            <Link href={`/profile/${post.userId}`}>
              <Avatar className="w-9 h-9 border border-white/30">
                <AvatarImage src={post.user?.avatarUrl || ""} />
                <AvatarFallback className="text-white bg-primary text-sm">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0">
              <Link href={`/profile/${post.userId}`}>
                <p className="text-white font-semibold text-sm leading-tight truncate">{post.user?.displayName}</p>
              </Link>
              <p className="text-white/60 text-xs">
                @{post.user?.username} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}
              </p>
            </div>
            <button className="text-white/60 hover:text-white p-1">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Right side: action buttons */}
          <div className="absolute right-2 bottom-16 flex flex-col items-center gap-4">
            {/* Follow button on avatar */}
            <div className="relative">
              <Avatar className="w-10 h-10 border-2 border-white">
                <AvatarImage src={post.user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary text-white text-sm">{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border border-background">
                <Plus className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Like */}
            <button onClick={handleLike} className="flex flex-col items-center gap-0.5" data-testid={`post-like-${post.id}`}>
              <Heart className={`w-7 h-7 drop-shadow-lg ${isLiked ? "fill-red-500 text-red-500" : "text-white"}`} />
              <span className="text-white text-xs font-medium drop-shadow">{formatCount(likeCount)}</span>
            </button>

            {/* Comment */}
            <button
              className="flex flex-col items-center gap-0.5"
              onClick={() => setIsCommentsOpen(true)}
              data-testid={`post-comment-${post.id}`}
            >
              <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
              <span className="text-white text-xs font-medium drop-shadow">{formatCount(post.commentCount)}</span>
            </button>

            {/* Share/Repost */}
            <button onClick={handleRepost} className="flex flex-col items-center gap-0.5" data-testid={`post-repost-${post.id}`}>
              <Share2 className={`w-7 h-7 drop-shadow-lg ${post.isReposted ? "text-primary" : "text-white"}`} />
              <span className="text-white text-xs font-medium drop-shadow">{formatCount(post.repostCount)}</span>
            </button>

            {/* Bookmark */}
            <button onClick={handleBookmark} className="flex flex-col items-center gap-0.5" data-testid={`post-bookmark-${post.id}`}>
              <Bookmark className={`w-7 h-7 drop-shadow-lg ${isBookmarked ? "fill-primary text-primary" : "text-white"}`} />
            </button>
          </div>

          {/* Bottom overlay: text, hashtags, music */}
          <div className="absolute bottom-0 left-0 right-14 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            {postText && (
              <p className="text-white text-sm font-medium mb-1.5 line-clamp-2">{postText}</p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tags.map(tag => (
                  <span key={tag} className="text-white/80 text-xs">#{tag}</span>
                ))}
                {tags.length > 2 && <span className="text-white/60 text-xs">+</span>}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Music2 className="w-3 h-3 text-white/70 flex-shrink-0" />
              <span className="text-white/70 text-xs truncate">Loop müzik</span>
            </div>
          </div>

          {/* Progress bar at very bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full w-1/3 bg-primary rounded-full" />
          </div>
        </div>

        <CommentBottomSheet
          postId={post.id}
          commentCount={post.commentCount}
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
        />
      </>
    );
  }

  // Text-only card
  return (
    <>
      <div className="mx-4 mb-3 bg-card rounded-2xl p-4 border border-border shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <Link href={`/profile/${post.userId}`}>
            <Avatar className="w-10 h-10 border border-border cursor-pointer">
              <AvatarImage src={post.user?.avatarUrl || ""} />
              <AvatarFallback>{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/profile/${post.userId}`} className="font-semibold text-sm hover:underline block truncate">
              {post.user?.displayName}
            </Link>
            <span className="text-xs text-muted-foreground">
              @{post.user?.username} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}
            </span>
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-3">{post.content}</p>

        {/* Poll options */}
        {post.postType === "poll" && post.pollOptions && post.pollOptions.length > 0 && (() => {
          const totalVotes = pollVoteCounts.reduce((s, c) => s + (c ?? 0), 0);
          const hasVoted = myPollVote !== null;
          return (
            <div className="flex flex-col gap-2 mb-3">
              {post.pollOptions.map((option, i) => {
                const count = pollVoteCounts[i] ?? 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isSelected = myPollVote === i;
                return (
                  <button
                    key={i}
                    disabled={hasVoted || isVoting}
                    onClick={() => handlePollVote(i)}
                    className={`relative w-full text-left rounded-xl border px-4 py-2.5 overflow-hidden transition-colors text-sm font-medium
                      ${isSelected
                        ? "border-primary text-primary"
                        : hasVoted
                          ? "border-border/60 text-muted-foreground"
                          : "border-border hover:border-primary hover:text-primary"
                      }
                      disabled:cursor-default`}
                  >
                    {/* Progress fill */}
                    {hasVoted && (
                      <span
                        className={`absolute inset-0 rounded-xl transition-all duration-500 ${isSelected ? "bg-primary/15" : "bg-muted/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="truncate">{option}</span>
                      {hasVoted && (
                        <span className={`text-xs font-semibold flex-shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                          %{pct}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
              <p className="text-xs text-muted-foreground pl-1">{totalVotes} oy</p>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="flex items-center gap-5 text-muted-foreground border-t border-border/50 pt-2.5">
          <button
            className="flex items-center gap-1.5 hover:text-primary transition-colors text-sm"
            onClick={() => setIsCommentsOpen(true)}
            data-testid={`post-comment-${post.id}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>{post.commentCount}</span>
          </button>

          <button onClick={handleRepost} className={`flex items-center gap-1.5 hover:text-primary transition-colors text-sm ${post.isReposted ? "text-primary" : ""}`} data-testid={`post-repost-${post.id}`}>
            <Share2 className="w-5 h-5" />
            <span>{post.repostCount}</span>
          </button>

          <button onClick={handleLike} className={`flex items-center gap-1.5 hover:text-red-500 transition-colors text-sm ${isLiked ? "text-red-500" : ""}`} data-testid={`post-like-${post.id}`}>
            <Heart className={`w-5 h-5 ${isLiked ? "fill-current" : ""}`} />
            <span>{likeCount}</span>
          </button>

          <button onClick={handleBookmark} className={`flex items-center gap-1.5 hover:text-primary transition-colors text-sm ml-auto ${isBookmarked ? "text-primary" : ""}`} data-testid={`post-bookmark-${post.id}`}>
            <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      <CommentBottomSheet
        postId={post.id}
        commentCount={post.commentCount}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />
    </>
  );
}
