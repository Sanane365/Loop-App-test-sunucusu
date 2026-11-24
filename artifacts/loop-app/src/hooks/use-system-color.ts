import { useEffect, useState } from "react";

export type SystemColorId = string;

type SystemColor = {
  id: SystemColorId;
  label: string;
  description: string;
  swatches: [string, string, string];
  mode: "solid" | "gradient";
  light: { primary: string; accent: string; accentForeground: string; gradient: string };
  dark: { primary: string; accent: string; accentForeground: string; gradient: string };
};

function solidColor(id: string, label: string, hue: number, swatches: [string, string, string]): SystemColor {
  return {
    id,
    mode: "solid",
    label,
    description: `Tek renk ${label.toLocaleLowerCase("tr-TR")} tonu`,
    swatches,
    light: { primary: `${hue} 72% 40%`, accent: `${hue} 65% 94%`, accentForeground: `${hue} 72% 28%`, gradient: `${hue} 72% 40%, ${hue} 72% 40%, ${hue} 72% 40%` },
    dark: { primary: `${hue} 78% 62%`, accent: `${hue} 52% 21%`, accentForeground: "0 0% 98%", gradient: `${hue} 78% 62%, ${hue} 78% 62%, ${hue} 78% 62%` },
  };
}

function gradientColor(id: string, label: string, hues: [number, number, number], swatches: [string, string, string]): SystemColor {
  return {
    id,
    mode: "gradient",
    label,
    description: `${label} renk geçişi`,
    swatches,
    light: { primary: `${hues[0]} 78% 42%`, accent: `${hues[0]} 68% 94%`, accentForeground: `${hues[0]} 78% 29%`, gradient: `${hues[0]} 78% 42%, ${hues[1]} 82% 50%, ${hues[2]} 78% 48%` },
    dark: { primary: `${hues[0]} 84% 62%`, accent: `${hues[0]} 55% 21%`, accentForeground: "0 0% 98%", gradient: `${hues[0]} 84% 62%, ${hues[1]} 86% 62%, ${hues[2]} 82% 58%` },
  };
}

const EXTRA_SOLID_COLORS: SystemColor[] = [
  solidColor("scarlet", "Scarlet", 4, ["#991b1b", "#dc2626", "#f87171"]),
  solidColor("brick", "Brick", 10, ["#9a3412", "#c2410c", "#fb923c"]),
  solidColor("peach", "Peach", 20, ["#ea580c", "#fb923c", "#fed7aa"]),
  solidColor("gold", "Gold", 42, ["#a16207", "#ca8a04", "#fde047"]),
  solidColor("olive", "Olive", 72, ["#4d7c0f", "#65a30d", "#bef264"]),
  solidColor("pine", "Pine", 150, ["#14532d", "#166534", "#4ade80"]),
  solidColor("jade", "Jade", 165, ["#047857", "#059669", "#6ee7b7"]),
  solidColor("aqua", "Aqua", 182, ["#0e7490", "#0891b2", "#67e8f9"]),
  solidColor("azure", "Azure", 205, ["#0369a1", "#0284c7", "#7dd3fc"]),
  solidColor("denim", "Denim", 215, ["#1e40af", "#1d4ed8", "#93c5fd"]),
  solidColor("royal", "Royal", 230, ["#1e3a8a", "#3730a3", "#818cf8"]),
  solidColor("periwinkle", "Periwinkle", 235, ["#4338ca", "#6366f1", "#a5b4fc"]),
  solidColor("grape", "Grape", 275, ["#581c87", "#7e22ce", "#d8b4fe"]),
  solidColor("orchid", "Orchid", 290, ["#86198f", "#c026d3", "#f0abfc"]),
  solidColor("fuchsia", "Fuchsia", 305, ["#a21caf", "#d946ef", "#f0abfc"]),
  solidColor("blush", "Blush", 335, ["#9f1239", "#e11d48", "#fda4af"]),
  solidColor("wine", "Wine", 345, ["#4c0519", "#881337", "#fb7185"]),
  solidColor("stone", "Stone", 30, ["#44403c", "#78716c", "#d6d3d1"]),
  solidColor("silver", "Silver", 210, ["#475569", "#94a3b8", "#e2e8f0"]),
  solidColor("graphite", "Graphite", 220, ["#111827", "#374151", "#9ca3af"]),
];

