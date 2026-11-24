import { useEffect, useRef } from "react";

type TransparencyMode = "auto" | "none" | "green" | "white";

type ChromaKeyAnimationProps = {
  src: string;
  mimeType: string;
  transparencyMode?: TransparencyMode;
  keyingSensitivity?: "normal" | "high";
  edgeFade?: "none" | "top-bottom";
  muted?: boolean;
  className?: string;
  onEnded?: () => void;
  onError?: () => void;
};

const IMAGE_DISPLAY_DURATION_MS = 5000;
const MAX_PROCESSING_DIMENSION = 960;
const FRAME_INTERVAL_MS = 1000 / 24;
const MOBILE_MAX_PROCESSING_DIMENSION = 640;
const MOBILE_FRAME_INTERVAL_MS = 1000 / 18;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function removeBackground(context: CanvasRenderingContext2D, width: number, height: number, mode: Exclude<TransparencyMode, "none">, keyingSensitivity: "normal" | "high") {
  const frame = context.getImageData(0, 0, width, height);
  const pixels = frame.data;
  const greenStart = keyingSensitivity === "high" ? 4 : 18;
  const greenRange = keyingSensitivity === "high" ? 24 : 48;
  const whiteStart = keyingSensitivity === "high" ? 185 : 205;
  const whiteChromaLimit = 20;

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const brightness = (red + green + blue) / 3;
    let strength = 0;

    const greenDominance = green - Math.max(red, blue);
    const greenScreenPixel = keyingSensitivity === "high"
      ? green > 45 && greenDominance > greenStart && green > red * 1.02 && green > blue * 1.02
      : green > 70 && greenDominance > greenStart && green > red * 1.12 && green > blue * 1.12;
    const selectedGreenScreenPixel = mode === "green"
      ? green > 30 && greenDominance > (keyingSensitivity === "high" ? 2 : greenStart)
      : greenScreenPixel;
    const whiteScreenPixel = brightness > whiteStart && Math.max(red, green, blue) - Math.min(red, green, blue) < whiteChromaLimit;

    if (mode === "green" || (mode === "auto" && greenScreenPixel)) {
      strength = selectedGreenScreenPixel ? Math.max(0, Math.min(1, (greenDominance - (keyingSensitivity === "high" ? 2 : greenStart)) / greenRange)) : 0;
    } else if (mode === "white" || (mode === "auto" && whiteScreenPixel)) {
      strength = whiteScreenPixel ? Math.max(0, Math.min(1, (brightness - whiteStart) / 50)) : 0;
    }

    if (strength > 0) {
      pixels[index + 3] = Math.round(pixels[index + 3] * (1 - strength));
    }
  }

  context.putImageData(frame, 0, 0);
}

