import { useEffect, useState } from "react";

type Props = { src: string; className?: string; isReferenceFrame?: boolean; offsetX?: number; offsetY?: number; scale?: number };

const REFERENCE_FRAME_PLACEMENT = {
  cropLeft: 156 / 1920,
  cropTop: 320 / 2396,
  cropWidth: (1784 - 156 + 1) / 1920,
  cropHeight: (2104 - 320 + 1) / 2396,
  top: "-4.1667%",
  height: "108.3333%",
} as const;
const NORMALIZED_FRAME_SIZE = 1000;

export function NormalizedFrame({ src, className = "", isReferenceFrame = false, offsetX = 0, offsetY = 0, scale = 1 }: Props) {
  const [normalizedSrc, setNormalizedSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      const sourceContext = sourceCanvas.getContext("2d");
      if (!sourceContext) return;
      sourceContext.drawImage(image, 0, 0);
      let minX = sourceCanvas.width * REFERENCE_FRAME_PLACEMENT.cropLeft;
      let minY = sourceCanvas.height * REFERENCE_FRAME_PLACEMENT.cropTop;
      let width = sourceCanvas.width * REFERENCE_FRAME_PLACEMENT.cropWidth;
      let height = sourceCanvas.height * REFERENCE_FRAME_PLACEMENT.cropHeight;
      if (!isReferenceFrame) {
        const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
        let maxX = -1;
        let maxY = -1;
        minX = sourceCanvas.width;
        minY = sourceCanvas.height;
        for (let y = 0; y < sourceCanvas.height; y += 2) {
          for (let x = 0; x < sourceCanvas.width; x += 2) {
            if (pixels[(y * sourceCanvas.width + x) * 4 + 3] > 8) {
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        if (maxX < minX || maxY < minY) return;
        width = maxX - minX + 1;
        height = maxY - minY + 1;
      }
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = NORMALIZED_FRAME_SIZE;
      cropCanvas.height = NORMALIZED_FRAME_SIZE;
      cropCanvas.getContext("2d")?.drawImage(image, minX, minY, width, height, 0, 0, NORMALIZED_FRAME_SIZE, NORMALIZED_FRAME_SIZE);
      if (!cancelled) setNormalizedSrc(cropCanvas.toDataURL("image/png"));
    };
    image.src = src;
    return () => { cancelled = true; };
  }, [src]);

  if (!normalizedSrc) return null;
  return <img src={normalizedSrc} alt="" aria-hidden="true" className={`pointer-events-none absolute left-0 z-10 w-full ${className}`} style={{ top: isReferenceFrame ? REFERENCE_FRAME_PLACEMENT.top : `calc(${REFERENCE_FRAME_PLACEMENT.top} - 3px)`, height: REFERENCE_FRAME_PLACEMENT.height, transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`, transformOrigin: "center" }} />;
}
