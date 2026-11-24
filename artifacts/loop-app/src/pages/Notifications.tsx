import { useListNotifications, useMarkNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, UserPlus, AtSign, CheckCheck, BookOpen, Newspaper, Zap, ChevronRight, Gamepad2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      refetchInterval: 3000,
      staleTime: 0,
    },
  });
  const markReadMutation = useMarkNotificationsRead();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<number | null>(null);

  const respondToGameInvite = async (notificationId: number, response: "accepted" | "rejected", fromUserId?: number) => {
    setRespondingId(notificationId);
    try {
      const result = await fetch(`/api/games/xox/invites/${notificationId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await result.json();
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
        if (response === "accepted" && fromUserId) setLocation(`/dm/${fromUserId}?xoxGameId=${data.gameId}`);
      }
    } finally {
      setRespondingId(null);
    }
  };

  const respondToSocialRequest = async (
    notification: NonNullable<typeof notifications>[number],
    action: "accepted" | "rejected",
  ) => {
    const fromUserId = notification.fromUser?.id;
    const data = (notification as typeof notification & { data?: { requestId?: number } }).data;
    const notificationType = String(notification.type);
    if (!fromUserId) return;
    setRespondingId(notification.id);
    try {
      const isFollowRequest = notificationType === "follow_request";
      const endpoint = isFollowRequest
        ? `/api/users/${fromUserId}/follow-request/respond`
        : `/api/dm/requests/${data?.requestId}/respond`;
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "İstek yanıtlanamadı");
      await queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      if (action === "accepted" && !isFollowRequest) setLocation(`/dm/${fromUserId}`);
      toast.success(action === "accepted" ? "İstek kabul edildi" : "İstek reddedildi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İstek yanıtlanamadı");
    } finally {
      setRespondingId(null);
    }
  };

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
    });
  };

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(activeCategory === categoryId ? null : categoryId);
    if (activeCategory !== categoryId) {
      void fetch("/api/notifications/read-category", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryId }),
      }).then(() => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500 fill-current" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-500 fill-current" />;
      case 'repost': return <Repeat2 className="w-5 h-5 text-green-500" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-primary" />;
      case 'follow_request': return <UserPlus className="w-5 h-5 text-primary" />;
      case 'message_request': return <MessageCircle className="w-5 h-5 text-violet-500" />;
      case 'book': case 'book_comment': return <BookOpen className="w-5 h-5 text-indigo-500" />;
      case 'bulletin': case 'bulletin_comment': return <Newspaper className="w-5 h-5 text-fuchsia-500" />;
      case 'mention': return <AtSign className="w-5 h-5 text-orange-500" />;
      case 'game_invite': case 'game_invite_accepted': case 'game_invite_rejected': return <Gamepad2 className="w-5 h-5 text-amber-500" />;
      case 'bobi_moderation': return <ShieldAlert className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  const getCategory = (notification: NonNullable<typeof notifications>[number]) => {
    const type = String(notification.type);
    if (["follow", "follow_request", "message_request", "game_invite", "game_invite_accepted", "game_invite_rejected"].includes(type)) return "social";
    if ((notification.post as { postType?: string } | null)?.postType === "book" || ["book", "book_comment"].includes(type)) return "books";
    if ((notification.post as { postType?: string } | null)?.postType === "bulletin" || ["bulletin", "bulletin_comment"].includes(type)) return "bulletins";
    return "activity";
  };

  const categories = [
    { id: "social", label: "Yeni takipçiler & mesaj istekleri", description: "Seni takip edenler ve gelen istekler", icon: UserPlus, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { id: "books", label: "Kitaplar", description: "Kitap, bölüm ve yorum bildirimleri", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30" },
    { id: "bulletins", label: "Bültenler", description: "Bülten gönderisi ve yorum bildirimleri", icon: Newspaper, color: "text-fuchsia-600", bg: "bg-fuchsia-50 dark:bg-fuchsia-950/30" },
    { id: "activity", label: "Aktivite", description: "Beğeniler, yorumlar, paylaşımlar ve diğerleri", icon: Zap, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30" },
  ];

  const groupedNotifications = categories.map(category => ({
    ...category,
    items: (notifications ?? []).filter(notification => getCategory(notification) === category.id),
  }));
  const visibleNotifications = activeCategory ? groupedNotifications.find(category => category.id === activeCategory)?.items ?? [] : [];

  const getText = (type: string, name: string, data?: { title?: string }) => {
    switch (type) {
      case 'like': return <><span className="font-semibold text-foreground">{name}</span> gönderini beğendi</>;
      case 'comment': return <><span className="font-semibold text-foreground">{name}</span> gönderine yorum yaptı</>;
      case 'repost': return <><span className="font-semibold text-foreground">{name}</span> gönderini yeniden paylaştı</>;
      case 'follow': return <><span className="font-semibold text-foreground">{name}</span> seni takip etmeye başladı</>;
      case 'follow_request': return <><span className="font-semibold text-foreground">{name}</span> takip isteği gönderdi</>;
      case 'message_request': return <><span className="font-semibold text-foreground">{name}</span> mesaj isteği gönderdi</>;
      case 'book': return <><span className="font-semibold text-foreground">{name}</span> kitabınla etkileşime geçti</>;
      case 'book_comment': return <><span className="font-semibold text-foreground">{name}</span> kitabına yorum yaptı</>;
      case 'bulletin': return <><span className="font-semibold text-foreground">{name}</span> bültenini görüntüledi</>;
      case 'bulletin_comment': return <><span className="font-semibold text-foreground">{name}</span> bültenine yorum yaptı</>;
      case 'mention': return <><span className="font-semibold text-foreground">{name}</span> senden bahsetti</>;
      case 'game_invite': return <><span className="font-semibold text-foreground">{name}</span> seni XOX oyununa davet etti</>;
      case 'game_invite_accepted': return <><span className="font-semibold text-foreground">{name}</span> XOX davetini kabul etti</>;
      case 'game_invite_rejected': return <><span className="font-semibold text-foreground">{name}</span> XOX davetini reddetti</>;
      case 'system_warning': return <span className="font-semibold text-foreground">{data?.title || "Sistem uyarısı"}</span>;
        case 'bobi_moderation': return <>Bobi moderasyon raporu: kullanıcı susturuldu veya admin kararı bekliyor</>;
      default: return null;
    }
  };

  const hasUnread = notifications?.some(n => !n.isRead);

  return (
    <AppLayout>
      <div className="p-4 pb-20">
        <div className="flex items-center justify-between mb-6 px-1">
          <h1 className="text-xl font-bold">Bildirimler</h1>
          {hasUnread && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="text-primary hover:text-primary/80 gap-2 h-8">
              <CheckCheck className="w-4 h-4" />
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex gap-4 p-4 bg-card rounded-2xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-secondary" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-border">
            Henüz bildiriminiz yok
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {groupedNotifications.map(category => {
                const Icon = category.icon;
                const unreadCount = category.items.filter(item => !item.isRead).length;
                return (
                  <button key={category.id} type="button" onClick={() => handleCategoryClick(category.id)} className={`flex items-center gap-4 rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${activeCategory === category.id ? "ring-2 ring-primary/30" : ""}`}>
                    <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${category.bg}`}><Icon className={`h-8 w-8 ${category.color}`} /></span>
                    <span className="min-w-0 flex-1"><strong className="block text-base font-bold leading-tight">{category.label}</strong><small className="mt-1 block text-sm leading-snug text-muted-foreground">{category.description}</small></span>
                    {unreadCount > 0 && activeCategory !== category.id ? <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-primary px-2 text-lg font-bold text-primary-foreground">{unreadCount}</span> : <ChevronRight className={`h-6 w-6 shrink-0 text-primary transition-transform ${activeCategory === category.id ? "rotate-90" : ""}`} />}
                  </button>
                );
              })}
            </div>

            {activeCategory && <div className="space-y-3">
            {visibleNotifications.map(notif => (
              <div key={notif.id} className={`flex gap-4 p-4 rounded-2xl border transition-colors ${notif.isRead ? 'bg-card border-border' : 'bg-primary/5 border-primary/20'}`}>
                {(() => {
                  const data = (notif as typeof notif & { data?: { status?: string; requestId?: number } }).data;
                  const type = String(notif.type);
                  if (data?.status !== "pending") return null;
                  if (type === "game_invite") return (
                    <div className="order-last flex shrink-0 items-center gap-2 self-center">
                      <Button size="sm" disabled={respondingId === notif.id} onClick={() => void respondToGameInvite(notif.id, "accepted", notif.fromUser?.id)}>Kabul Et</Button>
                      <Button size="sm" variant="outline" disabled={respondingId === notif.id} onClick={() => void respondToGameInvite(notif.id, "rejected")}>Reddet</Button>
                    </div>
                  );
                  if (type === "follow_request" || type === "message_request") return (
                    <div className="order-last flex shrink-0 items-center gap-2 self-center">
                      <Button size="sm" disabled={respondingId === notif.id} onClick={() => void respondToSocialRequest(notif, "accepted")}>Kabul Et</Button>
                      <Button size="sm" variant="outline" disabled={respondingId === notif.id} onClick={() => void respondToSocialRequest(notif, "rejected")}>Reddet</Button>
                    </div>
                  );
                  return null;
                })()}
                <div className="flex flex-col items-center gap-2 pt-1 flex-shrink-0">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1">
                  {notif.fromUser && <Link href={`/profile/${notif.fromUser.id}`}>
                    <Avatar className="w-8 h-8 mb-2 cursor-pointer">
                      <AvatarImage src={notif.fromUser?.avatarUrl || ""} />
                      <AvatarFallback>{notif.fromUser?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Link>}
                  
                  <p className="text-sm text-muted-foreground mb-1">
                    {getText(notif.type, notif.fromUser?.displayName || "Birisi", (notif as typeof notif & { data?: { title?: string; message?: string } }).data)}
                  </p>

                  {String(notif.type) === "system_warning" && (notif as typeof notif & { data?: { message?: string } }).data?.message && (
                    <p className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-relaxed text-foreground">
                      {(notif as typeof notif & { data?: { message?: string } }).data?.message}
                    </p>
                  )}
                  
                  {notif.post && (
                    <p className="text-sm line-clamp-2 text-foreground/80 pl-3 border-l-2 border-border mt-2">
                      {notif.post.content}
                    </p>
                  )}

                  {String(notif.type) === "message_request" && (notif as typeof notif & { data?: { preview?: string } }).data?.preview && (
                    <p className="mt-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-foreground/80">
                      {(notif as typeof notif & { data?: { preview?: string } }).data?.preview}
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                    {formatDistanceToNow(new Date(notif.createdAt), { locale: tr, addSuffix: true })}
                  </p>
                </div>
                
                {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
              </div>
            ))}
            {visibleNotifications.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Bu kategoride henüz bildirim yok.</div>}
            </div>}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
