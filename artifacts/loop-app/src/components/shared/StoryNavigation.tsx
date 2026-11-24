import { type MouseEvent, type ReactNode, useCallback, useState } from "react";
import { getListStoriesQueryKey, useListStories, type UserStories } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StoryViewer } from "./StoryViewer";

export async function markStoryViewed(queryClient: ReturnType<typeof useQueryClient>, storyId: number) {
  const response = await fetch(`/api/stories/${storyId}/view`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Hikaye izlendi olarak işaretlenemedi");

  queryClient.setQueryData<UserStories[]>(getListStoriesQueryKey(), previous => previous?.map(group => {
    const stories = group.stories.map(story => story.id === storyId ? { ...story, isViewed: true } : story);
    return {
      ...group,
      stories,
      hasUnviewed: stories.some(story => !story.isViewed),
    };
  }));
}

export function StoryNavigation({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: storyGroups } = useListStories({
    query: {
      queryKey: getListStoriesQueryKey(),
      enabled: Boolean(user),
      refetchOnMount: "always",
    },
  });
  const [viewerGroupIndex, setViewerGroupIndex] = useState<number | null>(null);
  const [viewerStoryIndex, setViewerStoryIndex] = useState(0);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-story-user-id]")
      : null;
    if (!target || !storyGroups) return;

    const userId = Number(target.dataset.storyUserId);
    const groupIndex = storyGroups.findIndex(group => group.user.id === userId && group.hasUnviewed);
    if (groupIndex < 0) return;

    const firstUnviewedStoryIndex = storyGroups[groupIndex].stories.findIndex(story => !story.isViewed);
    event.preventDefault();
    event.stopPropagation();
    setViewerStoryIndex(Math.max(0, firstUnviewedStoryIndex));
    setViewerGroupIndex(groupIndex);
  }, [storyGroups]);

  const handleStoryView = useCallback((storyId: number) => {
    void markStoryViewed(queryClient, storyId).catch(error => {
      console.error("Hikaye görüntüleme durumu kaydedilemedi", error);
    });
  }, [queryClient]);

  return (
    <div className="contents" onClickCapture={handleClickCapture}>
      {children}
      {viewerGroupIndex !== null && storyGroups?.length ? (
        <StoryViewer
          groups={storyGroups}
          startGroupIndex={viewerGroupIndex}
          startStoryIndex={viewerStoryIndex}
          onClose={() => setViewerGroupIndex(null)}
          onView={handleStoryView}
        />
      ) : null}
    </div>
  );
}
