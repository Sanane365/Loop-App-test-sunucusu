import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { isPrivilegedUser, requireAuth } from "../lib/auth";

const router = Router();
const filePath = path.resolve(import.meta.dirname, "..", "data", "interactive-stories.json");

type InteractiveOption = { id: string; label: string; nextStepId?: string | null };
type InteractiveStep = { id: string; title: string; text: string; options: InteractiveOption[] };
type InteractiveStory = {
  id: string;
  title: string;
  summary: string;
  eventTitle: string;
  eventText: string;
  options: InteractiveOption[];
  steps: InteractiveStep[];
  votes: Record<string, number>;
  voters: Record<string, string>;
  cover?: string;
  status: "ongoing" | "completed";
  published: boolean;
  createdAt: string;
  updatedAt: string;
  eventTag?: string;
  theme?: "night" | "ember" | "ocean" | "mint";
};

function readStories(): InteractiveStory[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as InteractiveStory[];
  } catch {
    return [];
  }
}

function writeStories(stories: InteractiveStory[]) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(stories, null, 2), "utf8");
}

function requireInteractiveAdmin(req: any, res: any, next: any) {
  if (!req.user || !isPrivilegedUser(req.user)) {
    res.status(403).json({ error: "Bu alanı yalnızca admin veya moderatör yayınlayabilir" });
    return;
  }
  next();
}

function normalizeSteps(input: any, fallbackTitle: string, fallbackText: string, fallbackOptions: InteractiveOption[]): InteractiveStep[] {
  const source = Array.isArray(input) ? input : [];
  const steps = source.map((step: any, stepIndex: number) => ({
    id: String(step.id || `step-${stepIndex + 1}`),
    title: String(step.title || "").trim().slice(0, 120),
    text: String(step.text || "").trim().slice(0, 20_000),
    options: (Array.isArray(step.options) ? step.options : []).map((option: any, optionIndex: number) => ({
      id: String(option.id || `option-${stepIndex + 1}-${optionIndex + 1}`),
      label: String(option.label || "").trim().slice(0, 160),
      nextStepId: option.nextStepId ? String(option.nextStepId) : null,
    })).filter((option: InteractiveOption) => option.label).slice(0, 8),
  })).filter((step: InteractiveStep) => step.title && step.text && step.options.length >= 2).slice(0, 20);
  return steps.length > 0 ? steps : [{ id: "step-1", title: fallbackTitle, text: fallbackText, options: fallbackOptions }];
}

router.get("/interactive-stories", (_req, res) => {
  res.json(readStories().filter(story => story.published).map(story => {
    const { voters: _voters, ...publicStory } = story;
    const steps = normalizeSteps(story.steps, story.eventTitle, story.eventText, story.options);
    return { ...publicStory, steps, options: steps[0].options, votes: story.votes ?? {} };
  }));
});

router.get("/admin/interactive-stories", requireAuth, requireInteractiveAdmin, (_req, res) => {
  res.json(readStories());
});

