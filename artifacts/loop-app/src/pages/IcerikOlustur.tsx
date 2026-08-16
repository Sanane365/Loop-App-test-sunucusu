import { useLocation } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

/* ── SVG ikonlar — referans stilinde büyük outlined ─────────────────── */
const ICON_COLOR = "#a78bfa"; // violet-400
const ICON_STROKE = 1.6;
const SZ = 96;

function MetinIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* kapak / kitap */}
      <rect x="14" y="12" width="52" height="68" rx="5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      <rect x="20" y="20" width="40" height="5" rx="2" fill={ICON_COLOR} opacity=".35" />
      <rect x="20" y="30" width="40" height="4" rx="2" fill={ICON_COLOR} opacity=".25" />
      <rect x="20" y="39" width="32" height="4" rx="2" fill={ICON_COLOR} opacity=".25" />
      <rect x="20" y="48" width="36" height="4" rx="2" fill={ICON_COLOR} opacity=".25" />
      <rect x="20" y="57" width="28" height="4" rx="2" fill={ICON_COLOR} opacity=".25" />
      <line x1="14" y1="12" x2="14" y2="80" stroke={ICON_COLOR} strokeWidth="4" strokeLinecap="round" />
      {/* yıldız */}
      <polygon points="74,10 76.4,17.6 84,17.6 78,22.4 80.4,30 74,25.2 67.6,30 70,22.4 64,17.6 71.6,17.6" fill="#f59e0b" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* film şeridi */}
      <rect x="12" y="16" width="62" height="62" rx="6" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      {/* dikey şerit çizgiler */}
      <rect x="12" y="28" width="62" height="1.5" fill={ICON_COLOR} opacity=".3" />
      <rect x="12" y="64" width="62" height="1.5" fill={ICON_COLOR} opacity=".3" />
      {/* film karesi delikleri sol */}
      <rect x="16" y="19" width="7" height="7" rx="1.5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      <rect x="16" y="68" width="7" height="7" rx="1.5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      {/* film karesi delikleri sağ */}
      <rect x="63" y="19" width="7" height="7" rx="1.5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      <rect x="63" y="68" width="7" height="7" rx="1.5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      {/* play üçgeni */}
      <polygon points="40,36 62,47.5 40,59" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinejoin="round" fill={`${ICON_COLOR}22`} />
    </svg>
  );
}

function GorselIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* arka kart */}
      <rect x="22" y="18" width="56" height="44" rx="5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} opacity=".4" transform="rotate(-6 22 18)" />
      {/* ana kart */}
      <rect x="12" y="26" width="60" height="48" rx="6" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} fill="none" />
      {/* dağ silueti */}
      <polyline points="18,64 32,42 44,55 54,44 78,64" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinejoin="round" fill={`${ICON_COLOR}15`} />
      {/* güneş */}
      <circle cx="62" cy="40" r="7" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} fill={`${ICON_COLOR}20`} />
    </svg>
  );
}

function SesliIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* kitap */}
      <rect x="14" y="14" width="48" height="62" rx="5" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} />
      <line x1="14" y1="14" x2="14" y2="76" stroke={ICON_COLOR} strokeWidth="4" strokeLinecap="round" />
      {/* hoparlör dalgaları */}
      <circle cx="68" cy="44" r="8" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} fill={`${ICON_COLOR}18`} />
      <path d="M60 34 Q52 44 60 54" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" opacity=".5" />
      <path d="M78 30 Q90 44 78 58" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" opacity=".5" />
      {/* iç ses ikonu */}
      <path d="M64 40 L68 36 L68 52 L64 48 L60 48 L60 40 Z" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinejoin="round" fill={`${ICON_COLOR}30`} />
    </svg>
  );
}

