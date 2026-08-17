/* ── Taslak deposu — localStorage tabanlı ────────────────────────────
   Her taslak:  id, type, title, cover, genres, synopsis,
                chapters, font, theme, fontSize, textAlign,
                status ("draft" | "published"), createdAt, updatedAt
─────────────────────────────────────────────────────────────────── */

export type DraftStatus = "draft" | "published";

export interface DraftChapter {
  id: string;
  title: string;
  blocks: Array<{
    id: string;
    type: "text" | "image" | "video" | "poll";
    content: string;
    pollQuestion?: string;
    pollOptions?: { id: string; text: string }[];
    pollDuration?: number;
  }>;
}

export interface Draft {
  id: string;
  type: "metin" | "video" | "gorsel" | "sesli" | "etkilesim";
  status: DraftStatus;
  title: string;
  subtitle: string;
  cover: string | null;
  trailers: (string | null)[];
  genres: string[];
  synopsis: string;
  ageRating: "all" | "13+" | "18+";
  fontId: string;
  themeId: string;
  fontSize: number;
  textAlign: "left" | "center" | "right";
  chapters: DraftChapter[];
  wordCount: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const STORAGE_KEY = "loop_drafts_v1";

function readAll(): Draft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: Draft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    /* storage dolu olabilir */
  }
}

/* Kaydet (oluştur ya da güncelle) — güncellenmiş draft'ı döner */
export function saveDraft(partial: Omit<Draft, "id" | "createdAt" | "updatedAt"> & { id?: string }): Draft {
  const all = readAll();
  const now = new Date().toISOString();
  const existing = partial.id ? all.find(d => d.id === partial.id) : undefined;

  const draft: Draft = {
    ...partial,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  if (existing) {
    writeAll(all.map(d => d.id === draft.id ? draft : d));
  } else {
    writeAll([draft, ...all]);
  }
  return draft;
}

/* Tek taslağı getir */
export function getDraft(id: string): Draft | undefined {
  return readAll().find(d => d.id === id);
}

/* Tüm taslakları getir (en yenisi önce) */
export function getAllDrafts(): Draft[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/* Sil */
export function deleteDraft(id: string): void {
  writeAll(readAll().filter(d => d.id !== id));
}

/* Yayınla */
export function publishDraft(id: string): void {
  writeAll(readAll().map(d => d.id === id ? { ...d, status: "published", updatedAt: new Date().toISOString() } : d));
}

/* Yayından Kaldır */
export function unpublishDraft(id: string): void {
  writeAll(readAll().map(d => d.id === id ? { ...d, status: "draft", updatedAt: new Date().toISOString() } : d));
}

/* Yayında olan kitapları getir */
export function getPublishedBooks(): Draft[] {
  return readAll()
    .filter(d => d.status === "published")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/* Kelime sayısı hesapla */
export function calcWordCount(chapters: DraftChapter[]): number {
  return chapters.reduce(
    (acc, ch) =>
      acc +
      ch.blocks
        .filter(b => b.type === "text")
        .reduce((s, b) => s + b.content.split(/\s+/).filter(Boolean).length, 0),
    0,
  );
}
