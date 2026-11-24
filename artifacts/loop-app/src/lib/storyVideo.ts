const STORY_VIDEO_LIMIT_MS = 60_000;

function getSupportedRecorderMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export async function splitVideoForStories(source: File | string): Promise<File[]> {
  if (typeof MediaRecorder === "undefined") return [typeof source === "string" ? new File([], "video.webm", { type: "video/webm" }) : source];

  const blob = typeof source === "string"
    ? await fetch(source, { credentials: "include" }).then((response) => {
        if (!response.ok) throw new Error("Video yüklenemedi");
        return response.blob();
      })
    : source;
  const sourceUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = sourceUrl;
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video okunamadı"));
  });

  if (!Number.isFinite(video.duration) || video.duration <= 60) {
    URL.revokeObjectURL(sourceUrl);
    return [typeof source === "string" ? new File([blob], "story-video.webm", { type: blob.type || "video/webm" }) : source];
  }

  const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
  if (!stream) {
    URL.revokeObjectURL(sourceUrl);
    throw new Error("Bu tarayıcı video bölmeyi desteklemiyor");
  }
  const mimeType = getSupportedRecorderMimeType();
  const output: File[] = [];
  let segmentIndex = 0;
  let segmentStartedAt = 0;
  let recorder: MediaRecorder | null = null;
  let finished = false;

  await new Promise<void>((resolve, reject) => {
    const startSegment = () => {
      const chunks: Blob[] = [];
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("Video bölünemedi"));
      recorder.onstop = () => {
        if (chunks.length > 0) output.push(new File(chunks, `story-part-${segmentIndex + 1}.webm`, { type: mimeType || "video/webm" }));
        segmentIndex += 1;
        recorder = null;
        if (finished) resolve();
        else { segmentStartedAt = video.currentTime; startSegment(); void video.play().catch(reject); }
      };
      recorder.start(250);
    };
    video.onended = () => {
      finished = true;
      if (recorder?.state !== "inactive") recorder?.stop(); else resolve();
    };
    video.ontimeupdate = () => {
      if (!finished && video.currentTime - segmentStartedAt >= STORY_VIDEO_LIMIT_MS / 1000 && recorder?.state === "recording") {
        video.pause();
        recorder.stop();
      }
    };
    startSegment();
    void video.play().catch(reject);
  });

  stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
  URL.revokeObjectURL(sourceUrl);
  return output.length > 0 ? output : [typeof source === "string" ? new File([blob], "story-video.webm", { type: blob.type || "video/webm" }) : source];
}

export const STORY_VIDEO_LIMIT = 60;
