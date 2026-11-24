import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Check, FileText, Feather, PenLine, UserPlus, Users, UserRoundPen } from "lucide-react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type ProfileStats = {
  id: number;
  username: string;
  displayName: string;
  bio?: string | null;
  authorBio?: string | null;
  avatarUrl?: string | null;
  followerCount?: number;
  followingCount?: number;
  storyCount?: number;
};

type Book = { authorId?: number; author?: { id: number } | null };

export default function BenimleIlgili() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileStats | null>(null);
  const [authorFollowerCount, setAuthorFollowerCount] = useState(0);
  const [authorFollowingCount, setAuthorFollowingCount] = useState(0);
  const [bookCount, setBookCount] = useState(0);
  const [feedCount, setFeedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [profileResponse, booksResponse, postsResponse, followersResponse, followingResponse] = await Promise.all([
        fetch("/api/users/me/profile"),
        fetch("/api/books"),
        fetch(`/api/posts?userId=${user.id}&postType=book`),
        fetch(`/api/users/${user.id}/followers`),
        fetch(`/api/users/${user.id}/following`),
      ]);
      if (!profileResponse.ok) throw new Error("Profil yüklenemedi");
      const nextProfile = await profileResponse.json() as ProfileStats;
      const books = await booksResponse.json() as Book[];
      const posts = await postsResponse.json() as unknown[];
      const followers = await followersResponse.json() as unknown[];
      const following = await followingResponse.json() as unknown[];
      setProfile(nextProfile);
      setDisplayName(nextProfile.displayName ?? "");
      setUsername(nextProfile.username ?? "");
      setBio(nextProfile.authorBio ?? "");
      setAuthorFollowerCount(Array.isArray(followers) ? followers.length : 0);
      setAuthorFollowingCount(Array.isArray(following) ? following.length : 0);
      setBookCount(Array.isArray(books) ? books.filter(book => book.authorId === user.id || book.author?.id === user.id).length : 0);
      setFeedCount(Array.isArray(posts) ? posts.length : 0);
    } catch {
      toast({ title: "Bilgiler yüklenemedi", description: "Profil verilerine ulaşılamadı.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [user?.id]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim() || !username.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), username: username.trim(), authorBio: bio.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profil kaydedilemedi");
      setProfile(data as ProfileStats);
      toast({ title: "Yazar kartın güncellendi" });
    } catch (error) {
      toast({ title: "Kaydedilemedi", description: error instanceof Error ? error.message : "Bir hata oluştu.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-24 pt-5 md:pb-10">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/notebook" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted" aria-label="Kitaplara dön">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Yazar alanı</p>
            <h1 className="text-2xl font-black tracking-tight">Benimle ilgili</h1>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/40 dark:via-background dark:to-sky-950/30">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-white shadow-md dark:border-slate-900">
              <AvatarImage src={profile?.avatarUrl ?? user.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-violet-200 text-xl font-black text-violet-700">{(profile?.displayName ?? user.displayName).slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-black">{profile?.displayName ?? user.displayName}</h2>
              <p className="truncate text-sm text-muted-foreground">@{profile?.username ?? user.username}</p>
              <p className="mt-1 text-xs text-muted-foreground">Yazar kartın ve kitap biyografin</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 border-t border-violet-200/60 pt-4 text-center dark:border-violet-900/50">
            <Stat label="Takipçi" value={authorFollowerCount} icon={<Users className="mx-auto mb-1 h-4 w-4" />} />
            <Stat label="Takip" value={authorFollowingCount} icon={<UserPlus className="mx-auto mb-1 h-4 w-4" />} />
            <Stat label="Hikaye" value={profile?.storyCount ?? 0} icon={<Feather className="mx-auto mb-1 h-4 w-4" />} />
            <Stat label="Kitap" value={bookCount} icon={<BookOpen className="mx-auto mb-1 h-4 w-4" />} />
          </div>
        </section>

        <section className="mt-5 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <UserRoundPen className="h-5 w-5 text-primary" />
            <div><h2 className="font-bold">Yazar kartını düzenle</h2><p className="text-xs text-muted-foreground">Kitaplar alanında görünecek bilgilerin</p></div>
          </div>
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-semibold">Görünen ad<Input value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
              <label className="space-y-1.5 text-sm font-semibold">Kullanıcı adı<Input value={username} onChange={event => setUsername(event.target.value)} /></label>
            </div>
            <label className="block space-y-1.5 text-sm font-semibold">Kitaplar alanı için bio<Textarea value={bio} onChange={event => setBio(event.target.value)} placeholder="Kendini ve yazdıklarını anlat..." maxLength={280} rows={4} /><span className="block text-right text-xs font-normal text-muted-foreground">{bio.length}/280</span></label>
            <Button type="submit" disabled={saving || loading} className="w-full sm:w-auto"><Check className="mr-2 h-4 w-4" />{saving ? "Kaydediliyor..." : "Değişiklikleri kaydet"}</Button>
          </form>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <Metric icon={<BookOpen className="h-5 w-5" />} label="Kitap akışı gönderisi" value={feedCount} />
          <Metric icon={<PenLine className="h-5 w-5" />} label="Toplam hikaye" value={profile?.storyCount ?? 0} />
        </section>
      </main>
    </AppLayout>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground">{icon}<strong className="block text-base text-foreground">{value.toLocaleString("tr-TR")}</strong><span>{label}</span></div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-3 rounded-2xl border bg-card p-4"><span className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</span><div><p className="text-2xl font-black">{value.toLocaleString("tr-TR")}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>;
}