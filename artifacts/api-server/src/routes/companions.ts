/**
 * Companion routes
 *
 * Public:
 *   GET /api/companions          → list all companions
 *
 * Admin only:
 *   POST /api/admin/companions   → upload PNG + name/description → create companion
 *   DELETE /api/admin/companions/:id → delete companion (+ file if not built-in)
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@workspace/db";
import { companionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Sadece resim dosyaları kabul edilir"));
    }
    cb(null, true);
  },
});

/* ── auth helpers ───────────────────────────────────────────────────── */
function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "moderator")) {
    return res.status(403).json({ error: "Yetersiz yetki" });
  }
  next();
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
      });
      console.log("[companions] Ayı yoldaşı otomatik eklendi.");
    }
  } catch (e) {
    console.warn("[companions] seed hatası:", e);
  }
}

/* ── GET /api/companions ────────────────────────────────────────────── */
router.get("/companions", async (_req, res) => {
  try {
    const companions = await db
      .select()
      .from(companionsTable)
      .orderBy(companionsTable.createdAt);
    res.json(companions);
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
  upload.single("image"),
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

      // generate unique slug from name
      const base = name.trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      let slug = base || uuidv4().slice(0, 8);
      // ensure uniqueness
      const existing = await db
        .select()
        .from(companionsTable)
        .where(eq(companionsTable.slug, slug))
        .limit(1);
      if (existing.length > 0) slug = `${slug}-${Date.now()}`;

      const imageUrl = `/api/uploads/companions/${req.file.filename}`;

      const [companion] = await db
        .insert(companionsTable)
        .values({ slug, name: name.trim(), description: description?.trim() || null, imageUrl })
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

      // built-in companions cannot be deleted
      if (companion.imageUrl.startsWith("/companion-")) {
        res.status(403).json({ error: "Yerleşik yoldaşlar silinemez" });
        return;
      }

      // only delete file if it's an uploaded one (not built-in)
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