const EXTRA_GRADIENT_COLORS: SystemColor[] = [
  gradientColor("fire", "Fire", [0, 18, 42], ["#ef4444", "#f97316", "#facc15"]),
  gradientColor("flame", "Flame", [12, 28, 350], ["#f97316", "#f59e0b", "#e11d48"]),
  gradientColor("golden-hour", "Golden Hour", [28, 42, 55], ["#ea580c", "#eab308", "#fef08a"]),
  gradientColor("spring", "Spring", [82, 142, 174], ["#84cc16", "#22c55e", "#14b8a6"]),
  gradientColor("jungle", "Jungle", [142, 160, 174], ["#15803d", "#10b981", "#06b6d4"]),
  gradientColor("lagoon", "Lagoon", [174, 190, 210], ["#0d9488", "#06b6d4", "#2563eb"]),
  gradientColor("deep-sea", "Deep Sea", [220, 195, 175], ["#172554", "#1d4ed8", "#0f766e"]),
  gradientColor("blue-hour", "Blue Hour", [230, 250, 280], ["#1e3a8a", "#4f46e5", "#7e22ce"]),
  gradientColor("twilight", "Twilight", [250, 280, 320], ["#312e81", "#7c3aed", "#db2777"]),
  gradientColor("nebula", "Nebula", [270, 305, 345], ["#581c87", "#c026d3", "#e11d48"]),
  gradientColor("rose-gold", "Rose Gold", [330, 350, 28], ["#be123c", "#f43f5e", "#f59e0b"]),
  gradientColor("pastel", "Pastel", [340, 45, 190], ["#f9a8d4", "#fde68a", "#a5f3fc"]),
  gradientColor("candy-floss", "Candy Floss", [320, 275, 200], ["#f472b6", "#c084fc", "#7dd3fc"]),
  gradientColor("lavender-sky", "Lavender Sky", [260, 280, 210], ["#a78bfa", "#c4b5fd", "#7dd3fc"]),
  gradientColor("earth", "Earth", [25, 35, 80], ["#78350f", "#a16207", "#4d7c0f"]),
  gradientColor("carbon", "Carbon", [220, 230, 250], ["#111827", "#334155", "#475569"]),
  gradientColor("holographic", "Holographic", [190, 285, 330], ["#67e8f9", "#c084fc", "#f9a8d4"]),
  gradientColor("cyberpunk", "Cyberpunk", [190, 315, 55], ["#06b6d4", "#d946ef", "#facc15"]),
  gradientColor("mermaid", "Mermaid", [170, 185, 265], ["#14b8a6", "#67e8f9", "#818cf8"]),
  gradientColor("peacock", "Peacock", [175, 215, 280], ["#0f766e", "#0284c7", "#7e22ce"]),
  gradientColor("galaxy", "Galaxy", [225, 275, 325], ["#1e3a8a", "#7c3aed", "#db2777"]),
  gradientColor("sakura", "Sakura", [330, 345, 45], ["#f9a8d4", "#fb7185", "#fde68a"]),
  gradientColor("toxic", "Toxic", [75, 125, 170], ["#a3e635", "#22c55e", "#06b6d4"]),
  gradientColor("desert-rose", "Desert Rose", [25, 350, 300], ["#d97706", "#fb7185", "#c084fc"]),
  gradientColor("volcanic", "Volcanic", [0, 12, 30], ["#7f1d1d", "#ef4444", "#f59e0b"]),
  gradientColor("arctic-fire", "Arctic Fire", [190, 350, 25], ["#22d3ee", "#f43f5e", "#fb923c"]),
  gradientColor("neon-mint", "Neon Mint", [150, 170, 210], ["#22c55e", "#2dd4bf", "#38bdf8"]),
  gradientColor("electric-lime", "Electric Lime", [65, 100, 190], ["#d9f99d", "#84cc16", "#0ea5e9"]),
  gradientColor("royal-sunset", "Royal Sunset", [250, 315, 15], ["#4338ca", "#e11d48", "#f59e0b"]),
  gradientColor("plum-gold", "Plum Gold", [280, 315, 45], ["#7e22ce", "#c026d3", "#eab308"]),
  gradientColor("ocean-flame", "Ocean Flame", [195, 25, 350], ["#0284c7", "#f97316", "#e11d48"]),
  gradientColor("rainforest", "Rainforest", [145, 175, 220], ["#166534", "#0d9488", "#0369a1"]),
  gradientColor("fruit-punch", "Fruit Punch", [345, 15, 50], ["#e11d48", "#f97316", "#facc15"]),
  gradientColor("grape-soda", "Grape Soda", [260, 290, 335], ["#4f46e5", "#a855f7", "#ec4899"]),
  gradientColor("blueberry", "Blueberry", [225, 245, 275], ["#1d4ed8", "#6366f1", "#a855f7"]),
  gradientColor("mint-chocolate", "Mint Chocolate", [145, 165, 30], ["#14532d", "#34d399", "#92400e"]),
  gradientColor("lavender-lemon", "Lavender Lemon", [270, 290, 50], ["#8b5cf6", "#c4b5fd", "#fde047"]),
  gradientColor("storm", "Storm", [210, 230, 275], ["#334155", "#475569", "#6366f1"]),
  gradientColor("cosmic-teal", "Cosmic Teal", [175, 250, 320], ["#0f766e", "#4338ca", "#be123c"]),
  gradientColor("neon-noir", "Neon Noir", [230, 315, 180], ["#020617", "#d946ef", "#22d3ee"]),
];

