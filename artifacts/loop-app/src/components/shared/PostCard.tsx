import { Post, useLikePost, useUnlikePost, useRepostPost, useBookmarkPost, getListPostsQueryKey, useListComments, useCreateComment, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Bookmark, Send, MoreHorizontal, Music2, Plus, Share2 } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

export function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");

  const likeMutation = useLikePost();
  const unlikeMutation = useUnlikePost();
  const repostMutation = useRepostPost();
  const bookmarkMutation = useBookmarkPost();
  const createCommentMutation = useCreateComment();

  const { data: comments, isLoading: commentsLoading } = useListComments(post.id, {
    query: { enabled: isCommentsOpen, queryKey: getListCommentsQueryKey(post.id) }
  });

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

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate({ postId: post.id, data: { content: newComment } }, {
      onSuccess: () => {
        setNewComment("");
        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(post.id) });
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      }
    });
  };

  if (hasMedia) {
    // Full-bleed media card (TikTok style)
    return (
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
          <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <DialogTrigger asChild>
              <button className="flex flex-col items-center gap-0.5" data-testid={`post-comment-${post.id}`}>
                <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
                <span className="text-white text-xs font-medium drop-shadow">{formatCount(post.commentCount)}</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Yorumlar</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {commentsLoading ? (
                  <div className="text-center text-muted-foreground">Yükleniyor...</div>
                ) : comments?.length === 0 ? (
                  <div className="text-center text-muted-foreground">İlk yorumu sen yap!</div>
                ) : (
                  comments?.map(comment => (
                    <div key={comment.id} className="flex gap-3">
                      <Link href={`/profile/${comment.userId}`} onClick={() => setIsCommentsOpen(false)}>
                        <Avatar className="w-8 h-8 cursor-pointer">
                          <AvatarImage src={comment.user?.avatarUrl || ""} />
                          <AvatarFallback>{comment.user?.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
                          <p className="font-semibold text-sm text-foreground">{comment.user?.displayName}</p>
                          <p className="text-sm text-foreground">{comment.content}</p>
                        </div>
                        <span className="text-xs text-muted-foreground ml-1 mt-1 inline-block">
                          {formatDistanceToNow(new Date(comment.createdAt), { locale: tr, addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-4 border-t border-border mt-auto">
                <Input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Yorum ekle..."
                  className="rounded-full flex-1"
                  onKeyDown={e => e.key === "Enter" && handleAddComment()}
                />
                <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleAddComment} disabled={!newComment.trim() || createCommentMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
    );
  }

  // Text-only card
  return (
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
      <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{post.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-5 text-muted-foreground border-t border-border/50 pt-2.5">
        <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 hover:text-primary transition-colors text-sm" data-testid={`post-comment-${post.id}`}>
              <MessageCircle className="w-5 h-5" />
              <span>{post.commentCount}</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Yorumlar</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {commentsLoading ? (
                <div className="text-center text-muted-foreground">Yükleniyor...</div>
              ) : comments?.length === 0 ? (
                <div className="text-center text-muted-foreground">İlk yorumu sen yap!</div>
              ) : (
                comments?.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <Link href={`/profile/${comment.userId}`} onClick={() => setIsCommentsOpen(false)}>
                      <Avatar className="w-8 h-8 cursor-pointer">
                        <AvatarImage src={comment.user?.avatarUrl || ""} />
                        <AvatarFallback>{comment.user?.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1">
                      <div className="bg-muted p-3 rounded-2xl rounded-tl-sm">
                        <p className="font-semibold text-sm text-foreground">{comment.user?.displayName}</p>
                        <p className="text-sm text-foreground">{comment.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-1 mt-1 inline-block">
                        {formatDistanceToNow(new Date(comment.createdAt), { locale: tr, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t border-border mt-auto">
              <Input
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Yorum ekle..."
                className="rounded-full flex-1"
                onKeyDown={e => e.key === "Enter" && handleAddComment()}
              />
              <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleAddComment} disabled={!newComment.trim() || createCommentMutation.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
  );
}
