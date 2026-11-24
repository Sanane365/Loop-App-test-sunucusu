import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/shared/PostCard";
import { Bookmark } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function Bookmarks() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts?bookmarked=true")
      .then((r) => r.json())
      .then((data) => { setPosts(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <AppLayout>
      <div className="p-4 pb-20 space-y-4">
        <div className="flex items-center gap-2 px-1 mb-2">
          <Bookmark className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">{t("bookmarks")}</h1>
        </div>

        {isLoading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-card animate-pulse rounded-xl border border-border" />
          ))
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bookmark className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t("noSavedPosts")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("saveHint")}</p>
            </div>
          </div>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </AppLayout>
  );
}