export function ChromaKeyAnimation({ src, mimeType, transparencyMode = "none", keyingSensitivity = "normal", edgeFade = "none", muted = false, className = "", onEnded, onError }: ChromaKeyAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const animationEndedRef = useRef(false);
  const imageEndTimerRef = useRef<number | null>(null);

  onEndedRef.current = onEnded;
  onErrorRef.current = onError;

  const finishAnimation = () => {
    if (animationEndedRef.current) return;
    animationEndedRef.current = true;
    onEndedRef.current?.();
  };

  const failAnimation = () => {
    onErrorRef.current?.();
    finishAnimation();
  };

  const startImageEndTimer = () => {
    if (imageEndTimerRef.current !== null) return;
    imageEndTimerRef.current = window.setTimeout(finishAnimation, IMAGE_DISPLAY_DURATION_MS);
  };

  useEffect(() => {
    animationEndedRef.current = false;
    return () => {
      if (imageEndTimerRef.current !== null) {
        window.clearTimeout(imageEndTimerRef.current);
        imageEndTimerRef.current = null;
      }
    };
  }, [src, mimeType]);

  useEffect(() => {
    if (transparencyMode === "none") return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const image = imageRef.current;
    if (!canvas || (!video && !image)) return;

    const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
    if (!context) {
      failAnimation();
      return;
    }

    let frameId = 0;
    let videoFrameId = 0;
    let stopped = false;
    let lastDrawAt = 0;
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const maxProcessingDimension = mobile ? MOBILE_MAX_PROCESSING_DIMENSION : MAX_PROCESSING_DIMENSION;
    const frameInterval = mobile ? MOBILE_FRAME_INTERVAL_MS : FRAME_INTERVAL_MS;
    const videoWithFrameCallback = video as VideoWithFrameCallback | null;
    const drawFrame = () => {
      const source = video ?? image;
      if (video && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return true;
      const sourceWidth = video?.videoWidth || image?.naturalWidth || 1;
      const sourceHeight = video?.videoHeight || image?.naturalHeight || 1;
      if (source && sourceWidth > 1 && sourceHeight > 1) {
        const scale = Math.min(1, maxProcessingDimension / sourceWidth, maxProcessingDimension / sourceHeight);
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        try {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(source, 0, 0, width, height);
          removeBackground(context, canvas.width, canvas.height, transparencyMode, keyingSensitivity);
        } catch (error) {
          console.error("Şeffaf animasyon karesi işlenemedi", error);
          failAnimation();
          return false;
        }
      }
      return true;
    };

    if (videoWithFrameCallback?.requestVideoFrameCallback) {
      const drawVideoFrame = () => {
        videoFrameId = videoWithFrameCallback.requestVideoFrameCallback!((now) => {
          if (stopped) return;
          if (now - lastDrawAt >= frameInterval) {
            lastDrawAt = now;
            if (!drawFrame()) return;
          }
          drawVideoFrame();
        });
      };
      drawVideoFrame();
    } else {
      const draw = (timestamp: number) => {
        if (stopped) return;
        if (timestamp - lastDrawAt >= frameInterval) {
          lastDrawAt = timestamp;
          if (!drawFrame()) return;
        }
        frameId = window.requestAnimationFrame(draw);
      };
      frameId = window.requestAnimationFrame(draw);
    }
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      if (videoFrameId && videoWithFrameCallback?.cancelVideoFrameCallback) {
        videoWithFrameCallback.cancelVideoFrameCallback(videoFrameId);
      }
    };
  }, [transparencyMode, keyingSensitivity, src]);

  if (transparencyMode === "none") {
    return mimeType === "image/gif" ? (
    <img crossOrigin="anonymous" src={src} alt="" className={`${className} ${edgeFade === "top-bottom" ? "live-gift-edge-fade" : ""}`} onLoad={startImageEndTimer} onError={failAnimation} />
    ) : (
    <video crossOrigin="anonymous" src={src} autoPlay muted={muted} playsInline onLoadedData={event => { const video = event.currentTarget; video.muted = muted; void video.play().catch(() => { if (muted) { failAnimation(); return; } video.muted = true; void video.play().catch(failAnimation); }); }} onEnded={finishAnimation} onError={failAnimation} className={`${className} ${edgeFade === "top-bottom" ? "live-gift-edge-fade" : ""}`} />
    );
  }

  return (
    <>
      {mimeType === "image/gif" ? (
        <img ref={imageRef} crossOrigin="anonymous" src={src} alt="" onLoad={startImageEndTimer} onError={failAnimation} className="pointer-events-none absolute inset-0 h-full w-full opacity-0" />
      ) : (
        <video ref={videoRef} crossOrigin="anonymous" src={src} autoPlay muted={muted} playsInline onLoadedData={event => { const video = event.currentTarget; video.muted = muted; void video.play().catch(() => { if (muted) { failAnimation(); return; } video.muted = true; void video.play().catch(failAnimation); }); }} onEnded={finishAnimation} onError={failAnimation} className="pointer-events-none absolute inset-0 h-full w-full" style={{ opacity: 0.001 }} />
      )}
      <canvas ref={canvasRef} className={`${className} chroma-key-animation ${edgeFade === "top-bottom" ? "live-gift-edge-fade" : ""}`} aria-hidden="true" />
    </>
  );
}
