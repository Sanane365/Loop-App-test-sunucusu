import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StoryRow } from "@/components/shared/StoryRow";
import { PostCard } from "@/components/shared/PostCard";

export default function Home() {
  const { data: posts, isLoading } = useListPosts(undefined, { query: { queryKey: getListPostsQueryKey() } });

  return (
    <AppLayout>
      <div className="pb-20">
        <StoryRow />
        <div className="flex flex-col gap-4 p-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-card animate-pulse rounded-xl border border-border" />
            ))
          ) : posts?.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">Henüz gönderi yok</div>
          ) : (
            posts?.map(post => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
