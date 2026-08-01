// ── Curated GIF kit ─────────────────────────────────────────────────────────
// Direct Giphy CDN — no API key needed.
// preview: media.giphy.com/media/{id}/giphy_s.gif  (small still/thumb)
// full:    media.giphy.com/media/{id}/giphy.gif    (animated)

export interface GifItem {
  id: string;
  tags: string[];
}

export interface GifCategory {
  id: string;
  label: string;
  emoji: string;
  gifs: GifItem[];
}

export function gifUrl(id: string) {
  return `https://media.giphy.com/media/${id}/giphy.gif`;
}
export function gifPreview(id: string) {
  return `https://media.giphy.com/media/${id}/giphy_s.gif`;
}

export const GIF_CATEGORIES: GifCategory[] = [
  {
    id: "popular",
    label: "Popüler",
    emoji: "🔥",
    gifs: [
      { id: "yMts4RqyjlN3a", tags: ["güldüm", "kedi", "komik"] },
      { id: "PVgeqivIoG1Zi", tags: ["alkış", "harika", "bravo"] },
      { id: "ZqlCdQXFM6pvC", tags: ["güldüm", "ağladım", "komik"] },
      { id: "l3fQjHqAtnuTCbPFe", tags: ["şaşırdım", "vay be", "inanılmaz"] },
      { id: "3o7TKqnN349PBUtGFO", tags: ["inanılmaz", "şaşırdım"] },
      { id: "S3Ot3hZ5bcy8o", tags: ["dans", "kutlama", "parti"] },
      { id: "111etqKBsomLMQ", tags: ["evet", "tamam", "haydi"] },
      { id: "l0MYAs5E2oNqngekA", tags: ["alkış", "bravo", "süper"] },
      { id: "XsUtdIeJ0MWMo", tags: ["yüzüstü", "saçma", "kötü"] },
      { id: "MDJ9IbxxvDUQM", tags: ["aşk", "kalp", "sevgi"] },
      { id: "26u4cqiYI30juCOGY", tags: ["evet", "tamam", "ok"] },
      { id: "xUPGcEliCc7bETyfDq", tags: ["şaşırdım", "anlamadım"] },
      { id: "CpSmX9LFkxbNe", tags: ["güldüm", "komik"] },
      { id: "l41lIqrUM7euPoUUU", tags: ["harika", "süper", "deal"] },
      { id: "3ohzdRoOp1FUYbtGDO", tags: ["wow", "şaşırdım", "inanılmaz"] },
      { id: "jUwpNzg9IcyrK", tags: ["kötü", "bozuldu", "yandı"] },
      { id: "VbAFjQgHYXDYk", tags: ["dans", "mutlu"] },
      { id: "l3q2K5jinAlChoCLS", tags: ["başparmak", "evet", "onay"] },
    ],
  },
  {
    id: "laugh",
    label: "Komedi",
    emoji: "😂",
    gifs: [
      { id: "yMts4RqyjlN3a", tags: ["güldüm", "kedi"] },
      { id: "ZqlCdQXFM6pvC", tags: ["güldüm", "ağladım"] },
      { id: "UrGVRCOJMWiRi", tags: ["güldüm", "komik"] },
      { id: "3o7TKqiRTEMSiUpL5C", tags: ["güldüm", "komik"] },
      { id: "oYtVHSxngR3lC", tags: ["güldüm", "çılgın"] },
      { id: "hZf255uES78hi", tags: ["güldüm"] },
      { id: "Vuw9XPHzA72UwHFtWV", tags: ["güldüm", "komik"] },
      { id: "3oKIPsx2VAYAgEHC12", tags: ["güldüm", "komik"] },
      { id: "lTiIoANE82PZSX4BfT", tags: ["güldüm", "deli"] },
      { id: "xT9IgG50Lg7russbDa", tags: ["güldüm", "aptal", "salak"] },
      { id: "o0vwzuFwCGAFO", tags: ["güldüm", "bütün gün"] },
      { id: "WIg8P0VNpgKcqkj8pG", tags: ["güldüm", "emoji"] },
      { id: "3oEdv9Y9MDhNISU3tK", tags: ["güldüm", "komik"] },
      { id: "CpSmX9LFkxbNe", tags: ["güldüm"] },
      { id: "4GT1YMNivMBdK", tags: ["güldüm", "trolledi"] },
      { id: "Gpf8A8aX7XEJ6", tags: ["güldüm", "meme"] },
      { id: "8vQSQ3cNXuDGo", tags: ["güldüm", "bebekler"] },
      { id: "TdfyKrN7HGTIY", tags: ["güldüm", "bekliyorum"] },
      { id: "l0MYC0LajbaPoEADe", tags: ["güldüm"] },
      { id: "GeimqsH0TLDt4tScGw", tags: ["güldüm", "emoji"] },
    ],
  },
  {
    id: "celebrate",
    label: "Kutlama",
    emoji: "🎉",
    gifs: [
      { id: "PVgeqivIoG1Zi", tags: ["alkış", "bravo"] },
      { id: "l0MYAs5E2oNqngekA", tags: ["alkış"] },
      { id: "artj39B8HX5wHEyqQ6", tags: ["kutlama", "parti"] },
      { id: "ZfK4uWd9acWKY", tags: ["alkış"] },
      { id: "hZf255uES78hi", tags: ["kutlama"] },
      { id: "26u4lOsABbO7bvMis", tags: ["kutlama", "harika"] },
      { id: "bPTXcJiIzzsuperflu", tags: ["kutlama", "confetti"] },
      { id: "g9582DNuQppxC", tags: ["alkış"] },
      { id: "KJ1f5iTl4Oo7u", tags: ["kutlama", "yes"] },
      { id: "3otPoS81loriI9sO8o", tags: ["kutlama", "evet"] },
      { id: "rY93u9tQbybks", tags: ["kutlama", "tebrikler"] },
      { id: "v0eHX3n28wjrG", tags: ["kutlama", "parti"] },
      { id: "l0HlvtIPzPdt2", tags: ["kutlama", "wohoo"] },
      { id: "TdfyKrN7HGTIY", tags: ["bekliyorum", "parti"] },
      { id: "26FPim2JtbDpE4jfO", tags: ["kutlama", "haydi"] },
      { id: "rVbAzUUSUC6dO", tags: ["kutlama", "tebrikler", "parti"] },
      { id: "Rl9Yqavfj2HF6", tags: ["kutlama"] },
      { id: "a0h7sAqON67nO", tags: ["alkış", "bravo"] },
    ],
  },
  {
    id: "dance",
    label: "Dans",
    emoji: "💃",
    gifs: [
      { id: "S3Ot3hZ5bcy8o", tags: ["dans", "mutlu"] },
      { id: "jMguxCQkMxgXHkIi86", tags: ["dans"] },
      { id: "11ISwbgCxECqDsI", tags: ["dans", "parti"] },
      { id: "CjmvTCZf2U3p09Cn0h", tags: ["dans"] },
      { id: "blSTtZehjAZ8I", tags: ["dans", "emoji"] },
      { id: "13CoXDiaCcCoyk", tags: ["dans"] },
      { id: "l0Iy2MnL9ejDrf73i", tags: ["dans", "mutlu"] },
      { id: "VbAFjQgHYXDYk", tags: ["dans"] },
      { id: "5xtWauHs7rmxCou3FH", tags: ["dans", "party"] },
      { id: "6q29hxDKTi5rO", tags: ["dans", "kedi"] },
      { id: "LmzTjVgPqUgaQ", tags: ["dans", "parti"] },
      { id: "DhstvI3zZ598Nb1rFf", tags: ["dans", "parti"] },
      { id: "xT9IgGSC9VuvmMWzOE", tags: ["dans"] },
      { id: "jTD9n0GiZYKIWiuSmz", tags: ["dans"] },
      { id: "10bDoTjGT9XJm8", tags: ["dans"] },
      { id: "14bhmZtBNhVnIk", tags: ["dans", "haydi"] },
      { id: "XqRsRHJSPRKpBKhCQy", tags: ["dans", "mutlu"] },
    ],
  },
  {
    id: "love",
    label: "Aşk",
    emoji: "❤️",
    gifs: [
      { id: "MDJ9IbxxvDUQM", tags: ["aşk", "kalp", "sevgi"] },
      { id: "l4FGmHTcdl3R4jGpi", tags: ["aşk", "kalp"] },
      { id: "3oz8xIs1YeOTn4iVNE", tags: ["aşk", "romantik"] },
      { id: "3o6Zt481isNVuQI1l6", tags: ["aşk", "kalp"] },
      { id: "6tbFhzZBKvFnq", tags: ["aşk", "sarıldım"] },
      { id: "XGj1h5MYSSnKE", tags: ["aşk", "sevgi"] },
      { id: "DrJm6F9poo4aA", tags: ["aşk", "emoji"] },
      { id: "l4Fk0GBeplZTxDxLO", tags: ["aşk", "kalpçik"] },
      { id: "C6sKEJeKLaLGg", tags: ["aşk", "sarıl"] },
      { id: "fdyZ3qI0GVZC0", tags: ["aşk", "kalp", "büyük"] },
      { id: "JjAdpCxoqoyzo", tags: ["aşk", "yavaş"] },
      { id: "26FKZlkQEIGl85yo8", tags: ["aşk", "seviyorum"] },
      { id: "3oEdvdGj5T66TijFnO", tags: ["aşk", "kedi"] },
      { id: "h0x8KXC9sTgQ8", tags: ["aşk", "sarıldım"] },
      { id: "5QZZGwZdpfKiI", tags: ["aşk", "kalp"] },
    ],
  },
  {
    id: "sad",
    label: "Üzgün",
    emoji: "😢",
    gifs: [
      { id: "d2lcHJTG5Tscg", tags: ["ağladım", "üzgün"] },
      { id: "OPU6wzx8JrHna", tags: ["ağladım", "üzgün"] },
      { id: "UvvR8SF23U7BS", tags: ["ağladım", "çok üzgün"] },
      { id: "ISOckXUybVfQ4", tags: ["üzgün", "hayal kırıklığı"] },
      { id: "N6funLmDGOv3q", tags: ["üzgün", "hayal kırıklığı"] },
      { id: "g01ZnwAX5R9d2", tags: ["üzgün", "meme"] },
      { id: "tk6IG3QLrjdfC", tags: ["üzgün", "ağladım"] },
      { id: "1FMaya1IyNvAI", tags: ["üzgün"] },
      { id: "ROF8OQvDiDYCFJd6Ed", tags: ["üzgün", "vay be"] },
      { id: "nFM9sByqNz5oS3ZF8J", tags: ["üzgün", "ağladım"] },
      { id: "wW95fEq09hOI8", tags: ["üzgün", "acıdı"] },
      { id: "5xtWauHs7rmxCou3FH", tags: ["üzgün"] },
      { id: "7SF5scGB2AFrgsXP63", tags: ["üzgün", "ağladım"] },
    ],
  },
  {
    id: "angry",
    label: "Sinirli",
    emoji: "😠",
    gifs: [
      { id: "3o7TKUMsHHPMTjKuPC", tags: ["sinirli", "kızgın"] },
      { id: "IXIJ0U0NeEGmk", tags: ["sinirli"] },
      { id: "11tTNkNy1SdXGg", tags: ["kızgın", "sinirli"] },
      { id: "3o7TKF1fSIs1R19B8k", tags: ["hayır", "kızgın"] },
      { id: "hv5AEBpH3ZyNoRnABG", tags: ["hayır", "reddet"] },
      { id: "KxKHjRmEMWCQgCLKwD", tags: ["kızgın", "sinirli"] },
      { id: "yFHkrrbfIk9vLwhNtk", tags: ["kızgın"] },
      { id: "3o6Zt6ML6BklcajjsA", tags: ["kızgın", "sinirli"] },
      { id: "12FjXAFBgHBfm0", tags: ["sinirli", "bruh"] },
      { id: "GRZnJ4PZNFM1O", tags: ["sinirli"] },
    ],
  },
  {
    id: "shocked",
    label: "Şaşkın",
    emoji: "🤯",
    gifs: [
      { id: "l3fQjHqAtnuTCbPFe", tags: ["şaşırdım", "inanılmaz"] },
      { id: "3o7TKqnN349PBUtGFO", tags: ["şaşırdım"] },
      { id: "3ohzdRoOp1FUYbtGDO", tags: ["wow", "şaşırdım"] },
      { id: "xUPGcEliCc7bETyfDq", tags: ["anlamadım", "şaşırdım"] },
      { id: "MhBNBRdifNVOsVSKAU", tags: ["şaşırdım", "wow"] },
      { id: "uqS4EMJC60KNO", tags: ["şaşırdım"] },
      { id: "3o6Yg4GMyL4W3QEWOO", tags: ["şaşırdım", "vay"] },
      { id: "SVgOYJJCqFoelJ7G71", tags: ["şaşırdım", "wow"] },
      { id: "elzANR9RvAWqf7qFzH", tags: ["şaşırdım"] },
      { id: "14aUO0Mf7dWDXW", tags: ["şaşırdım", "wow"] },
      { id: "YrMrSUfeh3vZm", tags: ["şaşırdım", "şok"] },
      { id: "l46C8WFxME8MP7WKI", tags: ["şaşırdım"] },
    ],
  },
  {
    id: "yes",
    label: "Evet / Onay",
    emoji: "👍",
    gifs: [
      { id: "111etqKBsomLMQ", tags: ["evet", "tamam"] },
      { id: "l3q2K5jinAlChoCLS", tags: ["başparmak", "evet", "onay"] },
      { id: "26u4cqiYI30juCOGY", tags: ["evet", "ok"] },
      { id: "vFKqnCdLPipaAdrjTW", tags: ["evet", "onay"] },
      { id: "TdfyKrN7HGTIY", tags: ["evet", "bekliyorum"] },
      { id: "dykJjxEZFBBiOMnVE5", tags: ["evet", "onay"] },
      { id: "fnSRRFvX0Dq18Y7AxF", tags: ["evet", "anlıyorum"] },
      { id: "3ohuAFn4vFAzNO6CHi", tags: ["evet", "harika"] },
      { id: "BaDCP7KhCBaVG", tags: ["evet", "iyi"] },
      { id: "3ohc14R7Hp5OGEBrte", tags: ["evet", "onay"] },
      { id: "xT9KVqOqOlNfN7SpVm", tags: ["tamam", "onay"] },
      { id: "l41lIqrUM7euPoUUU", tags: ["cool", "deal with it"] },
    ],
  },
  {
    id: "no",
    label: "Hayır / Red",
    emoji: "👎",
    gifs: [
      { id: "3o7TKF1fSIs1R19B8k", tags: ["hayır", "red"] },
      { id: "hv5AEBpH3ZyNoRnABG", tags: ["hayır", "red"] },
      { id: "XsUtdIeJ0MWMo", tags: ["yüzüstü", "saçma"] },
      { id: "RkXvpXA4gryti", tags: ["yüzüstü", "bruh"] },
      { id: "TIRlx3Fzo3bjA", tags: ["hayır", "dur"] },
      { id: "6yGqA3m5GZlFm", tags: ["hayır"] },
      { id: "l4FGGafcOHmrlQxG0", tags: ["hayır", "yeter"] },
      { id: "fQZX2aoRC1Tqw", tags: ["hayır", "gitmiyorum"] },
      { id: "3oEjHI5ij5iZiXzSXu", tags: ["hayır", "hiç"] },
      { id: "1zSs5StaSMkB2", tags: ["hayır", "dur"] },
    ],
  },
  {
    id: "animals",
    label: "Hayvanlar",
    emoji: "🐾",
    gifs: [
      { id: "yMts4RqyjlN3a", tags: ["kedi", "güldüm"] },
      { id: "6q29hxDKTi5rO", tags: ["kedi", "dans"] },
      { id: "3oEdv9Y9MDhNISU3tK", tags: ["kedi", "komik"] },
      { id: "5i7umUqAOYYEI", tags: ["köpek", "mutlu"] },
      { id: "GlPOHSGSSlIRa", tags: ["kedi", "tepki"] },
      { id: "ICOgUNjpvO0PC", tags: ["kedi", "sans"] },
      { id: "3oEdv9Y9MDhNISU3tK", tags: ["kedi"] },
      { id: "Nm8ZPAGOwZUQM", tags: ["kedi", "gözler"] },
      { id: "12pa1oFBTfNPjS", tags: ["köpek", "dans"] },
      { id: "7NoNw4pMNTvgc", tags: ["kedi", "baktı"] },
      { id: "Ov5NiLVXT8JEc", tags: ["köpek", "eğlenceli"] },
      { id: "11sBLVxNs7v6WA", tags: ["kedi", "dans"] },
      { id: "HFB3BEYBKhKkg", tags: ["kedi", "mutlu"] },
      { id: "AKf9R2a8b0JX4", tags: ["köpek", "bekliyorum"] },
    ],
  },
  {
    id: "thinking",
    label: "Düşünüyor",
    emoji: "🤔",
    gifs: [
      { id: "l0IsItRCaakrErTRC", tags: ["düşünüyor", "hmm"] },
      { id: "3o7TKSha51ATMDNwqY", tags: ["düşünüyor"] },
      { id: "14gzOEMbejZJJe", tags: ["düşünüyor", "plan"] },
      { id: "APqEbxBsVlkWSuqlZT", tags: ["düşünüyor"] },
      { id: "a5viI92PAF89q", tags: ["düşünüyor", "hmm"] },
      { id: "3o6Zt6ML6BklcajjsA", tags: ["merak", "düşünüyor"] },
      { id: "xT9IgvNIhBOEBFADZe", tags: ["düşünüyor", "kafa karışık"] },
      { id: "yhwJoGQNF2Sl8K3b2S", tags: ["düşünüyor"] },
      { id: "bAplZhiLAsNnG", tags: ["düşünüyor"] },
    ],
  },
  {
    id: "fire",
    label: "Harika / Ateş",
    emoji: "✨",
    gifs: [
      { id: "HVi8LsHHfpbNO", tags: ["ateş", "cool"] },
      { id: "YpJBf5kBP1Vr0G0oA4", tags: ["ateş", "bu iyidir"] },
      { id: "l41lIqrUM7euPoUUU", tags: ["harika", "cool"] },
      { id: "V80ek6UWwDOqk", tags: ["harika", "vay"] },
      { id: "3o6Zt481isNVuQI1l6", tags: ["harika"] },
      { id: "xT9Igc5WdcFQNS8R2", tags: ["harika", "ateş"] },
      { id: "dykJjxEZFBBiOMnVE5", tags: ["harika", "onay"] },
      { id: "elzANR9RvAWqf7qFzH", tags: ["harika", "wow"] },
      { id: "62PP2gEUkHoy1fHWZ9", tags: ["harika"] },
      { id: "xTiTnqUxyWbsAXq7Ju", tags: ["ateş"] },
    ],
  },
];

// Flat map for searching across all categories
export const ALL_GIFS: (GifItem & { categoryId: string })[] = GIF_CATEGORIES.flatMap(
  (cat) => cat.gifs.map((g) => ({ ...g, categoryId: cat.id }))
);

export function searchGifs(query: string, limit = 40): GifItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return ALL_GIFS.slice(0, limit);
  return ALL_GIFS.filter((g) =>
    g.tags.some((t) => t.includes(q))
  ).slice(0, limit);
}
