import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, BookOpen, Eye, Hash, Clock, ChevronDown, ChevronUp,
  List, Play, Pause, Bookmark, Heart, Share2, ChevronRight, Star, X, Volume2, VolumeX, MessageCircle, Send, Plus, ImagePlus, Smile, Search,
} from "lucide-react";
import { getDraft, type Draft, type DraftChapter } from "@/lib/draftStore";
import { useAuth } from "@/lib/auth";
import GifPicker from "@/components/shared/GifPicker";

const READING_PROGRESS_KEY = "loop_reading_progress_v3";
const LIBRARY_SAVED_KEY = "loop_library_saved_v1";
const LIBRARY_LIKED_KEY = "loop_library_liked_v1";
const BOOK_COMMENTS_KEY = "loop_book_comments_v1";

type LibraryEntry = { id: string; savedAt: string; book: Record<string, unknown> };
type BookPoll = { question: string; options: string[]; votes: number[]; voted?: number | null };
type BookComment = { id: string; bookId: string; userId?: number; text: string; author: string; createdAt: string; likes?: number; liked?: boolean; mediaUrl?: string; replyToId?: string; poll?: BookPoll };

function readLibraryEntries(key: string): LibraryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function writeLibraryEntries(key: string, entries: LibraryEntry[]) {
  localStorage.setItem(key, JSON.stringify(entries));
  window.dispatchEvent(new Event("loop-library-updated"));
}

function readBookComments(bookId: string): BookComment[] {
  try {
    const all = JSON.parse(localStorage.getItem(BOOK_COMMENTS_KEY) || "{}");
    return Array.isArray(all?.[bookId]) ? all[bookId] : [];
  } catch { return []; }
}

function writeBookComments(bookId: string, comments: BookComment[]) {
  const all = (() => {
    try { return JSON.parse(localStorage.getItem(BOOK_COMMENTS_KEY) || "{}"); } catch { return {}; }
  })();
  all[bookId] = comments;
  localStorage.setItem(BOOK_COMMENTS_KEY, JSON.stringify(all));
}

function libraryBookSnapshot(book: Draft): Record<string, unknown> {
  const authorBook = book as Draft & { author?: string; authorId?: number };
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    cover: book.cover,
    author: authorBook.author,
    authorId: authorBook.authorId,
    genres: book.genres,
    wordCount: book.wordCount,
    synopsis: book.synopsis,
    updatedAt: book.updatedAt,
  };
}

function normalizeMediaUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (url.startsWith("data:image/")) return url.replace(/\s+/g, "");
  return url;
}

