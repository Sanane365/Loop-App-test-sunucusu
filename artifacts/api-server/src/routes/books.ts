import { Router } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../lib/auth";
import { getUserWithStats } from "../lib/helpers";

const router = Router();
const dataDir = path.resolve(import.meta.dirname, "..", "data");
const booksFile = path.join(dataDir, "published-books.json");
const ratingsFile = path.join(dataDir, "book-ratings.json");
const viewsFile = path.join(dataDir, "book-views.json");
const viewVisitorsFile = path.join(dataDir, "book-view-visitors.json");
const commentsFile = path.join(dataDir, "book-comments.json");
const bookCoversDir = path.resolve(import.meta.dirname, "..", "uploads", "books");
const bookTrailersDir = path.resolve(import.meta.dirname, "..", "uploads", "book-trailers");

type PublishedBook = Record<string, unknown> & {
  id: string;
  status: "published";
  authorId: number;
  author?: { id: number; username: string; displayName: string; avatarUrl?: string | null };
  gallery?: Array<{ url: string; name: string }>;
};

function readBooks(): PublishedBook[] {
  try {
    if (!fs.existsSync(booksFile)) return [];
    const books = JSON.parse(fs.readFileSync(booksFile, "utf8")) as PublishedBook[];
    let changed = false;
    fs.mkdirSync(bookCoversDir, { recursive: true });
    fs.mkdirSync(bookTrailersDir, { recursive: true });
    const normalized = books.map((book) => {
      const cover = typeof book.cover === "string" ? book.cover : "";
      const match = cover.match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/s);
      let normalizedBook = book;
      if (match) {
        const extension = match[1] === "jpeg" ? "jpg" : match[1];
        const filename = `${book.id}-cover.${extension}`;
        const filePath = path.join(bookCoversDir, filename);
        if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));
        changed = true;
        normalizedBook = { ...normalizedBook, cover: `/api/uploads/books/${filename}` };
      }
      if (Array.isArray(book.trailers)) {
        const trailers = book.trailers.map((trailer, index) => {
          if (typeof trailer !== "string") return trailer;
          const trailerMatch = trailer.match(/^data:([^;]+);base64,(.+)$/s);
          if (!trailerMatch) return trailer;
          const extension = trailerMatch[1].split("/")[1]?.replace("x-matroska", "mkv") || "mp4";
          const filename = `${book.id}-${index}.${extension}`;
          const filePath = path.join(bookTrailersDir, filename);
          if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, Buffer.from(trailerMatch[2], "base64"));
          changed = true;
          return `/api/uploads/book-trailers/${filename}`;
        });
        normalizedBook = { ...normalizedBook, trailers };
      }
      return normalizedBook;
    });
    if (changed) writeBooks(normalized);
    return normalized;
  } catch {
    return [];
  }
}

function writeBooks(books: PublishedBook[]) {
  fs.mkdirSync(path.dirname(booksFile), { recursive: true });
  fs.writeFileSync(booksFile, JSON.stringify(books, null, 2), "utf8");
}

type BookRatings = Record<string, { ratings: Record<string, number>; likes: number[] }>;
type BookViews = Record<string, number>;
type BookViewVisitors = Record<string, string[]>;
type BookComment = {
  id: string;
  bookId: string;
  userId: number;
  author: string;
  text: string;
  mediaUrl?: string;
  replyToId?: string;
  likes: number;
  likedBy?: number[];
  createdAt: string;
  poll?: { question: string; options: string[]; votes: number[]; votedBy?: Record<string, number> };
};

function readRatings(): BookRatings {
  try {
    if (!fs.existsSync(ratingsFile)) return {};
    return JSON.parse(fs.readFileSync(ratingsFile, "utf8")) as BookRatings;
  } catch {
    return {};
  }
}

function writeRatings(ratings: BookRatings) {
  fs.mkdirSync(path.dirname(ratingsFile), { recursive: true });
  fs.writeFileSync(ratingsFile, JSON.stringify(ratings, null, 2), "utf8");
}

function readViews(): BookViews {
  try {
    if (!fs.existsSync(viewsFile)) return {};
    return JSON.parse(fs.readFileSync(viewsFile, "utf8")) as BookViews;
  } catch {
    return {};
  }
}

function writeViews(views: BookViews) {
  fs.mkdirSync(path.dirname(viewsFile), { recursive: true });
  fs.writeFileSync(viewsFile, JSON.stringify(views, null, 2), "utf8");
}

function readViewVisitors(): BookViewVisitors {
  try {
    if (!fs.existsSync(viewVisitorsFile)) return {};
    return JSON.parse(fs.readFileSync(viewVisitorsFile, "utf8")) as BookViewVisitors;
  } catch { return {}; }
}

