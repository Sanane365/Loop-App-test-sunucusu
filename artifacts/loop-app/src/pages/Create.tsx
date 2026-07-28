import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, X, Camera, ArrowLeft, Film, Plus, Trash2, BarChart2, Pencil } from "lucide-react";
import { useCreatePost } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

type PostType = "post" | "bulletin" | "poll";

export default function Create() {
  const { user } = useAuth();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const isStoryMode = searchParams.get("type") === "story";
  const initType = (searchParams.get("type") === "bulletin" ? "bulletin" : searchParams.get("type") === "poll" ? "poll" : "post") as PostType;

  const [postType, setPostType] = useState<PostType>(initType);
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createPost = useCreatePost();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmitStory = async () => {
    if (!mediaFile) return;
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", mediaFile);
      const uploadRes = await fetch("/api/stories/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url, type } = await uploadRes.json();
      const storyRes = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: url, mediaType: type }),
      });
      if (!storyRes.ok) throw new Error("Story failed");
      toast({ title: "Hikaye paylaşıldı! 24 saat görünür." });
      setLocation("/");
    } catch {
      toast({ title: "Hata", description: "Hikaye paylaşılamadı.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmitPost = async () => {
    if (postType === "poll") {
      const validOptions = pollOptions.map(o => o.trim()).filter(Boolean);
      if (!content.trim()) { toast({ title: "Anket sorusu girin", variant: "destructive" }); return; }
      if (validOptions.length < 2) { toast({ title: "En az 2 seçenek girin", variant: "destructive" }); return; }
    } else {
      if (!content.trim() && !mediaFile) return;
    }

    try {
      setIsUploading(true);
      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (mediaFile && postType !== "poll") {
        const formData = new FormData();
        formData.append("file", mediaFile);
        const res = await fetch("/api/posts/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        mediaUrl = data.url;
        mediaType = mediaFile.type.startsWith("video/") ? "video" : "image";
      }

      const finalPollOptions = postType === "poll"
        ? pollOptions.map(o => o.trim()).filter(Boolean)
        : undefined;

      createPost.mutate(
        { data: { content, mediaUrl: mediaUrl ?? undefined, mediaType: mediaType ?? undefined, postType, pollOptions: finalPollOptions as any } },
        {
          onSuccess: () => {
            toast({ title: postType === "bulletin" ? "Bülten paylaşıldı!" : postType === "poll" ? "Anket oluşturuldu!" : "Gönderi paylaşıldı!" });
            setLocation("/");
          },
          onError: () => {
            toast({ title: "Bir hata oluştu", variant: "destructive" });
          },
        }
      );
    } catch {
      toast({ title: "Yükleme hatası", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  if (isStoryMode) {
    return (
      <AppLayout>
        <div className="p-4 space-y-4 pb-20">
          <div className="flex items-center gap-3 px-1">
            <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex-1">Hikaye Paylaş</h1>
            <Button
              onClick={handleSubmitStory}
              disabled={!mediaFile || isUploading}
              className="rounded-full px-6 font-semibold shadow-md"
            >
              {isUploading ? "Yükleniyor..." : "Paylaş"}
            </Button>
          </div>

          {mediaPreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-border aspect-[9/16] max-h-[60vh] mx-auto max-w-xs">
              {mediaFile?.type.startsWith("video/") ? (
                <video src={mediaPreview} controls className="w-full h-full object-cover" />
              ) : (
                <img src={mediaPreview} alt="Story preview" className="w-full h-full object-cover" />
              )}
              <button
                onClick={handleRemoveMedia}
                className="absolute top-3 right-3 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-[9/16] max-h-[60vh] mx-auto max-w-xs flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-card hover:border-primary/60 hover:bg-primary/5 transition-all"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Fotoğraf veya Video Seç</p>
                <p className="text-sm text-muted-foreground mt-1">Hikayeler 24 saat sonra kaybolur</p>
              </div>
            </button>
          )}

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">
              {postType === "bulletin" ? "Bülten" : postType === "poll" ? "Anket" : "Yeni Gönderi"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 text-xs"
              onClick={() => setLocation("/create?type=story")}
            >
              <Film className="w-3.5 h-3.5" />
              Hikaye
            </Button>
            <Button
              onClick={handleSubmitPost}
              disabled={
                postType === "poll"
                  ? (!content.trim() || pollOptions.filter(o => o.trim()).length < 2 || isUploading)
                  : (!content.trim() && !mediaFile) || isUploading || createPost.isPending
              }
              className={`rounded-full px-6 font-semibold shadow-md ${postType === "bulletin" ? "bg-purple-600 hover:bg-purple-700" : postType === "poll" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="btn-create-post"
            >
              {isUploading ? "Yükleniyor..." : "Paylaş"}
            </Button>
          </div>
        </div>

        {/* Post type selector */}
        <div className="flex gap-2">
          {([
            { id: "post", label: "Gönderi", icon: <ImageIcon className="w-3.5 h-3.5" /> },
            { id: "bulletin", label: "Bülten", icon: <Pencil className="w-3.5 h-3.5" /> },
            { id: "poll", label: "Anket", icon: <BarChart2 className="w-3.5 h-3.5" /> },
          ] as { id: PostType; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setPostType(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                postType === t.id
                  ? t.id === "bulletin" ? "bg-purple-500/15 text-purple-600 border border-purple-500/30"
                    : t.id === "poll" ? "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                    : "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <Textarea
              placeholder={
                postType === "bulletin" ? "Aklından ne geçiyor?"
                : postType === "poll" ? "Anket sorusu..."
                : "Neler düşünüyorsun?"
              }
              className="min-h-[120px] border-none focus-visible:ring-0 resize-none p-0 text-lg bg-transparent"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              data-testid="textarea-create-content"
            />

            {/* Poll options */}
            {postType === "poll" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Seçenekler</p>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={e => {
                        const updated = [...pollOptions];
                        updated[i] = e.target.value;
                        setPollOptions(updated);
                      }}
                      placeholder={`Seçenek ${i + 1}`}
                      className="rounded-xl text-sm h-9"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="flex items-center gap-1.5 text-sm text-primary font-medium hover:opacity-80"
                  >
                    <Plus className="w-4 h-4" />
                    Seçenek ekle
                  </button>
                )}
              </div>
            )}

            {/* Media preview */}
            {mediaPreview && postType !== "poll" && (
              <div className="relative rounded-xl overflow-hidden border border-border">
                {mediaFile?.type.startsWith("video/") ? (
                  <video src={mediaPreview} controls className="w-full max-h-80 object-cover" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="w-full max-h-80 object-cover" />
                )}
                <button
                  onClick={handleRemoveMedia}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Media button (not for poll) */}
        {postType !== "poll" && (
          <div className="flex items-center gap-2 px-1">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 text-primary border-border bg-card hover:bg-primary/10 hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              data-testid="btn-add-media"
            >
              <ImageIcon className="w-5 h-5" />
            </Button>
            {postType === "bulletin" && (
              <span className="text-xs text-muted-foreground">Bültene fotoğraf ekleyebilirsin</span>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
