import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Image as ImageIcon,
  X,
  Camera,
  ArrowLeft,
  Film,
  Plus,
  Trash2,
  BarChart2,
  Pencil,
  BookOpen,
  AlignLeft,
  Feather,
  RotateCw,
  SlidersHorizontal,
  Type,
  Sparkles,
  Sticker,
  Music2,
  AtSign,
  PenTool,
  Undo2,
  ChevronDown,
  Users,
  Check,
  Shield,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Scissors,
  Move,
  Crop,
  Gauge,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListStoriesQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { splitVideoForStories } from "@/lib/storyVideo";

type PostType =
  | "post"
  | "bulletin"
  | "poll"
  | "book"
  | "trailer"
  | "column"
  | "micro";
type SharedBook = {
  id: string | number;
  title: string;
  cover?: string | null;
  author?: { displayName?: string } | null;
};
type ColumnStyle = {
  tone: "ink" | "forest" | "wine";
  weight: "normal" | "medium" | "strong";
  italic: boolean;
  highlighted: boolean;
};
type StoryTextBackground = "none" | "solid" | "white" | "translucent";
type StoryTextLayer = {
  text: string;
  color: string;
  background: StoryTextBackground;
  font: string;
  weight: "600" | "700" | "900";
  align: "left" | "center" | "right";
  position: { x: number; y: number };
  scale: number;
  rotation: number;
};
type StoryStickerLayer = {
  sticker: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
};
type StoryDrawLine = {
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  opacity: number;
};

const DEFAULT_COLUMN_STYLE: ColumnStyle = {
  tone: "ink",
  weight: "normal",
  italic: false,
  highlighted: false,
};

const STORY_CANVAS_WIDTH = 1080;
const STORY_CANVAS_HEIGHT = 1920;

