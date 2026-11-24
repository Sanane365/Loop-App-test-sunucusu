  import { Router } from "express";
  import { requireAuth } from "../lib/auth";
  import { createModerationReport, moderationSchemaReady } from "../lib/moderation";

  const router = Router();

  router.post("/reports", requireAuth, async (req, res) => {
    try {
      await moderationSchemaReady;
      const reportedUserId = Number(req.body?.reportedUserId);
      const reason = String(req.body?.reason || "").trim().slice(0, 120);
      const targetType = String(req.body?.targetType || "user").trim().slice(0, 40);
      const rawTargetId = req.body?.targetId;
      const targetId = rawTargetId === undefined || rawTargetId === null || rawTargetId === ""
        ? null
        : Number(rawTargetId);
      if (!reason || !Number.isSafeInteger(reportedUserId) || reportedUserId <= 0 ||
        reportedUserId === req.user!.id ||
        (targetId !== null && (!Number.isSafeInteger(targetId) || targetId <= 0))) {
        return res.status(400).json({ error: "Şikayet nedeni ve kullanıcı gerekli" });
      }
      const report = await createModerationReport({
        reporterId: req.user!.id,
        reportedUserId,
        targetType: targetType || "user",
        targetId,
        reason,
        details: String(req.body?.details || "").trim().slice(0, 1000) || null,
      });
      return res.status(report.duplicate ? 200 : 201).json({ success: true, ...report });
    } catch (error) {
      console.error("Report create error:", error instanceof Error ? error.message : error);
      return res.status(500).json({ error: "Şikayet kaydedilemedi" });
  }
});

export default router;
