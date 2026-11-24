import { useEffect, useState } from "react";

export const LANGUAGES = [
  { value: "tr", label: "Türkçe" }, { value: "en", label: "English" }, { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" }, { value: "fr", label: "Français" }, { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" }, { value: "nl", label: "Nederlands" }, { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" }, { value: "ja", label: "日本語" }, { value: "ko", label: "한국어" }, { value: "zh", label: "简体中文" },
] as const;

export type LanguageId = typeof LANGUAGES[number]["value"];
const STORAGE_KEY = "loop-language";

type Messages = Record<string, string>;
const messages: Record<string, Messages> = {
  tr: { home: "Ana sayfa", explore: "Keşfet", loops: "Loops", library: "Kitaplık", chat: "Sohbet", voice: "Ses", profile: "Profil", notifications: "Bildirimler", messages: "Mesajlarım", bookmarks: "Kaydedilenler", settings: "Ayarlar", admin: "Admin Paneli", appearance: "Görünüm ve tema", language: "Uygulama dili", dark: "Koyu", light: "Açık", save: "Kaydet", change: "Değiştir", trend: "Trend", following: "Takipte", news: "Gündem", bulletin: "Bülten", forYou: "Sana Özel", anonymous: "Anonim Sorular", books: "Kitaplar", followers: "Takipçi", posts: "Gönderi", likes: "Beğeni", editProfile: "Profili Düzenle", follow: "Takip Et", followingYou: "Takiptesin", message: "Mesaj", exploreTopics: "Keşfet", trendingPosts: "Gündemdeki Gönderiler", mostLiked: "En Beğenilenler", rising: "Yeni Yükselenler", weekly: "Haftalık Sıralama", noMessages: "Henüz mesaj yok", firstMessage: "İlk mesajı sen gönder", noSavedPosts: "Henüz kaydettiğin gönderi yok", saveHint: "Gönderilerdeki yer imi simgesine tıkla", post: "Gönderi", notFound: "Gönderi bulunamadı", comments: "Yorumlar", loading: "Yükleniyor...", firstComment: "İlk yorumu sen yap!", loginTitle: "Loop'a Giriş Yap", registerTitle: "Loop'a Katıl", usernameOrEmail: "Kullanıcı Adı veya E-posta", username: "Kullanıcı Adı", email: "E-posta", password: "Şifre", displayName: "Görünen Ad", login: "Giriş Yap", register: "Kayıt Ol", loggingIn: "Giriş yapılıyor...", registering: "Kayıt olunuyor...", noAccount: "Hesabın yok mu?", hasAccount: "Zaten hesabın var mı?", signUp: "Kayıt ol", signIn: "Giriş yap", loginSuccess: "Giriş başarılı", registerSuccess: "Kayıt başarılı" },
  en: { home: "Home", explore: "Explore", loops: "Loops", library: "Library", chat: "Chat", voice: "Voice", profile: "Profile", notifications: "Notifications", messages: "Messages", bookmarks: "Bookmarks", settings: "Settings", admin: "Admin Panel", appearance: "Appearance and theme", language: "App language", dark: "Dark", light: "Light", save: "Save", change: "Change", trend: "Trending", following: "Following", news: "News", bulletin: "Bulletin", forYou: "For You", anonymous: "Anonymous Questions", books: "Books", followers: "Followers", posts: "Posts", likes: "Likes", editProfile: "Edit profile", follow: "Follow", followingYou: "Following", message: "Message", exploreTopics: "Explore", trendingPosts: "Trending posts", mostLiked: "Most liked", rising: "New and rising", weekly: "Weekly ranking", noMessages: "No messages yet", firstMessage: "Send the first message", noSavedPosts: "No saved posts yet", saveHint: "Tap the bookmark icon on posts", post: "Post", notFound: "Post not found", comments: "Comments", loading: "Loading...", firstComment: "Be the first to comment!", loginTitle: "Sign in to Loop", registerTitle: "Join Loop", usernameOrEmail: "Username or email", username: "Username", email: "Email", password: "Password", displayName: "Display name", login: "Sign in", register: "Sign up", loggingIn: "Signing in...", registering: "Signing up...", noAccount: "Don't have an account?", hasAccount: "Already have an account?", signUp: "Sign up", signIn: "Sign in", loginSuccess: "Signed in successfully", registerSuccess: "Registered successfully" },
  de: { home: "Startseite", explore: "Entdecken", loops: "Loops", library: "Bibliothek", chat: "Chat", voice: "Audio", profile: "Profil", notifications: "Benachrichtigungen", messages: "Nachrichten", bookmarks: "Gespeichert", settings: "Einstellungen", admin: "Admin-Panel", appearance: "Darstellung und Thema", language: "App-Sprache", dark: "Dunkel", light: "Hell", save: "Speichern", change: "Ändern", trend: "Trend", following: "Abonniert", news: "Aktuell", bulletin: "Feed", forYou: "Für dich", anonymous: "Anonyme Fragen", books: "Bücher" },
  es: { home: "Inicio", explore: "Explorar", loops: "Loops", library: "Biblioteca", chat: "Chat", voice: "Voz", profile: "Perfil", notifications: "Notificaciones", messages: "Mensajes", bookmarks: "Guardados", settings: "Ajustes", admin: "Panel de administración", appearance: "Apariencia y tema", language: "Idioma de la app", dark: "Oscuro", light: "Claro", save: "Guardar", change: "Cambiar" },
  fr: { home: "Accueil", explore: "Explorer", loops: "Loops", library: "Bibliothèque", chat: "Discussion", voice: "Voix", profile: "Profil", notifications: "Notifications", messages: "Messages", bookmarks: "Enregistrés", settings: "Paramètres", admin: "Panneau admin", appearance: "Apparence et thème", language: "Langue de l'app", dark: "Sombre", light: "Clair", save: "Enregistrer", change: "Modifier" },
};

export function getLanguage(): LanguageId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageId | null;
    return LANGUAGES.some(language => language.value === saved) ? saved! : "tr";
  } catch { return "tr"; }
}

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageId>(getLanguage);
  useEffect(() => {
    const sync = (event?: Event) => setLanguage((event as CustomEvent<string> | undefined)?.detail as LanguageId || getLanguage());
    window.addEventListener("loop-language-change", sync);
    return () => window.removeEventListener("loop-language-change", sync);
  }, []);
  const setLanguageValue = (value: string) => {
    if (!LANGUAGES.some(option => option.value === value)) return;
    const nextLanguage = value as LanguageId;
    localStorage.setItem(STORAGE_KEY, nextLanguage);
    document.documentElement.lang = nextLanguage;
    setLanguage(nextLanguage);
    window.dispatchEvent(new CustomEvent("loop-language-change", { detail: nextLanguage }));
  };
  const t = (key: string) => messages[language]?.[key] ?? messages.en[key] ?? messages.tr[key] ?? key;
  return { language, setLanguage: setLanguageValue, t };
}
