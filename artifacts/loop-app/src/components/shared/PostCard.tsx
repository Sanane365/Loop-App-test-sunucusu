import { Post, useLikePost, useUnlikePost, useRepostPost, useBookmarkPost, getListPostsQueryKey, useListComments, useCreateComment, getListCommentsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, Bookmark, Send } from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PostCard({ post }: { post: Post }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
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

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => prev - 1);
      unlikeMutation.mutate({ postId: post.id }, {
        onError: () => {
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() })
      });
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      likeMutation.mutate({ postId: post.id }, {
        onError: () => {
          setIsLiked(false);
          setLikeCount(prev => prev - 1);
        },
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
    bookmarkMutation.mutate({ postId: post.id }, {
      onSuccess: () => {
        toast({ title: "Kaydedildi" });
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

  return (
    <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.userId}`}>
          <Avatar className="w-10 h-10 border border-border cursor-pointer">
            <AvatarImage src={post.user?.avatarUrl || ""} />
            <AvatarFallback>{post.user?.displayName?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex flex-col flex-1">
          <Link href={`/profile/${post.userId}`} className="font-semibold text-sm hover:underline cursor-pointer">
            {post.user?.displayName}
          </Link>
          <span className="text-xs text-muted-foreground">
            @{post.user?.username} · {formatDistanceToNow(new Date(post.createdAt), { locale: tr, addSuffix: true })}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
      
      {post.mediaUrl && (
        <div className="rounded-xl overflow-hidden mt-1 border border-border">
          {post.mediaType === 'video' ? (
            <video src={post.mediaUrl} controls className="w-full max-h-80 object-cover" />
          ) : (
            <img src={post.mediaUrl} alt="Post media" className="w-full max-h-80 object-cover" />
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-muted-foreground">
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
                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
              />
              <Button size="icon" className="rounded-full flex-shrink-0" onClick={handleAddComment} disabled={!newComment.trim() || createCommentMutation.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <button 
          onClick={handleRepost}
          className={`flex items-center gap-1.5 hover:text-green-500 transition-colors text-sm ${post.isReposted ? 'text-green-500' : ''}`}
          data-testid={`post-repost-${post.id}`}
        >
          <Repeat2 className="w-5 h-5" />
          <span>{post.repostCount}</span>
        </button>
        <button 
          onClick={handleLike}
          className={`flex items-center gap-1.5 hover:text-red-500 transition-colors text-sm ${isLiked ? 'text-red-500' : ''}`}
          data-testid={`post-like-${post.id}`}
        >
          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          <span>{likeCount}</span>
        </button>
        <button 
          onClick={handleBookmark}
          className={`flex items-center gap-1.5 hover:text-primary transition-colors text-sm ${post.isBookmarked ? 'text-primary' : ''}`}
          data-testid={`post-bookmark-${post.id}`}
        >
          <Bookmark className={`w-5 h-5 ${post.isBookmarked ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
}
