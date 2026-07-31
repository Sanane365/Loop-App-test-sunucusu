import { useParams } from "wouter";
import { useGetPost, getGetPostQueryKey, useListComments, useCreateComment, getListCommentsQueryKey, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useState } from "react";

export default function PostDetail() {
  const params = useParams<{ postId: string }>();
  const postId = parseInt(params.postId || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: post, isLoading } = useGetPost(postId, {
    query: { queryKey: getGetPostQueryKey(postId), enabled: !!postId },
  });

  const { data: comments, isLoading: commentsLoading } = useListComments(postId, {
    query: { queryKey: getListCommentsQueryKey(postId), enabled: !!postId },
  });

  const createComment = useCreateComment();

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    createComment.mutate(
      { postId, data: { content: newComment } },
      {
        onSuccess: () => {
          setNewComment("");
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(postId) });
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div className="pb-20">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-14 bg-background/90 backdrop-blur-md z-10">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : navigate("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Gönderi</h1>
        </div>

        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="h-48 bg-card animate-pulse rounded-xl border border-border" />
          ) : post ? (
            <PostCard post={post} />
          ) : (
            <div className="text-center p-8 text-muted-foreground">Gönderi bulunamadı</div>
          )}

          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60">
              <h2 className="font-semibold text-sm text-foreground">
                Yorumlar {comments ? `(${comments.length})` : ""}
              </h2>
            </div>

            <div className="divide-y divide-border/40">
              {commentsLoading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">Yükleniyor...</div>
              ) : comments?.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">İlk yorumu sen yap!</div>
              ) : (
                comments?.map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-4">
                    <Link href={`/profile/${comment.userId}`}>
                      <Avatar className="w-8 h-8 cursor-pointer flex-shrink-0">
                        <AvatarImage src={comment.user?.avatarUrl || ""} />
                        <AvatarFallback>{comment.user?.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-3 py-2">
                        <p className="font-semibold text-sm text-foreground">{comment.user?.displayName}</p>
                        <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-2 mt-1 inline-block">
                        {formatDistanceToNow(new Date(comment.createdAt), { locale: tr, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 p-3 border-t border-border/60">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Yorum ekle..."
                className="rounded-full flex-1 bg-muted/40 border-border/40"
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button
                size="icon"
                className="rounded-full flex-shrink-0 w-9 h-9"
                onClick={handleAddComment}
                disabled={!newComment.trim() || createComment.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