function writeViewVisitors(visitors: BookViewVisitors) {
  fs.mkdirSync(path.dirname(viewVisitorsFile), { recursive: true });
  fs.writeFileSync(viewVisitorsFile, JSON.stringify(visitors, null, 2), "utf8");
}

function readComments(): Record<string, BookComment[]> {
  try {
    if (!fs.existsSync(commentsFile)) return {};
    return JSON.parse(fs.readFileSync(commentsFile, "utf8")) as Record<string, BookComment[]>;
  } catch { return {}; }
}

function writeComments(comments: Record<string, BookComment[]>) {
  fs.mkdirSync(path.dirname(commentsFile), { recursive: true });
  fs.writeFileSync(commentsFile, JSON.stringify(comments, null, 2), "utf8");
}

function ratingSummary(bookId: string, userId?: number) {
  const entry = readRatings()[bookId] ?? { ratings: {}, likes: [] };
  const values = Object.values(entry.ratings);
  return {
    average: values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0,
    count: values.length,
    userRating: userId ? entry.ratings[String(userId)] ?? null : null,
    likeCount: entry.likes.length,
    userLiked: userId ? entry.likes.includes(userId) : false,
  };
}

router.get("/books", async (_req, res) => {
  const views = readViews();
  const books = readBooks()
    .filter(book => book.status === "published")
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
    .map(async book => {
      const trailers = Array.isArray(book.trailers) ? book.trailers : [];
      const { chapters, ...summaryBook } = book;
      const author = await getUserWithStats(book.authorId, _req.user?.id);
      return {
        ...summaryBook,
        chapterCount: Array.isArray(chapters) ? chapters.length : 0,
        trailerCount: Array.isArray(trailers) ? trailers.filter(Boolean).length : 0,
        author: author ?? book.author ?? null,
        viewCount: views[book.id] ?? 0,
        rating: ratingSummary(book.id, _req.user?.id),
      };
    });
  res.json(await Promise.all(books));
});

router.get("/books/:id/comments", (req, res) => {
  const bookId = String(req.params.id);
  const comments = readComments()[bookId] ?? [];
  return res.json(comments.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(comment => ({
    ...comment,
    liked: req.user?.id ? (comment.likedBy ?? []).includes(req.user.id) : false,
    poll: comment.poll ? { ...comment.poll, voted: req.user?.id ? comment.poll.votedBy?.[String(req.user.id)] ?? null : null } : undefined,
  })));
});

router.post("/books/:id/comments", requireAuth, (req, res) => {
  const bookId = String(req.params.id);
  const text = String(req.body?.text ?? "").trim().slice(0, 500);
  const mediaUrl = typeof req.body?.mediaUrl === "string" ? req.body.mediaUrl : undefined;
  const poll = req.body?.poll && typeof req.body.poll.question === "string" && Array.isArray(req.body.poll.options)
    ? { question: req.body.poll.question.trim().slice(0, 240), options: req.body.poll.options.map((option: unknown) => String(option).trim().slice(0, 100)).filter(Boolean).slice(0, 4), votes: [], votedBy: {} }
    : undefined;
  if ((!text && !mediaUrl) && !poll) return res.status(400).json({ error: "Yorum boş olamaz" });
  const all = readComments();
  const comment: BookComment = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    bookId,
    userId: req.user!.id,
    author: req.user!.displayName || req.user!.username,
    text,
    mediaUrl,
    replyToId: typeof req.body?.replyToId === "string" ? req.body.replyToId : undefined,
    likes: 0,
    likedBy: [],
    createdAt: new Date().toISOString(),
    poll: poll ? { ...poll, votes: poll.options.map(() => 0) } : undefined,
  };
  all[bookId] = [comment, ...(all[bookId] ?? [])];
  writeComments(all);
  return res.status(201).json(comment);
});

router.post("/books/:id/comments/:commentId/like", requireAuth, (req, res) => {
  const bookId = String(req.params.id);
  const commentId = String(req.params.commentId);
  const all = readComments();
  const comment = (all[bookId] ?? []).find(item => item.id === commentId);
  if (!comment) return res.status(404).json({ error: "Yorum bulunamadı" });
  const likedBy = comment.likedBy ?? [];
  const index = likedBy.indexOf(req.user!.id);
  if (index >= 0) likedBy.splice(index, 1); else likedBy.push(req.user!.id);
  comment.likedBy = likedBy;
  comment.likes = likedBy.length;
  writeComments(all);
  return res.json({ liked: index < 0, likes: comment.likes });
});