export const SYSTEM_COLORS: SystemColor[] = [
  {
    id: "violet", mode: "gradient",
    label: "Violet",
    description: "Loop'un klasik canlı tonu",
    swatches: ["#7c3aed", "#a855f7", "#ec4899"],
    light: { primary: "270 70% 55%", accent: "270 70% 95%", accentForeground: "270 70% 40%", gradient: "270 70% 55%, 292 72% 58%, 326 72% 58%" },
    dark: { primary: "270 70% 60%", accent: "270 50% 20%", accentForeground: "0 0% 98%", gradient: "263 80% 58%, 286 82% 64%, 326 78% 62%" },
  },
  {
    id: "ocean", mode: "gradient",
    label: "Okyanus",
    description: "Serin mavi ve turkuaz geçiş",
    swatches: ["#1d4ed8", "#0ea5e9", "#14b8a6"],
    light: { primary: "199 82% 43%", accent: "194 75% 94%", accentForeground: "199 82% 32%", gradient: "222 82% 52%, 199 88% 48%, 180 74% 42%" },
    dark: { primary: "197 88% 58%", accent: "198 70% 22%", accentForeground: "0 0% 98%", gradient: "222 82% 58%, 197 88% 58%, 187 78% 48%" },
  },
  {
    id: "ember", mode: "gradient",
    label: "Ember",
    description: "Kırmızı, turuncu ve altın",
    swatches: ["#dc2626", "#f97316", "#facc15"],
    light: { primary: "18 86% 48%", accent: "38 92% 94%", accentForeground: "18 86% 38%", gradient: "8 82% 48%, 22 92% 52%, 45 92% 52%" },
    dark: { primary: "18 92% 60%", accent: "28 70% 22%", accentForeground: "0 0% 98%", gradient: "4 86% 52%, 20 92% 58%, 43 94% 56%" },
  },
  {
    id: "emerald", mode: "gradient",
    label: "Zümrüt",
    description: "Derin yeşil ve petrol",
    swatches: ["#047857", "#10b981", "#14b8a6"],
    light: { primary: "160 72% 36%", accent: "158 62% 93%", accentForeground: "160 72% 28%", gradient: "160 72% 36%, 180 74% 38%, 145 64% 40%" },
    dark: { primary: "158 82% 55%", accent: "160 58% 20%", accentForeground: "0 0% 98%", gradient: "160 82% 45%, 178 78% 48%, 145 72% 48%" },
  },
  { id: "ruby", mode: "solid", label: "Ruby", description: "Tek renk yakut kırmızısı", swatches: ["#be123c", "#e11d48", "#fb7185"], light: { primary: "346 77% 42%", accent: "350 75% 94%", accentForeground: "346 77% 30%", gradient: "346 77% 42%, 346 77% 42%, 346 77% 42%" }, dark: { primary: "346 82% 62%", accent: "346 58% 22%", accentForeground: "0 0% 98%", gradient: "346 82% 62%, 346 82% 62%, 346 82% 62%" } },
  { id: "sapphire", mode: "solid", label: "Sapphire", description: "Tek renk safir mavisi", swatches: ["#1d4ed8", "#2563eb", "#60a5fa"], light: { primary: "221 83% 45%", accent: "214 90% 95%", accentForeground: "221 83% 32%", gradient: "221 83% 45%, 221 83% 45%, 221 83% 45%" }, dark: { primary: "221 88% 63%", accent: "221 58% 22%", accentForeground: "0 0% 98%", gradient: "221 88% 63%, 221 88% 63%, 221 88% 63%" } },
  { id: "sun", mode: "solid", label: "Sun", description: "Tek renk güneş sarısı", swatches: ["#ca8a04", "#eab308", "#fde047"], light: { primary: "45 93% 38%", accent: "48 90% 92%", accentForeground: "42 90% 25%", gradient: "45 93% 38%, 45 93% 38%, 45 93% 38%" }, dark: { primary: "45 93% 58%", accent: "42 70% 21%", accentForeground: "0 0% 98%", gradient: "45 93% 58%, 45 93% 58%, 45 93% 58%" } },
  { id: "forest", mode: "solid", label: "Forest", description: "Tek renk orman yeşili", swatches: ["#166534", "#15803d", "#4ade80"], light: { primary: "142 64% 32%", accent: "138 60% 93%", accentForeground: "142 64% 24%", gradient: "142 64% 32%, 142 64% 32%, 142 64% 32%" }, dark: { primary: "142 62% 55%", accent: "142 48% 20%", accentForeground: "0 0% 98%", gradient: "142 62% 55%, 142 62% 55%, 142 62% 55%" } },
  { id: "aurora", mode: "gradient", label: "Aurora", description: "Turkuaz, yeşil ve mavi", swatches: ["#06b6d4", "#10b981", "#3b82f6"], light: { primary: "174 72% 38%", accent: "174 65% 93%", accentForeground: "174 72% 28%", gradient: "187 78% 42%, 160 72% 42%, 221 83% 52%" }, dark: { primary: "174 82% 56%", accent: "174 55% 20%", accentForeground: "0 0% 98%", gradient: "187 82% 54%, 160 82% 52%, 221 88% 64%" } },
  { id: "candy", mode: "gradient", label: "Candy", description: "Pembe, mercan ve altın", swatches: ["#db2777", "#f43f5e", "#f59e0b"], light: { primary: "338 78% 48%", accent: "338 72% 95%", accentForeground: "338 78% 34%", gradient: "326 78% 52%, 348 82% 55%, 38 92% 52%" }, dark: { primary: "338 86% 64%", accent: "338 55% 22%", accentForeground: "0 0% 98%", gradient: "326 86% 62%, 348 86% 62%, 38 94% 60%" } },
  { id: "cobalt", mode: "gradient", label: "Cobalt", description: "Lacivert, mavi ve cyan", swatches: ["#1e3a8a", "#2563eb", "#06b6d4"], light: { primary: "221 78% 44%", accent: "221 80% 95%", accentForeground: "221 78% 30%", gradient: "230 72% 42%, 221 83% 52%, 187 78% 44%" }, dark: { primary: "221 88% 64%", accent: "221 58% 22%", accentForeground: "0 0% 98%", gradient: "230 82% 58%, 221 88% 64%, 187 82% 54%" } },
  { id: "citrus", mode: "gradient", label: "Citrus", description: "Limon, turuncu ve kırmızı", swatches: ["#84cc16", "#f59e0b", "#ef4444"], light: { primary: "32 92% 46%", accent: "38 90% 94%", accentForeground: "32 92% 32%", gradient: "84 72% 42%, 38 92% 50%, 0 84% 54%" }, dark: { primary: "32 94% 60%", accent: "32 70% 22%", accentForeground: "0 0% 98%", gradient: "84 72% 52%, 38 94% 60%, 0 86% 60%" } },
  { id: "coral", mode: "solid", label: "Coral", description: "Tek renk mercan", swatches: ["#f97316", "#fb7185", "#fb923c"], light: { primary: "12 85% 52%", accent: "12 90% 95%", accentForeground: "12 85% 34%", gradient: "12 85% 52%, 12 85% 52%, 12 85% 52%" }, dark: { primary: "12 90% 63%", accent: "12 60% 22%", accentForeground: "0 0% 98%", gradient: "12 90% 63%, 12 90% 63%, 12 90% 63%" } },
  { id: "magenta", mode: "solid", label: "Magenta", description: "Tek renk canlı fuşya", swatches: ["#c026d3", "#e11d8f", "#f472b6"], light: { primary: "306 70% 43%", accent: "306 70% 95%", accentForeground: "306 70% 30%", gradient: "306 70% 43%, 306 70% 43%, 306 70% 43%" }, dark: { primary: "306 78% 63%", accent: "306 55% 22%", accentForeground: "0 0% 98%", gradient: "306 78% 63%, 306 78% 63%, 306 78% 63%" } },
  { id: "plum", mode: "solid", label: "Plum", description: "Tek renk mürdüm", swatches: ["#581c87", "#7e22ce", "#c084fc"], light: { primary: "280 72% 36%", accent: "280 65% 95%", accentForeground: "280 72% 26%", gradient: "280 72% 36%, 280 72% 36%, 280 72% 36%" }, dark: { primary: "280 82% 66%", accent: "280 55% 22%", accentForeground: "0 0% 98%", gradient: "280 82% 66%, 280 82% 66%, 280 82% 66%" } },
  { id: "indigo", mode: "solid", label: "Indigo", description: "Tek renk gece indigosu", swatches: ["#3730a3", "#4f46e5", "#818cf8"], light: { primary: "239 70% 48%", accent: "239 70% 95%", accentForeground: "239 70% 32%", gradient: "239 70% 48%, 239 70% 48%, 239 70% 48%" }, dark: { primary: "239 82% 68%", accent: "239 55% 22%", accentForeground: "0 0% 98%", gradient: "239 82% 68%, 239 82% 68%, 239 82% 68%" } },
  { id: "sky", mode: "solid", label: "Sky", description: "Tek renk gökyüzü mavisi", swatches: ["#0284c7", "#0ea5e9", "#7dd3fc"], light: { primary: "199 89% 40%", accent: "199 85% 95%", accentForeground: "199 89% 28%", gradient: "199 89% 40%, 199 89% 40%, 199 89% 40%" }, dark: { primary: "199 90% 62%", accent: "199 55% 22%", accentForeground: "0 0% 98%", gradient: "199 90% 62%, 199 90% 62%, 199 90% 62%" } },
  { id: "cyan", mode: "solid", label: "Cyan", description: "Tek renk neon cyan", swatches: ["#0891b2", "#06b6d4", "#67e8f9"], light: { primary: "188 80% 36%", accent: "188 75% 94%", accentForeground: "188 80% 26%", gradient: "188 80% 36%, 188 80% 36%, 188 80% 36%" }, dark: { primary: "188 82% 58%", accent: "188 55% 20%", accentForeground: "0 0% 98%", gradient: "188 82% 58%, 188 82% 58%, 188 82% 58%" } },
  { id: "teal", mode: "solid", label: "Teal", description: "Tek renk deniz yeşili", swatches: ["#0f766e", "#0d9488", "#5eead4"], light: { primary: "174 78% 30%", accent: "174 65% 93%", accentForeground: "174 78% 23%", gradient: "174 78% 30%, 174 78% 30%, 174 78% 30%" }, dark: { primary: "174 72% 52%", accent: "174 50% 20%", accentForeground: "0 0% 98%", gradient: "174 72% 52%, 174 72% 52%, 174 72% 52%" } },
  { id: "lime", mode: "solid", label: "Lime", description: "Tek renk canlı lime", swatches: ["#65a30d", "#84cc16", "#bef264"], light: { primary: "82 78% 35%", accent: "82 70% 93%", accentForeground: "82 78% 24%", gradient: "82 78% 35%, 82 78% 35%, 82 78% 35%" }, dark: { primary: "82 75% 55%", accent: "82 52% 20%", accentForeground: "0 0% 98%", gradient: "82 75% 55%, 82 75% 55%, 82 75% 55%" } },
  { id: "orange", mode: "solid", label: "Orange", description: "Tek renk canlı turuncu", swatches: ["#c2410c", "#ea580c", "#fdba74"], light: { primary: "21 90% 43%", accent: "21 88% 94%", accentForeground: "21 90% 30%", gradient: "21 90% 43%, 21 90% 43%, 21 90% 43%" }, dark: { primary: "21 92% 60%", accent: "21 60% 22%", accentForeground: "0 0% 98%", gradient: "21 92% 60%, 21 92% 60%, 21 92% 60%" } },
  { id: "rose", mode: "solid", label: "Rose", description: "Tek renk gül pembesi", swatches: ["#be123c", "#f43f5e", "#fda4af"], light: { primary: "350 80% 45%", accent: "350 80% 95%", accentForeground: "350 80% 32%", gradient: "350 80% 45%, 350 80% 45%, 350 80% 45%" }, dark: { primary: "350 88% 64%", accent: "350 55% 22%", accentForeground: "0 0% 98%", gradient: "350 88% 64%, 350 88% 64%, 350 88% 64%" } },
  { id: "brown", mode: "solid", label: "Brown", description: "Tek renk toprak kahvesi", swatches: ["#78350f", "#a16207", "#d97706"], light: { primary: "30 78% 32%", accent: "30 75% 93%", accentForeground: "30 78% 23%", gradient: "30 78% 32%, 30 78% 32%, 30 78% 32%" }, dark: { primary: "30 78% 55%", accent: "30 48% 20%", accentForeground: "0 0% 98%", gradient: "30 78% 55%, 30 78% 55%, 30 78% 55%" } },
  { id: "slate", mode: "solid", label: "Slate", description: "Tek renk modern gri", swatches: ["#334155", "#64748b", "#cbd5e1"], light: { primary: "215 25% 35%", accent: "215 20% 94%", accentForeground: "215 25% 25%", gradient: "215 25% 35%, 215 25% 35%, 215 25% 35%" }, dark: { primary: "215 24% 70%", accent: "215 25% 22%", accentForeground: "0 0% 98%", gradient: "215 24% 70%, 215 24% 70%, 215 24% 70%" } },
  { id: "charcoal", mode: "solid", label: "Charcoal", description: "Tek renk kömür siyahı", swatches: ["#111827", "#374151", "#9ca3af"], light: { primary: "220 25% 25%", accent: "220 20% 94%", accentForeground: "220 25% 18%", gradient: "220 25% 25%, 220 25% 25%, 220 25% 25%" }, dark: { primary: "220 18% 78%", accent: "220 20% 20%", accentForeground: "0 0% 98%", gradient: "220 18% 78%, 220 18% 78%, 220 18% 78%" } },
  { id: "mint", mode: "solid", label: "Mint", description: "Tek renk nane yeşili", swatches: ["#059669", "#34d399", "#a7f3d0"], light: { primary: "158 75% 32%", accent: "158 65% 93%", accentForeground: "158 75% 23%", gradient: "158 75% 32%, 158 75% 32%, 158 75% 32%" }, dark: { primary: "158 70% 58%", accent: "158 50% 20%", accentForeground: "0 0% 98%", gradient: "158 70% 58%, 158 70% 58%, 158 70% 58%" } },
  { id: "lavender", mode: "solid", label: "Lavender", description: "Tek renk yumuşak lavanta", swatches: ["#7c3aed", "#a78bfa", "#ddd6fe"], light: { primary: "262 83% 58%", accent: "262 75% 95%", accentForeground: "262 83% 40%", gradient: "262 83% 58%, 262 83% 58%, 262 83% 58%" }, dark: { primary: "262 84% 72%", accent: "262 52% 22%", accentForeground: "0 0% 98%", gradient: "262 84% 72%, 262 84% 72%, 262 84% 72%" } },
  { id: "sunset", mode: "gradient", label: "Sunset", description: "Mercan, turuncu ve pembe", swatches: ["#f97316", "#f43f5e", "#c026d3"], light: { primary: "343 78% 48%", accent: "343 72% 95%", accentForeground: "343 78% 34%", gradient: "22 92% 52%, 343 82% 55%, 292 72% 56%" }, dark: { primary: "343 86% 64%", accent: "343 55% 22%", accentForeground: "0 0% 98%", gradient: "22 92% 58%, 343 86% 62%, 292 82% 64%" } },
  { id: "ice", mode: "gradient", label: "Ice", description: "Buz mavisi, cyan ve beyaz", swatches: ["#0ea5e9", "#67e8f9", "#e0f2fe"], light: { primary: "197 88% 42%", accent: "197 85% 95%", accentForeground: "197 88% 30%", gradient: "221 83% 52%, 197 88% 48%, 187 78% 48%" }, dark: { primary: "197 88% 64%", accent: "197 55% 22%", accentForeground: "0 0% 98%", gradient: "221 88% 64%, 197 88% 64%, 187 82% 58%" } },
  { id: "berry", mode: "gradient", label: "Berry", description: "Mürdüm, böğürtlen ve rose", swatches: ["#701a75", "#a21caf", "#e11d48"], light: { primary: "292 70% 42%", accent: "292 70% 95%", accentForeground: "292 70% 30%", gradient: "280 72% 42%, 292 70% 48%, 350 80% 50%" }, dark: { primary: "292 78% 64%", accent: "292 52% 22%", accentForeground: "0 0% 98%", gradient: "280 82% 60%, 292 82% 64%, 350 86% 64%" } },
  { id: "tropical", mode: "gradient", label: "Tropical", description: "Yeşil, sarı ve turkuaz", swatches: ["#16a34a", "#eab308", "#06b6d4"], light: { primary: "154 70% 36%", accent: "154 65% 93%", accentForeground: "154 70% 25%", gradient: "142 64% 38%, 48 92% 48%, 187 78% 44%" }, dark: { primary: "154 78% 56%", accent: "154 50% 20%", accentForeground: "0 0% 98%", gradient: "142 72% 50%, 48 94% 56%, 187 82% 54%" } },
  { id: "rainbow", mode: "gradient", label: "Rainbow", description: "Kırmızıdan cyan'a canlı spektrum", swatches: ["#ef4444", "#eab308", "#3b82f6"], light: { primary: "12 82% 48%", accent: "12 80% 95%", accentForeground: "12 82% 32%", gradient: "0 84% 54%, 48 92% 50%, 221 83% 52%" }, dark: { primary: "12 90% 62%", accent: "12 55% 22%", accentForeground: "0 0% 98%", gradient: "0 86% 60%, 48 94% 58%, 221 88% 64%" } },
  { id: "cocoa", mode: "gradient", label: "Cocoa", description: "Kahve, amber ve cream", swatches: ["#78350f", "#d97706", "#fef3c7"], light: { primary: "30 78% 38%", accent: "30 75% 93%", accentForeground: "30 78% 25%", gradient: "24 80% 38%, 30 90% 48%, 45 92% 62%" }, dark: { primary: "30 82% 58%", accent: "30 48% 20%", accentForeground: "0 0% 98%", gradient: "24 82% 52%, 30 92% 58%, 45 94% 62%" } },
  { id: "meadow", mode: "gradient", label: "Meadow", description: "Lime, yeşil ve emerald", swatches: ["#84cc16", "#22c55e", "#10b981"], light: { primary: "142 64% 36%", accent: "142 60% 93%", accentForeground: "142 64% 25%", gradient: "82 78% 42%, 142 64% 42%, 160 72% 42%" }, dark: { primary: "142 72% 56%", accent: "142 48% 20%", accentForeground: "0 0% 98%", gradient: "82 78% 52%, 142 72% 54%, 160 82% 52%" } },
  ...EXTRA_SOLID_COLORS,
  ...EXTRA_GRADIENT_COLORS,
];

