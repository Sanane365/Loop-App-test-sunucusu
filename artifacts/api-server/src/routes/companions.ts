/**
 * Companion routes
 *
 * Public:
 *   GET /api/companions          → published list (admin sees all)
 *
 * Admin only:
 *   POST  /api/admin/companions           → upload image/video + name/description → create (draft)
 *   PATCH /api/admin/companions/:id/publish → toggle published
 *   DELETE /api/admin/companions/:id      → delete (non-built-in only)
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { companionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, isPrivilegedUser } from "../lib/auth";

const router = Router();

/* ── upload directory ───────────────────────────────────────────────── */
const uploadDir = path.join(process.cwd(), "uploads", "companions");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const supportedExtension = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm", ".mov", ".m4v"].includes(extension);
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/") && !supportedExtension) {
      return cb(new Error("Sadece resim veya video dosyaları kabul edilir"));
    }
    cb(null, true);
  },
});

const companionUpload = (req: any, res: any, next: any) => {
  upload.single("image")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Yoldaş dosyası en fazla 50 MB olabilir"
        : error instanceof Error ? error.message : "Yoldaş dosyası yüklenemedi";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
};

/* ── auth helpers ───────────────────────────────────────────────────── */
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || !isPrivilegedUser(req.user)) {
    return res.status(403).json({ error: "Yetersiz yetki" });
  }
  next();
}

function isAdminUser(req: any): boolean {
  return !!req.user && isPrivilegedUser(req.user);
}

/* ── ensure published column exists (migration-less) ────────────────── */
export async function ensureCompanionsPublishedColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE companions
      ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false
    `);
    // bear is always published
    await db.execute(sql`
      UPDATE companions SET published = true WHERE slug = 'bear'
    `);
    console.log("[companions] published sütunu hazır.");
  } catch (e) {
    console.warn("[companions] published sütunu kontrol hatası:", e);
  }
}

/* ── seed built-in bear on first run ────────────────────────────────── */
export async function seedBuiltinCompanions() {
  try {
    const existing = await db
      .select()
      .from(companionsTable)
      .where(eq(companionsTable.slug, "bear"))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(companionsTable).values({
        slug:        "bear",
        name:        "Ayı",
        description: "Sevimli & Sadık",
        imageUrl:    "/companion-bear.png",
        published:   true,
      });
      console.log("[companions] Ayı yoldaşı otomatik eklendi.");
    }
  } catch (e) {
    console.warn("[companions] seed hatası:", e);
  }
}

/* ── GET /api/companions ────────────────────────────────────────────── */
// Admin/mod → tüm yoldaşlar (taslaklar dahil)
// Diğerleri → sadece published:true olanlar
router.get("/companions", requireAuth, async (req, res) => {
  try {
    const all = await db
      .select()
      .from(companionsTable)
      .orderBy(companionsTable.createdAt);

    const result = isAdminUser(req) ? all : all.filter(c => c.published);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

/* ── POST /api/admin/companions ─────────────────────────────────────── */
router.post(
  "/admin/companions",
  requireAuth,
  requireAdmin,
  companionUpload,
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Görsel yüklenmedi" }); return;
      }
      const { name, description } = req.body as { name?: string; description?: string };
      if (!name?.trim()) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: "İsim zorunlu" }); return;
      }

      const base = name.trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      let slug = base || uuidv4().slice(0, 8);
      const existing = await db
        .select()
        .from(companionsTable)
        .where(eq(companionsTable.slug, slug))
        .limit(1);
      if (existing.length > 0) slug = `${slug}-${Date.now()}`;

      const imageUrl = `/api/uploads/companions/${req.file.filename}`;

      const [companion] = await db
        .insert(companionsTable)
        .values({
          slug,
          name:        name.trim(),
          description: description?.trim() || null,
          imageUrl,
          published:   false,   // yeni yoldaşlar taslak olarak eklenir
        })
        .returning();

      res.status(201).json(companion);
    } catch (e) {
      console.error(e);
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* ── PATCH /api/admin/companions/:id/publish ────────────────────────── */
router.patch(
  "/admin/companions/:id/publish",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string, 10);
      if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

      const [companion] = await db
        .select()
        .from(companionsTable)
        .where(eq(companionsTable.id, id))
        .limit(1);
      if (!companion) { res.status(404).json({ error: "Bulunamadı" }); return; }

      // bear daima yayında kalır
      if (companion.slug === "bear") {
        res.status(400).json({ error: "Ayı yoldaşı her zaman yayında olmalı" }); return;
      }

      const newPublished = !companion.published;
      const [updated] = await db
        .update(companionsTable)
        .set({ published: newPublished })
        .where(eq(companionsTable.id, id))
        .returning();

      res.json(updated);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

/* ── DELETE /api/admin/companions/:id ───────────────────────────────── */
router.delete(
  "/admin/companions/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = parseInt(req.params["id"] as string, 10);
      if (isNaN(id)) { res.status(400).json({ error: "Geçersiz id" }); return; }

      const [companion] = await db
        .select()
        .from(companionsTable)
        .where(eq(companionsTable.id, id))
        .limit(1);
      if (!companion) { res.status(404).json({ error: "Bulunamadı" }); return; }

      if (companion.imageUrl.startsWith("/companion-")) {
        res.status(403).json({ error: "Yerleşik yoldaşlar silinemez" });
        return;
      }

      if (companion.imageUrl.startsWith("/api/uploads/companions/")) {
        const filename = path.basename(companion.imageUrl);
        const filePath = path.join(uploadDir, filename);
        try { fs.unlinkSync(filePath); } catch {}
      }

      await db.delete(companionsTable).where(eq(companionsTable.id, id));
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Sunucu hatası" });
    }
  }
);

export default router;
