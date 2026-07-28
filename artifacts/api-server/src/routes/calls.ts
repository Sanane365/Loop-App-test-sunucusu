import { Router } from "express";
import { db } from "@workspace/db";
import { callSignalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── POST /calls/offer ──────────────────────────────────────────────────────
router.post("/calls/offer", requireAuth, async (req, res) => {
  const { callId, callType, calleeId, sdp } = req.body as {
    callId: string; callType: string; calleeId: number;
    sdp: object;
  };
  if (!callId || !sdp || !calleeId) return res.status(400).json({ error: "missing fields" });

  await db.insert(callSignalsTable).values({
    id:       callId,
    callType,
    callerId: req.user!.id,
    calleeId,
    offerSdp: JSON.stringify(sdp),
  }).onConflictDoNothing();

  return res.json({ ok: true });
});

// ── GET /calls/:callId ─────────────────────────────────────────────────────
router.get("/calls/:callId", requireAuth, async (req, res) => {
  const rows = await db
    .select()
    .from(callSignalsTable)
    .where(eq(callSignalsTable.id, req.params.callId))
    .limit(1);

  if (!rows.length) return res.status(404).json({ error: "not found" });

  const row = rows[0];
  return res.json({
    callId:    row.id,
    callType:  row.callType,
    callerId:  row.callerId,
    calleeId:  row.calleeId,
    offer:     row.offerSdp     ? JSON.parse(row.offerSdp)     : null,
    answer:    row.answerSdp    ? JSON.parse(row.answerSdp)    : null,
    callerIce: row.callerIce    ? JSON.parse(row.callerIce)    : [],
    calleeIce: row.calleeIce    ? JSON.parse(row.calleeIce)    : [],
    ended:     row.ended,
  });
});

// ── POST /calls/answer ────────────────────────────────────────────────────
router.post("/calls/answer", requireAuth, async (req, res) => {
  const { callId, sdp } = req.body as { callId: string; sdp: object };
  if (!callId || !sdp) return res.status(400).json({ error: "missing fields" });

  const rows = await db
    .select({ id: callSignalsTable.id })
    .from(callSignalsTable)
    .where(eq(callSignalsTable.id, callId))
    .limit(1);

  if (!rows.length) return res.status(404).json({ error: "not found" });

  await db
    .update(callSignalsTable)
    .set({ answerSdp: JSON.stringify(sdp) })
    .where(eq(callSignalsTable.id, callId));

  return res.json({ ok: true });
});

// ── POST /calls/ice ───────────────────────────────────────────────────────
router.post("/calls/ice", requireAuth, async (req, res) => {
  const { callId, candidate, role } = req.body as {
    callId: string; candidate: object; role: "caller" | "callee";
  };
  if (!callId || !candidate || !role) return res.status(400).json({ error: "missing fields" });

  const rows = await db
    .select()
    .from(callSignalsTable)
    .where(eq(callSignalsTable.id, callId))
    .limit(1);

  if (!rows.length) return res.status(404).json({ error: "not found" });

  const row = rows[0];
  const existing: object[] = JSON.parse(
    role === "caller" ? row.callerIce : row.calleeIce
  );
  existing.push(candidate);

  if (role === "caller") {
    await db
      .update(callSignalsTable)
      .set({ callerIce: JSON.stringify(existing) })
      .where(eq(callSignalsTable.id, callId));
  } else {
    await db
      .update(callSignalsTable)
      .set({ calleeIce: JSON.stringify(existing) })
      .where(eq(callSignalsTable.id, callId));
  }

  return res.json({ ok: true });
});

// ── POST /calls/end ───────────────────────────────────────────────────────
router.post("/calls/end", requireAuth, async (req, res) => {
  const { callId } = req.body as { callId: string };
  if (callId) {
    await db
      .update(callSignalsTable)
      .set({ ended: true })
      .where(eq(callSignalsTable.id, callId))
      .catch(() => {});
  }
  return res.json({ ok: true });
});

export default router;
