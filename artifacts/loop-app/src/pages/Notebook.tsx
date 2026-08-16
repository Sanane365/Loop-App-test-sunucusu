import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowRight, BookOpen, Bookmark, ChevronDown, ChevronUp, Eye, Globe2, Heart, Home, Images, MapPin, MoreVertical, Pen, Play, Search, Sparkles, Star, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { useEffect, useRef } from "react";
import { useSearch, Link } from "wouter";
import { useListPosts, getListPostsQueryKey } from "@workspace/api-client-react";
import { PostCard } from "@/components/shared/PostCard";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const librarySummary = {
  title: "Loop Kitaplık",
  subtitle: "Kitap yazma ve okuma deneyimini tek bir profesyonel panelde birleştirin.",
  stats: [
    { label: "Aktif Proje", value: "Derin Mesafe" },
    { label: "Tamamlanan Bölümler", value: "8/12" },
    { label: "Okuma Süresi", value: "15 saat" },
  ],
};

const performanceInsights = [
  { label: "Haftalık Okuma", value: "9.4K", progress: 82 },
  { label: "Beğeni Artışı", value: "+18%", progress: 64 },
  { label: "Yeni Aboneler", value: "+320", progress: 71 },
  { label: "Ortalama Süre", value: "14 dk", progress: 56 },
];

type LaunchStatus = "Devam ediyor" | "Planlandı" | "Hazır";

type LaunchPipelineItem = {
  title: string;
  description: string;
  status: LaunchStatus;
};

const launchPipeline: LaunchPipelineItem[] = [
  { title: "Bölüm 9 taslağı", description: "Bitiş sahnelerini tamamla ve akışı sıkılaştır.", status: "Devam ediyor" },
  { title: "Kapak revizesi", description: "Formalite koleksiyonuna uygun tipografi seç.", status: "Planlandı" },
  { title: "OK okunma listesi", description: "Okuyucu notlarını toparla ve yeni öneriler ekle.", status: "Hazır" },
];

const featuredBooks = [
  {
    title: "Derin Mesafe",
    author: "Uygar Y.",
    category: "Genç Yetişkin",
    progress: 78,
    cover: "https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Sessiz Sayfalar",
    author: "Maya T.",
    category: "Polisiye",
    progress: 45,
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Yıldızların Altında",
    author: "Ege A.",
    category: "Fantastik",
    progress: 92,
    cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
  },
];

const rankings = [
  { rank: 1, title: "Beklenen Kaos", reads: "4.8K" },
  { rank: 2, title: "Ölüm İksiri", reads: "3.2K" },
  { rank: 3, title: "Yıldızların Altında", reads: "5.7K" },
];

const libraryCategories = [
  { name: "Roman", count: 24 },
  { name: "Polisiye", count: 18 },
  { name: "Fantastik", count: 12 },
  { name: "Kişisel Gelişim", count: 9 },
];

const formaliteBooks = [
  {
    title: "Formalite: Ritmik Akış",
    author: "Loop Koleksiyonu",
    progress: 54,
    cover: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Formalite: Gece Defteri",
    author: "Loop Koleksiyonu",
    progress: 37,
    cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80",
  },
];