const STORAGE_KEY = "loop-system-color";

export function getSystemColorId(): SystemColorId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SystemColorId | null;
    return SYSTEM_COLORS.some(color => color.id === saved) ? saved! : "ember";
  } catch {
    return "ember";
  }
}

export function applySystemColor(id: SystemColorId) {
  const color = SYSTEM_COLORS.find(item => item.id === id) ?? SYSTEM_COLORS[0]!;
  const dark = document.documentElement.classList.contains("dark");
  const values = dark ? color.dark : color.light;
  const root = document.documentElement;
  root.style.setProperty("--primary", values.primary);
  root.style.setProperty("--accent", values.accent);
  root.style.setProperty("--accent-foreground", values.accentForeground);
  root.style.setProperty("--loop-accent-mode", color.mode);
  const [start, middle, end] = values.gradient.split(", ");
  root.style.setProperty("--loop-gradient-start", start!);
  root.style.setProperty("--loop-gradient-mid", middle!);
  root.style.setProperty("--loop-gradient-end", end!);
  localStorage.setItem(STORAGE_KEY, color.id);
  window.dispatchEvent(new CustomEvent("loop-system-color-change", { detail: color.id }));
}

export function useSystemColor() {
  const [color, setColor] = useState<SystemColorId>(getSystemColorId);

  useEffect(() => {
    applySystemColor(color);
  }, [color]);

  useEffect(() => {
    const handleThemeChange = () => applySystemColor(color);
    window.addEventListener("loop-dark-mode-change", handleThemeChange);
    return () => window.removeEventListener("loop-dark-mode-change", handleThemeChange);
  }, [color]);

  return { color, setColor: (next: SystemColorId) => setColor(next) };
}
