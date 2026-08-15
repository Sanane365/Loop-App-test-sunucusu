/**
 * 5-harfli Türkçe kelime listesi — Wordle için
 * Hepsi büyük harf, Türk alfabesi kullanılarak.
 */
export const WORDLE_WORDS: string[] = [
  // A
  "ARABA", "ASLAN", "ALARM", "ALTIN", "ARMUT",
  // B
  "BADEM", "BAHÇE", "BAHAR", "BALIK", "BANKA", "BEYAZ", "BÖREK", "BRONZ", "BÜYÜK",
  // C - Ç
  "CADDE", "CEKET", "CEVİZ",
  "ÇADIR", "ÇANTA", "ÇARŞI", "ÇAYIR", "ÇİZME", "ÇORBA",
  // D
  "DEVAM", "DOLMA", "DOMUZ", "DUVAR", "DÜNYA",
  // E
  "EKMEK", "ELMAS",
  // F
  "FIRIN", "FULAR",
  // G - Ğ
  "GİTAR", "GÖLET", "GÜMÜŞ", "GÜNEŞ", "GÜNEY",
  // H
  "HABER", "HAVUÇ", "HAYAT", "HAYAL", "HEKİM", "HİNDİ", "HOROZ",
  // İ
  "İNCİR",
  // K
  "KABAK", "KABLO", "KAHVE", "KALEM", "KARGA", "KASAP", "KAVUN", "KAYIK", "KAZAK",
  "KEBAP", "KEMAN", "KİRAZ", "KİTAP", "KÖFTE", "KÖPEK", "KÖPRÜ", "KOŞMA", "KOYUN",
  "KORKU", "KURUM", "KUZEY", "KÜÇÜK", "KİRPİ", "KIRAZ",
  // L
  "LİMAN",
  // M
  "MARKA", "MEYVE", "MISIR", "MÜZİK", "MUTLU",
  // N
  "NEHİR",
  // O - Ö
  "OKUMA", "ORMAN",
  // P
  "PAZAR", "PEMBE", "PERDE", "PİLAV", "POLİS", "PILOT",
  // R
  "RADYO",
  // S - Ş
  "SAHİL", "SALON", "SANAT", "SARMA", "SEBZE", "SERÇE", "SEVGİ", "SİYAH", "SICAK",
  "SOKAK", "SOĞUK", "ŞEKER", "ŞOFÖR",
  // T
  "TABLO", "TAHTA", "TAKIM", "TARLA", "TATLI", "TAVAN", "TAVUK", "TEKNE", "TENİS",
  "TÜNEL", "TULUM",
  // Ü
  "ÜZGÜN",
  // V
  "VİDEO", "VİŞNE",
  // Y
  "YAZAR", "YATAK", "YAYLA", "YAZMA", "YEŞİL", "YOKUŞ", "YÜZME",
  // Z
  "ZAMAN", "ZEMİN",
  // ek kelimeler
  "ASKER", "BORSA", "DERGI", "HALIM", "KIYMA", "NEHIR", "TARIH",
  "SEVGI", "TATLÍ", "KOŞMA", "PIKAP", "LIMAN", "ZEMIN", "SERIN",
];

/** Günlük kelimeyi tarih bazlı seed ile döndür (herkes aynı kelimeyi görür) */
export function getDailyWord(): string {
  const epoch  = new Date("2024-01-01T00:00:00Z").getTime();
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  const dayIdx = Math.floor((now.getTime() - epoch) / 86_400_000);
  return WORDLE_WORDS[((dayIdx % WORDLE_WORDS.length) + WORDLE_WORDS.length) % WORDLE_WORDS.length];
}

/** Bugünün tarih dizgisi (YYYY-MM-DD) */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
