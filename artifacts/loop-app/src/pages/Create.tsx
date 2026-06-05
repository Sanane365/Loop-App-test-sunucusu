import { useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, BarChart2, X } from "lucide-react";
import { useCreatePost } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

export default function Create() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
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

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile) return;

    try {
      setIsUploading(true);
      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        const formData = new FormData();
        formData.append("file", mediaFile);
        
        const res = await fetch("/api/posts/upload", {
          method: "POST",
          body: formData
        });
        
        if (!res.ok) throw new Error("Upload failed");
        
        const data = await res.json();
        mediaUrl = data.url;
        mediaType = mediaFile.type.startsWith("video/") ? "video" : "image";
      }

      createPost.mutate({
        data: { content, mediaUrl, mediaType }
      }, {
        onSuccess: () => {
          toast({ title: "Gönderi paylaşıldı!" });
          setLocation("/");
        },
        onError: () => {
          toast({ title: "Bir hata oluştu", variant: "destructive" });
        }
      });
    } catch (err) {
      toast({ title: "Yükleme hatası", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-20">
        <div className="flex items-center justify-between px-1">
          <h1 className="text-xl font-bold">Yeni Gönderi</h1>
          <Button 
            onClick={handleSubmit} 
            disabled={(!content.trim() && !mediaFile) || isUploading || createPost.isPending}
            className="rounded-full px-6 font-semibold shadow-md"
            data-testid="btn-create-post"
          >
            {isUploading ? "Yükleniyor..." : "Paylaş"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-4">
            <Textarea
              placeholder="Neler düşünüyorsun?"
              className="min-h-[120px] border-none focus-visible:ring-0 resize-none p-0 text-lg bg-transparent"
              value={content}
              onChange={e => setContent(e.target.value)}
              data-testid="textarea-create-content"
            />
            
            {mediaPreview && (
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

        <div className="flex items-center gap-2 px-1">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*,video/*" 
            className="hidden" 
          />
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full w-10 h-10 text-primary border-border bg-card hover:bg-primary/10 hover:text-primary"
            onClick={() => fileInputRef.current?.click()}
            data-testid="btn-add-media"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="rounded-full w-10 h-10 text-primary border-border bg-card hover:bg-primary/10 hover:text-primary"
            data-testid="btn-add-poll"
          >
            <BarChart2 className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