const inspirationBooks = [
  { title: "Klasik Kurallar", cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80" },
  { title: "Mektup ve Mühür", cover: "https://images.unsplash.com/photo-1528209396504-5f31f70ca3b2?auto=format&fit=crop&w=900&q=80" },
  { title: "Sessiz Sayfalar", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80" },
];

const featuredStories = [
  { title: "Bir Adın Bedeli", author: "İrem Uslu", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=700&q=80", description: "Eylül Çetiner kanser olduğunu öğrendiği gün ilk aşkı ile karşılaşır. Çağan Demirsoy kim olduğunu Eylül'den gizlemiş yıllar sonra birden ortaya çıkar...", reads: "12.8K", likes: "161", rating: "5.0" },
  { title: "Derin Mesafe", author: "Uygar Y.", genre: "Genç Yetişkin", cover: "https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=700&q=80", description: "Hayata tutunduğu sıkı ipleri bir bir elinden kaçırmaya başlayan Uygar'ın, Peri ile karşılaşmasıyla başlar her şey...", reads: "26.4K", likes: "228", rating: "5.0" },
  { title: "Son Perde", author: "Lina K.", genre: "Dram", cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=700&q=80", description: "Bir sahnenin son ışığı sönerken geçmişin sakladığı hikâye yeniden ortaya çıkar.", reads: "18.2K", likes: "184", rating: "4.8" },
  { title: "Kayıp Harita", author: "Arda S.", genre: "Macera", cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=700&q=80", description: "Eski bir harita, hiç bilmediği bir şehre ve unutulmuş bir sırrın merkezine götürür.", reads: "14.7K", likes: "163", rating: "4.9" },
  { title: "Ay Işığı Notları", author: "Mina E.", genre: "Romantik", cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=700&q=80", description: "Her gece yazılan kısa notlar, iki yabancının birbirine yaklaşan sesine dönüşür.", reads: "12.8K", likes: "149", rating: "4.7" },
  { title: "Sessiz Oda", author: "Can D.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=700&q=80", description: "Kapısı yıllardır açılmayan bir oda, evin tüm sessizliğini üzerine toplamıştır.", reads: "10.6K", likes: "121", rating: "4.6" },
  { title: "Gökyüzü Çizgisi", author: "Ece Y.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80", description: "Gökyüzünde beliren ince çizgi, yeni bir dünyanın kapısını aralar.", reads: "9.8K", likes: "108", rating: "4.8" },
];

const premiumBooks = [
  { title: "Karma", author: "Nairobi", authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80", label: "Premium Yazar", description: "İki dünyanın arasında sıkışmış hayatlar... Farklı acılar, farklı seçimler, farklı kaderler.", cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=700&q=85", backdrop: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1400&q=70", genre: "Dram · Gizem", rank: "#01", trailers: ["https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4", "https://storage.googleapis.com/coverr-main/mp4/Footboys.mp4", "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4"], media: ["https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=900&q=85"] },
  { title: "Mekanik Kalp", author: "Arman Berra", authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80", label: "Loop Black Label", description: "İnsan olmakla programlanmış olmak arasındaki son çizgiye yaklaşırken.", cover: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=700&q=85", backdrop: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=70", genre: "Bilim Kurgu", rank: "#02", trailers: ["https://storage.googleapis.com/coverr-main/mp4/Footboys.mp4", "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4", "https://storage.googleapis.com/coverr-main/mp4/Footboys.mp4"], media: ["https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=900&q=85"] },
  { title: "Beyaz Yıldız Dağı", author: "Yume", authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80", label: "Altın Seçki", description: "Karın altında saklanan eski bir kehanet, dört yolcuyu aynı zirvede buluşturur.", cover: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=85", backdrop: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1400&q=70", genre: "Fantastik · Macera", rank: "#03", trailers: ["https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4", "https://storage.googleapis.com/coverr-main/mp4/Footboys.mp4", "https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4"], media: ["https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=85"] },
];

const recommendedBooks = [
  { title: "Sessiz Sayfalar", author: "Maya T.", genre: "Polisiye", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80", progress: "92%" },
  { title: "Yıldızların Altında", author: "Ege A.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=700&q=80", progress: "78%" },
  { title: "Kayıp Şehirler", author: "Derya N.", genre: "Macera", cover: "https://images.unsplash.com/photo-1470115636492-6d2b56f1d284?auto=format&fit=crop&w=700&q=80", progress: "64%" },
  { title: "Sırra Davet", author: "Deniz K.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=700&q=80", progress: "51%" },
  { title: "Kırık Zaman", author: "Elif M.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80", progress: "43%" },
];

const trendingBooks = [
  { title: "Bir Adın Bedeli", author: "İrem Uslu", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=700&q=80", reads: "12.8K" },
  { title: "Derin Mesafe", author: "Uygar Y.", genre: "Genç Yetişkin", cover: "https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=700&q=80", reads: "26.4K" },
  { title: "Gökyüzü Çizgisi", author: "Ece Y.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80", reads: "9.8K" },
  { title: "Kayıp Harita", author: "Arda S.", genre: "Macera", cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=700&q=80", reads: "14.7K" },
  { title: "Sessiz Oda", author: "Can D.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=700&q=80", reads: "10.6K" },
];

const featuredAuthors = [
  { name: "Hülya_Aslıkc", role: "Yerel yazar", bio: "Gözle görülmeyeni kalemle çiziyorum. Yarım kalan kitapların ve yeni başlangıçların yazarı.", genre: "Romantizm", stories: "10", followers: "9.1K", city: "İstanbul", accent: "from-fuchsia-950 via-slate-900 to-cyan-950", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80" },
  { name: "İrem Uslu", role: "Yerel yazar", bio: "Duygusal karşılaşmaları ve ikinci şansları sade, güçlü karakterlerle anlatıyor.", genre: "Romantizm", stories: "8", followers: "7.4K", city: "İzmir", accent: "from-amber-950 via-slate-900 to-rose-950", avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=240&q=80" },
  { name: "Uygar Y.", role: "Yerel yazar", bio: "Büyüme sancılarını, dostluğu ve hayata tutunma hikâyelerini yazıyor.", genre: "Genç Yetişkin", stories: "12", followers: "6.8K", city: "Ankara", accent: "from-blue-950 via-slate-900 to-violet-950", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80" },
  { name: "Ece Y.", role: "Yerel yazar", bio: "Gökyüzü, eski haritalar ve başka dünyalar arasında yeni yollar açıyor.", genre: "Fantastik", stories: "6", followers: "5.2K", city: "Antalya", accent: "from-emerald-950 via-slate-900 to-sky-950", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&q=80" },
  { name: "Deniz K.", role: "Yerel yazar", bio: "Sessiz mekânların içindeki sırları ve beklenmedik dönüşleri keşfediyor.", genre: "Gerilim", stories: "10", followers: "4.7K", city: "Bursa", accent: "from-red-950 via-slate-900 to-orange-950", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=80" },
];

const loopUniverses = [
  { title: "Geceye Kalanlar", description: "Sessiz şehirlerde saklanan sırların, yarım kalmış cümlelerin ve cesur başlangıçların evreni.", mood: "Gizemli · Duygusal", stories: "128 öykü", color: "from-indigo-950 via-slate-900 to-cyan-950", author: "Hülya_Aslıkc", authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=80"] },
  { title: "Kayıp Haritalar", description: "Her yolculuğun yeni bir kapı açtığı, keşif ve maceranın hiç bitmediği geniş bir dünya.", mood: "Macera · Keşif", stories: "94 öykü", color: "from-emerald-950 via-slate-900 to-teal-950", author: "Arda S.", authorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&w=700&q=80"] },
  { title: "Kalbin Kıyısı", description: "İkinci şanslara, eski mektuplara ve birbirini yeniden bulan kalplere ayrılmış sıcak bir evren.", mood: "Romantik · Sıcak", stories: "216 öykü", color: "from-rose-950 via-slate-900 to-orange-950", author: "İrem Uslu", authorAvatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=700&q=80"] },
  { title: "Başka Bir Gökyüzü", description: "Kuralların değiştiği, yıldızların yol gösterdiği ve hayal gücünün sınır tanımadığı dünya.", mood: "Fantastik · Sonsuz", stories: "76 öykü", color: "from-violet-950 via-slate-900 to-fuchsia-950", author: "Ece Y.", authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80", cover: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=85", gallery: ["https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=700&q=80", "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=700&q=80"] },
];

const shelfRows = [
  {
    title: "Yeni Çıkanlar",
    subtitle: "Daha yeni keşfedilmeye başlayan hikâyeler",
    books: [
      { title: "Bir Adın Bedeli", author: "İrem Uslu", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=700&q=80" },
      { title: "Geceye Kalanlar", author: "Hülya_Aslıkc", genre: "Gizem", cover: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=700&q=80" },
      { title: "Kayıp Haritalar", author: "Arda S.", genre: "Macera", cover: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=700&q=80" },
      { title: "Son Perde", author: "Lina K.", genre: "Dram", cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Aksiyon",
    subtitle: "Temposu yüksek, sınırları zorlayan dünyalar",
    books: [
      { title: "Çelik Yemin", author: "Mert A.", genre: "Aksiyon", cover: "https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&w=700&q=80" },
      { title: "Son Siper", author: "Kerem D.", genre: "Macera", cover: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=700&q=80" },
      { title: "Karanlık Rota", author: "Bora K.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=700&q=80" },
      { title: "Kuzey Hattı", author: "Selin E.", genre: "Aksiyon", cover: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Korku",
    subtitle: "Gece okumayı sevenler için karanlık hikâyeler",
    books: [
      { title: "Sessiz Oda", author: "Can D.", genre: "Korku", cover: "https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=700&q=80" },
      { title: "Fısıltı", author: "Nehir T.", genre: "Korku", cover: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=700&q=80" },
      { title: "Uyumayan Ev", author: "Duru P.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1505843513577-22bb7d21e455?auto=format&fit=crop&w=700&q=80" },
      { title: "Karanlıkta Üç Ses", author: "Ali V.", genre: "Korku", cover: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Romantizm",
    subtitle: "Kalbe dokunan karşılaşmalar ve ikinci şanslar",
    books: [
      { title: "Bir Adın Bedeli", author: "İrem Uslu", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=700&q=80" },
      { title: "Kalbin Kıyısı", author: "İrem Uslu", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=700&q=80" },
      { title: "Ay Işığı Notları", author: "Mina E.", genre: "Romantik", cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=700&q=80" },
      { title: "Eski Bir Mektup", author: "Lina K.", genre: "Romantizm", cover: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Fantastik",
    subtitle: "Başka dünyalara açılan büyülü kapılar",
    books: [
      { title: "Başka Bir Gökyüzü", author: "Ece Y.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=700&q=80" },
      { title: "Yıldızların Altında", author: "Ege A.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=700&q=80" },
      { title: "Kırık Zaman", author: "Elif M.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80" },
      { title: "Gölgeler Ülkesi", author: "Sena R.", genre: "Fantastik", cover: "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Polisiye",
    subtitle: "İpuçlarını takip et, gerçeği herkesten önce bul",
    books: [
      { title: "Sessiz Sayfalar", author: "Maya T.", genre: "Polisiye", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80" },
      { title: "Sırra Davet", author: "Deniz K.", genre: "Polisiye", cover: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=700&q=80" },
      { title: "Kayıp Dosya", author: "Bora K.", genre: "Polisiye", cover: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=700&q=80" },
      { title: "Son Tanık", author: "Duru P.", genre: "Gerilim", cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=700&q=80" },
    ],
  },
  {
    title: "Bilim Kurgu",
    subtitle: "Geleceğin şehirleri ve bilinmeyen olasılıklar",
    books: [
      { title: "Mekanik Kalp", author: "Arman B.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=700&q=80" },
      { title: "Kırık Zaman", author: "Elif M.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=700&q=80" },
      { title: "Yörünge", author: "Mert A.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=700&q=80" },
      { title: "Dünya 2.0", author: "Selin E.", genre: "Bilim Kurgu", cover: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=700&q=80" },
    ],
  },
];

const continuingBooks = [
  { title: "Bir Kamp Gecesi +18", description: "Biz, dokuz kişilik bir arkadaş grubuyduk. Dokuz masum can, dokuz günahsız kul... Biz bu sonu hak etmemiştik.", chapters: "36 Bölümler", status: "TAMAMLANDI", rank: "#11 içinde Macera", covers: ["https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=500&q=80", "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=500&q=80", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=500&q=80"] },
  { title: "Derin Mesafe", description: "Bazı mesafeler kilometreyle değil, söylenmemiş cümlelerle ölçülür.", chapters: "8 Bölüm", status: "DEVAM EDİYOR", rank: "#14 içinde Genç Yetişkin", covers: ["https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=500&q=80", "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=500&q=80", "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=500&q=80"] },
];

const loopUniversesFull = loopUniverses;

const libraryCollection = [
  {
    title: "Kayıp Şehirler",
    author: "Derya N.",
    genre: "Macera",
    cover: "https://images.unsplash.com/photo-1470115636492-6d2b56f1d284?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Sırra Davet",
    author: "Deniz K.",
    genre: "Gerilim",
    cover: "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Kırık Zaman",
    author: "Elif M.",
    genre: "Bilim Kurgu",
    cover: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Çığlık Sokağı",
    author: "Burak A.",
    genre: "Polisiye",
    cover: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
  },
];

export default function WriteBook() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"books" | "users">("books");
  const [showStats, setShowStats] = useState(true);
  const [showStudioDetails, setShowStudioDetails] = useState(false);
  const [showStudio, setShowStudio] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [premiumIndex, setPremiumIndex] = useState(0);
  const [activeTrailerIndex, setActiveTrailerIndex] = useState(0);
  const [showPremiumMedia, setShowPremiumMedia] = useState(false);
  const [currentTab, setCurrentTab] = useState("books");
  // Auto-advance and touch/swipe controls for premium area
  const premiumAreaRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const pausedUntilRef = useRef<number>(0);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const PAUSE_AFTER_MANUAL_MS = 10000;
  const PAUSE_AFTER_BACK_SWIPE_MS = 20000;
  const [showPerformance, setShowPerformance] = useState(true);
  const [shelfCategory, setShelfCategory] = useState("Tümü");
  const [selectedUniverse, setSelectedUniverse] = useState<(typeof loopUniverses)[number] | null>(null);
  const [libraryView, setLibraryView] = useState<"shelves" | "new" | "liked">("shelves");
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [catSearchMode, setCatSearchMode] = useState<"books" | "authors">("books");
  const universePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyCarouselRef = useRef<HTMLDivElement>(null);

  const allCategories = [
    { name: "Roman", count: 24, icon: "📖" },
    { name: "Polisiye", count: 18, icon: "🔍" },
    { name: "Fantastik", count: 12, icon: "✨" },
    { name: "Kişisel Gelişim", count: 9, icon: "🎯" },
    { name: "Aksiyon", count: 16, icon: "⚡" },
    { name: "Korku", count: 14, icon: "👻" },
    { name: "Romantizm", count: 21, icon: "💕" },
    { name: "Bilim Kurgu", count: 11, icon: "🚀" },
    { name: "Dram", count: 13, icon: "🎭" },
    { name: "Macera", count: 15, icon: "🗺️" },
    { name: "Gerilim", count: 10, icon: "😰" },
    { name: "Genç Yetişkin", count: 19, icon: "📚" },
    { name: "Askeri Kurgu", count: 8, icon: "🎖️" },
    { name: "Çocuk Edebiyatı", count: 22, icon: "👶" },
    { name: "Edebi Kurgu", count: 11, icon: "✍️" },
    { name: "Mizah", count: 7, icon: "😂" },
    { name: "Öykü", count: 17, icon: "📕" },
    { name: "Mitolojik", count: 10, icon: "🏛️" },
    { name: "Şiir", count: 14, icon: "🖋️" },
    { name: "Psikolojik", count: 9, icon: "🧠" },
    { name: "Ütopya-Distopya", count: 12, icon: "🔮" },
  ];

  const startUniversePress = (universe: (typeof loopUniverses)[number]) => {
    universePressTimer.current = setTimeout(() => setSelectedUniverse(universe), 550);
  };

  const cancelUniversePress = () => {
    if (universePressTimer.current) {
      clearTimeout(universePressTimer.current);
      universePressTimer.current = null;
    }
  };

  useEffect(() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "categories") {
      setCurrentTab("categories");
    } else if (tab === "library") {
      setCurrentTab("library");
    } else {
      setCurrentTab("books");
    }
  }, [search]);

  // Scroll listener removed — thumbnail strip now uses click-based navigation only.

  const selectStory = (index: number) => {
    const card = storyCarouselRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setSelectedStoryIndex(index);
  };

  const selectPremium = (index: number) => {
    setPremiumIndex(index);
    setActiveTrailerIndex(0);
    setShowPremiumMedia(false);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  const prevPremium = () => {
    setPremiumIndex((prev) => (prev - 1 + premiumBooks.length) % premiumBooks.length);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_BACK_SWIPE_MS;
  };

  const nextPremium = () => {
    setPremiumIndex((prev) => (prev + 1) % premiumBooks.length);
    pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
  };

  useEffect(() => {
    const startAutoAdvance = () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = window.setInterval(() => {
        if (Date.now() < pausedUntilRef.current) return;
        setPremiumIndex((prev) => (prev + 1) % premiumBooks.length);
      }, 300000);
    };

    startAutoAdvance();

    const area = premiumAreaRef.current;
    if (!area) return () => {};

    const onPointerDown = (e: PointerEvent) => {
      touchStartXRef.current = e.clientX;
    };
    const onPointerUp = (e: PointerEvent) => {
      const startX = touchStartXRef.current;
      if (startX == null) return;
      const dx = e.clientX - startX;
      const THRESHOLD = 50;
      if (dx > THRESHOLD) {
        setPremiumIndex((prev) => Math.max(0, prev - 1));
        pausedUntilRef.current = Date.now() + PAUSE_AFTER_BACK_SWIPE_MS;
      } else if (dx < -THRESHOLD) {
        setPremiumIndex((prev) => (prev + 1) % premiumBooks.length);
        pausedUntilRef.current = Date.now() + PAUSE_AFTER_MANUAL_MS;
      }
      touchStartXRef.current = null;
    };

    area.addEventListener("pointerdown", onPointerDown, { passive: true });
    area.addEventListener("pointerup", onPointerUp, { passive: true });

    return () => {
      if (autoAdvanceTimerRef.current) window.clearInterval(autoAdvanceTimerRef.current);
      area.removeEventListener("pointerdown", onPointerDown as any);
      area.removeEventListener("pointerup", onPointerUp as any);
    };
  }, []);

  useEffect(() => {
    setActiveTrailerIndex(0);
  }, [premiumIndex]);

  const query = searchQuery.trim().toLocaleLowerCase("tr-TR");
  const filteredCollection = libraryCollection.filter((book) => {
    if (!query || searchMode === "users") return true;
    return [book.title, book.author, book.genre].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  const filteredUsers = featuredAuthors.filter((user) => {
    if (!query) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((value) =>
      value.toLocaleLowerCase("tr-TR").includes(query),
    );
  });

  // Categories tab — independent search
  const catQuery = catSearchQuery.trim().toLocaleLowerCase("tr-TR");
  const catFilteredBooks = libraryCollection.filter((book) => {
    if (!catQuery) return true;
    return [book.title, book.author, book.genre].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });
  const catFilteredAuthors = featuredAuthors.filter((user) => {
    if (!catQuery) return true;
    return [user.name, user.role, user.genre, user.bio, user.city].some((v) =>
      v.toLocaleLowerCase("tr-TR").includes(catQuery),
    );
  });

  const libraryShelves = Object.entries(
    libraryCollection.reduce((acc, book) => {
      if (!acc[book.genre]) acc[book.genre] = [];
      acc[book.genre].push(book);
      return acc;
    }, {} as Record<string, typeof libraryCollection>),
  );

  const { data: bookPosts, isLoading: bookLoading } = useListPosts(
    { postType: "book" },
    { query: { queryKey: getListPostsQueryKey({ postType: "book" }), enabled: libraryView === "flow" } }
  );

  const visibleShelfRows = shelfCategory === "Tümü"
    ? shelfRows
    : shelfRows.filter((row) => row.title === shelfCategory);

  return (
    <AppLayout>
      {currentTab === "categories" ? (
        <div className="writebook-page min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 py-8 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 overflow-x-hidden">
            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.35em] text-violet-600 font-semibold">📚 Loop Kitaplık</p>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-950">Tüm Kategoriler</h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl">Milyonlarca kitap arasında keşfet. Kategorilerimiz arasında dolaş ve seni çeken türleri bul.</p>
            </div>

            {/* ── Bağımsız arama ── */}
            <div className="mb-8 rounded-[1.75rem] bg-white shadow-[0_8px_32px_rgba(109,40,217,0.08)] border border-violet-100 p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center flex-1 min-w-0 gap-2 rounded-[1.25rem] bg-slate-50 border border-slate-200 px-3 py-2.5 focus-within:border-violet-400 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] transition-all">
                  <Search className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <input
                    type="search"
                    placeholder={catSearchMode === "books" ? "Kitap veya yazar…" : "Yazar adı veya tür…"}
                    value={catSearchQuery}
                    onChange={(e) => setCatSearchQuery(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                  />
                  {catSearchQuery && (
                    <button type="button" onClick={() => setCatSearchQuery("")} className="text-slate-400 hover:text-slate-600 transition flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex rounded-[1.25rem] bg-slate-100 p-1 gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setCatSearchMode("books")}
                    className={`rounded-[1rem] px-3 py-2 text-xs sm:text-sm font-semibold transition ${catSearchMode === "books" ? "bg-violet-700 text-white shadow" : "text-slate-600 hover:bg-slate-200"}`}
                  >Kitap</button>
                  <button
                    type="button"
                    onClick={() => setCatSearchMode("authors")}
                    className={`rounded-[1rem] px-3 py-2 text-xs sm:text-sm font-semibold transition ${catSearchMode === "authors" ? "bg-violet-700 text-white shadow" : "text-slate-600 hover:bg-slate-200"}`}
                  >Yazar</button>
                </div>
              </div>

              {catSearchQuery ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {catSearchMode === "books" ? "Kitap sonuçları" : "Yazar sonuçları"}
                    </p>
                    <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
                      {catSearchMode === "books" ? `${catFilteredBooks.length} adet` : `${catFilteredAuthors.length} adet`}
                    </span>
                  </div>

                  {catSearchMode === "books" ? (
                    <div className="grid gap-2">
                      {catFilteredBooks.slice(0, 8).map((book) => (
                        <div key={book.title} className="flex items-center gap-4 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 hover:border-violet-200 hover:bg-violet-50/50 transition">
                          <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded-lg shadow-sm">
                            <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{book.title}</p>
                            <p className="text-xs text-slate-500 truncate">{book.author} · {book.genre}</p>
                          </div>
                          <span className="ml-auto flex-shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{book.genre}</span>
                        </div>
                      ))}
                      {catFilteredBooks.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500">"{catSearchQuery}" için kitap bulunamadı.</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {catFilteredAuthors.slice(0, 6).map((author) => (
                        <div key={author.name} className="flex items-center gap-3 rounded-[1.25rem] border border-slate-100 bg-slate-50 p-3 hover:border-violet-200 hover:bg-violet-50/50 transition">
                          <img src={author.avatar} alt={author.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover shadow-sm" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-900 truncate">{author.name}</p>
                            <p className="text-xs text-slate-500 truncate">{author.genre} · {author.city}</p>
                          </div>
                          <span className="ml-auto flex-shrink-0 text-xs text-slate-400">{author.followers}</span>
                        </div>
                      ))}
                      {catFilteredAuthors.length === 0 && (
                        <p className="py-6 text-center text-sm text-slate-500 col-span-2">"{catSearchQuery}" için yazar bulunamadı.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Kitap adı, yazar veya tür girerek ara.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {allCategories.map((category) => (
                <button
                  key={category.name}
                  type="button"
                  className="group relative overflow-hidden rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200 hover:border-violet-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-100/0 via-violet-100/0 to-violet-100/0 group-hover:from-violet-100/40 group-hover:to-violet-100/20 transition-all duration-300" />
                  
                  <div className="relative z-10 flex flex-col items-center text-center gap-3">
                    <div className="text-3xl sm:text-4xl">{category.icon}</div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">{category.name}</h3>
                      <p className="text-xs text-slate-500 mt-1">{category.count} kitap</p>
                    </div>
                  </div>

                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-16 h-16 bg-gradient-to-br from-violet-400 to-violet-600 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2" />
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-12 rounded-[2rem] bg-gradient-to-r from-violet-600 to-violet-700 p-8 sm:p-12 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold">Kendi kategorini oluştur</h2>
              <p className="mt-3 text-violet-100 max-w-xl">Favori kitaplarını gruplandır ve özel koleksiyonlar yarat. Arkadaşlarınla paylaş ve merak ettiklerine yardımcı ol.</p>
              <button className="mt-6 inline-flex items-center gap-2 rounded-full bg-white text-violet-700 font-semibold px-6 py-3 hover:bg-violet-50 transition-colors">
                Kategori Oluştur
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : currentTab === "library" ? (
        <div className="writebook-page min-h-screen bg-[#0f0f13]">
          {/* ── Hero ── */}
          <div className="relative overflow-hidden px-4 pt-8 pb-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/60 via-[#0f0f13] to-indigo-950/40" />
            <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full bg-indigo-600/10 blur-3xl" />
            <div className="relative mx-auto max-w-6xl">
              <p className="text-[10px] uppercase tracking-[0.4em] text-violet-400 font-semibold">📚 Kitaplığım</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-white">Kişisel Koleksiyon</h1>
              <p className="mt-1 text-sm text-slate-400 max-w-md">Okuduğun, beğendiğin ve koleksiyonuna eklediğin her kitap burada.</p>

              {/* Stat chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { label: "Toplam kitap", value: `${libraryCollection.length + shelfRows.reduce((a,r)=>a+r.books.length,0)}` },
                  { label: "Tür", value: `${allCategories.length}` },
                  { label: "Bu ay eklenen", value: "4" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-4 py-2 backdrop-blur-sm">
                    <span className="text-base font-bold text-white">{s.value}</span>
                    <span className="text-xs text-slate-400">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div className="mt-6 flex gap-1 rounded-[1.25rem] bg-white/6 border border-white/10 p-1 w-fit">
                {([ ["shelves","Raflar"], ["new","Yeni Eklediklerim"], ["liked","Beğendiklerim"] ] as const).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setLibraryView(v)}
                    className={`rounded-[1rem] px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                      libraryView === v
                        ? "bg-violet-600 text-white shadow-[0_2px_12px_rgba(124,58,237,0.4)]"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Content ── */}
          <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">

            {/* RAFLAR */}
            {libraryView === "shelves" && (
              <div className="space-y-10 pt-4">
                {shelfRows.map((row) => (
                  <section key={row.title}>
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-base font-bold text-white">{row.title}</h2>
                        <p className="text-xs text-slate-500 mt-0.5">{row.subtitle}</p>
                      </div>
                      <button className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition">Tümü →</button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory" style={{scrollbarWidth:"none"}}>
                      {row.books.map((book, idx) => (
                        <div key={idx} className="group flex-shrink-0 snap-start w-32 sm:w-36 cursor-pointer">
                          <div className="relative h-48 sm:h-52 w-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 group-hover:scale-[1.03]">
                            <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                            <span className="absolute bottom-2 left-2 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-[9px] font-semibold text-white/90 uppercase tracking-wide">{book.genre}</span>
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-200 line-clamp-2 leading-tight">{book.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{book.author}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* YENİ EKLEDİKLERİM */}
            {libraryView === "new" && (
              <div className="pt-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {[...libraryCollection, ...shelfRows[0].books].map((book, idx) => (
                    <div key={idx} className="group cursor-pointer">
                      <div className="relative overflow-hidden rounded-2xl shadow-[0_6px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.03]">
                        <img src={book.cover} alt={book.title} className="h-44 sm:h-52 w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{book.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-300">{book.author}</p>
                        </div>
                        <div className="absolute top-2 right-2">
                          <span className="rounded-full bg-violet-500/80 backdrop-blur-sm px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wide">{book.genre}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between px-0.5">
                        <p className="text-[10px] text-slate-500">
                          {idx === 0 ? "Bugün" : idx < 3 ? "Dün" : idx < 6 ? "3 gün önce" : "Bu hafta"}
                        </p>
                        <button className="text-slate-600 hover:text-red-400 transition">
                          <Bookmark className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BEĞENDİKLERİM */}
            {libraryView === "liked" && (
              <div className="pt-4 space-y-3">
                {[...featuredStories, ...recommendedBooks.map(b => ({ ...b, likes: "—", reads: "—", rating: "5.0", description: "" }))].map((book, idx) => (
                  <div key={idx} className="group flex items-center gap-4 rounded-2xl bg-white/5 border border-white/8 px-4 py-3 hover:bg-white/8 transition-all duration-200 cursor-pointer">
                    <div className="relative flex-shrink-0 h-16 w-12 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                      <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white line-clamp-1">{book.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{book.author} · <span className="text-violet-400">{book.genre}</span></p>
                      {"description" in book && book.description ? (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{book.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
                      {"reads" in book && book.reads ? (
                        <span className="text-[10px] text-slate-500">{book.reads} okuma</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="writebook-page min-h-screen bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
          {showStudio ? <header className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] lg:rounded-[3rem] bg-slate-950 px-4 sm:px-6 lg:px-8 py-6 sm:py-10 lg:py-12 text-white shadow-[0_45px_140px_rgba(15,23,42,0.24)]">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/4 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute left-0 bottom-0 h-52 w-52 -translate-x-1/4 translate-y-1/4 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <button type="button" onClick={() => setShowStudio(false)} aria-label="Kitaplık alanını kapat" className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
            <div className={`writebook-columns relative grid gap-6 sm:gap-8 lg:gap-10 ${showStats ? "xl:grid-cols-[1.45fr_0.95fr]" : "xl:grid-cols-1"} xl:items-center`}>
              <div className="max-w-3xl space-y-4 sm:space-y-6">
                <div className="inline-flex items-center gap-2 sm:gap-3 rounded-full bg-white/10 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-200/75 ring-1 ring-white/10">
                  <BookOpen className="h-3 sm:h-4 w-3 sm:w-4 text-white" />
                  Loop Kitaplık Stüdyosu
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-semibold tracking-tight">İstatistiklerini Loop diye gör</h1>
                    <button
                      type="button"
                      onClick={() => setShowStats((visible) => !visible)}
                      aria-expanded={showStats}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      <span>İstatistikler</span>
                      {showStats ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-2 sm:mt-4 max-w-xl text-sm sm:text-base lg:text-lg leading-6 sm:leading-8 text-slate-300">{librarySummary.subtitle}</p>
                </div>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-4">
                  <button className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition shadow-lg hover:shadow-xl whitespace-nowrap">
                    Yeni kitap başlat
                    <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" />
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-white/10 hover:bg-white/20 backdrop-blur px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white transition whitespace-nowrap">
                    Rapor
                    <ArrowRight className="h-3 sm:h-4 w-3 sm:w-4" />
                  </button>
                  <button type="button" onClick={() => setShowStudioDetails((visible) => !visible)} aria-expanded={showStudioDetails} className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-300/40 bg-violet-500/20 px-4 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30">
                    {showStudioDetails ? "Daha az" : "Daha fazla"}
                    {showStudioDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
                {showStudioDetails && <>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 p-4 sm:p-5 ring-1 ring-violet-400/30 backdrop-blur hover:ring-violet-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-200 font-semibold">📖 Aktif Proje</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white truncate">Derin Mesafe</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 p-4 sm:p-5 ring-1 ring-sky-400/30 backdrop-blur hover:ring-sky-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-sky-200 font-semibold">✍️ Toplam Kelime</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">42.8K</p>
                  </div>
                  <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10 p-4 sm:p-5 ring-1 ring-fuchsia-400/30 backdrop-blur hover:ring-fuchsia-400/50 transition">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-fuchsia-200 font-semibold">⚡ Okuma Hızı</p>
                    <p className="mt-2 sm:mt-3 text-xl sm:text-2xl lg:text-3xl font-bold text-white">2.1K / gün</p>
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 rounded-[1.5rem] sm:rounded-[2rem] border border-white/20 bg-gradient-to-r from-white/10 to-white/5 p-3 sm:p-5 text-slate-100 backdrop-blur">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">✨ 7 yeni öneri</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">🎬 3 canlı</span>
                    <span className="rounded-full bg-white/15 px-2 sm:px-4 py-1 sm:py-2 backdrop-blur font-medium">📊 2 akış</span>
                  </div>
                </div>
                </>}
              </div>

              {showStudioDetails && showStats && <div className="writebook-panel rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-white/15 via-white/10 to-white/5 p-4 sm:p-6 lg:p-8 shadow-[0_30px_60px_rgba(15,23,42,0.25)] backdrop-blur-2xl hover:border-white/30 transition">
                <div className="flex items-center justify-between gap-2 sm:gap-4 mb-6 sm:mb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-300 font-semibold">📊 Premium</p>
                    <p className="mt-2 sm:mt-3 text-lg sm:text-2xl lg:text-3xl font-bold text-white">Performans</p>
                  </div>
                  <span className="rounded-full bg-gradient-to-r from-violet-500/40 to-violet-600/30 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-200 backdrop-blur border border-violet-400/30">✨ Yeni</span>
                </div>
                <div className="rounded-[1.25rem] sm:rounded-[2rem] bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-4 sm:p-6 lg:p-8 text-white ring-1 ring-white/10 backdrop-blur">
                  <div className="flex items-start justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-300 font-semibold">📚 Yayınlar</p>
                      <p className="mt-2 sm:mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-violet-400 to-violet-300 bg-clip-text text-transparent">12</p>
                    </div>
                    <div className="text-3xl sm:text-4xl lg:text-5xl text-violet-500/50">📖</div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4 sm:mb-6">Dijital vitrinde öne çıkan yayınlar.</p>
                  <div className="grid gap-3 sm:gap-4 grid-cols-2">
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 px-5 py-4 border border-violet-400/30 hover:border-violet-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-violet-200 font-semibold">📈 Haftalık Etkileşim</p>
                      <p className="mt-3 text-2xl font-bold text-white">8.3K</p>
                      <p className="text-xs text-violet-200/70 mt-2">+12% geçen haftaya göre</p>
                    </div>
                    <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 px-5 py-4 border border-sky-400/30 hover:border-sky-400/60 transition">
                      <p className="text-xs uppercase tracking-[0.3em] text-sky-200 font-semibold">⭐ Yeni Favoriler</p>
                      <p className="mt-3 text-2xl font-bold text-white">24</p>
                      <p className="text-xs text-sky-200/70 mt-2">Bu haftaki yeni eklenenler</p>
                    </div>
                  </div>
                </div>
              </div>}
            </div>
          </header> : <button type="button" onClick={() => setShowStudio(true)} className="flex w-full items-center justify-between rounded-[1.25rem] border border-violet-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900 shadow-sm transition hover:border-violet-300 hover:shadow-md">
            <span>İstatistiklerini Loop diye gör</span>
            <span className="inline-flex items-center gap-2 text-violet-700">Alanı aç <ChevronDown className="h-4 w-4" /></span>
          </button>}

          {/* ── Öne Çıkan Hikayeler ── */}
          <section className="relative overflow-hidden rounded-[2rem] shadow-[0_32px_100px_rgba(0,0,0,0.35)]">
            {/* Blurred backdrop — all images pre-rendered; only opacity changes, no src swap */}
            <div className="absolute inset-0 -z-0 overflow-hidden">
              {featuredStories.map((story, index) => (
                <img
                  key={index}
                  src={story.cover}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover blur-2xl"
                  style={{
                    transform: "scale(1.2)",
                    opacity: selectedStoryIndex === index ? 0.3 : 0,
                    transition: "opacity 0.5s ease",
                    willChange: "opacity",
                  }}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d12]/80 via-[#0d0d12]/70 to-[#0d0d12]/95" />
            </div>

            {/* Header */}
            <div className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-6">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 ring-1 ring-amber-400/40">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                </span>
                <div>
                  <p className="text-[9px] uppercase tracking-[0.35em] text-amber-300/80 font-semibold">Loop Seçkisi</p>
                  <h2 className="text-sm font-bold text-white leading-tight">Öne Çıkan Hikayeler</h2>
                </div>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/15 hover:text-white">
                Tümü <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Active story — hero */}
            <div className="relative z-10 px-5 pt-5 sm:px-7">
              {(() => {
                const story = featuredStories[selectedStoryIndex];
                return (
                  <div className="flex gap-4 sm:gap-6">
                    {/* Cover */}
                    <div className="relative flex-shrink-0 w-28 sm:w-36">
                      <div className="relative h-40 sm:h-52 w-full overflow-hidden rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
                        <img src={story.cover} alt={story.title} className="h-full w-full object-cover transition-all duration-500" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      </div>
                      {/* Rank badge */}
                      <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-black shadow-lg">
                        #{selectedStoryIndex + 1}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 min-w-0 flex-col justify-between py-1">
                      <div className="space-y-2">
                        <span className="inline-flex items-center rounded-full bg-violet-500/20 border border-violet-400/30 px-2.5 py-0.5 text-[10px] font-semibold text-violet-300 uppercase tracking-wide">
                          {story.genre}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight line-clamp-2">{story.title}</h3>
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-5 line-clamp-3">{story.description}</p>
                      </div>

                      {/* Author row */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                          {story.author[0]}
                        </div>
                        <span className="text-xs text-slate-400 truncate">{story.author}</span>
                      </div>

                      {/* Stats */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/8 border border-white/10 px-2.5 py-1 text-[10px] text-slate-300">
                          <Eye className="h-3 w-3" /> {story.reads}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-400/20 px-2.5 py-1 text-[10px] text-rose-300">
                          <Heart className="h-3 w-3 fill-rose-400 text-rose-400" /> {story.likes}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {story.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Thumbnail strip */}
            <div
              ref={storyCarouselRef}
              className="relative z-10 mt-5 flex gap-2.5 overflow-x-auto px-5 pb-5 sm:px-7 sm:pb-6"
              style={{ scrollbarWidth: "none" }}
            >
              {featuredStories.map((story, index) => (
                <button
                  key={`thumb-${index}`}
                  type="button"
                  onClick={() => selectStory(index)}
                  className={`group relative flex-shrink-0 overflow-hidden rounded-xl transition-all duration-300 ${
                    selectedStoryIndex === index
                      ? "w-24 sm:w-28 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                      : "w-16 sm:w-20 opacity-50 hover:opacity-80 ring-1 ring-white/10"
                  }`}
                >
                  <img src={story.cover} alt={story.title} className="h-20 sm:h-24 w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  {selectedStoryIndex === index && (
                    <div className="absolute bottom-1.5 left-0 right-0 px-1.5">
                      <p className="text-[8px] font-bold text-white/90 line-clamp-1 text-center">{story.title}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Progress dots */}
            <div className="relative z-10 flex items-center justify-center gap-1.5 pb-4">
              {featuredStories.map((_, index) => (
                <button
                  key={`dot-${index}`}
                  type="button"
                  onClick={() => selectStory(index)}
                  className={`rounded-full transition-all duration-300 ${
                    selectedStoryIndex === index
                      ? "w-6 h-1.5 bg-amber-400"
                      : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
          </section>

          {(() => {
            const premium = premiumBooks[premiumIndex];
            const book = premium;
            return (
              <section ref={premiumAreaRef} className="relative isolate overflow-hidden rounded-[2rem] bg-[#090807] p-4 text-white shadow-[0_30px_100px_rgba(120,53,15,0.2)] sm:p-6">
                <img src={premium.backdrop} alt="" className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/85 via-black/65 to-amber-950/60" />
                <div className="relative mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">Loop seçkisi · özel salon</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Premium Yazarlardan Kitaplar</h2>
                    <p className="mt-1 text-xs text-amber-100/60">Sınırlı seçki · sinematik anlatılar</p>
                  </div>
                  <span className="rounded-full border border-amber-200/60 bg-white/10 px-3 py-1.5 font-serif text-sm text-amber-100 backdrop-blur">Pro</span>
                </div>
                            <article key={premium.title} className="grid w-full min-w-0 max-w-full grid-cols-1 overflow-hidden rounded-[1.5rem] border border-amber-100/20 bg-black/25 shadow-2xl backdrop-blur-sm sm:grid-cols-[0.75fr_1.25fr]">
                              <div className="relative h-48 min-w-0 overflow-hidden sm:h-auto sm:min-h-80">
                        <img src={book.cover} alt={`${book.title} kitap kapağı`} className="absolute inset-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                        <span className="absolute left-4 top-4 rounded-full border border-amber-200/50 bg-black/35 px-3 py-1 text-xs font-bold text-amber-100 backdrop-blur">{book.rank}</span>
                        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/30 p-1.5 pr-3 ring-1 ring-white/25 backdrop-blur-md">
                          <img src={book.authorAvatar} alt={`${book.author} profil fotoğrafı`} className="h-9 w-9 rounded-full object-cover ring-1 ring-amber-100/80" />
                          <span className="text-xs font-semibold text-white/90">{book.author}</span>
                        </div>
                      </div>
                      <div className="flex min-w-0 max-w-full flex-col overflow-hidden p-4 sm:p-8">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">{book.label}</p>
                          <h3 className="mt-2 font-serif text-3xl font-bold leading-tight text-white sm:mt-3 sm:text-5xl">{book.title}</h3>
                          <p className="mt-1 text-[10px] font-semibold text-amber-100/70 sm:mt-2 sm:text-sm">{book.genre}</p>
                          <p className="mt-3 line-clamp-3 max-w-xl text-sm leading-6 text-slate-200 sm:mt-5 sm:text-base sm:leading-7">{book.description}</p>
                          <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-5" style={{ touchAction: "pan-y" }} onPointerDown={(event) => event.stopPropagation()} onTouchStart={(event) => event.stopPropagation()}>
                            {book.trailers.map((trailer, trailerIndex) => {
                              const isActiveTrailer = trailerIndex === activeTrailerIndex;
                              return (
                                <button key={`${book.title}-${trailerIndex}`} type="button" aria-label={`${book.title} fragman ${trailerIndex + 1}`} onClick={() => setActiveTrailerIndex(trailerIndex)} className={`group/trailer relative min-w-0 overflow-hidden rounded-lg border transition-all duration-700 ${isActiveTrailer ? "col-span-2 h-28 border-amber-200/70 shadow-[0_0_25px_rgba(251,191,36,0.2)] sm:h-40" : "h-16 border-white/10 opacity-65 hover:opacity-100 sm:h-24"}`}>
                                  {isActiveTrailer ? <video key={`${book.title}-${trailerIndex}`} className="h-full w-full object-cover" muted autoPlay playsInline loop={book.trailers.length === 1} onEnded={() => book.trailers.length > 1 && setActiveTrailerIndex((trailerIndex + 1) % book.trailers.length)} src={trailer} /> : <img src={book.cover} alt={`${book.title} fragman ${trailerIndex + 1}`} className="h-full w-full object-cover transition duration-500 group-hover/trailer:scale-110" />}
                                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                                  <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-100 ${isActiveTrailer ? "opacity-100" : "opacity-0 group-hover/trailer:opacity-100"}`}><Play className="h-3 w-3 fill-current" /> {isActiveTrailer ? "Oynuyor" : `Fragman ${trailerIndex + 1}`}</span>
                                  {isActiveTrailer && book.trailers.length > 1 && <span className="absolute bottom-2 right-2 flex gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
                                    {book.trailers.map((trailerDot, dotIndex) => <i key={trailerDot} className={`h-1.5 rounded-full transition-all ${dotIndex === activeTrailerIndex ? "w-4 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" : "w-1.5 bg-white/60"}`} />)}
                                  </span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
                          <button type="button" className="whitespace-nowrap rounded-full border border-amber-100/30 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15 sm:px-4 sm:py-2.5 sm:text-sm">Kitaba git <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                          <button type="button" onClick={() => setShowPremiumMedia(true)} className="relative inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-2 text-xs font-bold text-amber-100 shadow-[4px_4px_0_rgba(251,191,36,0.2)] backdrop-blur transition hover:bg-white/20 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm" aria-label="Kitap görsellerini aç"><span className="relative flex -space-x-2"><span className="h-4 w-4 rounded bg-white/30 ring-1 ring-white/60 sm:h-5 sm:w-5" /><span className="h-4 w-4 -rotate-6 rounded bg-amber-200/70 ring-1 ring-white/70 sm:h-5 sm:w-5" /></span> Görseller</button>
                        </div>
                      </div>
                    </article>
                    
                <div className="relative mt-4 flex items-center justify-center gap-2">
                  {premiumBooks.map((book, index) => (
                    <button key={book.title} type="button" aria-label={`${book.title} premium kitabını göster`} aria-current={premiumIndex === index ? "true" : undefined} onClick={() => selectPremium(index)} className={`h-2.5 rounded-full transition-all duration-300 ${premiumIndex === index ? "w-8 bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.8)]" : "w-2.5 bg-white/30 hover:w-5 hover:bg-amber-100/70"}`} />
                  ))}
                </div>
                {showPremiumMedia && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`${premium.title} görselleri`}>
                  <div className="w-full max-w-2xl rounded-[1.5rem] border border-amber-200/30 bg-[#15100b] p-4 text-white shadow-2xl sm:p-6">
                    <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">{premium.author}</p><h3 className="mt-1 text-xl font-bold">{premium.title} görselleri</h3></div><button type="button" onClick={() => setShowPremiumMedia(false)} aria-label="Görselleri kapat" className="rounded-full bg-white/10 p-2 hover:bg-white/20"><X className="h-5 w-5" /></button></div>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{premium.media.map((image) => <img key={image} src={image} alt={`${premium.title} görseli`} className="h-32 w-full rounded-xl object-cover sm:h-44" />)}</div>
                  </div>
                </div>}
              </section>
            );
          })()}

          <section className="overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-violet-600">Okuma rotan</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Sizin İçin Önerdiğimiz</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:text-violet-700">
                Tümünü gör <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {recommendedBooks.map((book) => (
                <article key={book.title} className="group w-32 flex-none sm:w-40">
                  <div className="relative h-48 overflow-hidden rounded-xl bg-slate-200 shadow-md sm:h-60">
                    <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 pt-10">
                      <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{book.genre}</span>
                    </div>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-bold text-slate-900 group-hover:text-violet-700">{book.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{book.author}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: book.progress }} /></div>
                    <span className="text-[10px] font-semibold text-violet-700">{book.progress}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4 text-white shadow-[0_24px_70px_rgba(15,23,42,0.18)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300">Bu haftanın seçkisi</p>
                <h2 className="mt-1 text-xl font-bold">Trend Olanlar</h2>
              </div>
              <span className="rounded-full bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-200 ring-1 ring-amber-300/30">↗ Yükselişte</span>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {trendingBooks.map((book, index) => (
                <article key={book.title} className="group w-32 flex-none sm:w-40">
                  <div className="relative h-48 overflow-hidden rounded-xl bg-slate-800 shadow-lg sm:h-60">
                    <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950 shadow-lg">{index + 1}</div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent p-3 pt-12">
                      <span className="text-[10px] font-semibold text-amber-200">{book.genre}</span>
                    </div>
                  </div>
                  <h3 className="mt-2 truncate text-sm font-bold text-white group-hover:text-amber-200">{book.title}</h3>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="truncate">{book.author}</span>
                    <span className="shrink-0 text-amber-300">{book.reads}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Loop topluluğu</p>
                <h2 className="mt-1 text-xl font-bold text-slate-400">Trend olan yerel yazarlar Türkiye</h2>
              </div>
              <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-violet-300 hover:text-violet-700">
                Tümünü gör <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {featuredAuthors.map((author, index) => (
                <article key={author.name} className={`relative w-[calc(100%-1rem)] flex-none overflow-hidden rounded-[1.75rem] bg-gradient-to-br ${author.accent} p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.2)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(15,23,42,0.3)] sm:w-[34rem]`}>
                  <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full border-[18px] border-white/10" />
                  <div className="pointer-events-none absolute bottom-20 left-1/3 h-px w-2/3 rotate-[-12deg] bg-white/20" />
                  <div className="relative flex items-center gap-5">
                    <div className="relative">
                      <img src={author.avatar} alt={`${author.name} profil fotoğrafı`} className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-xl" />
                      <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950 shadow-lg">#{index + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-2xl font-black">{author.name}</h3>
                      <p className="mt-1 flex items-center gap-1 truncate text-sm font-medium text-slate-300"><MapPin className="h-3.5 w-3.5 shrink-0" /> {author.city} · {author.genre}</p>
                    </div>
                  </div>
                  <p className="relative mt-7 line-clamp-3 text-lg italic leading-8 text-slate-100">"{author.bio}"</p>
                  <div className="relative mt-7 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-center">
                    <div>
                      <p className="text-3xl font-black">{author.stories}</p>
                      <p className="mt-1 text-sm text-slate-300">Hikayeler</p>
                    </div>
                    <div>
                      <p className="text-3xl font-black">{author.followers}</p>
                      <p className="mt-1 text-sm text-slate-300">Takipçiler</p>
                    </div>
                  </div>
                  <button type="button" className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"><UserPlus className="h-4 w-4" /> Takip et</button>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-slate-900 to-black p-4 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Loop anlatı haritası</p>
                <h2 className="mt-1 text-xl font-bold">Evrenlere Loop diye giriş yap</h2>
                <p className="mt-1 text-xs text-slate-400">karta basılı tut :)</p>
              </div>
              <Globe2 className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="scrollbar-hide mt-5 flex gap-4 overflow-x-auto pb-2">
              {loopUniverses.map((universe) => (
                <article key={universe.title} onPointerDown={() => startUniversePress(universe)} onPointerUp={cancelUniversePress} onPointerLeave={cancelUniversePress} onPointerCancel={cancelUniversePress} className={`group relative w-72 flex-none overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${universe.color} shadow-lg transition hover:-translate-y-1 hover:shadow-cyan-950/40 sm:w-80`}>
                  <div className="relative h-40 overflow-hidden sm:h-44">
                    <img src={universe.cover} alt={`${universe.title} evreni`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/15 to-transparent" />
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/30 p-1 pr-3 ring-1 ring-white/30 backdrop-blur-md">
                      <img src={universe.authorAvatar} alt={`${universe.author} profil fotoğrafı`} className="h-9 w-9 rounded-full object-cover opacity-90 ring-1 ring-white/70" />
                      <span className="max-w-28 truncate text-[10px] font-semibold text-white/90">{universe.author}</span>
                    </div>
                    <span className="absolute right-4 top-4 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-slate-200 backdrop-blur">{universe.stories}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="relative text-xl font-black tracking-tight">{universe.title}</h3>
                    <p className="relative mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{universe.description}</p>
                  </div>
                  <div className="relative mx-5 flex items-center justify-between gap-3 border-t border-white/15 pb-5 pt-4">
                    <span className="text-xs font-semibold text-cyan-200">{universe.mood}</span>
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-white transition group-hover:text-cyan-200">Keşfet <ArrowRight className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-[1.5rem] bg-[#efece7] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-300/70 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Loop kitap dolabı</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Raflardan keşfet</h2>
              </div>
              <div className="flex items-center gap-2">
                <select value={shelfCategory} onChange={(event) => setShelfCategory(event.target.value)} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition hover:border-violet-300">
                  <option value="Tümü">Kategori seç</option>
                  {shelfRows.map((row) => <option key={row.title} value={row.title}>{row.title}</option>)}
                </select>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800">Tüm rafı gör <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-5 space-y-7">
              {visibleShelfRows.map((row) => (
                <div key={row.title}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{row.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{row.subtitle}</p>
                    </div>
                    <button type="button" className="shrink-0 text-xs font-bold text-slate-600 transition hover:text-violet-700">Daha fazla <ArrowRight className="inline h-3.5 w-3.5" /></button>
                  </div>
                  <div className="scrollbar-hide flex gap-4 overflow-x-auto border-b-[10px] border-amber-950/80 pb-3">
                    {row.books.map((book) => (
                      <article key={book.title} className="group w-28 flex-none sm:w-36">
                        <div className="relative h-40 overflow-hidden rounded-md bg-slate-300 shadow-[5px_6px_0_rgba(71,45,24,0.25)] sm:h-52">
                          <img src={book.cover} alt={`${book.title} kitap kapağı`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                          <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[9px] font-semibold text-white backdrop-blur">{book.genre}</span>
                        </div>
                        <h4 className="mt-2 truncate text-xs font-bold text-slate-900 sm:text-sm">{book.title}</h4>
                        <p className="truncate text-[10px] text-slate-500 sm:text-xs">{book.author}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {selectedUniverse && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={`${selectedUniverse.title} medya alanı`}>
              <div className={`w-full max-w-2xl overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${selectedUniverse.color} p-4 text-white shadow-2xl sm:p-6`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-200">{selectedUniverse.author} evreninden</p>
                    <h2 className="mt-1 text-xl font-bold">{selectedUniverse.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelectedUniverse(null)} aria-label="Medya alanını kapat" className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"><X className="h-5 w-5" /></button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedUniverse.gallery.map((image) => (
                    <img key={image} src={image} alt={`${selectedUniverse.title} evreninden kare`} className="h-28 w-full rounded-xl object-cover sm:h-36" />
                  ))}
                  <div className="relative h-28 overflow-hidden rounded-xl bg-black/30 sm:h-36">
                    <video className="h-full w-full object-cover" muted loop autoPlay playsInline src="https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4" />
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">Video</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showPerformance ? <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-4 text-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:p-6 lg:p-8">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-violet-300 font-semibold">📈 Performans Özeti</p>
                <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Haftalık etkileşim trendleri</h2>
                <p className="mt-2 text-sm text-slate-400">Kitaplığının son 7 gündeki hareketini tek bakışta gör.</p>
              </div>
              <button type="button" onClick={() => setShowPerformance(false)} aria-expanded={showPerformance} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                Kapat
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {performanceInsights.map((item, idx) => {
                const colors = ['from-violet-500 to-violet-700', 'from-sky-500 to-sky-700', 'from-fuchsia-500 to-fuchsia-700', 'from-amber-500 to-amber-700'];
                
                return (
                  <div key={item.label} className="rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur transition hover:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                      <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${colors[idx]}`} />
                    </div>
                    <p className="mt-3 text-2xl font-bold text-white sm:text-3xl">{item.value}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${colors[idx]}`} style={{ width: `${item.progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300 font-semibold">🗺️ Yayın Yol Haritası</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Lansman akışı</h3>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
                  Güncelle
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-3">
                {launchPipeline.map((item) => {
                  const statusColors: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'from-blue-500 to-blue-600',
                    'Planlandı': 'from-amber-500 to-amber-600',
                    'Hazır': 'from-emerald-500 to-emerald-600'
                  };
                  const statusBg: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'border-blue-400/30 bg-blue-500/10',
                    'Planlandı': 'border-amber-400/30 bg-amber-500/10',
                    'Hazır': 'border-emerald-400/30 bg-emerald-500/10'
                  };
                  const statusText: Record<LaunchStatus, string> = {
                    'Devam ediyor': 'text-blue-300',
                    'Planlandı': 'text-amber-300',
                    'Hazır': 'text-emerald-300'
                  };
                  return (
                    <div key={item.title} className={`rounded-[1.25rem] border p-4 ${statusBg[item.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white text-sm">{item.title}</h4>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusText[item.status]} border ${statusBg[item.status]}`}>{item.status}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-5">{item.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section> : <button type="button" onClick={() => setShowPerformance(true)} className="flex w-full items-center justify-between rounded-[1.25rem] border border-violet-200/30 bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
            <span>Haftalık etkileşim trendleri</span>
            <span className="inline-flex items-center gap-2 text-violet-300">Alanı aç <ChevronDown className="h-4 w-4" /></span>
          </button>}

          <section className="overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-cyan-950/30 to-slate-950 p-4 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Okuma yolculuğun</p>
                <h2 className="mt-1 text-2xl font-black text-white">Devam Edenler</h2>
              </div>
              <button type="button" className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15">Tümünü gör</button>
            </div>
            <div className="scrollbar-hide mt-5 flex snap-x gap-5 overflow-x-auto pb-2">
              {continuingBooks.map((book) => (
                <article key={book.title} className="group min-w-[calc(100%-1rem)] snap-start overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl backdrop-blur sm:min-w-[34rem] sm:p-5">
                  <div className="flex gap-3 sm:gap-5">
                    <div className="relative flex h-40 w-28 shrink-0 items-end justify-center sm:h-52 sm:w-36">
                      {book.covers.map((cover, index) => (
                        <img key={cover} src={cover} alt={`${book.title} ${index + 1}. kapak`} className={`absolute w-20 rounded-lg object-cover shadow-xl ring-1 ring-white/20 transition duration-300 group-hover:scale-105 sm:w-28 ${index === 0 ? "left-0 h-32 -rotate-6 sm:h-44" : index === 1 ? "left-4 z-10 h-40 sm:left-5 sm:h-52" : "right-0 h-32 rotate-6 sm:h-44"}`} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1 self-end pb-1">
                      <span className="inline-flex rounded-full bg-cyan-300/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-200">Şu anda okuyorsun</span>
                      <h3 className="mt-3 text-xl font-black text-white sm:text-2xl">{book.title}</h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{book.description}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-sm italic text-slate-400">{book.chapters}</span>
                        <span className="rounded-full border border-emerald-400/60 px-3 py-1 font-bold text-emerald-300">{book.status}</span>
                        <span className="rounded-full border border-amber-400/60 px-3 py-1 font-bold text-amber-300">{book.rank}</span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-300 to-violet-400" /></div>
                      <button type="button" className="mt-4 text-base font-bold text-cyan-300 transition hover:text-white">Devamını oku <ArrowRight className="ml-1 inline h-4 w-4" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="writebook-columns grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-white to-slate-50 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] border border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-600 font-semibold">📚 Kitaplık Öne Çıkan</p>
                  <h2 className="mt-2 text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900">Okuma ve yazma akışın</h2>
                </div>
                <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 px-5 py-2 text-sm font-semibold text-white transition shadow-lg hover:shadow-xl">
                  Tüm koleksiyonu gör
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="writebook-columns grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
                <article className="writebook-panel rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-[0_25px_90px_rgba(15,23,42,0.3)] border border-white/10 hover:border-white/20 transition">
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] p-8 lg:p-8">
                    <div className="space-y-6">
                      <div className="inline-flex rounded-full bg-gradient-to-r from-violet-600/30 to-violet-500/20 border border-violet-400/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-violet-200 backdrop-blur">
                        🌟 Ana Akış
                      </div>
                      <div>
                        <h3 className="text-4xl font-bold bg-gradient-to-r from-white via-violet-100 to-white bg-clip-text text-transparent">Derin Mesafe</h3>
                      </div>
                      <p className="max-w-xl text-sm leading-7 text-slate-300">
                        Kitabını yazarken aynı zamanda okuyucu kitlesini büyütün. Kodlu bir yazma alanı ile resmi kitap koleksiyonunu yan yana yönetin.
                      </p>
                      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-2">
                        <div className="rounded-[1.5rem] bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-400/30 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-violet-200 font-semibold">Bölüm</p>
                          <p className="mt-3 text-2xl font-bold text-white">8/12</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-gradient-to-br from-sky-500/20 to-sky-600/10 border border-sky-400/30 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-sky-200 font-semibold">Tamam</p>
                          <p className="mt-3 text-2xl font-bold text-white">78%</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-600/10 border border-fuchsia-400/30 p-4">
                          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-200 font-semibold">Okuyucu</p>
                          <p className="mt-3 text-2xl font-bold text-white">26.4K</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="rounded-full bg-white/10 backdrop-blur px-4 py-2 text-xs font-semibold text-white border border-white/20">✨ 7 editoryal not</span>
                        <span className="rounded-full bg-white/10 backdrop-blur px-4 py-2 text-xs font-semibold text-white border border-white/20">📰 4 yayın önerisi</span>
                        <button className="rounded-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 px-5 py-2 text-xs font-semibold text-white transition shadow-lg">
                          Hemen yazmaya başla
                        </button>
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-800 to-slate-900 h-64">
                      <img src="https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=900&q=80" alt="Derin Mesafe" className="h-full w-full object-cover transition duration-500 hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/90">📖 Yazma ve kitap yönetimi</p>
                        <p className="text-xs text-slate-300 mt-2">Profesyonel yazma deneyimi</p>
                      </div>
                    </div>
                  </div>
                </article>

                <aside className="writebook-panel space-y-6">
                  <div className="rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-slate-50 p-6">
                    <p className="text-xs uppercase tracking-[0.35em] text-violet-600 font-semibold">🏆 Formalite Kitaplar</p>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">Loop resmi koleksiyonu</h3>
                    <p className="mt-3 text-xs leading-6 text-slate-600">
                      Kurumsal ve markalı içeriğin sergilendiği, editoryal seçkilerle desteklenen kitap deneyimi.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3 sm:gap-4 justify-start items-end overflow-x-auto pb-2">
                      {formaliteBooks.map((book) => (
                        <article key={book.title} className="relative group h-44 w-28 sm:h-52 sm:w-32 cursor-pointer transition-transform duration-300 hover:scale-105 flex-shrink-0">
                          <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_15px_50px_rgba(15,23,42,0.2)] transition-shadow duration-300 group-hover:shadow-[0_25px_70px_rgba(15,23,42,0.3)]">
                            <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            <div className="absolute inset-y-0 -right-2 w-4 bg-gradient-to-r from-violet-900/40 to-violet-950/60 rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                              <div>
                                <span className="inline-flex rounded-full bg-violet-600/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-white backdrop-blur-sm">Resmi</span>
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <h4 className="text-sm font-bold text-white line-clamp-2">{book.title}</h4>
                                  <p className="mt-0.5 text-xs text-slate-200">{book.author}</p>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="h-1 overflow-hidden rounded-full bg-white/20">
                                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${book.progress}%` }} />
                                  </div>
                                  <button className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 px-2 py-1.5 text-[11px] font-semibold text-white transition">İncele</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-center">
                            <h5 className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition">{book.title}</h5>
                            <p className="text-[11px] text-slate-500 mt-0.5">{book.progress}% Tamamlandı</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 p-6 text-white shadow-[0_24px_80px_rgba(79,70,229,0.25)] border border-violet-500/30 hover:shadow-[0_30px_90px_rgba(79,70,229,0.35)] transition">
                    <p className="text-xs uppercase tracking-[0.35em] text-violet-200 font-semibold">🗺️ Rota</p>
                    <h3 className="mt-3 text-lg font-bold">Okuma planın</h3>
                    <p className="mt-2 text-xs leading-6 text-violet-100">Kitaplığında öne çıkan içerikleri hızla filtrele ve bir sonraki okumaya hazır ol.</p>
                    <div className="mt-5 space-y-3 rounded-[1.5rem] bg-white/10 backdrop-blur p-4 text-xs text-violet-100 border border-white/10">
                      <div className="flex items-center justify-between font-medium"><span>📖 Yeni başlıklar</span><span className="font-bold text-white">4</span></div>
                      <div className="flex items-center justify-between font-medium"><span>⭐ Favori listesi</span><span className="font-bold text-white">12</span></div>
                      <div className="flex items-center justify-between font-medium"><span>⏰ Günlük hedef</span><span className="font-bold text-white">25 dk</span></div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </section>

          <main className="writebook-columns grid gap-8 xl:grid-cols-[1.55fr_0.95fr]">
            <section className="writebook-panel space-y-8">
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.95fr] p-6 lg:p-8">
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-violet-600 font-semibold">✍️ Yazma Alanı</p>
                        <h2 className="mt-3 text-3xl font-bold text-slate-900">Derin Mesafe</h2>
                      </div>
                      <span className="rounded-full bg-gradient-to-r from-violet-100 to-violet-50 border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700">Taslak</span>
                    </div>

                    <p className="text-sm leading-7 text-slate-600">Şimdi yazma zamanı. Bölümlerin, karakter notların ve yayın ajandan tek bir profesyonel ekranda toplanmış durumda.</p>

                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                      <div className="rounded-[1.5rem] sm:rounded-[1.75rem] bg-gradient-to-br from-violet-50 to-slate-50 p-4 sm:p-5 border border-violet-200/50 hover:shadow-lg transition duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-600 font-semibold">Bölümler</p>
                            <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold text-slate-900">8/12</p>
                          </div>
                          <div className="text-4xl text-violet-200">📖</div>
                        </div>
                        <div className="mt-3 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-violet-700" style={{width: '67%'}} />
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] sm:rounded-[1.75rem] bg-gradient-to-br from-sky-50 to-slate-50 p-4 sm:p-5 border border-sky-200/50 hover:shadow-lg transition duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-sky-600 font-semibold">Kelime</p>
                            <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold text-slate-900">42.8K</p>
                          </div>
                          <div className="text-4xl text-sky-200">✍️</div>
                        </div>
                        <div className="mt-3 h-1.5 bg-sky-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-sky-500 to-sky-700" style={{width: '85%'}} />
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] sm:rounded-[1.75rem] bg-gradient-to-br from-fuchsia-50 to-slate-50 p-4 sm:p-5 border border-fuchsia-200/50 hover:shadow-lg transition duration-300">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-fuchsia-600 font-semibold">Okuma</p>
                            <p className="mt-2 sm:mt-3 text-2xl sm:text-3xl font-bold text-slate-900">26.4K</p>
                          </div>
                          <div className="text-4xl text-fuchsia-200">👥</div>
                        </div>
                        <div className="mt-3 h-1.5 bg-fuchsia-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-fuchsia-500 to-fuchsia-700" style={{width: '78%'}} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-slate-50 p-6">
                      <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-violet-600 font-semibold">📋 Yazma Planı</p>
                          <p className="mt-2 text-lg font-bold text-slate-900">Bu hafta tamamlanacak</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-center">
                            <span className="text-3xl font-bold text-violet-600">76</span>
                            <span className="text-xs text-violet-600 font-semibold">%</span>
                          </div>
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs font-bold">76%</div>
                        </div>
                      </div>
                      <div className="h-2 bg-violet-100 rounded-full overflow-hidden mb-6">
                        <div className="h-full bg-gradient-to-r from-violet-500 via-violet-600 to-violet-700" style={{width: '76%'}} />
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-[1.5rem] bg-white p-4 border border-violet-100 hover:border-violet-300 transition">
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">✓</div>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">Bölüm akışını netleştir</p>
                              <p className="mt-1 text-xs text-slate-500">Karakter ilerleyişini gözden geçir.</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-[1.5rem] bg-white p-4 border border-violet-100 hover:border-violet-300 transition">
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5"></div>
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900">Kapak konsepti hazırla</p>
                              <p className="mt-1 text-xs text-slate-500">Markalı içerik vitrini için hazırla.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 px-5 py-3 text-sm font-semibold text-white transition shadow-lg hover:shadow-xl">
                        <Sparkles className="h-4 w-4" />
                        Yeni bölüm ekle
                      </button>
                      <button className="inline-flex items-center justify-center gap-2 rounded-[1.5rem] border-2 border-slate-200 bg-white hover:bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-violet-300">
                        <Bookmark className="h-4 w-4" />
                        Okuma listesini aç
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.3)] hover:shadow-[0_30px_80px_rgba(15,23,42,0.4)] transition">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-300">📚 Kapak</p>
                        <h3 className="mt-3 text-2xl font-bold">Profesyonel Sahne</h3>
                      </div>
                      <span className="rounded-full bg-white/10 backdrop-blur px-3 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-white/90">İleri Seviye</span>
                    </div>
                    <div className="mt-6 grid gap-4">
                      <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-800 shadow-lg">
                        <img src="https://images.unsplash.com/photo-1496104679561-38d5f6b8446c?auto=format&fit=crop&w=900&q=80" alt="Derin Mesafe" className="h-48 w-full object-cover transition duration-500 hover:scale-105" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">Derin Mesafe</p>
                          <p className="text-[11px] text-slate-300 mt-1">Yazma ve kitap yönetimi</p>
                        </div>
                      </div>
                      <p className="text-sm leading-7 text-slate-300">Kitabın atmosferi, kapakta kullanılan renk ve tipografiyle güçlendirildi. Bu görünüm, modern bir marka dokunuşu sağlar.</p>
                      <button className="w-full rounded-[1.25rem] bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 px-4 py-3 text-sm font-semibold text-white transition shadow-lg">Kapağı Düzenle</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="writebook-columns grid gap-6 lg:grid-cols-[0.95fr_0.65fr]">
                <div className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Kütüphane</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">Sözlükteki favoriler</h3>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-800">
                      Daha fazla
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-6">
                    <div className="flex flex-wrap gap-6 justify-start items-end">
                      {featuredBooks.map((book) => (
                        <article key={book.title} className="relative group h-64 w-40 cursor-pointer transition-transform duration-300 hover:scale-105">
                          <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition-shadow duration-300 group-hover:shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
                            <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                            <div className="absolute inset-y-0 -right-2 w-5 bg-gradient-to-r from-slate-900/30 to-slate-950/50 rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex flex-col justify-between">
                              <div>
                                <span className="inline-flex rounded-full bg-violet-500/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white backdrop-blur-sm">{book.category}</span>
                                <span className="ml-2 inline-flex rounded-full bg-white/20 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">{book.progress}%</span>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-base font-bold text-white line-clamp-2">{book.title}</h4>
                                  <p className="mt-1 text-xs text-slate-200">{book.author}</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                                    <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400" style={{ width: `${book.progress}%` }} />
                                  </div>
                                  <button className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 px-3 py-2 text-xs font-semibold text-white transition">Okumaya devam et</button>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-center">
                            <h5 className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition">{book.title}</h5>
                            <p className="text-xs text-slate-500 mt-1">{book.author}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="writebook-panel space-y-6">
                  <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-white to-slate-50 p-4 sm:p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] border border-slate-100">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-amber-600 font-semibold">⭐ Sıralama</p>
                    <h3 className="mt-2 text-base sm:text-lg lg:text-xl font-bold text-slate-900">Haftanın en iyileri</h3>
                    <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                      {rankings.map((item) => (
                        <div key={item.rank} className="flex items-center justify-between rounded-[1.25rem] sm:rounded-[1.5rem] bg-gradient-to-r from-amber-50 to-slate-50 border border-amber-100/50 hover:border-amber-200 p-3 sm:p-4 transition hover:shadow-md gap-2">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="flex-shrink-0 w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg">
                              {item.rank}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm sm:text-base text-slate-900 truncate">{item.title}</p>
                              <p className="text-xs text-slate-500">📖 {item.reads} okunma</p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Star className="h-5 sm:h-6 w-5 sm:w-6 text-amber-400 drop-shadow-lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-white to-slate-50 p-4 sm:p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] border border-slate-100">
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-sky-600 font-semibold">🏷️ Kategoriler</p>
                    <h3 className="mt-2 text-base sm:text-lg lg:text-xl font-bold text-slate-900">Hızlı filtreler</h3>
                    <div className="mt-4 sm:mt-6 grid gap-2 sm:gap-3">
                      {libraryCategories.map((category) => (
                        <button key={category.name} className="rounded-[1.25rem] sm:rounded-[1.5rem] border border-sky-200/50 bg-gradient-to-r from-sky-50/80 to-slate-50/80 hover:from-sky-100/80 hover:to-slate-50/80 px-3 sm:px-5 py-3 sm:py-4 transition duration-300 hover:shadow-md hover:border-sky-300 text-left group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 group-hover:text-sky-700 truncate">{category.name}</p>
                              <p className="mt-0.5 sm:mt-1 text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-500">📚 {category.count} kitap</p>
                            </div>
                            <div className="text-lg sm:text-xl flex-shrink-0 group-hover:translate-x-1 transition">→</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="writebook-panel space-y-6">
              <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-white to-slate-50 p-4 sm:p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] border border-slate-100">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-violet-600 font-semibold">🔍 Arama</p>
                    <h3 className="mt-2 text-base sm:text-lg font-bold text-slate-900">Kitap veya bölüm ara</h3>
                  </div>
                </div>
                <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3 rounded-[1.25rem] sm:rounded-[1.5rem] border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-slate-50 px-3 sm:px-4 py-2.5 sm:py-3 focus-within:border-violet-400 transition">
                  <Search className="h-4 sm:h-5 w-4 sm:w-5 text-violet-500 flex-shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full bg-transparent text-xs sm:text-sm text-slate-900 outline-none placeholder:text-slate-400 font-medium"
                    placeholder="Kitap, yazar veya anahtar kelime..."
                  />
                </div>
                <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 sm:gap-2">
                  {['Roman', 'Polisiye', 'Fantastik', 'Kişisel Gelişim'].map((tag) => (
                    <button key={tag} type="button" onClick={() => setSearchQuery(tag)} aria-pressed={searchQuery === tag} className="rounded-full border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-slate-50 hover:from-violet-100 hover:to-slate-50 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-violet-700 transition hover:shadow-md hover:border-violet-300 whitespace-nowrap">
                      {tag}
                    </button>
                  ))}
                </div>

                <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-semibold">Arama modu</p>
                      <p className="mt-1 text-sm text-slate-700">Bu bölüm sadece Kitaplar sayfasına özel arama sunar.</p>
                    </div>
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                      <button type="button" onClick={() => setSearchMode("books")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${searchMode === "books" ? "bg-violet-700 text-white shadow" : "text-slate-700 hover:bg-slate-200"}`}>Kitap</button>
                      <button type="button" onClick={() => setSearchMode("users")} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${searchMode === "users" ? "bg-violet-700 text-white shadow" : "text-slate-700 hover:bg-slate-200"}`}>Yazar</button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-3 sm:p-4">
                    {searchQuery ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{searchMode === "books" ? "Kitap sonuçları" : "Yazar sonuçları"}</p>
                          <span className="text-xs uppercase tracking-[0.25em] text-slate-500">{searchMode === "books" ? `${filteredCollection.length} adet` : `${filteredUsers.length} adet`}</span>
                        </div>

                        {searchMode === "books" ? (
                          filteredCollection.slice(0, 4).map((book) => (
                            <div key={book.title} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                              <img src={book.cover} alt={book.title} className="h-14 w-12 rounded-lg object-cover" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{book.title}</p>
                                <p className="text-xs text-slate-500">{book.author} · {book.genre}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          filteredUsers.slice(0, 4).map((user) => (
                            <div key={user.name} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                              <img src={user.avatar} alt={user.name} className="h-14 w-14 rounded-full object-cover" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                                <p className="text-xs text-slate-500">{user.role} · {user.genre}</p>
                                <p className="mt-1 text-[11px] text-slate-500">{user.followers} takipçi · {user.city}</p>
                              </div>
                            </div>
                          ))
                        )}

                        {(searchMode === "books" ? filteredCollection : filteredUsers).length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 p-4 text-center text-sm text-slate-600">Aradığınız kriterlere uygun sonuç bulunamadı.</div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">Kitap ya da yazar adı girerek burada özel arama sonuçlarını görebilirsin.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-violet-700 to-sky-600 p-4 sm:p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-200/75 font-semibold">✨ İlham</p>
                    <h3 className="mt-2 text-lg sm:text-2xl font-semibold">Öne çıkan kitaplar</h3>
                  </div>
                  <Sparkles className="h-5 sm:h-6 w-5 sm:w-6 text-white/90 flex-shrink-0" />
                </div>
                <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 justify-start items-end overflow-x-auto pb-2">
                  {inspirationBooks.map((book) => (
                    <article key={book.title} className="relative group h-48 w-32 sm:h-56 sm:w-36 cursor-pointer transition-transform duration-300 hover:scale-105 flex-shrink-0">
                      <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.3)] transition-shadow duration-300 group-hover:shadow-[0_25px_70px_rgba(0,0,0,0.4)]">
                        <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-y-0 -right-2 w-4 bg-gradient-to-r from-sky-900/40 to-sky-950/60 rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-between">
                          <div>
                            <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3em] text-white backdrop-blur-sm">İlham</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <h4 className="text-sm font-bold text-white line-clamp-2">{book.title}</h4>
                              <p className="mt-0.5 text-xs text-slate-200">Okuma için seçilen modern kapak</p>
                            </div>
                            <button className="w-full rounded-lg bg-white/20 hover:bg-white/30 px-2 py-1.5 text-[11px] font-semibold text-white transition backdrop-blur-sm">Keşfet</button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <h5 className="text-xs font-bold text-white line-clamp-2 group-hover:text-sky-200 transition">{book.title}</h5>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </aside>
          </main>

          <section className="overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] bg-white p-4 sm:p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] sm:tracking-[0.35em] text-slate-500 font-semibold">📖 Kitap Koleksiyonu</p>
                <h2 className="mt-2 text-lg sm:text-2xl font-bold text-slate-900">Loop Kitaplık vitrini</h2>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition shadow-md hover:shadow-lg">
                Düzenle
                <ArrowRight className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
              </button>
            </div>
            <div className="mt-4 sm:mt-6 flex flex-wrap gap-3 sm:gap-4 justify-start items-end overflow-x-auto pb-2">
              {filteredCollection.map((book) => (
                <article key={book.title} className="relative group h-56 w-36 sm:h-64 sm:w-40 lg:h-72 lg:w-48 cursor-pointer perspective transition-transform duration-300 hover:scale-105 flex-shrink-0">
                  <div className="relative h-full w-full rounded-lg overflow-hidden shadow-[0_20px_60px_rgba(15,23,42,0.16)] transition-shadow duration-300 group-hover:shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
                    <img src={book.cover} alt={book.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-y-0 -right-2 w-6 bg-gradient-to-r from-slate-900/30 to-slate-950/50 rounded-r-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 sm:p-4 flex flex-col justify-between">
                      <div>
                        <span className="inline-flex rounded-full bg-violet-500/80 px-2 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.2em] sm:tracking-[0.35em] text-white backdrop-blur-sm">{book.genre}</span>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        <div>
                          <h4 className="text-sm sm:text-lg font-bold text-white line-clamp-2">{book.title}</h4>
                          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-200">{book.author}</p>
                        </div>
                        <button className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold text-white transition">İncele</button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3 text-center px-1">
                    <h5 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition">{book.title}</h5>
                    <p className="text-xs text-slate-500 mt-0.5 sm:mt-1 line-clamp-1">{book.author}</p>
                  </div>
                </article>
              ))}
              {filteredCollection.length === 0 && (
                <div className="w-full rounded-[1.5rem] border border-dashed border-violet-200 bg-violet-50/50 px-6 py-10 text-center">
                  <p className="font-semibold text-slate-900">Eşleşen kitap bulunamadı.</p>
                  <button type="button" onClick={() => setSearchQuery("")} className="mt-3 text-sm font-semibold text-violet-700 hover:text-violet-900">Aramayı temizle</button>
                </div>
              )}
            </div>
          </section>
        </div>
        </div>
      )}
    </AppLayout>
  );
}
