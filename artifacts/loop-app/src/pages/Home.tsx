import { useState, useEffect } from "react";
import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StoryRow } from "@/components/shared/StoryRow";
import { PostCard } from "@/components/shared/PostCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, TrendingUp, MapPin, Leaf, Sparkles, SlidersHorizontal, Pencil, BarChart2, AlignLeft, Bot, Send, ChevronRight, MessageCircle, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type FilterType = "trend" | "takipte" | "yeni" | "bulten" | "sana-ozel" | "anonim-sorular";

const filters: { id: FilterType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "trend",         label: "Trend",           icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-primary"      },
  { id: "takipte",       label: "Takipte",          icon: <MapPin className="w-3.5 h-3.5" />,     color: "text-orange-500"   },
  { id: "yeni",          label: "Yeni",             icon: <Leaf className="w-3.5 h-3.5" />,        color: "text-green-500"    },
  { id: "bulten",        label: "Bülten",           icon: <Sparkles className="w-3.5 h-3.5" />,    color: "text-purple-500"   },
  { id: "sana-ozel",     label: "Sana Özel",        icon: <Sparkles className="w-3.5 h-3.5" />,    color: "text-blue-500"     },
  { id: "anonim-sorular",label: "Anonim Sorular",   icon: <Bot className="w-3.5 h-3.5" />,         color: "text-violet-500"   },
];

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("trend");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const { toast } = useToast();

  // ── Anonim Sorular ──
  const [publicQuestions, setPublicQuestions] = useState<any[]>([]);
  const [myQuestions, setMyQuestions]         = useState<any[]>([]);
  const [qLoading, setQLoading]               = useState(false);
  const [answeringId, setAnsweringId]         = useState<number | null>(null);
  const [answerText, setAnswerText]           = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  // Yorumlar
  const [openCommentsId, setOpenCommentsId]   = useState<number | null>(null);
  const [commentsByQ, setCommentsByQ]         = useState<Record<number, any[]>>({});
  const [newComment, setNewComment]           = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadComments = async (questionId: number) => {
    try {
      const r = await fetch(`/api/questions/${questionId}/comments`);
      const data = await r.json();
      setCommentsByQ(prev => ({ ...prev, [questionId]: Array.isArray(data) ? data : [] }));
    } catch { setCommentsByQ(prev => ({ ...prev, [questionId]: [] })); }
  };

  const toggleComments = async (questionId: number) => {
    if (openCommentsId === questionId) { setOpenCommentsId(null); return; }
    setOpenCommentsId(questionId);
    if (!commentsByQ[questionId]) await loadComments(questionId);
  };

  const submitComment = async (questionId: number) => {
    if (!newComment.trim()) return;
    setCommentSubmitting(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });
      if (r.ok) {
        setNewComment("");
        await loadComments(questionId);
      } else { toast({ title: "Hata", variant: "destructive" }); }
    } finally { setCommentSubmitting(false); }
  };

  const loadQuestions = async () => {
    setQLoading(true);
    try {
      const [pubRes, myRes] = await Promise.all([
        fetch("/api/questions/public"),
        fetch("/api/users/me/questions"),
      ]);
      const pubData = await pubRes.json();
      const myData  = await myRes.json();
      setPublicQuestions(Array.isArray(pubData) ? pubData : []);
      setMyQuestions(Array.isArray(myData) ? myData : []);
    } catch { /* sessiz */ }
    finally { setQLoading(false); }
  };

  useEffect(() => {
    if (activeFilter === "anonim-sorular") loadQuestions();
  }, [activeFilter]);

  const submitAnswer = async (questionId: number) => {
    if (!answerText.trim()) return;
    setSubmittingAnswer(true);
    try {
      const r = await fetch(`/api/questions/${questionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText }),
      });
      if (r.ok) {
        toast({ title: "Yanıtın yayınlandı 💜" });
        setAnsweringId(null);
        setAnswerText("");
        loadQuestions();
      } else {
        toast({ title: "Hata", variant: "destructive" });
      }
    } finally { setSubmittingAnswer(false); }
  };

  const { data: allPosts, isLoading } = useListPosts(undefined, {
    query: { queryKey: getListPostsQueryKey() }
  });

  const { data: bulletinPosts, isLoading: bulletinLoading } = useListPosts(
    { postType: "bulletin" },
    { query: { queryKey: getListPostsQueryKey({ postType: "bulletin" }), enabled: activeFilter === "bulten" } }
  );

  const posts = activeFilter === "bulten" ? bulletinPosts : allPosts;
  const loading = activeFilter === "bulten" ? bulletinLoading : isLoading;

  return (
    <div className="min-h-screen bg-secondary/50 pb-16">
      <Header />
      <main className="max-w-screen-md mx-auto min-h-[calc(100vh-3.5rem-4rem)]">
        <div className="pb-4">

          {/* Post creation bar */}
          <div className="bg-background border-b border-border px-4 py-3 flex items-center gap-3">
            <Link href="/profile/me" className="flex-shrink-0">
              <Avatar className="w-10 h-10 border border-border">
                <AvatarImage src={user?.avatarUrl || ""} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {user?.displayName?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
            </Link>
            <button className="flex-1 text-left" onClick={() => setTypePickerOpen(true)}>
              <div className="bg-muted/60 rounded-full px-4 py-2.5 text-sm text-muted-foreground">
                Neler paylaşmak istersin?
              </div>
            </button>
            <button onClick={() => setTypePickerOpen(true)}>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/30">
                <Plus className="w-5 h-5 text-primary-foreground" />
              </div>
            </button>
          </div>

          {/* Stories row */}
          <div className="bg-background border-b border-border">
            <StoryRow />
          </div>

          {/* Filter tabs */}
          <div className="bg-background border-b border-border px-4 py-2 flex items-center gap-2 overflow-x-auto hide-scrollbar">
            {filters.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all ${
                  activeFilter === f.id
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={activeFilter === f.id ? "text-primary" : f.color}>
                  {f.icon}
                </span>
                {f.label}
              </button>
            ))}
            <button className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground p-1.5">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* ── Anonim Sorular Feed ── */}
          {activeFilter === "anonim-sorular" ? (
            <div className="pt-2 px-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Anonim Sorular</p>
                    <p className="text-xs text-muted-foreground">Yanıtlanan sorular ve gelen kutunuz</p>
                  </div>
                </div>
              </div>

              {/* My inbox unanswered */}
              {myQuestions.filter((q: any) => !q.answer_text).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">📬 Sana Gelen</p>
                  <div className="space-y-2">
                    {myQuestions.filter((q: any) => !q.answer_text).map((q: any) => (
                      <div key={q.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                        {/* Top gradient bar */}
                        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400" />
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-3.5 h-3.5 text-violet-500" />
                            </div>
                            <span className="text-xs font-medium text-violet-500">Anonim Soru</span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {new Date(q.created_at).toLocaleDateString("tr-TR", { day:"numeric", month:"short" })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold leading-snug mb-3">"{q.question_text}"</p>

                          {answeringId === q.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={answerText}
                                onChange={e => setAnswerText(e.target.value)}
                                placeholder="Yanıtını yaz..."
                                className="resize-none rounded-2xl text-sm"
                                rows={3}
                                maxLength={500}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                                  className="flex-1 py-2 rounded-2xl border border-border text-xs font-semibold hover:bg-muted"
                                >
                                  İptal
                                </button>
                                <button
                                  onClick={() => submitAnswer(q.id)}
                                  disabled={!answerText.trim() || submittingAnswer}
                                  className="flex-1 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  {submittingAnswer ? "Gönderiliyor…" : "Yanıtla"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAnsweringId(q.id); setAnswerText(""); }}
                              className="w-full py-2.5 rounded-2xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Yanıtla
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Answered questions (mine + public) */}
              {(() => {
                const myAnswered = myQuestions.filter((q: any) => q.answer_text);
                // Merge: kendi yanıtladıkları + public feed (dedup by id)
                const ids = new Set(myAnswered.map((q: any) => q.id));
                const combined = [...myAnswered, ...publicQuestions.filter((q: any) => !ids.has(q.id))];
                combined.sort((a, b) => new Date(b.answered_at || b.created_at).getTime() - new Date(a.answered_at || a.created_at).getTime());
                if (combined.length === 0 && !qLoading) return null;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">💬 Yanıtlananlar</p>
                    <div className="space-y-3">
                      {qLoading ? (
                        Array(3).fill(0).map((_, i) => (
                          <div key={i} className="h-40 bg-muted animate-pulse rounded-3xl" />
                        ))
                      ) : combined.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">Henüz yanıtlanmış soru yok</p>
                      ) : combined.map((q: any) => (
                        <div key={q.id} className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
                          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-400 to-pink-400" />
                          <div className="p-4">
                            {/* Who it was asked to */}
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                                <Bot className="w-3 h-3 text-violet-500" />
                              </div>
                              <span className="text-xs text-muted-foreground">Anonim soru →</span>
                              <Link href={`/profile/${q.username}`} className="flex items-center gap-1.5 group">
                                {q.avatar_url ? (
                                  <img src={q.avatar_url} className="w-5 h-5 rounded-full object-cover border border-border" alt={q.display_name} />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                                    {q.display_name?.charAt(0)}
                                  </div>
                                )}
                                <span className="text-xs font-semibold group-hover:text-primary transition-colors">{q.display_name}</span>
                              </Link>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {q.answered_at ? new Date(q.answered_at).toLocaleDateString("tr-TR", { day:"numeric", month:"short" }) : ""}
                              </span>
                            </div>

                            {/* Question */}
                            <div className="bg-muted/50 rounded-2xl px-3.5 py-2.5 mb-2">
                              <p className="text-sm font-medium leading-snug">"{q.question_text}"</p>
                            </div>

                            {/* Answer */}
                            <div className="flex gap-2 items-start mb-2">
                              <div className="flex-shrink-0 mt-0.5">
                                {q.avatar_url ? (
                                  <img src={q.avatar_url} className="w-6 h-6 rounded-full object-cover border border-border" alt={q.display_name} />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {q.display_name?.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 bg-primary/5 border border-primary/10 rounded-2xl px-3 py-2">
                                <p className="text-xs font-semibold text-primary mb-0.5">{q.display_name}</p>
                                <p className="text-sm leading-snug">{q.answer_text}</p>
                              </div>
                            </div>

                            {/* Yorum butonu */}
                            <button
                              onClick={() => toggleComments(q.id)}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-8 mt-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {commentsByQ[q.id]?.length
                                ? `${commentsByQ[q.id].length} yorum`
                                : "Yorum yap"}
                              {openCommentsId === q.id && <span className="text-[10px]">▲</span>}
                              {openCommentsId !== q.id && <span className="text-[10px]">▼</span>}
                            </button>

                            {/* Yorum bölümü */}
                            {openCommentsId === q.id && (
                              <div className="mt-3 ml-8 space-y-2">
                                {/* Mevcut yorumlar */}
                                {(commentsByQ[q.id] || []).map((c: any) => (
                                  <div key={c.id} className="flex gap-2 items-start">
                                    <div className="w-5 h-5 rounded-full bg-muted flex-shrink-0 overflow-hidden mt-0.5">
                                      {c.avatar_url
                                        ? <img src={c.avatar_url} className="w-full h-full object-cover" alt={c.display_name} />
                                        : <span className="w-full h-full flex items-center justify-center text-[8px] font-bold">{c.display_name?.charAt(0)}</span>}
                                    </div>
                                    <div className="flex-1 bg-muted/60 rounded-xl px-2.5 py-1.5">
                                      <p className="text-[10px] font-semibold mb-0.5">{c.display_name}</p>
                                      <p className="text-xs leading-snug">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                                {/* Yeni yorum input */}
                                <div className="flex gap-2 items-center">
                                  <input
                                    value={newComment}
                                    onChange={e => setNewComment(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(q.id); } }}
                                    placeholder="Yorum yaz…"
                                    className="flex-1 px-3 py-1.5 rounded-full bg-muted/60 text-xs border border-transparent focus:border-primary/30 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => submitComment(q.id)}
                                    disabled={!newComment.trim() || commentSubmitting}
                                    className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                                  >
                                    <Send className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Empty state */}
              {!qLoading && myQuestions.length === 0 && publicQuestions.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-3xl bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-8 h-8 text-violet-500" />
                  </div>
                  <p className="font-bold text-base mb-1">Henüz soru yok</p>
                  <p className="text-sm text-muted-foreground">Profiline anonim soru gönderilince burada görünür</p>
                </div>
              )}
            </div>
          ) : (
            /* ── Normal Posts Feed ── */
            <div className="pt-3">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="mx-4 mb-4 h-80 bg-card animate-pulse rounded-2xl border border-border" />
                ))
              ) : posts?.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <p className="font-medium">Henüz gönderi yok</p>
                  {activeFilter === "bulten" && (
                    <p className="text-sm mt-1">İlk bülten gönderisini paylaş!</p>
                  )}
                </div>
              ) : (
                posts?.map(post => (
                  <PostCard key={post.id} post={post} />
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bülten FAB */}
      {activeFilter === "bulten" && (
        <button
          onClick={() => setLocation("/create?type=bulletin")}
          className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-purple-600 text-white shadow-xl flex items-center justify-center z-40 hover:bg-purple-700 transition-colors active:scale-95"
        >
          <Pencil className="w-6 h-6" />
        </button>
      )}

      {/* Type picker modal */}
      <Dialog open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <DialogContent className="max-w-xs rounded-3xl p-0 overflow-hidden">
          <div className="px-4 py-5">
            <h2 className="text-base font-bold mb-4 text-center">Ne paylaşmak istersin?</h2>
            <div className="space-y-2">
              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <AlignLeft className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Gönderi</p>
                  <p className="text-xs text-muted-foreground">Fotoğraf, video veya metin paylaş</p>
                </div>
              </button>

              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create?type=bulletin"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Bülten</p>
                  <p className="text-xs text-muted-foreground">Twitter tarzı kısa metin & fotoğraf</p>
                </div>
              </button>

              <button
                onClick={() => { setTypePickerOpen(false); setLocation("/create?type=poll"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-muted hover:bg-muted/80 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <BarChart2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Anket</p>
                  <p className="text-xs text-muted-foreground">Seçeneklerle oylama başlat</p>
                </div>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
