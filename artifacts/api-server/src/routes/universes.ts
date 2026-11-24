import { Router } from "express";
import fs from "fs";
import path from "path";
import { requireAuth } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const router = Router();
const file = path.resolve(import.meta.dirname, "..", "data", "universes.json");
type Universe = { id: string; title: string; description: string; color: string; gallery: string[]; authorId?: number; author?: string; authorAvatar?: string | null; createdAt: string; updatedAt: string };
function read(): Universe[] { try { return JSON.parse(fs.readFileSync(file, "utf8")) as Universe[]; } catch { return []; } }
function write(value: Universe[]) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8"); }

router.get("/universes", async (req, res) => {
  try {
    const universes = read();
    const authorIds = [...new Set(universes.map(universe => universe.authorId).filter((id): id is number => Number.isInteger(id)))];
    const authors = authorIds.length
      ? await db.select({ id: usersTable.id, username: usersTable.username, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(inArray(usersTable.id, authorIds))
      : [];
    const authorById = new Map(authors.map(author => [author.id, author]));
    res.json(universes.map(universe => {
      const author = universe.authorId ? authorById.get(universe.authorId) : undefined;
      return author ? {
        ...universe,
        author: author.displayName || author.username || universe.author,
        authorAvatar: author.avatarUrl || universe.authorAvatar || null,
      } : universe;
    }));
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Evrenler yüklenemedi" });
  }
});
router.post("/universes", (req, res) => {
  const title = String(req.body?.title || "").trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: "Evren adı gerekli" });
  const now = new Date().toISOString();
  const universe: Universe = { id: `${req.user?.id ?? "guest"}-${Date.now()}`, title, description: String(req.body?.description || "").trim().slice(0, 240), color: String(req.body?.color || "from-violet-950 via-slate-900 to-cyan-950"), gallery: Array.isArray(req.body?.gallery) ? req.body.gallery.filter((item: unknown): item is string => typeof item === "string").slice(0, 3) : [], authorId: req.user?.id, author: req.user ? (req.user.displayName || req.user.username) : "Loop topluluğu", authorAvatar: req.user?.avatarUrl ?? null, createdAt: now, updatedAt: now };
  write([universe, ...read()]);
  res.status(201).json(universe);
});
router.patch("/universes/:id", requireAuth, (req, res) => {
  const universes = read();
  const item = universes.find(universe => universe.id === req.params.id && universe.authorId === req.user!.id);
  if (!item) return res.status(404).json({ error: "Evren bulunamadı" });
  if (Array.isArray(req.body?.gallery)) item.gallery = req.body.gallery.filter((value: unknown): value is string => typeof value === "string").slice(0, 3);
  item.updatedAt = new Date().toISOString();
  write(universes);
  res.json(item);
});
router.delete("/universes/:id", requireAuth, (req, res) => {
  const universes = read();
  const target = universes.find(universe => universe.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Evren bulunamadı" });
  if (target.authorId !== req.user!.id) return res.status(403).json({ error: "Bu evreni silme yetkiniz yok" });
  write(universes.filter(universe => universe.id !== req.params.id));
  res.json({ success: true });
});
export default router;