router.post("/books/:id/comments/:commentId/poll-vote", requireAuth, (req, res) => {
  const bookId = String(req.params.id);
  const commentId = String(req.params.commentId);
  const optionIndex = Number(req.body?.optionIndex);
  const all = readComments();
  const comment = (all[bookId] ?? []).find(item => item.id === commentId);
  if (!comment?.poll || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= comment.poll.options.length) {
    return res.status(400).json({ error: "Geçersiz anket seçimi" });
  }
  const votedBy = comment.poll.votedBy ?? {};
  const userKey = String(req.user!.id);
  if (votedBy[userKey] === undefined) {
    comment.poll.votes[optionIndex] = (comment.poll.votes[optionIndex] ?? 0) + 1;
    votedBy[userKey] = optionIndex;
    comment.poll.votedBy = votedBy;
    writeComments(all);
  }
  return res.json({ votes: comment.poll.votes, voted: votedBy[userKey] });
});

router.get("/books/:id", (_req, res) => {
  const book = readBooks().find(item => item.id === _req.params.id && item.status === "published");
  if (!book) return res.status(404).json({ error: "Kitap bulunamadı" });
  const views = readViews();
  const visitors = readViewVisitors();
  const visitorKey = _req.user?.id
    ? `user:${_req.user.id}`
    : `visitor:${_req.ipAddress ?? "unknown"}:${_req.headers["user-agent"] ?? "unknown"}`;
  const bookVisitors = visitors[book.id] ?? [];
  if (!bookVisitors.includes(visitorKey)) {
    bookVisitors.push(visitorKey);
    visitors[book.id] = bookVisitors;
    views[book.id] = (views[book.id] ?? 0) + 1;
    writeViewVisitors(visitors);
    writeViews(views);
  }
  res.json({ ...book, author: book.author ?? null, viewCount: views[book.id], rating: ratingSummary(book.id, _req.user?.id) });
});

router.get("/books/:id/rating", (req, res) => {
  res.json(ratingSummary(req.params.id, req.user?.id));
});

router.patch("/books/:id/gallery", requireAuth, (req, res) => {
  const books = readBooks();
  const index = books.findIndex(item => item.id === req.params.id && item.status === "published");
  if (index < 0) return res.status(404).json({ error: "Kitap bulunamadı" });
  const book = books[index]!;
  if (book.authorId !== req.user!.id) return res.status(403).json({ error: "Bu kitabın görsellerini yalnızca yazarı düzenleyebilir" });

  const gallery = Array.isArray(req.body?.gallery) ? req.body.gallery : [];
  if (gallery.length > 5 || gallery.some((item: any) => !item?.url || !item?.name?.trim())) {
    return res.status(400).json({ error: "En fazla 5 görsel ekleyebilir ve her görsele ad verebilirsiniz" });
  }
  book.gallery = gallery.slice(0, 5).map((item: any) => ({ url: String(item.url), name: String(item.name).trim().slice(0, 80) }));
  books[index] = book;
  writeBooks(books);
  res.json({ gallery: book.gallery });
});

router.post("/books/:id/rating", requireAuth, (req, res) => {
  const value = Number(req.body?.rating);
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return res.status(400).json({ error: "Puan 1 ile 10 arasında olmalı" });
  }
  const ratings = readRatings();
  const entry = ratings[req.params.id] ?? { ratings: {}, likes: [] };
  entry.ratings[String(req.user!.id)] = value;
  ratings[req.params.id] = entry;
  writeRatings(ratings);
  res.json(ratingSummary(req.params.id, req.user!.id));
});

router.post("/books/:id/like", requireAuth, (req, res) => {
  const ratings = readRatings();
  const entry = ratings[req.params.id] ?? { ratings: {}, likes: [] };
  const index = entry.likes.indexOf(req.user!.id);
  if (index >= 0) entry.likes.splice(index, 1);
  else entry.likes.push(req.user!.id);
  ratings[req.params.id] = entry;
  writeRatings(ratings);
  res.json(ratingSummary(req.params.id, req.user!.id));
});

router.post("/books", requireAuth, (req, res) => {
  const book = req.body as Partial<PublishedBook>;
  if (!book.id || !book.title || book.status !== "published" || !Array.isArray(book.chapters)) {
    return res.status(400).json({ error: "Geçersiz kitap verisi" });
  }

  const user = req.user!;
  const published: PublishedBook = {
    ...book,
    id: String(book.id),
    status: "published",
    authorId: user.id,
    author: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
  };
  const books = readBooks();
  const previous = books.find(item => item.id === published.id);
  if (previous) {
    if (!published.cover && previous.cover) published.cover = previous.cover;
    if ((!Array.isArray(published.trailers) || published.trailers.every(item => !item)) && previous.trailers) {
      published.trailers = previous.trailers;
    }
  }
  const next = books.some(item => item.id === published.id)
    ? books.map(item => item.id === published.id ? published : item)
    : [published, ...books];
  writeBooks(next);
  res.status(201).json(published);
});

export default router;
