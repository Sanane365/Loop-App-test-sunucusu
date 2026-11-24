type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
};

export function revealVideoAfterFrame(video: HTMLVideoElement): void {
  const reveal = () => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.dataset.playing = "true";
    }
  };
  const videoWithFrameCallback = video as VideoWithFrameCallback;

  if (videoWithFrameCallback.requestVideoFrameCallback) {
    videoWithFrameCallback.requestVideoFrameCallback(reveal);
    return;
  }

  const revealAfterPaint = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(reveal));
  };

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    revealAfterPaint();
  } else {
    video.addEventListener("loadeddata", revealAfterPaint, { once: true });
  }
}