const THEMES: Record<string, { bg: string; text: string; page: string }> = {
  dark:   { bg: "#0a0814", text: "#e2e8f0", page: "#120e20" },
  light:  { bg: "#f8f7f4", text: "#1a1a2e", page: "#ffffff" },
  sepia:  { bg: "#2d1f0a", text: "#f5e6cc", page: "#1e1508" },
  forest: { bg: "#0a1a0f", text: "#d4ead9", page: "#0d2013" },
};
const FONT_FAMILIES: Record<string, string> = {
  serif:   "Georgia, serif",
  sans:    "system-ui, sans-serif",
  mono:    "'Courier New', monospace",
  elegant: "'Palatino Linotype', serif",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "az önce";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function TrailerVideo({ src, autoPlay = false }: { src: string; autoPlay?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <div className="group/player relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl">
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        muted={muted}
        playsInline
        preload="auto"
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={() => {
          togglePlayback();
          setControlsVisible(false);
        }}
        className="max-h-[78vh] w-full cursor-pointer object-contain"
      />
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-3 pt-10 transition-opacity ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={event => {
            const nextTime = Number(event.target.value);
            if (videoRef.current) videoRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          aria-label="Fragman ilerlemesi"
          className="mb-2 h-1 w-full cursor-pointer accent-violet-400"
        />
        <div className="flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Duraklat" : "Oynat"} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
            {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          </button>
          <span className="text-[10px] tabular-nums text-white/75">{formatVideoTime(currentTime)} / {formatVideoTime(duration)}</span>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bölüm listesi görünümü ─────────────────────────────────────────── */
function ChapterList({
  chapters,
  onSelect,
}: {
  chapters: DraftChapter[];
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-4">
        {chapters.length} Bölüm
      </p>
      <div className="space-y-2">
        {chapters.map((ch, i) => {
          const wordCount = ch.blocks
            .filter(b => b.type === "text")
            .reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0);
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelect(i)}
              className="flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
            >
              {/* Numara */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-[13px]"
                style={{ background: "rgba(109,40,217,0.18)", color: "#a78bfa" }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[13px] font-bold text-white">{ch.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{wordCount} kelime</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Okuma görünümü ──────────────────────────────────────────────────── */
function Reader({
  book,
  chapterIdx,
  onBack,
  onNextChapter,
  onPrevChapter,
}: {
  book: Draft;
  chapterIdx: number;
  onBack: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
}) {
  const theme = THEMES[book.themeId] ?? THEMES.dark;
  const fontFamily = FONT_FAMILIES[book.fontId] ?? FONT_FAMILIES.sans;
  const fontSize = book.fontSize ?? 16;
  const chapter = book.chapters[chapterIdx];
  const contentRef = useRef<HTMLDivElement>(null);

  const saveProgress = (chapterFraction = 0) => {
    if (!book.id || book.chapters.length === 0) return;
    try {
      const stored = JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) || "{}") as Record<string, number>;
      const progress = Math.min(100, Math.round(((chapterIdx + chapterFraction) / book.chapters.length) * 100));
      stored[book.id] = Math.max(stored[book.id] ?? 0, progress);
      localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(stored));
      window.dispatchEvent(new CustomEvent("loop-reading-progress"));
    } catch {
      // Reading progress should never block the reader.
    }
  };

  useEffect(() => {
    saveProgress();
  }, [book.id, book.chapters.length, chapterIdx]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: theme.bg }}>
      {/* Reader header */}
      <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: theme.bg }}>
        <button type="button" onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.07)", color: theme.text }}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0 text-center">
          <p className="truncate text-[12px] font-bold" style={{ color: theme.text }}>
            {chapter.title}
          </p>
          <p className="text-[10px]" style={{ color: `${theme.text}60` }}>
            {chapterIdx + 1} / {book.chapters.length}
          </p>
        </div>
        <div className="w-9" />
      </div>

      {/* İçerik */}
      <div
        ref={contentRef}
        onScroll={() => {
          const content = contentRef.current;
          if (!content) return;
          const scrollableHeight = content.scrollHeight - content.clientHeight;
          const chapterFraction = scrollableHeight > 0
            ? Math.min(1, Math.max(0, content.scrollTop / scrollableHeight))
            : 0;
          saveProgress(chapterFraction);
        }}
        className="flex-1 overflow-y-auto px-5 pb-32 pt-6"
      >
        {chapter.blocks.map(block => {
          if (block.type === "text") {
            return (
              <p key={block.id}
                className="mb-5 leading-loose"
                style={{ fontFamily, fontSize, color: theme.text, lineHeight: 1.85 }}
              >
                {block.content || <span style={{ color: `${theme.text}30` }}>(boş paragraf)</span>}
              </p>
            );
          }
          if (block.type === "image" && block.content) {
            return (
              <div key={block.id} className="mb-5 rounded-2xl overflow-hidden">
                <img src={block.content} alt="" className="w-full object-cover" />
              </div>
            );
          }
          if (block.type === "video" && block.content) {
            return (
              <div key={block.id} className="mb-5 rounded-2xl overflow-hidden">
                <video src={block.content} controls className="w-full" />
              </div>
            );
          }
          if (block.type === "poll") {
            return (
              <div key={block.id}
                className="mb-5 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
                <p className="text-[13px] font-bold text-violet-200 mb-3">
                  📊 {block.pollQuestion || "Anket"}
                </p>
                <div className="space-y-2">
                  {(block.pollOptions ?? []).map(opt => (
                    <div key={opt.id}
                      className="rounded-xl bg-white/8 px-3 py-2.5 text-[12px] text-violet-200">
                      {opt.text || "—"}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Alt nav — bölümler arası */}
      <div className="fixed bottom-0 inset-x-0 border-t px-4 pb-8 pt-3"
        style={{ background: theme.bg, borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPrevChapter}
            disabled={chapterIdx === 0}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold border transition-all disabled:opacity-25"
            style={{ borderColor: "rgba(167,139,250,0.4)", color: "#a78bfa" }}
          >
            ← Önceki
          </button>
          <button
            type="button"
            onClick={onNextChapter}
            disabled={chapterIdx === book.chapters.length - 1}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold transition-all disabled:opacity-25"
            style={{ background: "rgba(109,40,217,0.7)", color: "#fff" }}
          >
            Sonraki →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Ana bileşen ─────────────────────────────────────────────────────── */
export default function KitapDetay() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [book, setBook] = useState<Draft | null>(null);
  const [view, setView] = useState<"detail" | "chapters" | "read">("detail");
  const [activeChap, setActiveChap] = useState(0);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [ratingAverage, setRatingAverage] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ type: "image" | "video"; src: string; label: string } | null>(null);
  const [shareState, setShareState] = useState("Paylaş");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareContacts, setShareContacts] = useState<Array<{ id: number; displayName?: string; username?: string; avatarUrl?: string }>>([]);
  const [shareSearch, setShareSearch] = useState("");
  const [shareSending, setShareSending] = useState<number | null>(null);
  const [shareSent, setShareSent] = useState<Set<number>>(new Set());
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<BookComment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [commentMediaUrl, setCommentMediaUrl] = useState<string | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [gifPanelOpen, setGifPanelOpen] = useState(false);
  const commentMediaRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (id) {
      const d = getDraft(id);
      if (d) setBook({ ...d, cover: normalizeMediaUrl(d.cover) || null });
      fetch(`/api/books/${id}`, { credentials: "include", cache: "no-store" })
        .then(response => response.ok ? response.json() : null)
        .then(remote => {
          if (!remote) return;
          setBook({ ...(remote as Draft), cover: normalizeMediaUrl(remote.cover) || null });
          setViewCount(remote.viewCount ?? 0);
        })
        .catch(() => {});
      fetch(`/api/books/${id}/rating`, { credentials: "include", cache: "no-store" })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (!data) return;
          setRatingAverage(data.average ?? 0);
          setRatingCount(data.count ?? 0);
          setUserRating(data.userRating ?? null);
          setLikeCount(data.likeCount ?? 0);
          setLiked(Boolean(data.userLiked));
        })
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setBookmarked(readLibraryEntries(LIBRARY_SAVED_KEY).some(entry => entry.id === id));
    setComments(readBookComments(id));
    void (async () => {
      try {
        let response = await fetch(`/api/books/${id}/comments`, { credentials: "include", cache: "no-store" });
        let data = response.ok ? await response.json() : null;
        const localPolls = readBookComments(id).filter(comment => comment.poll);
        for (const localPoll of localPolls) {
          if (Array.isArray(data) && data.some((comment: BookComment) => comment.poll?.question === localPoll.poll?.question)) continue;
          await fetch(`/api/books/${id}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ poll: localPoll.poll }),
          });
        }
        if (localPolls.length > 0) {
          response = await fetch(`/api/books/${id}/comments`, { credentials: "include", cache: "no-store" });
          data = response.ok ? await response.json() : data;
        }
        if (Array.isArray(data)) setComments(data);
      } catch { /* local comments remain visible */ }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !commentsOpen) return;
    const refreshComments = () => fetch(`/api/books/${id}/comments`, { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (Array.isArray(data)) setComments(data); })
      .catch(() => {});
    const interval = window.setInterval(refreshComments, 4000);
    return () => window.clearInterval(interval);
  }, [id, commentsOpen]);

  const submitRating = async (value: number) => {
    if (!id || !user || ratingBusy) return;
    setRatingBusy(true);
    try {
      const response = await fetch(`/api/books/${id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating: value }),
      });
      if (!response.ok) return;
      const data = await response.json();
      setRatingAverage(data.average ?? 0);
      setRatingCount(data.count ?? 0);
      setUserRating(data.userRating ?? value);
    } finally {
      setRatingBusy(false);
    }
  };

  const toggleLike = async () => {
    if (!id || !user) return;
    const response = await fetch(`/api/books/${id}/like`, { method: "POST", credentials: "include" });
    if (!response.ok) return;
    const data = await response.json();
    setLiked(Boolean(data.userLiked));
    setLikeCount(data.likeCount ?? 0);
    const entries = readLibraryEntries(LIBRARY_LIKED_KEY).filter(entry => entry.id !== id);
    if (data.userLiked && book) entries.unshift({ id, savedAt: new Date().toISOString(), book: libraryBookSnapshot(book) });
    writeLibraryEntries(LIBRARY_LIKED_KEY, entries);
  };

  const toggleBookmark = () => {
    if (!book || !id) return;
    const next = !bookmarked;
    setBookmarked(next);
    const entries = readLibraryEntries(LIBRARY_SAVED_KEY).filter(entry => entry.id !== id);
    if (next) entries.unshift({ id, savedAt: new Date().toISOString(), book: libraryBookSnapshot(book) });
    writeLibraryEntries(LIBRARY_SAVED_KEY, entries);
  };

  const shareBook = async () => {
    setShareOpen(true);
    setShareSearch("");
    setShareSent(new Set());
    fetch("/api/dm/conversations", { credentials: "include", cache: "no-store" })
      .then(response => response.ok ? response.json() : [])
      .then(data => setShareContacts(Array.isArray(data) ? data.map((conversation: any) => conversation.user).filter(Boolean) : []))
      .catch(() => setShareContacts([]));
  };

  const sendBookToContact = async (contact: { id: number; displayName?: string }) => {
    if (!id || shareSending === contact.id || shareSent.has(contact.id)) return;
    setShareSending(contact.id);
    try {
      const response = await fetch(`/api/dm/${contact.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `__LOOP_BOOK_SHARE__:${id}:${book?.title || "Loop kitabı"}` }),
      });
      if (response.ok) setShareSent(current => new Set(current).add(contact.id));
    } finally { setShareSending(null); }
  };

  const addComment = async () => {
    if (!id || !commentText.trim()) return;
    const text = commentText.trim().slice(0, 500);
    try {
      const response = await fetch(`/api/books/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text, mediaUrl: commentMediaUrl || undefined, replyToId: replyingToId || undefined }),
      });
      if (response.ok) {
        const created = await response.json() as BookComment;
        const next = [created, ...comments];
        setComments(next);
        writeBookComments(id, next);
        setCommentText("");
        setReplyingToId(null);
        setCommentMediaUrl(null);
        return;
      }
    } catch { /* local fallback below */ }
    const comment: BookComment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      bookId: id,
      text,
      author: user?.displayName || user?.username || "Loop okuru",
      createdAt: new Date().toISOString(),
      likes: 0,
      mediaUrl: commentMediaUrl || undefined,
      replyToId: replyingToId || undefined,
    };
    const next = [comment, ...comments];
    writeBookComments(id, next);
    setComments(next);
    setCommentText("");
    setReplyingToId(null);
    setCommentMediaUrl(null);
  };

  const handleCommentPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCommentMediaUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/books/${id}/comments/${commentId}/like`, { method: "POST", credentials: "include" });
      if (response.ok) {
        const result = await response.json() as { liked: boolean; likes: number };
        setComments(current => current.map(comment => comment.id === commentId ? { ...comment, liked: result.liked, likes: result.likes } : comment));
        return;
      }
    } catch { /* local fallback below */ }
    const next = comments.map(comment => comment.id === commentId ? { ...comment, liked: !comment.liked, likes: Math.max(0, (comment.likes ?? 0) + (comment.liked ? -1 : 1)) } : comment);
    writeBookComments(id, next);
    setComments(next);
  };

  const addPoll = async () => {
    if (!id || !pollQuestion.trim() || pollOptions.some(option => !option.trim())) return;
    const poll: BookPoll = { question: pollQuestion.trim(), options: pollOptions.map(option => option.trim()), votes: pollOptions.map(() => 0) };
    try {
      const response = await fetch(`/api/books/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ poll }),
      });
      if (response.ok) {
        const created = await response.json() as BookComment;
        setComments(current => [created, ...current]);
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollOpen(false);
        return;
      }
    } catch { /* local fallback below */ }
    const comment: BookComment = { id: `${Date.now()}-poll`, bookId: id, text: "", author: user?.displayName || user?.username || "İçerik üreticisi", createdAt: new Date().toISOString(), poll };
    const next = [comment, ...comments];
    writeBookComments(id, next);
    setComments(next);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollOpen(false);
  };

  const votePoll = async (commentId: string, optionIndex: number) => {
    if (!id) return;
    try {
      const response = await fetch(`/api/books/${id}/comments/${commentId}/poll-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ optionIndex }),
      });
      if (response.ok) {
        const result = await response.json() as { votes: number[]; voted: number };
        setComments(current => current.map(comment => comment.id === commentId && comment.poll ? { ...comment, poll: { ...comment.poll, votes: result.votes, voted: result.voted } } : comment));
        return;
      }
    } catch { /* local fallback below */ }
    const next = comments.map(comment => {
      if (comment.id !== commentId || !comment.poll || comment.poll.voted !== undefined) return comment;
      const votes = [...comment.poll.votes];
      votes[optionIndex] = (votes[optionIndex] ?? 0) + 1;
      return { ...comment, poll: { ...comment.poll, votes, voted: optionIndex } };
    });
    if (id) writeBookComments(id, next);
    setComments(next);
  };

  const renderBookComment = (comment: BookComment, isReply = false) => (
    <article key={comment.id} className={`rounded-2xl border border-white/8 bg-white/[0.03] p-3 ${isReply ? "ml-5 border-l-violet-400/40" : ""}`}>
      <div className="flex items-center justify-between"><div><p className="text-[11px] font-bold text-slate-200">{comment.author}</p><time className="text-[9px] text-slate-600">{timeAgo(comment.createdAt)}</time></div><button type="button" onClick={() => toggleCommentLike(comment.id)} className={`flex items-center gap-1 text-[10px] ${comment.liked ? "text-rose-400" : "text-slate-500"}`}><Heart className={`h-3.5 w-3.5 ${comment.liked ? "fill-current" : ""}`} /> {comment.likes ?? 0}</button></div>
      {comment.replyToId && <p className="mt-1 text-[10px] text-violet-300">Bir yoruma yanıt</p>}
      {comment.text && <p className="mt-2 text-[12px] leading-relaxed text-slate-300">{comment.text}</p>}
      {comment.mediaUrl && <img src={comment.mediaUrl} alt="Yorum görseli" className="mt-2 max-h-40 max-w-full rounded-xl object-cover" />}
      {comment.poll && (() => { const poll = comment.poll as BookPoll; return <div className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-3"><p className="text-xs font-bold text-violet-100">{poll.question}</p><div className="mt-2 space-y-2">{poll.options.map((option, index) => <button key={option} type="button" onClick={() => votePoll(comment.id, index)} className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-left text-[11px] text-slate-200"><span>{option}</span><span className="text-[10px] text-violet-200">{poll.votes[index] ?? 0}</span></button>)}</div></div>; })()}
      {!comment.poll && <button type="button" onClick={() => { setReplyingToId(comment.id); setCommentText(`@${comment.author} `); }} className="mt-2 text-[10px] font-semibold text-slate-500 hover:text-violet-300">Yanıtla</button>}
    </article>
  );

  if (!book) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#07050f" }}>
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-violet-400/40 mx-auto mb-3" />
          <p className="text-white font-bold">Kitap bulunamadı</p>
          <button onClick={() => setLocation("/kitaplar")}
            className="mt-4 rounded-xl bg-violet-500/20 px-4 py-2 text-violet-300 text-[13px] font-bold">
            Kitaplara Dön
          </button>
        </div>
      </div>
    );
  }

  const theme = THEMES[book.themeId] ?? THEMES.dark;
  const wordCount = book.wordCount;
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const trailers = (book.trailers ?? []).filter((src): src is string => Boolean(src));
  const gallery = [
    ...((book as Draft & { gallery?: Array<{ url?: string } | string> }).gallery ?? []).map(item =>
      typeof item === "string" ? item : item.url ?? "",
    ),
    ...(book.favoriteImages ?? []).filter((src): src is string => Boolean(src)),
  ].filter(Boolean);
  const bookAuthorId = (book as Draft & { authorId?: number }).authorId;
  const isBookAuthor = Boolean(user?.id && bookAuthorId && user.id === bookAuthorId);

  /* Okuma görünümü */
  if (view === "read") {
    return (
      <Reader
        book={book}
        chapterIdx={activeChap}
        onBack={() => setView("chapters")}
        onNextChapter={() => setActiveChap(p => Math.min(p + 1, book.chapters.length - 1))}
        onPrevChapter={() => setActiveChap(p => Math.max(p - 1, 0))}
      />
    );
  }

  /* Bölüm listesi görünümü */
  if (view === "chapters") {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: "#07050f" }}>
        <div className="shrink-0 flex items-center gap-3 px-4 pt-12 pb-3 border-b border-white/8">
          <button type="button" onClick={() => setView("detail")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-violet-300">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="flex-1 text-center text-[15px] font-black text-white">Bölümler</p>
          <div className="w-9" />
        </div>
        <ChapterList
          chapters={book.chapters}
          onSelect={i => { setActiveChap(i); setView("read"); }}
        />
      </div>
    );
  }

  /* Detay görünümü (varsayılan) */
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f" }}>
      {/* Hero kapak */}
      <div className="relative shrink-0" style={{ height: 300 }}>
        {/* Bulanık arka plan */}
        {book.cover && (
          <img src={book.cover} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "blur(20px) brightness(0.35)", transform: "scale(1.1)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-[#07050f]" />

        {/* Geri */}
        <button type="button" onClick={() => setLocation("/kitaplar")}
          className="absolute top-12 left-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Aksiyonlar */}
        <div className="absolute top-12 right-4 flex gap-2">
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            aria-label="Yorumlara git"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            {comments.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-violet-500 px-1 text-center text-[9px] font-black text-white">{comments.length}</span>}
          </button>
          <button type="button" onClick={toggleBookmark}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${bookmarked ? "bg-amber-500/30 text-amber-400" : "bg-black/40 text-white"}`}>
            <Bookmark className={`h-4.5 w-4.5 ${bookmarked ? "fill-amber-400" : ""}`} />
          </button>
          <button type="button" onClick={shareBook} aria-label={shareState}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white">
            <Share2 className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Kapak + başlık */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-4 items-end">
          <div className="shrink-0 overflow-hidden rounded-2xl shadow-2xl border border-white/15"
            style={{ width: 88, height: 130, background: "rgba(109,40,217,0.3)" }}>
            {book.cover
              ? <img src={book.cover} alt="" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center"><BookOpen className="h-8 w-8 text-violet-400/50" /></div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[20px] font-black text-white leading-tight">{book.title || "Başlıksız"}</p>
            {book.subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{book.subtitle}</p>}
            <div className="flex flex-wrap gap-1 mt-2">
              {book.genres?.map(g => (
                <span key={g} className="rounded-full bg-violet-500/25 px-2 py-0.5 text-[10px] font-bold text-violet-300">{g}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto px-4 pb-32 pt-3">
        {/* Meta çubuk */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 mb-5 border-b border-white/8 pb-4">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />{book.chapters?.length ?? 0} bölüm
          </span>
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />{wordCount.toLocaleString("tr")} kelime
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />~{readMinutes} dk
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />{viewCount.toLocaleString("tr-TR")} görüntülenme
          </span>
          <span className="ml-auto text-[10px]">
            Durum: {book.status === "published" ? "Yayında" : "Taslak"}
          </span>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300/80">Kitap Puanı</p>
              <p className="mt-1 text-2xl font-black text-white">{ratingAverage > 0 ? ratingAverage.toFixed(1) : "—"}<span className="text-sm text-slate-500"> / 10</span></p>
              <p className="text-[10px] text-slate-500">{ratingCount} değerlendirme · {likeCount} beğeni · {viewCount} görüntülenme</p>
            </div>
            <div className="flex max-w-[190px] flex-wrap justify-end gap-1">
              {Array.from({ length: 10 }, (_, index) => index + 1).map(value => (
                <button
                  key={value}
                  type="button"
                  disabled={!user || ratingBusy}
                  onClick={() => submitRating(value)}
                  aria-label={`${value} puan ver`}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-black transition ${userRating === value ? "bg-amber-400 text-amber-950" : "bg-white/8 text-slate-400 hover:bg-amber-400/20 hover:text-amber-200"} disabled:cursor-not-allowed disabled:opacity-50`}
                >{value}</button>
              ))}
            </div>
          </div>
          {!user && <p className="mt-2 text-[10px] text-slate-500">Puan vermek için giriş yapmalısın.</p>}
        </div>

        {/* Özet */}
        {book.synopsis && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Özet</p>
            <div
              className="text-[13px] leading-relaxed text-slate-300 overflow-hidden transition-all"
              style={{ maxHeight: synopsisOpen ? 9999 : 80 }}
            >
              {book.synopsis}
            </div>
            {book.synopsis.length > 180 && (
              <button type="button" onClick={() => setSynopsisOpen(v => !v)}
                className="mt-1 flex items-center gap-1 text-[11px] text-violet-400 font-semibold">
                {synopsisOpen ? <><ChevronUp className="h-3.5 w-3.5" />Kapat</> : <><ChevronDown className="h-3.5 w-3.5" />Devamını Oku</>}
              </button>
            )}
          </div>
        )}

        {(trailers.length > 0 || gallery.length > 0) && (
          <section className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-400/70">Özel içerik</p>
                <h3 className="mt-1 text-sm font-black text-white">Fragman ve görseller</h3>
              </div>
              <span className="text-right text-[10px] text-slate-500">Büyütmek için seç</span>
            </div>
            {trailers.length > 0 && (
              <button
                type="button"
                onClick={() => setMediaViewer({ type: "video", src: trailers[0], label: `${book.title} ana fragman` })}
                className="group relative mb-2 block aspect-video w-full overflow-hidden rounded-xl border border-violet-400/25 bg-black text-left shadow-[0_14px_40px_rgba(0,0,0,0.3)]"
                aria-label={`${book.title} ana fragmanını büyüt`}
              >
                <video src={trailers[0]} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.02] group-hover:opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
                <span className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] font-bold text-white"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-violet-700 shadow-lg"><Play className="h-3.5 w-3.5 fill-current" /></span>Ana fragmanı izle</span>
                <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/40 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">Fragman</span>
              </button>
            )}
            <div className="grid grid-cols-3 gap-2">
              {trailers.slice(1).map((src, index) => (
                <button
                  key={`trailer-${src}-${index + 1}`}
                  type="button"
                  onClick={() => setMediaViewer({ type: "video", src, label: `${book.title} fragman ${index + 2}` })}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-violet-400/15 bg-black text-left"
                  aria-label={`${book.title} fragman ${index + 2} büyüt`}
                >
                  <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white/80">Fragman {index + 2}</span>
                </button>
              ))}
              {gallery.map((src, index) => (
                <button
                  key={`gallery-${src}-${index}`}
                  type="button"
                  onClick={() => setMediaViewer({ type: "image", src, label: `${book.title} görsel ${index + 1}` })}
                  className="group aspect-video overflow-hidden rounded-lg border border-white/10 bg-white/5"
                  aria-label={`${book.title} görsel ${index + 1} büyüt`}
                >
                  <img src={src} alt={`${book.title} görsel ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* İlk bölüme göz at */}
        {book.chapters.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70 mb-2">Bölüm Önizlemesi</p>
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 overflow-hidden" style={{ maxHeight: 120 }}>
              {book.chapters[0].blocks
                .filter(b => b.type === "text" && b.content)
                .slice(0, 2)
                .map(b => (
                  <p key={b.id} className="text-[12px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{b.content}</p>
                ))
              }
              {book.chapters[0].blocks.filter(b => b.type === "text" && b.content).length === 0 && (
                <p className="text-[12px] text-slate-600">İçerik henüz eklenmemiş.</p>
              )}
            </div>
          </div>
        )}

        {/* Bölümler listesi (küçük önizleme) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400/70">Bölümler</p>
            <button type="button" onClick={() => setView("chapters")}
              className="text-[11px] text-violet-400 font-semibold flex items-center gap-1">
              Tümü <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1.5">
            {book.chapters.slice(0, 3).map((ch, i) => (
              <button key={ch.id} type="button"
                onClick={() => { setActiveChap(i); setView("read"); }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left">
                <span className="text-[11px] font-black text-violet-400/70 w-5">{i + 1}</span>
                <span className="flex-1 text-[12px] font-bold text-white truncate">{ch.title}</span>
                <Play className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              </button>
            ))}
            {book.chapters.length > 3 && (
              <button type="button" onClick={() => setView("chapters")}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-2.5 text-[12px] text-slate-500">
                <List className="h-3.5 w-3.5" /> +{book.chapters.length - 3} bölüm daha
              </button>
            )}
          </div>
        </div>
      </div>

      {commentsOpen && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/55" onClick={() => setCommentsOpen(false)}>
          <section className="max-h-[88vh] w-full overflow-hidden rounded-t-[28px] bg-[#110d1d] text-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex justify-center pb-1 pt-2"><div className="h-1 w-9 rounded-full bg-white/25" /></div>
            <header className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-1">
              <button type="button" onClick={() => setCommentsOpen(false)} aria-label="Yorumları kapat" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
              <div className="text-center"><p className="text-[15px] font-bold">Yorumlar</p><p className="text-[12px] text-slate-500">{comments.length} yorum</p></div>
              {isBookAuthor ? <button type="button" onClick={() => setPollOpen(value => !value)} aria-label="Anket oluştur" className="flex h-8 w-8 items-center justify-center rounded-full text-violet-300 hover:bg-white/10">📊</button> : <span className="w-8" />}
            </header>
            <div className="max-h-[62vh] space-y-3 overflow-y-auto px-4 py-4">
              {isBookAuthor && pollOpen && (
                <div className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3">
                  <p className="text-xs font-bold text-violet-200">Okurlara anket sor</p>
                  <input value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} placeholder="Sorunu yaz..." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none" />
                  {pollOptions.map((option, index) => <input key={index} value={option} onChange={event => setPollOptions(values => values.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} placeholder={`Seçenek ${index + 1}`} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none" />)}
                  <button type="button" onClick={addPoll} disabled={!pollQuestion.trim() || pollOptions.some(option => !option.trim())} className="mt-3 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold disabled:opacity-40">Anketi yayınla</button>
                </div>
              )}
              {comments.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">İlk yorumu sen yap.</p> : comments.filter(comment => !comment.replyToId).map(comment => <div key={comment.id} className="space-y-2">{renderBookComment(comment)}{comments.filter(reply => reply.replyToId === comment.id).map(reply => renderBookComment(reply, true))}</div>)}
            </div>
            {gifPanelOpen && <GifPicker onSelect={url => { setCommentMediaUrl(url); setGifPanelOpen(false); }} onClose={() => setGifPanelOpen(false)} />}
            <div className="relative flex items-center gap-2 border-t border-white/10 px-4 pb-7 pt-3">
              <input ref={commentMediaRef} type="file" accept="image/*" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) handleCommentPhoto(file); event.target.value = ""; }} />
              <div className="relative shrink-0"><button type="button" onClick={() => { setPlusMenuOpen(value => !value); setGifPanelOpen(false); }} aria-label="Yorum eklerini aç" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10"><Plus className="h-5 w-5" /></button>{plusMenuOpen && <div className="absolute bottom-full left-0 mb-2 min-w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#1b1528] shadow-xl"><button type="button" onClick={() => { commentMediaRef.current?.click(); setPlusMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"><ImagePlus className="h-4 w-4" /> Fotoğraf</button><button type="button" onClick={() => { setGifPanelOpen(true); setPlusMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"><span className="w-4 text-center text-[10px] font-black">GIF</span> GIF</button><button type="button" onClick={() => { setCommentText(value => `${value} ✨`); setPlusMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-3 text-xs hover:bg-white/10"><Smile className="h-4 w-4" /> Sticker</button></div>}</div>
              <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">{replyingToId && <div className="mb-1 flex items-center justify-between text-[10px] text-violet-300">Yanıt yazıyorsun<button type="button" onClick={() => { setReplyingToId(null); setCommentText(""); }}><X className="h-3 w-3" /></button></div>}{commentMediaUrl && <div className="relative mb-1 w-fit"><img src={commentMediaUrl} alt="Seçilen ek" className="max-h-20 max-w-32 rounded-lg object-cover" /><button type="button" onClick={() => setCommentMediaUrl(null)} className="absolute -right-1.5 -top-1.5 rounded-full bg-black/80 p-1"><X className="h-3 w-3" /></button></div>}<input value={commentText} onChange={event => setCommentText(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addComment(); }} placeholder="Yorum yaz..." maxLength={500} className="w-full bg-transparent text-[12px] text-white outline-none placeholder:text-slate-600" /></div>
              <button type="button" onClick={addComment} disabled={!commentText.trim() && !commentMediaUrl} aria-label="Yorum gönder" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-600 disabled:opacity-30"><Send className="h-4 w-4" /></button>
            </div>
          </section>
        </div>
      )}

      {shareOpen && book && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/60 p-3 sm:items-center sm:justify-center" onClick={() => setShareOpen(false)}>
          <section className="max-h-[78vh] w-full max-w-md overflow-hidden rounded-t-[28px] border border-white/10 bg-[#171225] text-white shadow-2xl sm:rounded-3xl" onClick={event => event.stopPropagation()}>
            <div className="flex justify-center pb-1 pt-2 sm:hidden"><div className="h-1 w-9 rounded-full bg-white/25" /></div>
            <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-2"><div><p className="text-[10px] uppercase tracking-[0.25em] text-violet-300">DM ile paylaş</p><h2 className="mt-1 text-lg font-black">{book.title}</h2></div><button type="button" onClick={() => setShareOpen(false)} aria-label="Paylaşımı kapat"><X className="h-5 w-5 text-slate-400" /></button></div>
            <div className="border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={shareSearch} onChange={event => setShareSearch(event.target.value)} placeholder="Kişi ara..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" /></div></div>
            <div className="max-h-[55vh] overflow-y-auto px-4 py-2">
              {shareContacts.filter(contact => !shareSearch.trim() || `${contact.displayName ?? ""} ${contact.username ?? ""}`.toLocaleLowerCase("tr-TR").includes(shareSearch.toLocaleLowerCase("tr-TR"))).length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Henüz DM kişisi bulunamadı.</p> : shareContacts.filter(contact => !shareSearch.trim() || `${contact.displayName ?? ""} ${contact.username ?? ""}`.toLocaleLowerCase("tr-TR").includes(shareSearch.toLocaleLowerCase("tr-TR"))).map(contact => { const sent = shareSent.has(contact.id); return <div key={contact.id} className="flex items-center gap-3 border-b border-white/5 py-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">{contact.avatarUrl ? <img src={contact.avatarUrl} alt="" className="h-full w-full object-cover" /> : (contact.displayName ?? contact.username ?? "U").charAt(0)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{contact.displayName ?? contact.username}</p><p className="truncate text-xs text-slate-500">@{contact.username}</p></div><button type="button" onClick={() => sendBookToContact(contact)} disabled={sent || shareSending === contact.id} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold disabled:bg-white/10 disabled:text-slate-500">{shareSending === contact.id ? "..." : sent ? "Gönderildi ✓" : "Gönder"}</button></div>; })}
            </div>
          </section>
        </div>
      )}

      {/* CTA — sabit */}
      <div className="fixed bottom-0 inset-x-0 border-t border-white/8 px-4 pb-8 pt-3"
        style={{ background: "rgba(7,5,15,0.97)", backdropFilter: "blur(12px)" }}>
        <div className="flex gap-3 items-center">
          <button type="button" onClick={toggleLike}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all ${liked ? "border-rose-400/60 bg-rose-500/15" : "border-white/10 bg-white/5"}`}>
            <Heart className={`h-5 w-5 ${liked ? "fill-rose-400 text-rose-400" : "text-slate-400"}`} />
          </button>
          <button
            type="button"
            onClick={() => { setActiveChap(0); setView("read"); }}
            className="flex-1 rounded-xl py-3.5 text-[14px] font-black text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
          >
            📖 Okumaya Başla
          </button>
        </div>
      </div>

      {mediaViewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={mediaViewer.label}
          onClick={() => setMediaViewer(null)}
        >
          <button
            type="button"
            onClick={() => setMediaViewer(null)}
            aria-label="Medya görüntüleyiciyi kapat"
            className="absolute right-4 top-12 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="w-full max-w-5xl" onClick={event => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-violet-300/70">Loop kitaplık</p>
                <p className="mt-1 text-sm font-bold text-white">{mediaViewer.label}</p>
              </div>
              <span className="text-[10px] text-slate-500">ESC / dışarı tıkla</span>
            </div>
            {mediaViewer.type === "video" ? (
              <TrailerVideo src={mediaViewer.src} autoPlay />
            ) : (
              <img src={mediaViewer.src} alt={mediaViewer.label} className="max-h-[78vh] w-full rounded-xl border border-white/10 object-contain shadow-2xl" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
