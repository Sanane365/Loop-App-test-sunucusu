import { Router } from "express";
import { randomUUID } from "node:crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { isPrivilegedUser, requireAuth } from "../lib/auth";

const router = Router();
const dataFile = path.resolve(import.meta.dirname, "..", "data", "branding.json");
const brandingDir = path.resolve(import.meta.dirname, "..", "uploads", "branding");
const modiAssetFile = path.resolve(import.meta.dirname, "..", "data", "modi-asset.json");
const modiAssetDir = path.resolve(import.meta.dirname, "..", "uploads", "modi");
fs.mkdirSync(brandingDir, { recursive: true });
fs.mkdirSync(modiAssetDir, { recursive: true });

const upload = multer({
  dest: brandingDir,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMime = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    const allowedExtension = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mov)$/i.test(file.originalname);
    cb(null, allowedMime || allowedExtension);
  },
});

const modiAssetUpload = multer({
  storage: multer.diskStorage({
    destination: modiAssetDir,
    filename: (_req, file, cb) => {
      const extensions: Record<string, string> = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
      };
      cb(null, `${randomUUID()}${extensions[file.mimetype] ?? ""}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    cb(null, allowedTypes.has(file.mimetype));
  },
});

type ModiAsset = {
  assetUrl: string | null;
  originalName: string | null;
  updatedAt: string | null;
  profileUrl: string | null;
  profileOriginalName: string | null;
  profileUpdatedAt: string | null;
};

function readModiAsset(): ModiAsset {
  try {
    const saved = JSON.parse(fs.readFileSync(modiAssetFile, "utf8")) as Partial<ModiAsset>;
    return {
      assetUrl: typeof saved.assetUrl === "string" ? saved.assetUrl : null,
      originalName: typeof saved.originalName === "string" ? saved.originalName : null,
      updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : null,
      profileUrl: typeof saved.profileUrl === "string" ? saved.profileUrl : null,
      profileOriginalName: typeof saved.profileOriginalName === "string" ? saved.profileOriginalName : null,
      profileUpdatedAt: typeof saved.profileUpdatedAt === "string" ? saved.profileUpdatedAt : null,
    };
  } catch {
    return { assetUrl: null, originalName: null, updatedAt: null, profileUrl: null, profileOriginalName: null, profileUpdatedAt: null };
  }
}

function writeModiAsset(asset: ModiAsset) {
  fs.mkdirSync(path.dirname(modiAssetFile), { recursive: true });
  fs.writeFileSync(modiAssetFile, JSON.stringify(asset, null, 2), "utf8");
}

function handleModiAssetUpload(req: any, res: any, next: any) {
  modiAssetUpload.single("asset")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Modi görseli 15 MB'dan küçük olmalı."
        : error instanceof Error ? error.message : "Modi görseli yüklenemedi.";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

function watermarkUpload(req: any, res: any, next: any) {
  upload.single("watermark")(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Watermark dosyası 50 MB'dan küçük olmalı"
        : error instanceof Error ? error.message : "Watermark dosyası yüklenemedi";
      return res.status(400).json({ error: message });
    }
    next();
  });
}

type BrandingSettings = {
  logoUrl: string;
  originalName: string;
  mimeType: string;
  updatedAt: string | null;
  watermarkUrl?: string;
  watermarkOriginalName?: string;
  watermarkMimeType?: string;
  watermarkUpdatedAt?: string | null;
  watermarkText?: string;
  watermarkSize?: number;
};

function normalizeWatermarkSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(2.5, Math.max(0.5, parsed));
}

function readBranding(): BrandingSettings {
  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, "utf8")) as BrandingSettings;
    return {
      ...saved,
      watermarkUrl: saved.watermarkUrl || "/loop-app-logo.png",
      watermarkOriginalName: saved.watermarkOriginalName || "loop-app-logo.png",
      watermarkMimeType: saved.watermarkMimeType || "image/png",
      watermarkUpdatedAt: saved.watermarkUpdatedAt || null,
      watermarkText: saved.watermarkText ?? "",
      watermarkSize: normalizeWatermarkSize(saved.watermarkSize ?? 1),
    };
  } catch {
    return { logoUrl: "/loop-app-logo.png", originalName: "loop-app-logo.png", mimeType: "image/png", updatedAt: null, watermarkUrl: "/loop-app-logo.png", watermarkOriginalName: "loop-app-logo.png", watermarkMimeType: "image/png", watermarkUpdatedAt: null, watermarkText: "", watermarkSize: 1 };
  }
}

function writeBranding(settings: BrandingSettings) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(settings, null, 2), "utf8");
}

function requireBrandingAdmin(req: any, res: any, next: any) {
  if (!req.user || !isPrivilegedUser(req.user)) return res.status(403).json({ error: "Yetersiz yetki" });
  next();
}

router.get("/modi/asset", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(readModiAsset());
});

router.post("/admin/modi/asset", requireAuth, requireBrandingAdmin, handleModiAssetUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: "PNG, JPG, WEBP veya GIF görseli seçin." });
  const current = readModiAsset();
  const next: ModiAsset = {
    assetUrl: `/api/uploads/modi/${path.basename(req.file.filename)}`,
    originalName: String(req.file.originalname || "modi-asset").slice(0, 160),
    updatedAt: new Date().toISOString(),
  };
  writeModiAsset(next);
  if (current.assetUrl?.startsWith("/api/uploads/modi/")) {
    fs.rm(path.join(modiAssetDir, path.basename(current.assetUrl)), { force: true }, () => {});
  }
  res.status(201).json(next);
});

router.post("/admin/modi/profile", requireAuth, requireBrandingAdmin, handleModiAssetUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: "PNG, JPG, WEBP veya GIF profil görseli seçin." });
  const current = readModiAsset();
  const next: ModiAsset = {
    ...current,
    profileUrl: `/api/uploads/modi/${path.basename(req.file.filename)}`,
    profileOriginalName: String(req.file.originalname || "modi-profile").slice(0, 160),
    profileUpdatedAt: new Date().toISOString(),
  };
  writeModiAsset(next);
  if (current.profileUrl?.startsWith("/api/uploads/modi/")) {
    fs.rm(path.join(modiAssetDir, path.basename(current.profileUrl)), { force: true }, () => {});
  }
  res.status(201).json(next);
});

router.delete("/admin/modi/profile", requireAuth, requireBrandingAdmin, (_req, res) => {
  const current = readModiAsset();
  if (current.profileUrl?.startsWith("/api/uploads/modi/")) {
    fs.rm(path.join(modiAssetDir, path.basename(current.profileUrl)), { force: true }, () => {});
  }
  const next: ModiAsset = { ...current, profileUrl: null, profileOriginalName: null, profileUpdatedAt: new Date().toISOString() };
  writeModiAsset(next);
  res.json(next);
});

router.delete("/admin/modi/asset", requireAuth, requireBrandingAdmin, (_req, res) => {
  const current = readModiAsset();
  if (current.assetUrl?.startsWith("/api/uploads/modi/")) {
    fs.rm(path.join(modiAssetDir, path.basename(current.assetUrl)), { force: true }, () => {});
  }
  const next: ModiAsset = { ...current, assetUrl: null, originalName: null, updatedAt: new Date().toISOString() };
  writeModiAsset(next);
  res.json(next);
});

router.get("/branding/logo", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.json(readBranding());
});

router.get("/branding/favicon", (_req, res) => {
  const branding = readBranding();
  res.set("Cache-Control", "no-store, max-age=0");
  const faviconUrl = branding.mimeType.startsWith("video/") ? "/loop-app-logo.png" : branding.logoUrl;
  res.redirect(302, `${faviconUrl}?v=${encodeURIComponent(branding.updatedAt || Date.now())}`);
});

router.get("/admin/branding/logo", requireAuth, requireBrandingAdmin, (_req, res) => {
  res.json(readBranding());
});

router.post("/admin/branding/logo", requireAuth, requireBrandingAdmin, upload.single("logo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Geçerli bir görsel veya video seçin" });
  const current = readBranding();
  const logoUrl = `/api/uploads/branding/${path.basename(req.file.filename)}`;
  const next = {
    ...current,
    logoUrl,
    originalName: String(req.file.originalname || "logo").slice(0, 160),
    mimeType: req.file.mimetype,
    updatedAt: new Date().toISOString(),
  };
  writeBranding(next);
  if (current.logoUrl.startsWith("/api/uploads/branding/")) {
    fs.rm(path.join(brandingDir, path.basename(current.logoUrl)), { force: true }, () => {});
  }
  res.status(201).json(next);
});

router.delete("/admin/branding/logo", requireAuth, requireBrandingAdmin, (_req, res) => {
  const current = readBranding();
  if (current.logoUrl.startsWith("/api/uploads/branding/")) {
    fs.rm(path.join(brandingDir, path.basename(current.logoUrl)), { force: true }, () => {});
  }
  const next = { ...current, logoUrl: "/loop-app-logo.png", originalName: "loop-app-logo.png", mimeType: "image/png", updatedAt: new Date().toISOString() };
  writeBranding(next);
  res.json(next);
});

router.get("/branding/watermark", (_req, res) => {
  const branding = readBranding();
  res.set("Cache-Control", "no-store");
  res.json({
    watermarkUrl: branding.watermarkUrl || "/loop-app-logo.png",
    originalName: branding.watermarkOriginalName || "loop-app-logo.png",
    mimeType: branding.watermarkMimeType || "image/png",
    updatedAt: branding.watermarkUpdatedAt || null,
    text: branding.watermarkText ?? "",
    size: normalizeWatermarkSize(branding.watermarkSize ?? 1),
  });
});

router.get("/admin/branding/watermark", requireAuth, requireBrandingAdmin, (_req, res) => {
  const branding = readBranding();
  res.json({ watermarkUrl: branding.watermarkUrl, originalName: branding.watermarkOriginalName, mimeType: branding.watermarkMimeType, updatedAt: branding.watermarkUpdatedAt, text: branding.watermarkText ?? "", size: normalizeWatermarkSize(branding.watermarkSize ?? 1) });
});

router.post("/admin/branding/watermark", requireAuth, requireBrandingAdmin, watermarkUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Geçerli bir görsel veya video seçin" });
  const current = readBranding();
  const watermarkUrl = `/api/uploads/branding/${path.basename(req.file.filename)}`;
  const next = {
    ...current,
    watermarkUrl,
    watermarkOriginalName: String(req.file.originalname || "watermark").slice(0, 160),
    watermarkMimeType: req.file.mimetype,
    watermarkUpdatedAt: new Date().toISOString(),
    watermarkSize: normalizeWatermarkSize(current.watermarkSize ?? 1),
  };
  writeBranding(next);
  if (current.watermarkUrl?.startsWith("/api/uploads/branding/")) {
    fs.rm(path.join(brandingDir, path.basename(current.watermarkUrl)), { force: true }, () => {});
  }
  res.status(201).json({ watermarkUrl: next.watermarkUrl, originalName: next.watermarkOriginalName, mimeType: next.watermarkMimeType, updatedAt: next.watermarkUpdatedAt, text: next.watermarkText ?? "", size: normalizeWatermarkSize(next.watermarkSize ?? 1) });
});

router.delete("/admin/branding/watermark", requireAuth, requireBrandingAdmin, (_req, res) => {
  const current = readBranding();
  if (current.watermarkUrl?.startsWith("/api/uploads/branding/")) {
    fs.rm(path.join(brandingDir, path.basename(current.watermarkUrl)), { force: true }, () => {});
  }
  const next = { ...current, watermarkUrl: "/loop-app-logo.png", watermarkOriginalName: "loop-app-logo.png", watermarkMimeType: "image/png", watermarkUpdatedAt: new Date().toISOString(), watermarkText: "", watermarkSize: 1 };
  writeBranding(next);
  res.json({ watermarkUrl: next.watermarkUrl, originalName: next.watermarkOriginalName, mimeType: next.watermarkMimeType, updatedAt: next.watermarkUpdatedAt, text: next.watermarkText ?? "", size: normalizeWatermarkSize(next.watermarkSize ?? 1) });
});

router.put("/admin/branding/watermark", requireAuth, requireBrandingAdmin, (req, res) => {
  const current = readBranding();
  const text = String(req.body?.text ?? "").trim().slice(0, 40);
  const size = normalizeWatermarkSize(req.body?.size ?? current.watermarkSize ?? 1);
  const next = { ...current, watermarkText: text, watermarkSize: size, watermarkUpdatedAt: new Date().toISOString() };
  writeBranding(next);
  res.json({ watermarkUrl: next.watermarkUrl, originalName: next.watermarkOriginalName, mimeType: next.watermarkMimeType, updatedAt: next.watermarkUpdatedAt, text: next.watermarkText, size: normalizeWatermarkSize(next.watermarkSize ?? 1) });
});

export default router;
