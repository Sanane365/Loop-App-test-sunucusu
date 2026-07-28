import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── In-memory signaling store ──────────────────────────────────────────────
interface CallSignal {
  callId: string;
  callType: "voice" | "video";
  callerId: number;
  calleeId: number;
  offer:    RTCSessionDescriptionInit | null;
  answer:   RTCSessionDescriptionInit | null;
  callerIce: RTCIceCandidateInit[];
  calleeIce: RTCIceCandidateInit[];
  ended:    boolean;
  createdAt: number;
}

const calls = new Map<string, CallSignal>();

// Temizleme — 10 dk eski aramalar silinir
setInterval(() => {
  const now = Date.now();
  calls.forEach((c, id) => {
    if (now - c.createdAt > 10 * 60 * 1000) calls.delete(id);
  });
}, 60_000);

// ── POST /api/calls/offer ──────────────────────────────────────────────────
router.post("/api/calls/offer", requireAuth, (req, res) => {
  const { callId, callType, calleeId, sdp } = req.body as {
    callId: string; callType: "voice" | "video"; calleeId: number;
    sdp: RTCSessionDescriptionInit;
  };
  if (!callId || !sdp || !calleeId) return res.status(400).json({ error: "missing fields" });

  calls.set(callId, {
    callId, callType, callerId: req.user!.id, calleeId,
    offer: sdp, answer: null,
    callerIce: [], calleeIce: [],
    ended: false, createdAt: Date.now(),
  });
  return res.json({ ok: true });
});

// ── GET /api/calls/:callId ─────────────────────────────────────────────────
router.get("/api/calls/:callId", requireAuth, (req, res) => {
  const call = calls.get(req.params.callId);
  if (!call) return res.status(404).json({ error: "not found" });
  return res.json(call);
});

// ── POST /api/calls/answer ────────────────────────────────────────────────
router.post("/api/calls/answer", requireAuth, (req, res) => {
  const { callId, sdp } = req.body as { callId: string; sdp: RTCSessionDescriptionInit };
  const call = calls.get(callId);
  if (!call) return res.status(404).json({ error: "not found" });
  call.answer = sdp;
  return res.json({ ok: true });
});

// ── POST /api/calls/ice ───────────────────────────────────────────────────
router.post("/api/calls/ice", requireAuth, (req, res) => {
  const { callId, candidate, role } = req.body as {
    callId: string; candidate: RTCIceCandidateInit; role: "caller" | "callee";
  };
  const call = calls.get(callId);
  if (!call) return res.status(404).json({ error: "not found" });
  if (role === "caller") call.callerIce.push(candidate);
  else call.calleeIce.push(candidate);
  return res.json({ ok: true });
});

// ── POST /api/calls/end ───────────────────────────────────────────────────
router.post("/api/calls/end", requireAuth, (req, res) => {
  const { callId } = req.body as { callId: string };
  const call = calls.get(callId);
  if (call) call.ended = true;
  return res.json({ ok: true });
});

export default router;