export default function Create() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const isStoryMode = searchParams.get("type") === "story";
  const requestedType = searchParams.get("type");
  const initType = (
    ["bulletin", "poll", "book", "trailer", "column", "micro"] as string[]
  ).includes(requestedType ?? "")
    ? (requestedType as PostType)
    : "post";

  const [postType, setPostType] = useState<PostType>(initType);

  useEffect(() => {
    if (!isStoryMode) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isStoryMode]);
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [storyOverlayFile, setStoryOverlayFile] = useState<File | null>(null);
  const [storyOverlayPreview, setStoryOverlayPreview] = useState<string | null>(null);
  const [storyOverlayScale, setStoryOverlayScale] = useState(0.42);
  const [storyOverlayRotation, setStoryOverlayRotation] = useState(0);
  const [storyOverlayPosition, setStoryOverlayPosition] = useState({ x: 50, y: 58 });
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [books, setBooks] = useState<SharedBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [columnStyle, setColumnStyle] =
    useState<ColumnStyle>(DEFAULT_COLUMN_STYLE);
  const [storyBrightness, setStoryBrightness] = useState(100);
  const [storyContrast, setStoryContrast] = useState(100);
  const [storySaturation, setStorySaturation] = useState(100);
  const [storyWarmth, setStoryWarmth] = useState(0);
  const [storyVignette, setStoryVignette] = useState(0);
  const [storyZoom, setStoryZoom] = useState(100);
  const [storyRotation, setStoryRotation] = useState(0);
  const [storyText, setStoryText] = useState("");
  const [storyTextColor, setStoryTextColor] = useState("#ffffff");
  const [storyTextBackground, setStoryTextBackground] =
    useState<StoryTextBackground>("none");
  const [storyTextFont, setStoryTextFont] = useState("sans-serif");
  const [storyTextWeight, setStoryTextWeight] = useState<"600" | "700" | "900">(
    "700",
  );
  const [storyTextAlign, setStoryTextAlign] = useState<
    "left" | "center" | "right"
  >("center");
  const [storyLayout, setStoryLayout] = useState<"fit" | "fill" | "crop">(
    "fit",
  );
  const [storyCanvasZoom, setStoryCanvasZoom] = useState(1);
  const [storyCanvasPosition, setStoryCanvasPosition] = useState({
    x: 0,
    y: 0,
  });
  const [storyPlaying, setStoryPlaying] = useState(false);
  const [storyMuted, setStoryMuted] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyTrimStart, setStoryTrimStart] = useState(0);
  const [storyTrimEnd, setStoryTrimEnd] = useState(100);
  const [storySpeed, setStorySpeed] = useState(1);
  const [storyTool, setStoryTool] = useState<
    | "text"
    | "sticker"
    | "music"
    | "mention"
    | "draw"
    | "light"
    | "zoom"
    | "crop"
    | "photo"
    | null
  >(null);
  const [storyToolsOpen, setStoryToolsOpen] = useState(false);
  const [storySticker, setStorySticker] = useState<string | null>(null);
  const [storyStickerPosition, setStoryStickerPosition] = useState({ x: 50, y: 52 });
  const [storyStickerScale, setStoryStickerScale] = useState(1);
  const [storyStickerRotation, setStoryStickerRotation] = useState(0);
  const [storyStickerLayers, setStoryStickerLayers] = useState<StoryStickerLayer[]>([]);
  const [activeStoryStickerIndex, setActiveStoryStickerIndex] = useState<number | null>(null);
  const storyStickerDragRef = useRef<{ x: number; y: number; position: { x: number; y: number } } | null>(null);
  const storyStickerTouchRef = useRef<{ distance: number; angle: number; scale: number; rotation: number } | null>(null);
  const storyStickerTouchStartRef = useRef<{ x: number; y: number; position: { x: number; y: number } } | null>(null);
  const storyStickerRotateRef = useRef<{ centerX: number; centerY: number; angle: number; rotation: number } | null>(null);
  const storyStickerResizeRef = useRef<{ centerX: number; centerY: number; distance: number; scale: number } | null>(null);
  const [storyMusic, setStoryMusic] = useState("");
  const [storyAudience, setStoryAudience] = useState<"story" | "close-friends">(
    "story",
  );
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityUsers, setVisibilityUsers] = useState<any[]>([]);
  const [excludedUserIds, setExcludedUserIds] = useState<number[]>([]);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [storyDrawColor, setStoryDrawColor] = useState("#ff4f81");
  const [storyDrawWidth, setStoryDrawWidth] = useState(0.7);
  const [storyDrawOpacity, setStoryDrawOpacity] = useState(1);
  const [storyDrawLines, setStoryDrawLines] = useState<StoryDrawLine[]>([]);
  const [storyDrawing, setStoryDrawing] = useState(false);
  const [storyTextPosition, setStoryTextPosition] = useState({ x: 50, y: 38 });
  const [storyTextScale, setStoryTextScale] = useState(1);
  const [storyTextRotation, setStoryTextRotation] = useState(0);
  const [storyTextDragging, setStoryTextDragging] = useState(false);
  const [storyTextLayers, setStoryTextLayers] = useState<StoryTextLayer[]>([]);
  const [activeStoryTextIndex, setActiveStoryTextIndex] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [storyStickerIndex, setStoryStickerIndex] = useState(0);
  const [storyMusicIndex, setStoryMusicIndex] = useState(0);
  const storyTextInputRef = useRef<HTMLTextAreaElement>(null);
  const updateStoryText = (value: string) => {
    setStoryText(value);
    if (storyTextInputRef.current && storyTextInputRef.current.value !== value) {
      storyTextInputRef.current.value = value;
    }
  };
  useEffect(() => {
    if (activeStoryTextIndex === null) return;
    setStoryTextLayers((layers) => layers.map((layer, index) => index === activeStoryTextIndex ? {
      ...layer,
      text: storyText,
      color: storyTextColor,
      background: storyTextBackground,
      font: storyTextFont,
      weight: storyTextWeight,
      align: storyTextAlign,
      position: storyTextPosition,
      scale: storyTextScale,
      rotation: storyTextRotation,
    } : layer));
  }, [activeStoryTextIndex, storyText, storyTextColor, storyTextBackground, storyTextFont, storyTextWeight, storyTextAlign, storyTextPosition, storyTextScale, storyTextRotation]);
  const addStoryTextLayer = () => {
    const text = (storyTextInputRef.current?.value ?? storyText).trim();
    if (activeStoryTextIndex !== null) {
      setActiveStoryTextIndex(null);
      updateStoryText("");
      window.requestAnimationFrame(() => storyTextInputRef.current?.focus());
      return;
    }
    if (!text) return;
    const layer = {
      text,
      color: storyTextColor,
      background: storyTextBackground,
      font: storyTextFont,
      weight: storyTextWeight,
      align: storyTextAlign,
      position: storyTextPosition,
      scale: storyTextScale,
      rotation: storyTextRotation,
    };
    setStoryTextLayers((layers) => [
      ...layers,
      { ...layer, position: { x: Math.max(18, Math.min(82, 50 + layers.length * 5)), y: Math.max(20, Math.min(76, 38 + layers.length * 6)) } },
    ]);
    setActiveStoryTextIndex(null);
    updateStoryText("");
    window.requestAnimationFrame(() => storyTextInputRef.current?.focus());
  };
  const editStoryTextLayer = (index: number) => {
    const layer = storyTextLayers[index];
    if (!layer) return;
    if (activeStoryTextIndex !== null && activeStoryTextIndex !== index) {
      setStoryTextLayers((layers) => layers.map((existing, layerIndex) => layerIndex === activeStoryTextIndex ? {
        ...existing,
        text: storyText,
        color: storyTextColor,
        background: storyTextBackground,
        font: storyTextFont,
        weight: storyTextWeight,
        align: storyTextAlign,
        position: storyTextPosition,
        scale: storyTextScale,
        rotation: storyTextRotation,
      } : existing));
    }
    setActiveStoryTextIndex(index);
    setStoryText(layer.text);
    setStoryTextColor(layer.color);
    setStoryTextBackground(layer.background);
    setStoryTextFont(layer.font);
    setStoryTextWeight(layer.weight);
    setStoryTextAlign(layer.align);
    setStoryTextPosition(layer.position);
    setStoryTextScale(layer.scale);
    setStoryTextRotation(layer.rotation);
    setStoryTool("text");
    window.requestAnimationFrame(() => storyTextInputRef.current?.focus());
  };
  const removeStoryTextLayer = (index: number) => {
    setStoryTextLayers((layers) => layers.filter((_, layerIndex) => layerIndex !== index));
    if (activeStoryTextIndex === index) {
      setActiveStoryTextIndex(null);
      updateStoryText("");
      setStoryTool(null);
    } else if (activeStoryTextIndex !== null && activeStoryTextIndex > index) {
      setActiveStoryTextIndex((current) => current === null ? null : current - 1);
    }
  };
  const handleStickerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    storyStickerDragRef.current = { x: event.clientX, y: event.clientY, position: storyStickerPosition };
  };
  const handleStickerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = storyStickerDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setStoryStickerPosition({
      x: Math.max(10, Math.min(90, drag.position.x + ((event.clientX - drag.x) / bounds.width) * 100)),
      y: Math.max(10, Math.min(90, drag.position.y + ((event.clientY - drag.y) / bounds.height) * 100)),
    });
  };
  const handleStickerPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    storyStickerDragRef.current = null;
  };
  const handleStickerTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.touches.length === 2) {
      const [first, second] = [event.touches[0], event.touches[1]];
      storyStickerTouchRef.current = {
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        angle: Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX) * 180 / Math.PI,
        scale: storyStickerScale,
        rotation: storyStickerRotation,
      };
      storyStickerTouchStartRef.current = null;
    } else if (event.touches.length === 1) {
      storyStickerTouchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, position: storyStickerPosition };
    }
  };
  const handleStickerTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const [first, second] = [event.touches[0], event.touches[1]];
    if (event.touches.length === 2 && storyStickerTouchRef.current && second) {
      event.preventDefault();
      const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
      const angle = Math.atan2(second.clientY - first.clientY, second.clientX - first.clientX) * 180 / Math.PI;
      setStoryStickerScale(Math.max(0.35, Math.min(4, storyStickerTouchRef.current.scale * distance / Math.max(1, storyStickerTouchRef.current.distance))));
      setStoryStickerRotation(storyStickerTouchRef.current.rotation + angle - storyStickerTouchRef.current.angle);
      return;
    }
    if (event.touches.length === 1 && storyStickerTouchStartRef.current) {
      const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
      if (!bounds) return;
      const start = storyStickerTouchStartRef.current;
      setStoryStickerPosition({ x: Math.max(10, Math.min(90, start.position.x + ((first.clientX - start.x) / bounds.width) * 100)), y: Math.max(10, Math.min(90, start.position.y + ((first.clientY - start.y) / bounds.height) * 100)) });
    }
  };
  const handleStickerTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    storyStickerTouchRef.current = null;
    storyStickerTouchStartRef.current = null;
  };
  const handleStickerRotateStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    storyStickerRotateRef.current = {
      centerX,
      centerY,
      angle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
      rotation: storyStickerRotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleStickerRotateMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rotate = storyStickerRotateRef.current;
    if (!rotate) return;
    event.stopPropagation();
    const angle = Math.atan2(event.clientY - rotate.centerY, event.clientX - rotate.centerX) * 180 / Math.PI;
    setStoryStickerRotation(rotate.rotation + angle - rotate.angle);
  };
  const handleStickerRotateEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    storyStickerRotateRef.current = null;
  };
  const handleStickerResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    storyStickerResizeRef.current = { centerX, centerY, distance: Math.hypot(event.clientX - centerX, event.clientY - centerY), scale: storyStickerScale };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleStickerResizeMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = storyStickerResizeRef.current;
    if (!resize) return;
    event.stopPropagation();
    const distance = Math.hypot(event.clientX - resize.centerX, event.clientY - resize.centerY);
    setStoryStickerScale(Math.max(0.35, Math.min(4, resize.scale * distance / Math.max(1, resize.distance))));
  };
  const handleStickerResizeEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    storyStickerResizeRef.current = null;
  };
  useEffect(() => {
    if (activeStoryStickerIndex === null || !storySticker) return;
    setStoryStickerLayers((layers) => layers.map((layer, index) => index === activeStoryStickerIndex ? {
      sticker: storySticker,
      position: storyStickerPosition,
      scale: storyStickerScale,
      rotation: storyStickerRotation,
    } : layer));
  }, [activeStoryStickerIndex, storySticker, storyStickerPosition, storyStickerScale, storyStickerRotation]);
  const addStoryStickerLayer = () => {
    if (!storySticker) return;
    if (activeStoryStickerIndex !== null) {
      setActiveStoryStickerIndex(null);
      setStorySticker(null);
      return;
    }
    setStoryStickerLayers((layers) => [...layers, {
      sticker: storySticker,
      position: { x: Math.max(15, Math.min(85, 50 + layers.length * 5)), y: Math.max(15, Math.min(80, 52 + layers.length * 5)) },
      scale: storyStickerScale,
      rotation: storyStickerRotation,
    }]);
    setStorySticker(null);
  };
  const selectStorySticker = (sticker: string) => {
    if (storySticker && activeStoryStickerIndex === null) {
      setStoryStickerLayers((layers) => [...layers, {
        sticker: storySticker,
        position: storyStickerPosition,
        scale: storyStickerScale,
        rotation: storyStickerRotation,
      }]);
    }
    setActiveStoryStickerIndex(null);
    setStorySticker(sticker);
    setStoryStickerPosition({ x: 50, y: 52 });
    setStoryStickerScale(1);
    setStoryStickerRotation(0);
    setStoryTool(null);
  };
  const editStoryStickerLayer = (index: number) => {
    const layer = storyStickerLayers[index];
    if (!layer) return;
    setActiveStoryStickerIndex(index);
    setStorySticker(layer.sticker);
    setStoryStickerPosition(layer.position);
    setStoryStickerScale(layer.scale);
    setStoryStickerRotation(layer.rotation);
    setStoryTool("sticker");
  };
  const storyVideoRef = useRef<HTMLVideoElement>(null);
  const storyGestureRef = useRef<{
    distance: number;
    centerX: number;
    centerY: number;
    startZoom: number;
    startPosition: { x: number; y: number };
    pointerId?: number;
  } | null>(null);
  const storyDragRef = useRef<{
    x: number;
    y: number;
    startPosition: { x: number; y: number };
    mode?: "pending" | "pan";
  } | null>(null);
  const storyTextPointers = useRef(new Map<number, { x: number; y: number }>());
  const storyTextPinchRef = useRef<{
    distance: number;
    scale: number;
    angle: number;
    rotation: number;
  } | null>(null);
  const storyTextGestureActive = useRef(false);
  const storyTextTouchRef = useRef<{
    distance: number;
    scale: number;
    angle: number;
    rotation: number;
  } | null>(null);
  const storyTextTouchStart = useRef<{ x: number; y: number } | null>(null);
  const storyOverlayTouchRef = useRef<{ distance: number; scale: number; angle: number; rotation: number } | null>(null);
  const storyOverlayTouchStart = useRef<{ x: number; y: number } | null>(null);
  const storyTextResizeRef = useRef<{
    centerX: number;
    centerY: number;
    distance: number;
    scale: number;
  } | null>(null);
  const storyTextRotateRef = useRef<{
    centerX: number;
    centerY: number;
    angle: number;
    rotation: number;
  } | null>(null);
  const [storyEffectIndex, setStoryEffectIndex] = useState(0);
  const [showEffectHint, setShowEffectHint] = useState(false);
  const storySwipeStart = useRef<number | null>(null);

  const storyEffects = [
    { label: "Orijinal", filter: "none" },
    {
      label: "Sıcak ışık",
      filter: "sepia(0.35) saturate(1.25) contrast(1.05)",
    },
    { label: "Siyah beyaz", filter: "grayscale(1) contrast(1.08)" },
    {
      label: "Serin ton",
      filter: "saturate(1.15) hue-rotate(14deg) contrast(1.04)",
    },
    {
      label: "Canlı",
      filter: "saturate(1.55) contrast(1.12) brightness(1.04)",
    },
    {
      label: "Soluk film",
      filter: "sepia(0.18) saturate(0.7) contrast(0.92) brightness(1.08)",
    },
    {
      label: "Neon gece",
      filter: "saturate(1.8) contrast(1.15) hue-rotate(28deg) brightness(0.94)",
    },
    {
      label: "Portre",
      filter: "saturate(1.2) contrast(1.04) brightness(1.06) sepia(0.08)",
    },
    {
      label: "Retro",
      filter: "sepia(0.48) saturate(1.3) contrast(1.18) hue-rotate(-8deg)",
    },
    {
      label: "Buz",
      filter:
        "saturate(0.82) contrast(1.1) brightness(1.12) hue-rotate(165deg)",
    },
    {
      label: "Gün batımı",
      filter: "sepia(0.28) saturate(1.65) contrast(1.08) hue-rotate(-18deg)",
    },
    {
      label: "Rüya",
      filter: "saturate(1.2) contrast(0.86) brightness(1.12) blur(0.2px)",
    },
    { label: "Kontrast", filter: "contrast(1.38) saturate(1.2)" },
    { label: "Mat", filter: "contrast(0.86) saturate(0.82) brightness(1.06)" },
    {
      label: "Kobalt",
      filter: "saturate(1.35) hue-rotate(195deg) contrast(1.12)",
    },
    {
      label: "Şeker",
      filter: "saturate(1.5) hue-rotate(315deg) brightness(1.08)",
    },
    {
      label: "Solgun gölge",
      filter: "brightness(0.82) contrast(1.22) saturate(0.72) sepia(0.12)",
    },
    {
      label: "Tozlu film",
      filter: "brightness(1.08) contrast(0.84) saturate(0.68) sepia(0.2)",
    },
    {
      label: "Glow",
      filter: "brightness(1.12) contrast(0.9) saturate(1.22) blur(0.15px)",
    },
    {
      label: "Yumuşak ışık",
      filter: "brightness(1.16) contrast(0.8) saturate(0.92) blur(0.25px)",
    },
    {
      label: "Moody",
      filter: "brightness(0.72) contrast(1.3) saturate(0.82) hue-rotate(342deg)",
    },
    {
      label: "Amber",
      filter: "sepia(0.52) saturate(1.45) contrast(1.08) hue-rotate(-12deg)",
    },
    {
      label: "Lavanta",
      filter: "saturate(0.82) brightness(1.08) hue-rotate(278deg) contrast(0.96)",
    },
    {
      label: "Y2K",
      filter: "saturate(1.7) contrast(1.08) brightness(1.04) hue-rotate(318deg)",
    },
    {
      label: "VHS",
      filter: "contrast(1.24) saturate(1.2) brightness(0.94) hue-rotate(8deg)",
    },
    {
      label: "Polaroid",
      filter: "brightness(1.12) contrast(0.88) saturate(0.82) sepia(0.14)",
    },
    {
      label: "Lomo",
      filter: "contrast(1.32) saturate(1.3) brightness(0.92)",
    },
    {
      label: "Deniz",
      filter: "saturate(1.3) contrast(1.08) brightness(1.03) hue-rotate(145deg)",
    },
    {
      label: "Kiraz",
      filter: "saturate(1.48) contrast(1.1) brightness(1.02) hue-rotate(-28deg)",
    },
    {
      label: "Gece mavisi",
      filter: "brightness(0.68) contrast(1.2) saturate(1.18) hue-rotate(190deg)",
    },
    {
      label: "Beyaz perde",
      filter: "brightness(1.2) contrast(0.76) saturate(0.62) blur(0.12px)",
    },
  ] as const;
  const storyStickers = [
    "✨", "❤️", "🔥", "😂", "🌈", "⭐", "💫", "🎉", "🌸", "☀️",
    "🫶", "🍀", "🎈", "💎", "🦋", "✅", "💡", "👀", "🥰", "😍",
    "😘", "🤍", "🖤", "💜", "💙", "💚", "💛", "🧡", "💖", "💯",
    "👏", "🙌", "🤌", "😎", "🤩", "🥳", "😜", "🤪", "😇", "😭",
    "🤣", "😮", "😱", "🤯", "😴", "🫠", "🌟", "🌙", "🌻", "🌷",
    "🌺", "🍓", "🍒", "🍋", "🍉", "🧋", "🍕", "🎧",
    "🎵", "📸", "💌", "🔒", "🪩", "🚀", "🧿", "🧸", "🪽", "🕊️",
  ] as const;
  const storyMusicTracks = [
    "Loop gece",
    "Yaz ritmi",
    "Sakin an",
    "Keşfet",
  ] as const;
  const storyDrawColors = [
    "#ff4f81",
    "#ffd166",
    "#ffffff",
    "#55d6be",
    "#8b5cf6",
  ] as const;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const storyOverlayInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const selectedBook =
    books.find((book) => String(book.id) === selectedBookId) ?? null;

  useEffect(() => {
    if (searchParams.get("streak") !== "1") return;
    const streakDraft = localStorage.getItem("loop_streak_share_draft");
    if (!streakDraft) return;
    setContent(streakDraft);
    localStorage.removeItem("loop_streak_share_draft");
    toast({
      title: "Anı şablonu taslağa eklendi",
      description: "Paylaşmadan önce metni düzenleyebilirsin.",
    });
  }, []);

  useEffect(() => {
    if (postType !== "book") return;
    fetch("/api/books", { credentials: "include", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        const availableBooks = Array.isArray(data)
          ? (data as SharedBook[])
          : [];
        setBooks(availableBooks);
        setSelectedBookId(
          (current) =>
            current || (availableBooks[0] ? String(availableBooks[0].id) : ""),
        );
      })
      .catch(() => setBooks([]));
  }, [postType]);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "media" | "background" | "overlay" = "media",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === "background") {
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file));
      return;
    }

    if (target === "overlay") {
      setStoryOverlayFile(file);
      setStoryOverlayPreview(URL.createObjectURL(file));
      setStoryTool("photo");
      return;
    }

    const selectedFiles = target === "media" && postType !== "trailer" && file.type.startsWith("image/")
      ? Array.from(e.target.files ?? []).filter(item => item.type.startsWith("image/"))
      : [file];
    const previews = selectedFiles.map(item => URL.createObjectURL(item));
    setMediaFiles(selectedFiles);
    setMediaFile(selectedFiles[0] ?? null);
    setMediaPreviews(previews);
    setMediaPreview(previews[0] ?? null);
    if (target === "media") {
      setStoryTool(null);
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaFiles([]);
    setMediaPreview(null);
    setMediaPreviews([]);
    setStoryOverlayFile(null);
    setStoryOverlayPreview(null);
    setStoryOverlayScale(0.42);
    setStoryOverlayRotation(0);
    setStoryOverlayPosition({ x: 50, y: 58 });
    if (fileInputRef.current) fileInputRef.current.value = "";
    updateStoryText("");
    setStoryTextLayers([]);
    setActiveStoryTextIndex(null);
    setStoryTextLayers([]);
    setStoryTool(null);
    setStorySticker(null);
    setStoryStickerLayers([]);
    setActiveStoryStickerIndex(null);
    setStoryStickerPosition({ x: 50, y: 52 });
    setStoryStickerScale(1);
    setStoryStickerRotation(0);
    setStoryMusic("");
    setStoryDrawLines([]);
    setStoryDrawing(false);
    setStoryStickerIndex(0);
    setStoryMusicIndex(0);
    setStoryLayout("fit");
    setStoryCanvasZoom(1);
    setStoryCanvasPosition({ x: 0, y: 0 });
    setStoryOverlayScale(0.42);
    setStoryOverlayRotation(0);
    setStoryOverlayPosition({ x: 50, y: 58 });
    setStoryPlaying(false);
    setStoryMuted(false);
    setStoryProgress(0);
    setStoryTrimStart(0);
    setStoryTrimEnd(100);
    setStorySpeed(1);
    setStoryTextFont("sans-serif");
    setStoryTextBackground("none");
    setStoryTextWeight("700");
    setStoryTextAlign("center");
    setStoryTextPosition({ x: 50, y: 38 });
    setStoryTextScale(1);
    setStoryTextRotation(0);
    setMentionQuery("");
    setMentionResults([]);
    setStoryTextPosition({ x: 50, y: 38 });
    setStoryTextScale(1);
    setStoryTextRotation(0);
    setMentionQuery("");
    setMentionResults([]);
  };

  const storyFilterStyle = storyEffects[storyEffectIndex].filter;
  const storyLightFilter = `brightness(${storyBrightness}%) contrast(${storyContrast}%) saturate(${storySaturation}%) sepia(${storyWarmth}%)`;
  const storyCombinedFilter = storyFilterStyle === "none"
    ? storyLightFilter
    : `${storyFilterStyle} ${storyLightFilter}`;

  const storyMediaStyle = {
    filter: storyCombinedFilter,
    objectFit: (storyLayout === "fit" ? "contain" : "cover") as
      | "contain"
      | "cover",
    transform: `translate(${storyCanvasPosition.x}px, ${storyCanvasPosition.y}px) scale(${(storyCanvasZoom * storyZoom) / 100}) rotate(${storyRotation}deg)`,
    transition: "filter 160ms ease, transform 160ms ease",
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left - bounds.width / 2,
      y: event.clientY - bounds.top - bounds.height / 2,
    };
  };

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleCanvasPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (storyTool === "draw" || event.pointerType === "touch") return;
    const point = getCanvasPoint(event);
    storyDragRef.current = {
      x: point.x,
      y: point.y,
      startPosition: storyCanvasPosition,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!storyDragRef.current || storyTool === "draw") return;
    const point = getCanvasPoint(event);
    setStoryCanvasPosition({
      x:
        storyDragRef.current.startPosition.x + point.x - storyDragRef.current.x,
      y:
        storyDragRef.current.startPosition.y + point.y - storyDragRef.current.y,
    });
  };

  const handleCanvasPointerUp = () => {
    storyDragRef.current = null;
  };

  const handleCanvasTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (storyTool === "draw" || storyTextGestureActive.current) return;
    const cropMode = storyTool === "crop";
    if (
      (event.target as HTMLElement).closest(
        "[data-story-overlay], button, input, textarea, video",
      ) && !cropMode
    )
      return;
    storySwipeStart.current = cropMode ? null : event.touches.length === 1 ? event.touches[0].clientX : null;
    if (cropMode && event.touches.length === 1) {
      storyDragRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        startPosition: storyCanvasPosition,
      };
    }
    if (event.touches.length === 2) {
      storyGestureRef.current = {
        distance: getTouchDistance(event.touches),
        centerX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        centerY: (event.touches[0].clientY + event.touches[1].clientY) / 2,
        startZoom: storyCanvasZoom,
        startPosition: storyCanvasPosition,
      };
    }
  };

  const handleCanvasTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (storyTool === "draw" || storyTextGestureActive.current) return;
    const cropMode = storyTool === "crop";
    if (
      (event.target as HTMLElement).closest(
        "[data-story-overlay], button, input, textarea, video",
      ) && !cropMode
    )
      return;
    event.preventDefault();
    if (event.touches.length === 2 && storyGestureRef.current) {
      const gesture = storyGestureRef.current;
      const scale =
        getTouchDistance(event.touches) / Math.max(1, gesture.distance);
      setStoryCanvasZoom(Math.max(1, Math.min(4, gesture.startZoom * scale)));
      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
      setStoryCanvasPosition({
        x: gesture.startPosition.x + centerX - gesture.centerX,
        y: gesture.startPosition.y + centerY - gesture.centerY,
      });
    } else if (cropMode && event.touches.length === 1 && storyDragRef.current) {
      const drag = storyDragRef.current;
      setStoryCanvasPosition({
        x: drag.startPosition.x + event.touches[0].clientX - drag.x,
        y: drag.startPosition.y + event.touches[0].clientY - drag.y,
      });
    }
  };

  const handleCanvasTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (storyTextGestureActive.current) return;
    if (
      (event.target as HTMLElement).closest(
        "[data-story-overlay], button, input, textarea, video",
      ) && storyTool !== "crop"
    ) {
      storySwipeStart.current = null;
      storyGestureRef.current = null;
      storyDragRef.current = null;
      return;
    }
    if (storyTool === "crop") {
      storySwipeStart.current = null;
      storyGestureRef.current = null;
      storyDragRef.current = null;
      return;
    }
    if (
      storyTool !== "draw" &&
      storySwipeStart.current !== null &&
      event.changedTouches.length > 0
    ) {
      const distance =
        event.changedTouches[0].clientX - storySwipeStart.current;
      if (Math.abs(distance) >= 45) changeStoryEffect(distance > 0 ? 1 : -1);
    }
    storySwipeStart.current = null;
    storyGestureRef.current = null;
    storyDragRef.current = null;
  };

  const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, textarea, video, svg")) return;
    setStoryCanvasZoom((value) => (value > 1.05 ? 1 : 2));
  };

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video) return;
    video.playbackRate = storySpeed;
  }, [storySpeed]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const endTime = (storyTrimEnd / 100) * video.duration;
    const handleTrim = () => {
      if (video.currentTime >= endTime) {
        video.pause();
        video.currentTime = endTime;
        setStoryPlaying(false);
      }
    };
    video.addEventListener("timeupdate", handleTrim);
    return () => video.removeEventListener("timeupdate", handleTrim);
  }, [storyTrimEnd, mediaPreview]);

  const createEditedStoryVideo = async (): Promise<File> => {
    if (!mediaFile || !mediaPreview || !mediaFile.type.startsWith("video/")) return mediaFile as File;
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return mediaFile;

    const source = document.createElement("video");
    source.src = mediaPreview;
    source.muted = false;
    source.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      source.onloadedmetadata = () => resolve();
      source.onerror = () => reject(new Error("Video yüklenemedi"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = STORY_CANVAS_WIDTH;
    canvas.height = STORY_CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return mediaFile;
    const overlay = storyOverlayPreview ? await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Bindirme görseli yüklenemedi"));
      image.src = storyOverlayPreview;
    }) : null;
    const canvasStream = canvas.captureStream(30);
    const captureStream = (source as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    const sourceStream = typeof captureStream === "function" ? captureStream.call(source) : null;
    sourceStream?.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
      .find((type) => MediaRecorder.isTypeSupported(type)) || "";
    const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
    const startTime = (storyTrimStart / 100) * source.duration;
    const endTime = (storyTrimEnd / 100) * source.duration;
    source.currentTime = startTime;
    source.playbackRate = storySpeed;

    const drawFrame = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#000";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.filter = storyCombinedFilter;
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((storyRotation * Math.PI) / 180);
      context.scale((storyCanvasZoom * storyZoom) / 100, (storyCanvasZoom * storyZoom) / 100);
      const mediaScale = storyLayout === "fit"
        ? Math.min(canvas.width / source.videoWidth, canvas.height / source.videoHeight)
        : Math.max(canvas.width / source.videoWidth, canvas.height / source.videoHeight);
      const mediaWidth = source.videoWidth * mediaScale;
      const mediaHeight = source.videoHeight * mediaScale;
      context.drawImage(source, -mediaWidth / 2 + storyCanvasPosition.x, -mediaHeight / 2 + storyCanvasPosition.y, mediaWidth, mediaHeight);
      context.restore();

      const drawText = (layer: StoryTextLayer) => {
        const size = Math.max(24, canvas.width * 0.055) * layer.scale;
        const x = (layer.position.x / 100) * canvas.width;
        const y = (layer.position.y / 100) * canvas.height;
        context.save();
        context.translate(x, y);
        context.rotate((layer.rotation * Math.PI) / 180);
        context.font = `${layer.weight} ${size}px ${layer.font}`;
        context.textAlign = layer.align;
        context.fillStyle = layer.color;
        context.shadowColor = "rgba(0,0,0,.45)";
        context.shadowBlur = 8;
        const lines = layer.text.slice(0, 80).split("\n");
        const lineHeight = size * 1.12;
        const width = Math.max(...lines.map((line) => context.measureText(line).width), 0);
        const blockHeight = lines.length * lineHeight;
        if (layer.background !== "none") {
          context.shadowBlur = 0;
          context.fillStyle = layer.background === "solid" ? "rgba(0,0,0,.88)" : layer.background === "white" ? "rgba(255,255,255,.94)" : "rgba(0,0,0,.52)";
          const left = layer.align === "left" ? -12 : layer.align === "right" ? -width - 12 : -width / 2 - 12;
          context.fillRect(left, -blockHeight - 10, width + 24, blockHeight + 18);
          context.fillStyle = layer.color;
        }
        lines.forEach((line, index) => context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight));
        context.restore();
      };
      storyTextLayers.forEach((layer, index) => {
        if (index !== activeStoryTextIndex) drawText(layer);
      });
      if (storyText.trim()) drawText({ text: storyText.trim(), color: storyTextColor, background: storyTextBackground, font: storyTextFont, weight: storyTextWeight, align: storyTextAlign, position: storyTextPosition, scale: storyTextScale, rotation: storyTextRotation });
      [...storyStickerLayers, ...(storySticker ? [{ sticker: storySticker, position: storyStickerPosition, scale: storyStickerScale, rotation: storyStickerRotation }] : [])].forEach((sticker) => {
        context.save();
        context.translate((sticker.position.x / 100) * canvas.width, (sticker.position.y / 100) * canvas.height);
        context.rotate((sticker.rotation * Math.PI) / 180);
        context.font = `${Math.max(48, canvas.width * 0.12) * sticker.scale}px sans-serif`;
        context.textAlign = "center";
        context.shadowColor = "rgba(0,0,0,.45)";
        context.shadowBlur = 8;
        context.fillText(sticker.sticker, 0, 0);
        context.restore();
      });
      if (overlay) {
        const width = canvas.width * storyOverlayScale;
        const height = width * overlay.naturalHeight / Math.max(1, overlay.naturalWidth);
        context.save();
        context.translate((storyOverlayPosition.x / 100) * canvas.width, (storyOverlayPosition.y / 100) * canvas.height);
        context.rotate((storyOverlayRotation * Math.PI) / 180);
        context.drawImage(overlay, -width / 2, -height / 2, width, height);
        context.restore();
      }
      context.save();
      context.strokeStyle = storyDrawColor;
      context.lineCap = "round";
      context.lineJoin = "round";
      storyDrawLines.forEach((line) => {
        if (line.points.length < 2) return;
        context.globalAlpha = line.opacity;
        context.lineWidth = Math.max(4, canvas.width * (line.width / 100));
        context.beginPath();
        line.points.forEach((point, index) => index === 0 ? context.moveTo(point.x / 100 * canvas.width, point.y / 100 * canvas.height) : context.lineTo(point.x / 100 * canvas.width, point.y / 100 * canvas.height));
        context.strokeStyle = line.color;
        context.stroke();
      });
      context.restore();
      if (storyVignette > 0) {
        const vignette = context.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.2, canvas.width / 2, canvas.height / 2, canvas.width * 0.72);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, `rgba(0,0,0,${storyVignette / 100})`);
        context.fillStyle = vignette;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    return await new Promise<File>((resolve, reject) => {
      const finish = () => {
        cancelAnimationFrame(frameId);
        if (recorder.state !== "inactive") recorder.stop();
        canvasStream.getTracks().forEach((track) => track.stop());
      };
      let frameId = 0;
      recorder.onstop = () => resolve(new File([new Blob(chunks, { type: mimeType || "video/webm" })], `${mediaFile.name.replace(/\.[^.]+$/, "")}-edited.webm`, { type: mimeType || "video/webm" }));
      source.ontimeupdate = () => { if (source.currentTime >= endTime) { source.pause(); finish(); } };
      const render = () => { drawFrame(); frameId = requestAnimationFrame(render); };
      recorder.onerror = () => { finish(); reject(new Error("Düzenlenmiş video oluşturulamadı")); };
      recorder.start(200);
      render();
      void source.play().catch((error) => {
        finish();
        reject(error);
      });
    });
  };

  const createEditedStoryImage = async (): Promise<File | null> => {
    if (!mediaFile || !mediaPreview || mediaFile.type.startsWith("video/"))
      return mediaFile;
    const image = new Image();
    image.src = mediaPreview;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = STORY_CANVAS_WIDTH;
    canvas.height = STORY_CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return mediaFile;
    context.direction = "ltr";
    context.fillStyle = "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = storyCombinedFilter;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((storyRotation * Math.PI) / 180);
    const scale = storyZoom / 100;
    context.scale(scale, scale);
    const mediaScale = storyLayout === "fit"
      ? Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      : Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    context.drawImage(image, -image.naturalWidth * mediaScale / 2 + storyCanvasPosition.x, -image.naturalHeight * mediaScale / 2 + storyCanvasPosition.y, image.naturalWidth * mediaScale, image.naturalHeight * mediaScale);
    context.setTransform(1, 0, 0, 1, 0, 0);
    const drawImageText = (layer: StoryTextLayer) => {
      context.save();
      const size = Math.max(24, canvas.width * 0.055) * layer.scale;
      const textX = (layer.position.x / 100) * canvas.width;
      const textY = (layer.position.y / 100) * canvas.height;
      context.translate(textX, textY);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.font = `${layer.weight} ${size}px ${layer.font}`;
      context.textAlign = layer.align;
      context.fillStyle = layer.color;
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = 8;
      const lines = layer.text.slice(0, 80).split("\n");
      const lineHeight = size * 1.12;
      const textWidth = Math.max(...lines.map((line) => context.measureText(line).width), 0);
      const blockHeight = lines.length * lineHeight;
      if (layer.background !== "none") {
        const padding = Math.max(12, canvas.width * 0.018);
        const backgroundX = layer.align === "left" ? -padding : layer.align === "right" ? -textWidth - padding : -textWidth / 2 - padding;
        context.shadowColor = "transparent";
        context.fillStyle = layer.background === "solid" ? "rgba(0,0,0,.88)" : layer.background === "white" ? "rgba(255,255,255,.94)" : "rgba(0,0,0,.52)";
        context.fillRect(backgroundX, -blockHeight - padding, textWidth + padding * 2, blockHeight + padding * 2);
        context.fillStyle = layer.color;
      }
      lines.forEach((line, index) => context.fillText(line, 0, (index - (lines.length - 1) / 2) * lineHeight));
      context.restore();
    };
    storyTextLayers.forEach((layer, index) => {
      if (index !== activeStoryTextIndex) drawImageText(layer);
    });
    if (storyText.trim()) drawImageText({ text: storyText.trim(), color: storyTextColor, background: storyTextBackground, font: storyTextFont, weight: storyTextWeight, align: storyTextAlign, position: storyTextPosition, scale: storyTextScale, rotation: storyTextRotation });
    if (storyOverlayPreview && storyOverlayFile) {
      const overlay = new Image();
      overlay.src = storyOverlayPreview;
      await new Promise<void>((resolve, reject) => {
        overlay.onload = () => resolve();
        overlay.onerror = reject;
      });
      const overlayWidth = canvas.width * storyOverlayScale;
      const overlayHeight = overlayWidth * (overlay.naturalHeight / overlay.naturalWidth);
      const overlayX = (storyOverlayPosition.x / 100) * canvas.width - overlayWidth / 2;
      const overlayY = (storyOverlayPosition.y / 100) * canvas.height - overlayHeight / 2;
      context.save();
      context.translate(overlayX + overlayWidth / 2, overlayY + overlayHeight / 2);
      context.rotate((storyOverlayRotation * Math.PI) / 180);
      context.drawImage(overlay, -overlayWidth / 2, -overlayHeight / 2, overlayWidth, overlayHeight);
      context.restore();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    const stickersToDraw = [
      ...storyStickerLayers,
      ...(storySticker ? [{ sticker: storySticker, position: storyStickerPosition, scale: storyStickerScale, rotation: storyStickerRotation }] : []),
    ];
    stickersToDraw.forEach((sticker) => {
      context.save();
      context.font = `${Math.max(48, canvas.width * 0.12) * sticker.scale}px sans-serif`;
      context.textAlign = "center";
      context.shadowColor = "rgba(0,0,0,.45)";
      context.shadowBlur = 8;
      context.translate((sticker.position.x / 100) * canvas.width, (sticker.position.y / 100) * canvas.height);
      context.rotate((sticker.rotation * Math.PI) / 180);
      context.fillText(sticker.sticker, 0, 0);
      context.restore();
    });
    if (storyDrawLines.length > 0) {
      context.shadowBlur = 0;
      context.strokeStyle = storyDrawColor;
      context.lineWidth = Math.max(4, canvas.width * 0.007);
      context.lineCap = "round";
      context.lineJoin = "round";
      storyDrawLines.forEach((line) => {
        if (line.points.length < 1) return;
        context.strokeStyle = line.color;
        context.globalAlpha = line.opacity;
        context.lineWidth = Math.max(4, canvas.width * (line.width / 100));
        context.beginPath();
        line.points.forEach((point, index) => {
          const x = (point.x / 100) * canvas.width;
          const y = (point.y / 100) * canvas.height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();
      });
      context.globalAlpha = 1;
    }
    if (storyVignette > 0) {
      const vignette = context.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.2,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width * 0.72,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, `rgba(0,0,0,${storyVignette / 100})`);
      context.fillStyle = vignette;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mediaFile.type || "image/jpeg", 0.92),
    );
    return blob
      ? new File([blob], mediaFile.name, { type: blob.type })
      : mediaFile;
  };

  const getDrawPoint = (
    event: React.PointerEvent<SVGSVGElement>,
    svg: SVGSVGElement,
  ) => {
    const bounds = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    };
  };

  const handleDrawStart = (event: React.PointerEvent<SVGSVGElement>) => {
    if (storyTool !== "draw") return;
    const svg = event.currentTarget;
    event.stopPropagation();
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }
    setStoryDrawing(true);
    setStoryDrawLines((lines) => [
      ...lines,
      {
        points: [getDrawPoint(event, svg)],
        color: storyDrawColor,
        width: storyDrawWidth,
        opacity: storyDrawOpacity,
      },
    ]);
  };

  const handleDrawMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!storyDrawing) return;
    const svg = event.currentTarget;
    event.stopPropagation();
    event.preventDefault();
    const point = getDrawPoint(event, svg);
    setStoryDrawLines((lines) =>
      lines.map((line, index) =>
        index === lines.length - 1
          ? { ...line, points: [...line.points, point] }
          : line,
      ),
    );
  };

  const changeStoryEffect = (direction: 1 | -1) => {
    setStoryEffectIndex(
      (index) =>
        (index + direction + storyEffects.length) % storyEffects.length,
    );
    setShowEffectHint(true);
    window.setTimeout(() => setShowEffectHint(false), 1200);
  };

  const handleStoryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (storyTool === "draw") return;
    storySwipeStart.current = event.touches[0]?.clientX ?? null;
  };

  const handleStoryTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (storyTool === "draw" || storySwipeStart.current === null) return;
    const distance =
      (event.changedTouches[0]?.clientX ?? storySwipeStart.current) -
      storySwipeStart.current;
    storySwipeStart.current = null;
    if (Math.abs(distance) < 45) return;
    changeStoryEffect(distance > 0 ? 1 : -1);
  };

  const handleStoryTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!storyText) return;
    if (storyTextResizeRef.current || storyTextRotateRef.current) return;
    if (event.pointerType === "touch") return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    storyTextPointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    storyTextGestureActive.current = true;
    if (storyTextPointers.current.size >= 2) {
      const points = [...storyTextPointers.current.values()];
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      storyTextPinchRef.current = {
        distance: Math.max(1, Math.sqrt(dx * dx + dy * dy)),
        scale: storyTextScale,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        rotation: storyTextRotation,
      };
      setStoryTextDragging(false);
    } else {
      setStoryTextDragging(true);
    }
  };

  const handleStoryTextMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (storyTextResizeRef.current || storyTextRotateRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    if (storyTextPointers.current.has(event.pointerId))
      storyTextPointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    if (storyTextPointers.current.size >= 2 && storyTextPinchRef.current) {
      const points = [...storyTextPointers.current.values()];
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      setStoryTextScale(
        Math.max(
          0.25,
          (storyTextPinchRef.current.scale * distance) /
            storyTextPinchRef.current.distance,
        ),
      );
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      let angleDelta = angle - storyTextPinchRef.current.angle;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      setStoryTextRotation(storyTextPinchRef.current.rotation + angleDelta);
      return;
    }
    if (!storyTextDragging) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    setStoryTextPosition({
      x: Math.max(
        12,
        Math.min(88, ((event.clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.max(
        12,
        Math.min(78, ((event.clientY - bounds.top) / bounds.height) * 100),
      ),
    });
  };

  const stopStoryTextDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    event?.stopPropagation();
    if (event) storyTextPointers.current.delete(event.pointerId);
    if (storyTextPointers.current.size < 2) storyTextPinchRef.current = null;
    if (storyTextPointers.current.size === 0) {
      storyTextGestureActive.current = false;
      setStoryTextDragging(false);
    }
  };

  const handleStoryTextTouchStart = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (!storyText) return;
    if (storyTextResizeRef.current || storyTextRotateRef.current) return;
    event.stopPropagation();
    if (event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      storyTextTouchRef.current = {
        distance: Math.max(1, Math.hypot(dx, dy)),
        scale: storyTextScale,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        rotation: storyTextRotation,
      };
      storyTextTouchStart.current = null;
    } else if (event.touches.length === 1) {
      storyTextTouchStart.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    }
  };

  const handleStoryTextTouchMove = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (!storyText) return;
    if (storyTextResizeRef.current || storyTextRotateRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    if (event.touches.length === 2 && storyTextTouchRef.current) {
      const first = event.touches[0];
      const second = event.touches[1];
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      let delta = angle - storyTextTouchRef.current.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      setStoryTextScale(
        Math.max(
          0.25,
          (storyTextTouchRef.current.scale * distance) /
            storyTextTouchRef.current.distance,
        ),
      );
      setStoryTextRotation(storyTextTouchRef.current.rotation + delta);
      return;
    }
    if (event.touches.length === 1 && storyTextTouchStart.current) {
      const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
      if (!bounds) return;
      const touch = event.touches[0];
      setStoryTextPosition({
        x: Math.max(
          12,
          Math.min(88, ((touch.clientX - bounds.left) / bounds.width) * 100),
        ),
        y: Math.max(
          12,
          Math.min(78, ((touch.clientY - bounds.top) / bounds.height) * 100),
        ),
      });
    }
  };

  const handleStoryTextTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    storyTextTouchStart.current = null;
    storyTextTouchRef.current = null;
  };

  const handleOverlayTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.touches.length === 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      storyOverlayTouchRef.current = {
        distance: Math.max(1, Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)),
        scale: storyOverlayScale,
        angle: (Math.atan2(first.clientY - second.clientY, first.clientX - second.clientX) * 180) / Math.PI,
        rotation: storyOverlayRotation,
      };
      storyOverlayTouchStart.current = null;
    } else if (event.touches.length === 1) {
      storyOverlayTouchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
  };

  const handleOverlayTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (event.touches.length === 2 && storyOverlayTouchRef.current) {
      const first = event.touches[0];
      const second = event.touches[1];
      const dx = first.clientX - second.clientX;
      const dy = first.clientY - second.clientY;
      const gesture = storyOverlayTouchRef.current;
      setStoryOverlayScale(Math.max(0.15, Math.min(0.9, gesture.scale * Math.hypot(dx, dy) / gesture.distance)));
      let delta = (Math.atan2(dy, dx) * 180) / Math.PI - gesture.angle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      setStoryOverlayRotation(gesture.rotation + delta);
      return;
    }
    if (event.touches.length === 1 && storyOverlayTouchStart.current) {
      const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
      if (!bounds) return;
      const touch = event.touches[0];
      setStoryOverlayPosition({ x: Math.max(10, Math.min(90, ((touch.clientX - bounds.left) / bounds.width) * 100)), y: Math.max(10, Math.min(90, ((touch.clientY - bounds.top) / bounds.height) * 100)) });
    }
  };

  const handleOverlayTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    storyOverlayTouchRef.current = null;
    storyOverlayTouchStart.current = null;
  };

  const handleStoryTextResizeStart = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    storyTextResizeRef.current = {
      centerX,
      centerY,
      distance: Math.max(
        1,
        Math.hypot(event.clientX - centerX, event.clientY - centerY),
      ),
      scale: storyTextScale,
    };
    storyTextGestureActive.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStoryTextResizeMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!storyTextResizeRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    const resize = storyTextResizeRef.current;
    setStoryTextScale(
      Math.max(
        0.25,
        (resize.scale *
          Math.hypot(
            event.clientX - resize.centerX,
            event.clientY - resize.centerY,
          )) /
          resize.distance,
      ),
    );
  };

  const stopStoryTextResize = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    storyTextResizeRef.current = null;
    storyTextGestureActive.current = false;
  };

  const handleStoryTextRotateStart = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    storyTextRotateRef.current = {
      centerX,
      centerY,
      angle:
        (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
        Math.PI,
      rotation: storyTextRotation,
    };
    storyTextGestureActive.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleStoryTextRotateMove = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (!storyTextRotateRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    const rotate = storyTextRotateRef.current;
    let delta =
      (Math.atan2(
        event.clientY - rotate.centerY,
        event.clientX - rotate.centerX,
      ) *
        180) /
        Math.PI -
      rotate.angle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    setStoryTextRotation(rotate.rotation + delta);
  };

  const stopStoryTextRotate = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();
    storyTextRotateRef.current = null;
    storyTextGestureActive.current = false;
  };

  const resetStoryEdits = () => {
    setStoryEffectIndex(0);
    setStoryBrightness(100);
    setStoryContrast(100);
    setStorySaturation(100);
    setStoryWarmth(0);
    setStoryVignette(0);
    setStoryZoom(100);
    setStoryRotation(0);
    updateStoryText("");
    setStorySticker(null);
    setStoryStickerLayers([]);
    setActiveStoryStickerIndex(null);
    setStoryStickerPosition({ x: 50, y: 52 });
    setStoryStickerScale(1);
    setStoryStickerRotation(0);
    setStoryMusic("");
    setStoryDrawLines([]);
    setStoryTool(null);
    setStoryLayout("fit");
    setStoryCanvasZoom(1);
    setStoryCanvasPosition({ x: 0, y: 0 });
    setStoryOverlayScale(0.42);
    setStoryOverlayRotation(0);
    setStoryOverlayPosition({ x: 50, y: 58 });
    setStoryPlaying(false);
    setStoryMuted(false);
    setStoryProgress(0);
    setStoryTrimStart(0);
    setStoryTrimEnd(100);
    setStorySpeed(1);
    setStoryTextFont("sans-serif");
    setStoryTextBackground("none");
    setStoryTextWeight("700");
    setStoryTextAlign("center");
    setStoryTextPosition({ x: 50, y: 38 });
    setStoryTextScale(1);
    setMentionQuery("");
    setMentionResults([]);
  };

  useEffect(() => {
    if (storyTool !== "mention" || mentionQuery.trim().length < 2) {
      setMentionResults([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/users?q=${encodeURIComponent(mentionQuery.trim())}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) =>
        setMentionResults(Array.isArray(data) ? data.slice(0, 5) : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, [mentionQuery, storyTool]);

  const handleRemoveBackground = () => {
    setBackgroundFile(null);
    setBackgroundPreview(null);
    if (backgroundInputRef.current) backgroundInputRef.current.value = "";
  };

  const handleSubmitStory = async () => {
    if (!mediaFile) return;
    try {
      setIsUploading(true);
      const editedFile = mediaFile.type.startsWith("video/")
        ? await createEditedStoryVideo()
        : await createEditedStoryImage();
      const storyFiles = (editedFile || mediaFile).type.startsWith("video/")
        ? await splitVideoForStories(editedFile || mediaFile)
        : [editedFile || mediaFile];
      for (let index = 0; index < storyFiles.length; index += 1) {
        const formData = new FormData();
        formData.append("file", storyFiles[index]);
        const uploadRes = await fetch("/api/stories/upload", { method: "POST", body: formData });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { url, type } = await uploadRes.json();
        const storyRes = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaUrl: url, mediaType: type, storyText: index === 0 ? [...storyTextLayers.map((layer) => layer.text), storyText].filter(Boolean).join("\n") : "", storyTextColor, storyTextBackground }),
        });
        if (!storyRes.ok) throw new Error("Story failed");
      }
      await queryClient.invalidateQueries({ queryKey: getListStoriesQueryKey() });
      toast({ title: "Hikaye paylaşıldı! 24 saat görünür." });
      setLocation(
        postType === "trailer" ? "/notebook?tab=akis&flow=fragmanlar" : "/",
      );
    } catch {
      toast({
        title: "Hata",
        description: "Hikaye paylaşılamadı.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const openVisibilitySettings = async () => {
    setVisibilityOpen(true);
    const [usersResponse, settingsResponse] = await Promise.all([
      fetch("/api/users", { credentials: "include" }),
      fetch("/api/stories/visibility", { credentials: "include" }),
    ]);
    const users = usersResponse.ok ? await usersResponse.json() : [];
    const settings = settingsResponse.ok ? await settingsResponse.json() : { excludedUserIds: [] };
    setVisibilityUsers(Array.isArray(users) ? users.filter((item) => item.id !== user?.id) : []);
    setExcludedUserIds(Array.isArray(settings.excludedUserIds) ? settings.excludedUserIds : []);
  };

  const saveVisibilitySettings = async () => {
    setVisibilitySaving(true);
    try {
      const response = await fetch("/api/stories/visibility", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedUserIds }),
      });
      if (response.ok) setVisibilityOpen(false);
    } finally {
      setVisibilitySaving(false);
    }
  };

  const handleSubmitPost = async () => {
    if (postType === "poll") {
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (!content.trim()) {
        toast({ title: "Anket sorusu girin", variant: "destructive" });
        return;
      }
      if (validOptions.length < 2) {
        toast({ title: "En az 2 seçenek girin", variant: "destructive" });
        return;
      }
    } else {
      if (
        !content.trim() &&
        !mediaFile &&
        !backgroundFile &&
        !(postType === "book" && selectedBook)
      )
        return;
    }

    try {
      setIsUploading(true);
      let mediaUrl: string | null = selectedBook?.cover ?? null;
      let mediaType: string | null = null;
      let backgroundUrl: string | null = null;

      if (mediaFiles.length > 0 && postType !== "poll") {
        const uploadedUrls: string[] = [];
        for (const file of mediaFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/posts/upload", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Upload failed");
          uploadedUrls.push((await res.json()).url);
        }
        mediaUrl = uploadedUrls.length > 1 ? JSON.stringify(uploadedUrls) : uploadedUrls[0] ?? null;
        mediaType = uploadedUrls.length > 1 ? "image-gallery" : (mediaFiles[0]?.type.startsWith("video/") ? "video" : "image");
      }

      if (backgroundFile && postType !== "poll") {
        const formData = new FormData();
        formData.append("file", backgroundFile);
        const res = await fetch("/api/posts/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        backgroundUrl = data.url;
      }

      if (mediaUrl && !mediaType) mediaType = "image";

      const finalPollOptions =
        postType === "poll"
          ? pollOptions.map((o) => o.trim()).filter(Boolean)
          : undefined;

      const sharedContent =
        content.trim() ||
        (selectedBook ? `Kitap paylaşımı: ${selectedBook.title}` : content);
      const bookContent =
        postType === "book" && selectedBook
          ? `[[book-meta:${JSON.stringify({ title: selectedBook.title, author: selectedBook.author?.displayName || "Yazar", text: content.trim() })}]]${sharedContent}`
          : sharedContent;
      const columnContent =
        postType === "column"
          ? `[[column-style:${JSON.stringify(columnStyle)}]]${sharedContent}`
          : sharedContent;

      const response = await fetch("/api/posts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: postType === "book" ? bookContent : columnContent,
          mediaUrl: mediaUrl ?? undefined,
          mediaType: mediaType ?? undefined,
          backgroundUrl: backgroundUrl ?? undefined,
          postType,
          pollOptions: finalPollOptions,
        }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(responseData?.error || "Post creation failed");
      toast({
        title:
          postType === "bulletin"
            ? "Duyuru paylaşıldı!"
            : postType === "poll"
              ? "Anket oluşturuldu!"
              : postType === "book"
                ? "Kitap alanında paylaşıldı!"
                : postType === "trailer"
                  ? "Fragman paylaşıldı!"
                  : postType === "column"
                    ? "Köşe yazısı paylaşıldı!"
                    : postType === "micro"
                      ? "Mikro öykü paylaşıldı!"
                      : "Gönderi paylaşıldı!",
      });
      setLocation("/");
    } catch {
      toast({
        title: "Paylaşım yapılamadı",
        description: "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isStoryMode) {
    return (
      <AppLayout hideHeader hideBottomNav>
        <div className="fixed inset-0 z-40 h-[100dvh] overflow-hidden bg-[#08090f] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(94,61,145,.28),transparent_42%),linear-gradient(145deg,#08090f,#17151f)]" />
          <div className="relative flex h-full min-h-0 flex-col">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-20 items-center justify-between px-4 sm:px-8"
              style={{ paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))" }}
            >
              <button
                onClick={() => setLocation("/")}
                aria-label="Geri dön"
                className="pointer-events-auto rounded-full border border-white/10 bg-black/25 p-3 text-white backdrop-blur-md transition hover:bg-black/50"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div className="text-center drop-shadow-lg">
                <p className="text-[10px] font-bold uppercase tracking-[.28em] text-white/60">
                  Loop
                </p>
                <h1 className="text-base font-bold">Hikaye oluştur</h1>
              </div>
              <Button
                onClick={handleSubmitStory}
                disabled={!mediaFile || isUploading}
                className="pointer-events-auto h-10 rounded-full bg-white px-5 text-xs font-bold text-black shadow-lg hover:bg-white/90"
              >
                {isUploading ? "Yükleniyor..." : "Paylaş"}
              </Button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              {mediaPreview ? (
                <div
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  onTouchStart={handleCanvasTouchStart}
                  onTouchMove={handleCanvasTouchMove}
                  onTouchEnd={handleCanvasTouchEnd}
                  onTouchCancel={handleCanvasTouchEnd}
                  onDoubleClick={handleCanvasDoubleClick}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("[data-story-overlay], button, input, textarea, video, svg")) return;
                    setStoryTool(null);
                  }}
                  className="absolute inset-0 overflow-hidden bg-black touch-none select-none"
                  style={{ touchAction: "none" }}
                >
                  {mediaFile?.type.startsWith("video/") ? (
                    <video
                      ref={storyVideoRef}
                      src={mediaPreview}
                      playsInline
                      controls={false}
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      draggable={false}
                      onContextMenu={(event) => event.preventDefault()}
                      muted={storyMuted}
                      onPlay={() => setStoryPlaying(true)}
                      onPause={() => setStoryPlaying(false)}
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;
                        setStoryProgress(
                          video.duration
                            ? (video.currentTime / video.duration) * 100
                            : 0,
                        );
                      }}
                      onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        video.currentTime =
                          (storyTrimStart / 100) * video.duration;
                      }}
                      onEnded={() => setStoryPlaying(false)}
                      className="h-full w-full object-cover"
                      style={storyMediaStyle}
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Story preview"
                      className="h-full w-full object-cover"
                      style={storyMediaStyle}
                    />
                  )}
                  {storyVignette > 0 && (
                    <div
                      className="pointer-events-none absolute inset-0 z-[5]"
                      style={{
                        background: `radial-gradient(ellipse at center, transparent ${Math.max(20, 72 - storyVignette / 2)}%, rgba(0,0,0,${storyVignette / 100}) 100%)`,
                      }}
                    />
                  )}
                  {storyOverlayPreview && (
                    <div
                      data-story-overlay="photo"
                      className="absolute z-20 overflow-hidden rounded-xl shadow-2xl"
                      onTouchStart={handleOverlayTouchStart}
                      onTouchMove={handleOverlayTouchMove}
                      onTouchEnd={handleOverlayTouchEnd}
                      onTouchCancel={handleOverlayTouchEnd}
                      onDoubleClick={(event) => event.stopPropagation()}
                      style={{
                        left: `${storyOverlayPosition.x}%`,
                        top: `${storyOverlayPosition.y}%`,
                        width: `${storyOverlayScale * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${storyOverlayRotation}deg)`,
                        touchAction: "none",
                      }}
                    >
                      <img src={storyOverlayPreview} alt="Bindirme fotoğrafı" className="block h-auto w-full" />
                      <button type="button" onClick={() => { setStoryOverlayFile(null); setStoryOverlayPreview(null); }} aria-label="Bindirme fotoğrafını kaldır" className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X className="h-3 w-3" /></button>
                    </div>
                  )}
                  {storyTextLayers.map((layer, index) => activeStoryTextIndex === index ? null : (
                    <div
                      key={`story-text-layer-${index}`}
                      data-story-overlay="text-layer"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={() => editStoryTextLayer(index)}
                      className="pointer-events-auto absolute z-20 cursor-pointer select-none whitespace-pre drop-shadow-lg"
                      style={{
                        left: `${layer.position.x}%`,
                        top: `${layer.position.y}%`,
                        direction: "ltr",
                        color: layer.color,
                        fontFamily: layer.font,
                        fontWeight: layer.weight,
                        textAlign: layer.align,
                        fontSize: `${1.5 * layer.scale}rem`,
                        backgroundColor: layer.background === "solid" ? "rgba(0,0,0,.88)" : layer.background === "white" ? "rgba(255,255,255,.94)" : layer.background === "translucent" ? "rgba(0,0,0,.52)" : "transparent",
                        padding: layer.background === "none" ? "0" : "0.35em 0.55em",
                        borderRadius: layer.background === "none" ? "0" : "0.35em",
                        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                        whiteSpace: "pre",
                        lineHeight: 1.12,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); removeStoryTextLayer(index); }}
                        aria-label={`Metin katmanı ${index + 1} sil`}
                        className="absolute -right-5 -top-5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {layer.text}
                    </div>
                  ))}
                  {storyText && (
                    <div
                      data-story-overlay="text"
                      onPointerDown={handleStoryTextDrag}
                      onPointerMove={handleStoryTextMove}
                      onPointerUp={stopStoryTextDrag}
                      onPointerCancel={stopStoryTextDrag}
                      onTouchStart={handleStoryTextTouchStart}
                      onTouchMove={handleStoryTextTouchMove}
                      onTouchEnd={handleStoryTextTouchEnd}
                      onTouchCancel={handleStoryTextTouchEnd}
                      onDoubleClick={(event) => event.stopPropagation()}
                      className={`absolute z-20 cursor-move select-none whitespace-pre drop-shadow-lg ${storyTextDragging ? "cursor-grabbing" : ""}`}
                      style={{
                        left: `${storyTextPosition.x}%`,
                        top: `${storyTextPosition.y}%`,
                        direction: "ltr",
                        unicodeBidi: "normal",
                        color: storyTextColor,
                        fontFamily: storyTextFont,
                        fontWeight: storyTextWeight,
                        textAlign: storyTextAlign,
                        fontSize: `${1.5 * storyTextScale}rem`,
                        backgroundColor: storyTextBackground === "solid" ? "rgba(0,0,0,.88)" : storyTextBackground === "white" ? "rgba(255,255,255,.94)" : storyTextBackground === "translucent" ? "rgba(0,0,0,.52)" : "transparent",
                        padding: storyTextBackground === "none" ? "0" : "0.35em 0.55em",
                        borderRadius: storyTextBackground === "none" ? "0" : "0.35em",
                        transform: `translate(-50%, -50%) rotate(${storyTextRotation}deg)`,
                        touchAction: "none",
                        whiteSpace: "pre",
                        lineHeight: 1.12,
                      }}
                    >
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onTouchStart={(event) => event.stopPropagation()}
                        onClick={() => updateStoryText("")}
                        aria-label="Metni kaldır"
                        className="absolute -right-5 -top-5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleStoryTextRotateStart}
                        onPointerMove={handleStoryTextRotateMove}
                        onPointerUp={stopStoryTextRotate}
                        onPointerCancel={stopStoryTextRotate}
                        onDoubleClick={(event) => event.stopPropagation()}
                        aria-label="Metni döndür"
                        className="absolute -top-8 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white/70 bg-transparent text-white/80 shadow-lg backdrop-blur-sm"
                        style={{ touchAction: "none" }}
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleStoryTextResizeStart}
                        onPointerMove={handleStoryTextResizeMove}
                        onPointerUp={stopStoryTextResize}
                        onPointerCancel={stopStoryTextResize}
                        onDoubleClick={(event) => event.stopPropagation()}
                        aria-label="Metni boyutlandır"
                        className="absolute -bottom-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-transparent text-white/80 shadow-lg backdrop-blur-sm"
                        style={{ touchAction: "none" }}
                      >
                        ↘
                      </button>
                      <span className="pointer-events-none block">
                        {storyText}
                      </span>
                      <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white/80">
                        {Math.round(storyTextScale * 100)}%
                      </span>
                    </div>
                  )}
                  {storyStickerLayers.map((layer, index) => activeStoryStickerIndex === index ? null : (
                    <div
                      key={`story-sticker-layer-${index}`}
                      data-story-overlay="sticker-layer"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => editStoryStickerLayer(index)}
                      className="pointer-events-auto absolute z-20 cursor-pointer select-none text-5xl drop-shadow-lg"
                      style={{ left: `${layer.position.x}%`, top: `${layer.position.y}%`, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`, touchAction: "none" }}
                    >
                      {layer.sticker}
                    </div>
                  ))}
                  {storySticker && (
                    <div
                      data-story-overlay="sticker"
                      onPointerDown={handleStickerPointerDown}
                      onPointerMove={handleStickerPointerMove}
                      onPointerUp={handleStickerPointerUp}
                      onPointerCancel={handleStickerPointerUp}
                      onTouchStart={handleStickerTouchStart}
                      onTouchMove={handleStickerTouchMove}
                      onTouchEnd={handleStickerTouchEnd}
                      onTouchCancel={handleStickerTouchEnd}
                      className="pointer-events-auto absolute z-20 cursor-move select-none text-5xl drop-shadow-lg"
                      style={{ left: `${storyStickerPosition.x}%`, top: `${storyStickerPosition.y}%`, transform: `translate(-50%, -50%) rotate(${storyStickerRotation}deg) scale(${storyStickerScale})`, touchAction: "none" }}
                    >
                      {storySticker}
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          if (activeStoryStickerIndex !== null) {
                            setStoryStickerLayers((layers) => layers.filter((_, index) => index !== activeStoryStickerIndex));
                          }
                          setStorySticker(null);
                          setActiveStoryStickerIndex(null);
                        }}
                        aria-label="Çıkartmayı kaldır"
                        className="pointer-events-auto absolute -right-5 -top-5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black shadow"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleStickerRotateStart}
                        onPointerMove={handleStickerRotateMove}
                        onPointerUp={handleStickerRotateEnd}
                        onPointerCancel={handleStickerRotateEnd}
                        aria-label="Çıkartmayı parmakla döndür"
                        className="pointer-events-auto absolute -top-5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white shadow-lg"
                        style={{ touchAction: "none" }}
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onPointerDown={handleStickerResizeStart}
                        onPointerMove={handleStickerResizeMove}
                        onPointerUp={handleStickerResizeEnd}
                        onPointerCancel={handleStickerResizeEnd}
                        aria-label="Çıkartmayı boyutlandır"
                        className="pointer-events-auto absolute -bottom-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white shadow-lg"
                        style={{ touchAction: "none" }}
                      >
                        ↘
                      </button>
                    </div>
                  )}
                  {storyDrawLines.length > 0 && storyTool !== "draw" && (
                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                        {storyDrawLines.map((line, index) => (
                          <polyline
                            key={index}
                            stroke={line.color}
                            strokeOpacity={line.opacity}
                            strokeWidth={line.width}
                            points={line.points
                              .map((point) => `${point.x},${point.y}`)
                              .join(" ")}
                          />
                        ))}
                      </g>
                    </svg>
                  )}
                  {storyTool === "draw" && (
                    <svg
                      className="pointer-events-auto absolute inset-0 z-10 h-full w-full cursor-crosshair touch-none"
                      viewBox="0 0 100 100"
                      pointerEvents="all"
                      onPointerDown={handleDrawStart}
                      onPointerMove={handleDrawMove}
                      onPointerUp={(event) => {
                        event.stopPropagation();
                        setStoryDrawing(false);
                      }}
                      onPointerCancel={(event) => {
                        event.stopPropagation();
                        setStoryDrawing(false);
                      }}
                      aria-label="Hikaye üzerine çizim alanı"
                    >
                      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                        {storyDrawLines.map((line, index) => (
                          <polyline
                            key={index}
                            stroke={line.color}
                            strokeOpacity={line.opacity}
                            strokeWidth={line.width}
                            points={line.points
                              .map((point) => `${point.x},${point.y}`)
                              .join(" ")}
                          />
                        ))}
                      </g>
                    </svg>
                  )}
                  {showEffectHint && (
                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md">
                      {storyEffects[storyEffectIndex].label}
                    </div>
                  )}
                  <button
                    onClick={handleRemoveMedia}
                    aria-label="Medyayı kaldır"
                    className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div
                    data-story-overlay="toolbar"
                    className="absolute right-3 top-20 z-30 flex max-h-[calc(100dvh-10rem)] max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 overflow-y-auto overflow-x-visible py-1 pl-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onPointerDown={(event) => event.stopPropagation()}
                    onTouchStart={(event) => event.stopPropagation()}
                    onTouchMove={(event) => event.stopPropagation()}
                    onTouchEnd={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setStoryToolsOpen((open) => {
                          if (open) setStoryTool(null);
                          return !open;
                        });
                      }}
                      aria-expanded={storyToolsOpen}
                      className="flex items-center gap-2 rounded-2xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100 shadow-xl backdrop-blur-xl transition hover:border-cyan-200/45 hover:bg-slate-900/90"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 text-slate-950">
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                      <span>Düzenle</span>
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${storyToolsOpen ? "rotate-180" : ""}`} />
                    </button>
                    {storyToolsOpen && <div className="flex flex-col items-end gap-2">
                    {(
                      [
                        ["text", Type, "Metin"],
                        ["photo", ImageIcon, "Fotoğraf"],
                        ["sticker", Sticker, "Çıkartmalar"],
                        ["music", Music2, "Müzik"],
                        ["mention", AtSign, "Bahsetme"],
                        ["draw", PenTool, "Çiz"],
                        ["light", SlidersHorizontal, "Işık"],
                        ["zoom", Sparkles, "Efekt"],
                        ["crop", Crop, "Kırp"],
                      ] as const
                    ).map(([tool, Icon, label]) => (
                      <button
                        key={tool}
                        type="button"
                        onClick={() => {
                          setStoryTool((current) =>
                            current === tool ? null : tool,
                          );
                          if (tool === "text" || tool === "mention")
                            window.setTimeout(
                              () => storyTextInputRef.current?.focus(),
                              0,
                            );
                          if (tool === "photo")
                            window.setTimeout(() => storyOverlayInputRef.current?.click(), 0);
                          if (tool === "music") {
                            const nextTrack = storyMusicTracks[storyMusicIndex];
                            setStoryMusic((current) =>
                              current === nextTrack ? "" : nextTrack,
                            );
                            setStoryMusicIndex(
                              (index) => (index + 1) % storyMusicTracks.length,
                            );
                          }
                          if (tool === "draw")
                            setStoryDrawColor(
                              (current) =>
                                storyDrawColors[
                                  (storyDrawColors.indexOf(
                                    current as (typeof storyDrawColors)[number],
                                  ) +
                                    1) %
                                    storyDrawColors.length
                                ],
                            );
                              setStoryToolsOpen(false);
                        }}
                        aria-label={label}
                        className={`group flex items-center gap-2 ${storyTool === tool ? "text-cyan-50" : "text-white/90"}`}
                      >
                        <span className="rounded-lg border border-white/10 bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-cyan-50 backdrop-blur-sm">
                          {label}
                        </span>
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition group-hover:scale-105 ${storyTool === tool ? "border-cyan-200/70 bg-gradient-to-br from-cyan-300 to-violet-400 text-slate-950 ring-2 ring-cyan-100/40" : "border-cyan-100/20 bg-slate-950/80 text-cyan-50 hover:border-cyan-200/45 hover:bg-slate-900/90"}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setStoryCanvasPosition({ x: 0, y: 0 });
                        setStoryCanvasZoom(1);
                        setStoryZoom(100);
                        setStoryRotation(0);
                      }}
                      aria-label="Fotoğrafı veya videoyu ortala"
                      title="Fotoğrafı veya videoyu ortala"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg backdrop-blur-md transition hover:scale-105"
                    >
                      <Move className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStoryRotation((value) => (value + 90) % 360)
                      }
                      aria-label="Döndür"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg backdrop-blur-md transition hover:scale-105"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={resetStoryEdits}
                      aria-label="Düzenlemeleri sıfırla"
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 shadow-lg backdrop-blur-md transition hover:scale-105"
                    >
                      <Undo2 className="h-5 w-5" />
                    </button>
                    </div>}
                  </div>
                  {storyTool && (
                    <button
                      type="button"
                      onClick={() => setStoryTool(null)}
                      aria-label="Açık düzenleme menüsünü kapat"
                      className="absolute bottom-24 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/75 text-white shadow-xl backdrop-blur-xl transition hover:bg-black"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {storyTool === "light" && (
                    <div
                      data-story-overlay="light-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerMove={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-20 left-4 right-16 z-40 space-y-3 rounded-2xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur-xl"
                      style={{ touchAction: "auto" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Işık ayarları</span>
                        <button type="button" onClick={() => { setStoryBrightness(100); setStoryContrast(100); setStorySaturation(100); setStoryWarmth(0); setStoryVignette(0); }} className="rounded-lg bg-white/10 px-2 py-1 text-[10px]">Sıfırla</button>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {[
                          ["Doğal", 100, 100, 100, 0, 0],
                          ["Parlak", 125, 105, 110, 0, 0],
                          ["Sinematik", 92, 125, 92, 8, 28],
                          ["Sıcak", 108, 102, 108, 38, 8],
                          ["Gece", 72, 118, 82, 4, 42],
                        ].map(([label, brightness, contrast, saturation, warmth, vignette]) => (
                          <button key={label} type="button" onClick={() => { setStoryBrightness(brightness as number); setStoryContrast(contrast as number); setStorySaturation(saturation as number); setStoryWarmth(warmth as number); setStoryVignette(vignette as number); }} className="whitespace-nowrap rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold transition hover:bg-white/20">{label}</button>
                        ))}
                      </div>
                      {[
                        ["Parlaklık", 40, 160, storyBrightness, setStoryBrightness],
                        ["Kontrast", 60, 150, storyContrast, setStoryContrast],
                        ["Doygunluk", 0, 180, storySaturation, setStorySaturation],
                        ["Sıcaklık", 0, 70, storyWarmth, setStoryWarmth],
                        ["Vignette", 0, 70, storyVignette, setStoryVignette],
                      ].map(([label, min, max, value, setter]) => (
                        <label key={label as string} className="flex items-center gap-2 text-[10px] font-semibold text-white/70">
                          <span className="w-16 shrink-0">{label as string}</span>
                          <input type="range" min={min as number} max={max as number} value={value as number} onChange={(event) => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(event.target.value))} className="min-w-0 flex-1 accent-white" />
                          <span className="w-8 text-right text-white">{value as number}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {storyTool === "zoom" && (
                    <div
                      data-story-overlay="effect-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerMove={(event) => event.stopPropagation()}
                      onPointerUp={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-20 left-4 right-16 z-40 rounded-2xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur-xl"
                      style={{ touchAction: "auto" }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-bold">Efektler</span>
                        <span className="text-[10px] text-white/55">{storyEffects.length} seçenek</span>
                      </div>
                      <div className="grid max-h-52 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
                        {storyEffects.map((effect, index) => (
                          <button
                            key={effect.label}
                            type="button"
                            onClick={() => {
                              setStoryEffectIndex(index);
                              setShowEffectHint(true);
                              window.setTimeout(() => setShowEffectHint(false), 900);
                            }}
                            className={`min-h-9 rounded-lg border px-1.5 py-2 text-[10px] font-semibold transition ${storyEffectIndex === index ? "border-white bg-white text-black" : "border-white/15 bg-white/10 text-white hover:bg-white/20"}`}
                          >
                            {effect.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {storyTool === "crop" && (
                    <div
                      data-story-overlay="crop-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-20 left-4 right-16 z-40 rounded-2xl border border-cyan-200/20 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur-xl"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold">Kadraj</p>
                          <p className="mt-0.5 text-[10px] text-white/50">Hikayenin ekrandaki çerçevesini seç</p>
                        </div>
                        <Crop className="h-4 w-4 text-cyan-200" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ["fit", "Sığdır", "Tamamını göster"],
                          ["fill", "Doldur", "Ekranı doldur"],
                          ["crop", "Kırp", "Parmağınla taşı ve yakınlaştır"],
                        ] as const).map(([layout, label, description]) => (
                          <button
                            key={layout}
                            type="button"
                            onClick={() => {
                              setStoryLayout(layout);
                              if (layout === "fit" || layout === "fill") {
                                setStoryCanvasZoom(1);
                                setStoryCanvasPosition({ x: 0, y: 0 });
                              }
                            }}
                            className={`rounded-xl border px-2 py-2 text-left transition ${storyLayout === layout ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                          >
                            <span className="block text-[11px] font-bold">{label}</span>
                            <span className={`mt-1 block text-[9px] ${storyLayout === layout ? "text-slate-700" : "text-white/45"}`}>{description}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[10px] text-white/50">Kırp modunda fotoğrafın üzerinde tek parmakla taşı, iki parmakla yakınlaştır.</p>
                      <button
                        type="button"
                        onClick={() => { setStoryCanvasZoom(1); setStoryCanvasPosition({ x: 0, y: 0 }); }}
                        className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2 text-[10px] font-semibold text-white hover:bg-white/15"
                      >
                        Kadrajı sıfırla
                      </button>
                    </div>
                  )}
                  {storyTool === "photo" && storyOverlayPreview && (
                    <div
                      data-story-overlay="photo-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-20 left-4 right-16 z-40 space-y-2 rounded-2xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur-xl"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span>Fotoğraf bindirme</span>
                        <button type="button" onClick={() => { setStoryOverlayFile(null); setStoryOverlayPreview(null); setStoryTool(null); }} className="rounded-lg bg-white/10 px-2 py-1 text-[10px]">Kaldır</button>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] text-white/70">
                        <span className="w-12 shrink-0">Boyut</span>
                        <input type="range" min="0.15" max="0.9" step="0.01" value={storyOverlayScale} onChange={(event) => setStoryOverlayScale(Number(event.target.value))} className="min-w-0 flex-1 accent-white" />
                        <span className="w-8 text-right text-white">{Math.round(storyOverlayScale * 100)}%</span>
                      </label>
                      <div className="flex w-full min-w-0 gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-x-visible sm:whitespace-normal">
                        {[["←", -4, 0], ["→", 4, 0], ["↑", 0, -4], ["↓", 0, 4]].map(([label, x, y]) => <button key={label} type="button" onClick={() => setStoryOverlayPosition((position) => ({ x: Math.max(10, Math.min(90, position.x + (x as number))), y: Math.max(10, Math.min(90, position.y + (y as number))) }))} aria-label={`Fotoğrafı ${label} taşı`} className="flex-1 rounded-lg bg-white/10 py-1 text-sm hover:bg-white/20">{label}</button>)}
                      </div>
                    </div>
                  )}
                  {storyTool === "draw" && (
                    <div
                      data-story-overlay="draw-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      className="absolute bottom-20 left-4 right-16 z-20 space-y-2 rounded-xl border border-white/15 bg-black/75 p-3 backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-2 overflow-x-auto">
                        {storyDrawColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setStoryDrawColor(color)}
                            aria-label={`Çizim rengi ${color}`}
                            className={`h-7 w-7 shrink-0 rounded-full border-2 ${storyDrawColor === color ? "scale-110 border-white ring-2 ring-white/30" : "border-white/20"}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setStoryDrawColor("#ffffff")}
                          aria-label="Beyaz çizim rengi"
                          className={`h-7 w-7 shrink-0 rounded-full border-2 bg-white ${storyDrawColor === "#ffffff" ? "scale-110 border-white ring-2 ring-white/30" : "border-white/20"}`}
                        />
                        <span className="mx-1 h-6 w-px shrink-0 bg-white/20" />
                        {[0.35, 0.7, 1.2, 2].map((width) => (
                          <button
                            key={width}
                            type="button"
                            onClick={() => setStoryDrawWidth(width)}
                            aria-label={`Çizgi kalınlığı ${width}`}
                            className={`flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border ${storyDrawWidth === width ? "border-white bg-white/20" : "border-white/10 bg-white/5"}`}
                          >
                            <span className="rounded-full bg-white" style={{ width: `${Math.max(5, width * 5)}px`, height: `${Math.max(3, width * 2)}px` }} />
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-white/60">Opaklık</span>
                        <input type="range" min="0.25" max="1" step="0.05" value={storyDrawOpacity} onChange={(event) => setStoryDrawOpacity(Number(event.target.value))} aria-label="Çizim opaklığı" className="min-w-0 flex-1 accent-white" />
                        <button type="button" onClick={() => setStoryDrawLines((lines) => lines.slice(0, -1))} disabled={storyDrawLines.length === 0} aria-label="Son çizgiyi geri al" className="rounded-lg bg-white/10 px-2 py-1 text-[10px] disabled:opacity-40">Geri al</button>
                        <button type="button" onClick={() => setStoryDrawLines([])} disabled={storyDrawLines.length === 0} aria-label="Tüm çizimleri temizle" className="rounded-lg bg-white/10 px-2 py-1 text-[10px] disabled:opacity-40">Temizle</button>
                      </div>
                    </div>
                  )}
                  {storyTool === "text" && (
                    <div
                      data-story-overlay="text-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-24 left-3 right-3 z-30 max-h-[45dvh] touch-auto space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-black/70 px-3 py-2 backdrop-blur-xl sm:bottom-20 sm:left-4 sm:right-16"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Type className="h-4 w-4 shrink-0 text-white/65" />
                        <textarea
                          ref={storyTextInputRef}
                          dir="ltr"
                          lang="tr"
                          inputMode="text"
                          autoComplete="off"
                          maxLength={80}
                          rows={2}
                          defaultValue={storyText}
                          onFocus={(event) => {
                            const input = event.currentTarget;
                            window.requestAnimationFrame(() => {
                              input.setSelectionRange(input.value.length, input.value.length);
                            });
                          }}
                          onInput={(event) => {
                            const input = event.currentTarget;
                            const selectionStart = input.selectionStart;
                            const selectionEnd = input.selectionEnd;
                            setStoryText(input.value);
                            window.requestAnimationFrame(() => {
                              if (document.activeElement === input && selectionStart !== null && selectionEnd !== null) {
                                input.setSelectionRange(selectionStart, selectionEnd);
                              }
                            });
                          }}
                          placeholder="Metin ekle..."
                          className="order-first min-h-12 min-w-0 basis-full flex-1 resize-none rounded-md border border-white/15 bg-black/25 px-2 py-1 text-left text-sm leading-tight text-white outline-none placeholder:text-white/45 sm:order-none sm:min-h-8 sm:basis-auto sm:border-0 sm:bg-transparent sm:px-0"
                          style={{ direction: "ltr", unicodeBidi: "normal", textAlign: "left" }}
                        />
                        <button
                          type="button"
                          onClick={addStoryTextLayer}
                          onPointerDown={(event) => event.preventDefault()}
                          aria-label="Yeni metin ekle"
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTextScale((value) =>
                              Math.max(0.25, value - 0.15),
                            )
                          }
                          aria-label="Metni küçült"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTextScale((value) => value + 0.15)
                          }
                          aria-label="Metni büyüt"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-sm"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTextRotation((value) => (value + 15) % 360)
                          }
                          aria-label="Metni döndür"
                          className="rounded-lg bg-white/10 p-1.5"
                        >
                          <RotateCw className="h-4 w-4" />
                        </button>
                        <input
                          aria-label="Metin rengi"
                          type="color"
                          value={storyTextColor}
                          onChange={(event) =>
                            setStoryTextColor(event.target.value)
                          }
                          className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                        />
                        <div className="flex gap-1">
                          {[
                            ["none", "Yok"],
                            ["solid", "Siyah"],
                            ["white", "Beyaz"],
                            ["translucent", "Şeffaf"],
                          ].map(([background, label]) => (
                            <button
                              key={background}
                              type="button"
                              onClick={() => {
                                setStoryTextBackground(background as StoryTextBackground);
                                setStoryTextColor(background === "white" ? "#111111" : "#ffffff");
                              }}
                              aria-label={`Metin arka planı: ${label}`}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${storyTextBackground === background ? "border-white bg-white text-black" : "border-white/10 text-white/65"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto">
                        {[
                          ["Klasik", "sans-serif"],
                          ["Modern", "Arial"],
                          ["Zarif", "Georgia"],
                          ["Daktilo", "monospace"],
                          ["Yuvarlak", "Trebuchet MS"],
                        ].map(([label, font]) => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => setStoryTextFont(font)}
                            className={`whitespace-nowrap rounded-lg border px-2 py-1 text-[10px] ${storyTextFont === font ? "border-white bg-white/15" : "border-white/10 text-white/65"}`}
                            style={{ fontFamily: font }}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setStoryTextAlign((value) =>
                              value === "left"
                                ? "center"
                                : value === "center"
                                  ? "right"
                                  : "left",
                            )
                          }
                          className="rounded-lg border border-white/10 px-2 py-1 text-[10px]"
                        >
                          Hizala
                        </button>
                      </div>
                    </div>
                  )}
                  {mediaFile?.type.startsWith("video/") && (
                    <div
                      className="pointer-events-auto absolute bottom-3 left-3 right-16 z-30 rounded-xl border border-white/15 bg-black/65 p-2 backdrop-blur-xl"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const video = storyVideoRef.current;
                            if (!video) return;
                            if (video.paused) void video.play();
                            else video.pause();
                          }}
                          aria-label={
                            storyPlaying ? "Videoyu duraklat" : "Videoyu oynat"
                          }
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-black"
                        >
                          {storyPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4 fill-current" />
                          )}
                        </button>
                        <input
                          aria-label="Video zaman çizelgesi"
                          type="range"
                          min="0"
                          max="100"
                          value={storyProgress}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setStoryProgress(value);
                            if (storyVideoRef.current?.duration)
                              storyVideoRef.current.currentTime =
                                (value / 100) * storyVideoRef.current.duration;
                          }}
                          className="min-w-0 flex-1 accent-white"
                        />
                        <button
                          type="button"
                          onClick={() => setStoryMuted((value) => !value)}
                          aria-label={storyMuted ? "Sesi aç" : "Sesi kapat"}
                        >
                          {storyMuted ? (
                            <VolumeX className="h-4 w-4" />
                          ) : (
                            <Volume2 className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStorySpeed((value) =>
                              value >= 2 ? 0.5 : value + 0.5,
                            )
                          }
                          aria-label="Video hızını değiştir"
                          className="flex items-center gap-1 text-[10px] font-semibold"
                        >
                          <Gauge className="h-4 w-4" />
                          {storySpeed}x
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[9px] text-white/70">
                        <Scissors className="h-3.5 w-3.5" />
                        <input
                          aria-label="Video başlangıcı"
                          type="range"
                          min="0"
                          max={Math.max(storyTrimEnd - 1, 1)}
                          value={storyTrimStart}
                          onChange={(event) =>
                            setStoryTrimStart(Number(event.target.value))
                          }
                          className="min-w-0 flex-1 accent-white"
                        />
                        <input
                          aria-label="Video bitişi"
                          type="range"
                          min={Math.min(storyTrimStart + 1, 99)}
                          max="100"
                          value={storyTrimEnd}
                          onChange={(event) =>
                            setStoryTrimEnd(Number(event.target.value))
                          }
                          className="min-w-0 flex-1 accent-white"
                        />
                        <span>
                          {Math.round(storyTrimStart)}-
                          {Math.round(storyTrimEnd)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {storyTool === "sticker" && (
                    <div
                      data-story-overlay="sticker-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-24 left-3 right-3 z-30 rounded-xl border border-white/15 bg-black/75 p-3 text-white backdrop-blur-xl sm:bottom-20 sm:left-4 sm:right-16"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                        <span>Çıkartma seç</span>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setStoryTool(null)} aria-label="Çıkartma menüsünü kapat" className="rounded-lg bg-white/10 p-1.5"><X className="h-4 w-4" /></button>
                          <button type="button" onClick={addStoryStickerLayer} aria-label="Yeni çıkartma ekle" className="rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold">Ekle</button>
                          <button type="button" onClick={() => setStoryStickerScale((value) => Math.max(0.4, value - 0.15))} aria-label="Çıkartmayı küçült" className="rounded-lg bg-white/10 px-2 py-1">-</button>
                          <button type="button" onClick={() => setStoryStickerScale((value) => value + 0.15)} aria-label="Çıkartmayı büyüt" className="rounded-lg bg-white/10 px-2 py-1">+</button>
                          <button type="button" onClick={() => setStoryStickerRotation((value) => (value + 15) % 360)} aria-label="Çıkartmayı döndür" className="rounded-lg bg-white/10 p-1.5"><RotateCw className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto">
                        {storyStickers.map((sticker, index) => (
                          <button
                            key={`${sticker}-${index}`}
                            type="button"
                            onClick={() => selectStorySticker(sticker)}
                            aria-label={`Çıkartma ${index + 1}`}
                            className={`flex h-9 items-center justify-center rounded-lg text-xl ${storySticker === sticker ? "bg-white/25 ring-1 ring-white/70" : "bg-white/5 hover:bg-white/15"}`}
                          >
                            {sticker}
                          </button>
                        ))}
                      </div>
                      {storyStickerLayers.length > 0 && (
                        <div className="mt-3 border-t border-white/10 pt-2">
                          <p className="mb-1 text-[10px] font-semibold text-white/60">Eklenen çıkartmalar</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {storyStickerLayers.map((layer, index) => (
                              <button
                                key={`edit-sticker-${index}`}
                                type="button"
                                onClick={() => editStoryStickerLayer(index)}
                                aria-label={`Çıkartma ${index + 1} düzenle`}
                                className={`flex h-10 min-w-10 items-center justify-center rounded-lg border text-2xl ${activeStoryStickerIndex === index ? "border-white bg-white/25" : "border-white/10 bg-white/5"}`}
                              >
                                {layer.sticker}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {storyTool === "mention" && (
                    <div
                      data-story-overlay="mention-controls"
                      onPointerDown={(event) => event.stopPropagation()}
                      onTouchStart={(event) => event.stopPropagation()}
                      onTouchMove={(event) => event.stopPropagation()}
                      onTouchEnd={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                      className="pointer-events-auto absolute bottom-20 left-4 right-16 z-30 rounded-xl border border-white/15 bg-black/75 p-2 backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-2">
                        <AtSign className="h-4 w-4 shrink-0 text-white/65" />
                        <input
                          autoFocus
                          value={mentionQuery}
                          onChange={(event) =>
                            setMentionQuery(event.target.value)
                          }
                          placeholder="Kullanıcı ara..."
                          className="min-w-0 flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/45"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="text-[10px] font-semibold text-white/60">
                          Etiket arka planı
                        </span>
                        <div className="flex gap-1">
                          {[
                            ["none", "Yok"],
                            ["solid", "Siyah"],
                            ["white", "Beyaz"],
                            ["translucent", "Şeffaf"],
                          ].map(([background, label]) => (
                            <button
                              key={background}
                              type="button"
                              onClick={() => {
                                setStoryTextBackground(background as StoryTextBackground);
                                setStoryTextColor(background === "white" ? "#111111" : "#ffffff");
                              }}
                              aria-label={`Etiket arka planı: ${label}`}
                              className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${storyTextBackground === background ? "border-white bg-white text-black" : "border-white/15 bg-white/10 text-white"}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {mentionResults.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                          {mentionResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => {
                                const name =
                                  result.username ||
                                  result.displayName ||
                                  "kullanıcı";
                                const current = storyTextInputRef.current?.value ?? storyText;
                                const mention = `@${name}`;
                                updateStoryText(current.trim() ? `${current.trim()} ${mention}` : mention);
                                if (storyTextBackground === "none") {
                                  setStoryTextBackground("solid");
                                  setStoryTextColor("#ffffff");
                                }
                                setMentionQuery("");
                                setStoryTool("text");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                                {(result.displayName || result.username || "U")
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                              <span>
                                {result.displayName || result.username}
                              </span>
                              <span className="text-white/45">
                                @{result.username}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {storyTool === "sticker" && (
                    <div className="absolute bottom-20 left-4 right-16 z-20 flex flex-wrap gap-2 rounded-xl border border-white/15 bg-black/75 p-3 text-2xl backdrop-blur-xl">
                      {storyStickers.map((sticker) => (
                        <button
                          key={sticker}
                          type="button"
                          onClick={() => setStorySticker(sticker)}
                          className={`rounded-lg p-1 ${storySticker === sticker ? "bg-white/20" : ""}`}
                        >
                          {sticker}
                        </button>
                      ))}
                    </div>
                  )}
                  {storyTool === "music" && (
                    <div className="absolute bottom-20 left-4 right-16 z-20 rounded-xl border border-white/15 bg-black/75 p-3 text-xs text-white/75 backdrop-blur-xl">
                      <Music2 className="mb-1 h-4 w-4" />
                      Müzik ekleme yakında kullanılabilir olacak.
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex h-full w-full flex-col items-center justify-center bg-white/5 transition hover:bg-white/10"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <Camera className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="mt-4 font-semibold">
                      Galeriden fotoğraf veya video seç
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      Hikayeni paylaşmadan önce düzenle
                    </p>
                  </div>
                </button>
              )}
            </div>
            {mediaPreview && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="pointer-events-auto flex w-full max-w-[560px] items-center gap-2 rounded-2xl border border-white/15 bg-black/55 p-2 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => void openVisibilitySettings()}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-white/10 px-2.5 py-2 text-[10px] font-semibold"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Anıların
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
            {visibilityOpen && (
              <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
                <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#17151f] text-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div><h2 className="text-base font-bold">Anıların kimler görsün?</h2><p className="mt-0.5 text-xs text-white/55">İşaretlediklerin Anılarını göremez.</p></div>
                    <button type="button" onClick={() => setVisibilityOpen(false)} aria-label="Kapat" className="rounded-full p-2 hover:bg-white/10"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto p-2">
                    {visibilityUsers.length === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-white/55"><Shield className="h-8 w-8" />Kullanıcı bulunamadı.</div> : visibilityUsers.map((item) => {
                      const selected = excludedUserIds.includes(item.id);
                      return <button key={item.id} type="button" onClick={() => setExcludedUserIds((ids) => selected ? ids.filter((id) => id !== item.id) : [...ids, item.id])} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10"><Avatar className="h-9 w-9"><AvatarImage src={item.avatarUrl || ""} /><AvatarFallback>{(item.displayName || item.username || "U").charAt(0).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.displayName || item.username}</span><span className="block truncate text-xs text-white/50">@{item.username}</span></span><span className={`flex h-6 w-6 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary" : "border-white/25"}`}>{selected && <Check className="h-4 w-4" />}</span></button>;
                    })}
                  </div>
                  <div className="flex justify-end gap-2 border-t border-white/10 p-3"><button type="button" onClick={() => setVisibilityOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Vazgeç</button><button type="button" onClick={() => void saveVisibilitySettings()} disabled={visibilitySaving} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{visibilitySaving ? "Kaydediliyor..." : "Kaydet"}</button></div>
                </div>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              multiple={postType !== "trailer"}
              onChange={handleFileSelect}
              accept="image/*,video/*"
              className="hidden"
            />
            <input
              type="file"
              ref={storyOverlayInputRef}
              onChange={(event) => handleFileSelect(event, "overlay")}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold">
              {postType === "bulletin"
                ? "Bülten"
                : postType === "poll"
                  ? "Anket"
                  : "Yeni Gönderi"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1.5 text-xs"
              onClick={() => setLocation("/create?type=story")}
            >
              <Film className="w-3.5 h-3.5" />
              Hikaye
            </Button>
            <Button
              onClick={handleSubmitPost}
              disabled={
                postType === "poll"
                  ? !content.trim() ||
                    pollOptions.filter((o) => o.trim()).length < 2 ||
                    isUploading
                  : (!content.trim() &&
                      !mediaFile &&
                      !(postType === "book" && selectedBook)) ||
                    isUploading
              }
              className={`rounded-full px-6 font-semibold shadow-md ${postType === "bulletin" ? "bg-primary text-primary-foreground hover:brightness-110" : postType === "poll" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid="btn-create-post"
            >
              {isUploading ? "Yükleniyor..." : "Paylaş"}
            </Button>
          </div>
        </div>

        {/* Post type selector */}
        <div className="flex w-full min-w-0 gap-2 overflow-x-auto overscroll-x-contain whitespace-nowrap pb-1 touch-pan-x hide-scrollbar">
          {(
            [
              {
                id: "post",
                label: "Gönderi",
                icon: <ImageIcon className="w-3.5 h-3.5" />,
              },
              {
                id: "bulletin",
                label: "Bülten",
                icon: <Pencil className="w-3.5 h-3.5" />,
              },
              {
                id: "book",
                label: "Kitaplar",
                icon: <BookOpen className="w-3.5 h-3.5" />,
              },
              {
                id: "trailer",
                label: "Fragman",
                icon: <Film className="w-3.5 h-3.5" />,
              },
              {
                id: "column",
                label: "Loop Editoryal Yazısı",
                icon: <Feather className="w-3.5 h-3.5" />,
              },
              {
                id: "micro",
                label: "Mikro Öykü",
                icon: <AlignLeft className="w-3.5 h-3.5" />,
              },
              {
                id: "poll",
                label: "Anket",
                icon: <BarChart2 className="w-3.5 h-3.5" />,
              },
            ] as { id: PostType; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setPostType(t.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                postType === t.id
                  ? t.id === "bulletin"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : t.id === "poll"
                      ? "bg-blue-500/15 text-blue-600 border border-blue-500/30"
                      : "bg-primary/10 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div
          className={`rounded-2xl border p-4 shadow-sm flex gap-3 ${postType === "column" ? "border-stone-200 bg-[#fffdf8]" : "bg-card border-border"}`}
        >
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-4">
            <Textarea
              placeholder={
                postType === "bulletin"
                  ? "Aklından ne geçiyor?"
                  : postType === "poll"
                    ? "Anket sorusu..."
                    : "Neler düşünüyorsun?"
              }
              className={`min-h-[120px] resize-none border-none p-0 text-lg leading-8 focus-visible:ring-0 ${postType === "column" ? `${columnStyle.tone === "forest" ? "text-emerald-950" : columnStyle.tone === "wine" ? "text-rose-950" : "text-slate-800"} ${columnStyle.weight === "strong" ? "font-semibold" : columnStyle.weight === "medium" ? "font-medium" : "font-normal"} ${columnStyle.italic ? "italic" : "not-italic"} ${columnStyle.highlighted ? "rounded-lg bg-amber-100/80 px-3 py-2" : "bg-transparent"}` : "bg-transparent"}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={postType === "book" ? 2000 : undefined}
              data-testid="textarea-create-content"
            />
            {postType === "book" && (
              <div className="text-right text-[11px] text-muted-foreground">
                {content.length}/2000
              </div>
            )}

            {postType === "column" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-stone-200/80 pt-3">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  Kalem
                </span>
                {(["ink", "forest", "wine"] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    title={`${tone} tonu`}
                    aria-label={`${tone} kalem tonu`}
                    onClick={() =>
                      setColumnStyle((style) => ({ ...style, tone }))
                    }
                    className={`h-7 w-7 rounded-full border-2 transition ${columnStyle.tone === tone ? "scale-110 border-stone-900 ring-2 ring-stone-900/10" : "border-transparent"} ${tone === "ink" ? "bg-slate-800" : tone === "forest" ? "bg-emerald-800" : "bg-rose-900"}`}
                  />
                ))}
                <span className="ml-2 h-5 w-px bg-stone-200" />
                <button
                  type="button"
                  title="Kalınlık"
                  onClick={() =>
                    setColumnStyle((style) => ({
                      ...style,
                      weight: style.weight === "strong" ? "normal" : "strong",
                    }))
                  }
                  className={`rounded-lg px-2.5 py-1 text-sm font-bold transition ${columnStyle.weight === "strong" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  aria-label="Yazı kalınlığı"
                >
                  B
                </button>
                <button
                  type="button"
                  title="Vurgu"
                  onClick={() =>
                    setColumnStyle((style) => ({
                      ...style,
                      highlighted: !style.highlighted,
                    }))
                  }
                  className={`rounded-lg px-2.5 py-1 text-sm transition ${columnStyle.highlighted ? "bg-amber-200 text-amber-950" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  aria-label="Metni vurgula"
                >
                  A
                </button>
                <button
                  type="button"
                  title="Eğik yazı"
                  onClick={() =>
                    setColumnStyle((style) => ({
                      ...style,
                      italic: !style.italic,
                    }))
                  }
                  className={`rounded-lg px-2.5 py-1 text-sm italic transition ${columnStyle.italic ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}
                  aria-label="Eğik yazı"
                >
                  I
                </button>
                <span className="ml-auto text-[10px] text-stone-400">
                  Canlı önizleme
                </span>
              </div>
            )}

            {/* Poll options */}
            {postType === "poll" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Seçenekler
                </p>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={opt}
                      onChange={(e) => {
                        const updated = [...pollOptions];
                        updated[i] = e.target.value;
                        setPollOptions(updated);
                      }}
                      placeholder={`Seçenek ${i + 1}`}
                      className="rounded-xl text-sm h-9"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        onClick={() =>
                          setPollOptions(pollOptions.filter((_, j) => j !== i))
                        }
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="flex items-center gap-1.5 text-sm text-primary font-medium hover:opacity-80"
                  >
                    <Plus className="w-4 h-4" />
                    Seçenek ekle
                  </button>
                )}
              </div>
            )}

            {postType === "book" && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Kitap ekle
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paylaşımına kitabının kapağını ekle.
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <select
                  value={selectedBookId}
                  onChange={(event) => setSelectedBookId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Paylaşılacak kitabı seç"
                >
                  <option value="">Kitap seçin</option>
                  {books.map((book) => (
                    <option key={String(book.id)} value={String(book.id)}>
                      {book.title}
                      {book.author?.displayName
                        ? ` · ${book.author.displayName}`
                        : ""}
                    </option>
                  ))}
                </select>
                {selectedBook && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-2">
                    {selectedBook.cover ? (
                      <img
                        src={selectedBook.cover}
                        alt={`${selectedBook.title} kitap kapağı`}
                        className="h-16 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-16 w-12 items-center justify-center rounded-md bg-muted text-xl">
                        📖
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedBook.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Kapak paylaşımına eklenecek
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {postType !== "poll" && !selectedBook && (
              <div className="rounded-xl border border-dashed border-violet-300/60 bg-gradient-to-br from-violet-500/8 via-transparent to-fuchsia-500/8 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Gönderiye arka kapak ekle
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Kapak önizlemesi profilinde ve Keşfet'te görünür.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => backgroundInputRef.current?.click()}
                    className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-500/15"
                  >
                    {backgroundPreview ? "Değiştir" : "Ekle"}
                  </button>
                </div>
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, "background")}
                  className="hidden"
                />
                {backgroundPreview && (
                  <div className="relative mt-3 overflow-hidden rounded-xl border border-violet-300/30">
                    <img
                      src={backgroundPreview}
                      alt="Arka plan önizleme"
                      className="h-32 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveBackground}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {postType === "trailer" && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50 px-4 py-5 text-sm font-bold text-sky-700 transition hover:border-sky-500 hover:bg-sky-100"
              >
                <Film className="h-5 w-5" />
                {mediaFile ? "Fragmanı değiştir" : "Fragman ekle"}
              </button>
            )}

            {/* Media preview */}
            {mediaPreview && postType !== "poll" && (
              <div className="relative rounded-xl overflow-hidden border border-border">
                {mediaFiles.length > 1 ? (
                  <div>
                    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto p-2" aria-label="Kaydırmalı fotoğraf önizlemesi">
                      {mediaPreviews.map((preview, index) => (
                        <img key={preview} src={preview} alt={`Fotoğraf ${index + 1}`} className="h-40 w-32 shrink-0 snap-center rounded-lg object-cover" />
                      ))}
                    </div>
                    <p className="px-3 pb-2 text-center text-[11px] text-muted-foreground">{mediaFiles.length} fotoğraf · Kaydırarak sıralamayı önizle</p>
                  </div>
                ) : mediaFile?.type.startsWith("video/") ? (
                  <video
                    src={mediaPreview}
                    controls
                    className="w-full max-h-80 object-cover"
                  />
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full max-h-80 object-cover"
                  />
                )}
                <button
                  onClick={handleRemoveMedia}
                  className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Media button (not for poll) */}
        {postType !== "poll" && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            <input
              type="file"
              ref={fileInputRef}
              multiple={postType !== "trailer"}
              onChange={(e) => handleFileSelect(e, "media")}
              accept={postType === "trailer" ? "video/*" : "image/*,video/*"}
              className="hidden"
            />
            {postType !== "trailer" && (
              <Button
                variant="outline"
                size="icon"
                className="rounded-full w-10 h-10 text-primary border-border bg-card hover:bg-primary/10 hover:text-primary"
                onClick={() => fileInputRef.current?.click()}
                data-testid="btn-add-media"
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            )}
            {postType === "bulletin" && (
              <span className="text-xs text-muted-foreground">
                Bültene fotoğraf ekleyebilirsin
              </span>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