function EtkilesimIcon() {
  return (
    <svg width={SZ} height={SZ} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* el */}
      <path d="M42 64 L42 42 Q42 38 46 38 Q50 38 50 42 L50 56 Q50 52 54 52 Q58 52 58 56 L58 58 Q58 54 62 54 Q66 54 66 58 L66 62 Q66 58 70 58 Q74 58 74 62 L74 74 Q74 80 68 82 L52 82 Q44 82 42 74 Z"
        stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinejoin="round" fill={`${ICON_COLOR}15`} />
      {/* dokunma dalgaları */}
      <path d="M30 30 Q22 38 22 48 Q22 58 30 66" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" opacity=".5" />
      <path d="M36 24 Q24 34 24 48 Q24 62 36 72" stroke={ICON_COLOR} strokeWidth={ICON_STROKE} strokeLinecap="round" fill="none" opacity=".3" />
    </svg>
  );
}

/* ── İçerik tipleri ─────────────────────────────────────────────────── */
const CONTENT_TYPES = [
  {
    id: "metin",
    label: "Metin Hikayesi",
    desc: "Kitaplar, bölümlü romanlar, bloglar ve kısa öyküler.",
    Icon: MetinIcon,
    badge: null,
    href: "/yaz/metin",
  },
  {
    id: "video",
    label: "Video Hikayesi",
    desc: "Hikayeni kısa film, fragman veya animasyonla anlat.",
    Icon: VideoIcon,
    badge: null,
    href: "/yaz/video",
  },
  {
    id: "gorsel",
    label: "Görsel Hikaye",
    desc: "Çizgi roman, webtoon, manga veya fotoğraf dizileri.",
    Icon: GorselIcon,
    badge: null,
    href: "/yaz/gorsel",
  },
  {
    id: "sesli",
    label: "Sesli Kitap",
    desc: "Sesli kitap ya da podcast bölümleri şeklinde yayınla.",
    Icon: SesliIcon,
    badge: "YENİ",
    href: "/yaz/sesli",
  },
  {
    id: "etkilesim",
    label: "Etkileşimli Deneyim",
    desc: "Dallanan hikayeler ve sohbet tabanlı interaktif anlatılar.",
    Icon: EtkilesimIcon,
    badge: "YENİ",
    href: "/yaz/etkilesim",
  },
];

export default function IcerikOlustur() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0814" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <button
          type="button"
          onClick={() => history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h1 className="text-[16px] font-black tracking-tight text-white">İçerik Oluştur</h1>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-violet-300 hover:bg-white/5 transition-colors"
        >
          <FileText className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Subtitle */}
      <p className="text-center text-[12px] text-slate-400 px-8 mb-6">
        Hangi türde içerik oluşturmak istiyorsun?
      </p>

      {/* 2-column grid */}
      <div className="flex-1 px-4 pb-24">
        <div className="grid grid-cols-2 gap-4">
          {CONTENT_TYPES.map((type, i) => {
            /* Tek sayıda olduğu için son eleman span-2 */
            const isLast = i === CONTENT_TYPES.length - 1 && CONTENT_TYPES.length % 2 !== 0;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setLocation(type.href)}
                className={`group relative flex flex-col items-center text-center rounded-2xl px-4 pt-7 pb-5 transition-all duration-200 active:scale-95
                  ${isLast ? "col-span-2 max-w-[calc(50%-8px)] mx-auto" : ""}
                `}
                style={{
                  background: "linear-gradient(145deg, rgba(109,40,217,0.10) 0%, rgba(109,40,217,0.05) 100%)",
                  border: "1px solid rgba(139,92,246,0.22)",
                  boxShadow: "0 4px 24px rgba(109,40,217,0.08)",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(167,139,250,0.5)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.22)")}
              >
                {/* YENİ badge */}
                {type.badge && (
                  <span
                    className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-black tracking-wide"
                    style={{ background: "#34d399", color: "#052e16" }}
                  >
                    {type.badge}
                  </span>
                )}

                {/* İkon */}
                <div className="mb-4 transition-transform duration-200 group-hover:scale-105">
                  <type.Icon />
                </div>

                {/* Başlık */}
                <span className="text-[14px] font-black text-white leading-tight mb-2">
                  {type.label}
                </span>

                {/* Açıklama */}
                <span className="text-[11px] leading-snug text-slate-400">
                  {type.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