router.post("/admin/interactive-stories", requireAuth, requireInteractiveAdmin, (req, res) => {
  const body = req.body ?? {};
  const options = Array.isArray(body.options)
    ? body.options
        .map((option: any, index: number) => ({
          id: String(option.id || `option-${index + 1}`),
          label: String(option.label || "").trim().slice(0, 160),
        }))
        .filter((option: InteractiveOption) => option.label)
        .slice(0, 6)
    : [];

  if (!String(body.title || "").trim() || !String(body.eventTitle || "").trim() || !String(body.eventText || "").trim()) {
    res.status(400).json({ error: "Başlık ve olay metni gerekli" });
    return;
  }

  const normalizedSteps = normalizeSteps(body.steps, String(body.eventTitle), String(body.eventText), options);
  const now = new Date().toISOString();
  const story: InteractiveStory = {
    id: `interactive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(body.title).trim().slice(0, 120),
    summary: String(body.summary || "").trim().slice(0, 240),
    eventTitle: String(body.eventTitle).trim().slice(0, 120),
    eventText: String(body.eventText).trim().slice(0, 1000),
    options,
    steps: normalizedSteps,
    votes: {},
    voters: {},
    cover: typeof body.cover === "string" ? body.cover.slice(0, 2_000_000) : "",
    status: body.status === "completed" ? "completed" : "ongoing",
    published: true,
    createdAt: now,
    updatedAt: now,
    eventTag: String(body.eventTag || "").trim().slice(0, 80),
    theme: ["night", "ember", "ocean", "mint"].includes(body.theme) ? body.theme : "night",
  };
  const stories = [story, ...readStories()];
  writeStories(stories);
  res.status(201).json(story);
});

router.patch("/admin/interactive-stories/:id", requireAuth, requireInteractiveAdmin, (req, res) => {
  const stories = readStories();
  const index = stories.findIndex(story => story.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "İçerik bulunamadı" });
  const current = stories[index];
  const body = req.body ?? {};
  const steps = normalizeSteps(body.steps ?? current.steps, String(body.eventTitle ?? current.eventTitle), String(body.eventText ?? current.eventText), current.options);
  stories[index] = {
    ...current,
    title: String(body.title ?? current.title).trim().slice(0, 120),
    summary: String(body.summary ?? current.summary).trim().slice(0, 240),
    cover: typeof body.cover === "string" ? body.cover.slice(0, 2_000_000) : current.cover,
    status: body.status === "completed" ? "completed" : "ongoing",
    steps,
    eventTitle: steps[0]?.title ?? current.eventTitle,
    eventText: steps[0]?.text ?? current.eventText,
    options: steps[0]?.options ?? current.options,
    updatedAt: new Date().toISOString(),
    eventTag: String(body.eventTag ?? current.eventTag ?? "").trim().slice(0, 80),
    theme: ["night", "ember", "ocean", "mint"].includes(body.theme) ? body.theme : (current.theme ?? "night"),
  };
  writeStories(stories);
  res.json(stories[index]);
});

router.post("/interactive-stories/:id/vote", (req, res) => {
  const stories = readStories();
  const index = stories.findIndex(story => story.id === req.params.id && story.published);
  if (index < 0) return res.status(404).json({ error: "İçerik bulunamadı" });
  stories[index].steps = normalizeSteps(stories[index].steps, stories[index].eventTitle, stories[index].eventText, stories[index].options);
  const optionId = String(req.body?.optionId || "");
  const stepId = String(req.body?.stepId || stories[index].steps?.[0]?.id || "step-1");
  const step = stories[index].steps?.find(item => item.id === stepId);
  const valid = (step?.options ?? stories[index].options).some(option => option.id === optionId);
  if (!valid) return res.status(400).json({ error: "Geçersiz seçenek" });
  const visitorIdentity = `${req.ipAddress ?? req.ip ?? "unknown"}:${req.headers["user-agent"] ?? "unknown"}`;
  const voterId = req.user?.id ? `user:${req.user.id}` : `visitor:${createHash("sha256").update(visitorIdentity).digest("hex")}`;
  stories[index].voters = stories[index].voters ?? {};
  const voteKey = `${stepId}:${voterId}`;
  if (stories[index].voters[voteKey]) {
    return res.status(409).json({ error: "Bu hikâyede zaten oy kullandın", votes: stories[index].votes ?? {} });
  }
  stories[index].voters[voteKey] = optionId;
  stories[index].votes = stories[index].votes ?? {};
  stories[index].votes[optionId] = (stories[index].votes[optionId] ?? 0) + 1;
  writeStories(stories);
  res.json({ votes: stories[index].votes });
});

router.post("/interactive-stories/:id/options", requireAuth, (req, res) => {
  const stories = readStories();
  const index = stories.findIndex(story => story.id === req.params.id && story.published);
  if (index < 0) return res.status(404).json({ error: "İçerik bulunamadı" });
  const label = String(req.body?.label || "").trim().slice(0, 160);
  const stepId = String(req.body?.stepId || stories[index].steps?.[0]?.id || "step-1");
  if (!label) return res.status(400).json({ error: "Seçenek metni gerekli" });
  if (!stories[index].steps?.length) {
    stories[index].steps = [{ id: "step-1", title: stories[index].eventTitle, text: stories[index].eventText, options: stories[index].options }];
  }
  const step = stories[index].steps?.find(item => item.id === stepId);
  if (!step || step.options.length >= 8) return res.status(400).json({ error: "Bu sahneye daha fazla seçenek eklenemez" });
  const option = { id: `user-option-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, nextStepId: null };
  step.options.push(option);
  stories[index].votes = stories[index].votes ?? {};
  stories[index].votes[option.id] = 0;
  writeStories(stories);
  res.status(201).json({ option, votes: stories[index].votes });
});

router.patch("/admin/interactive-stories/:id/publish", requireAuth, requireInteractiveAdmin, (req, res) => {
  const stories = readStories();
  const index = stories.findIndex(story => story.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: "İçerik bulunamadı" });
  stories[index].published = !stories[index].published;
  stories[index].updatedAt = new Date().toISOString();
  writeStories(stories);
  res.json(stories[index]);
});

router.delete("/admin/interactive-stories/:id", requireAuth, requireInteractiveAdmin, (req, res) => {
  const stories = readStories();
  const next = stories.filter(story => story.id !== req.params.id);
  if (next.length === stories.length) return res.status(404).json({ error: "İçerik bulunamadı" });
  writeStories(next);
  res.status(204).send();
});

export default router;
