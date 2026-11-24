export const VIDEO_MUTED_STORAGE_KEY = "loop-video-muted";

export function getStoredVideoMuted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(VIDEO_MUTED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function storeVideoMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(VIDEO_MUTED_STORAGE_KEY, String(muted));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}
