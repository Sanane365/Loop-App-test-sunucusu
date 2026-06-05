import { useListNotifications, useMarkNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Repeat2, UserPlus, AtSign, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Notifications() {
  const { data: notifications, isLoading } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const markReadMutation = useMarkNotificationsRead();
  const queryClient = useQueryClient();

  const handleMarkAllRead = () => {
    markReadMutation.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-5 h-5 text-red-500 fill-current" />;
      case 'comment': return <MessageCircle className="w-5 h-5 text-blue-500 fill-current" />;
      case 'repost': return <Repeat2 className="w-5 h-5 text-green-500" />;
      case 'follow': return <UserPlus className="w-5 h-5 text-primary" />;
      case 'mention': return <AtSign className="w-5 h-5 text-orange-500" />;
      default: return null;
    }
  };

  const getText = (type: string, name: string) => {
    switch (type) {
      case 'like': return <><span className="font-semibold text-foreground">{name}</span> gönderini beğendi</>;
      case 'comment': return <><span className="font-semibold text-foreground">{name}</span> gönderine yorum yaptı</>;
      case 'repost': return <><span className="font-semibold text-foreground">{name}</span> gönderini yeniden paylaştı</>;
      case 'follow': return <><span className="font-semibold text-foreground">{name}</span> seni takip etmeye başladı</>;
      case 'mention': return <><span className="font-semibold text-foreground">{name}</span> senden bahsetti</>;
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
          <div className="space-y-3">
            {notifications?.map(notif => (
              <div key={notif.id} className={`flex gap-4 p-4 rounded-2xl border transition-colors ${notif.isRead ? 'bg-card border-border' : 'bg-primary/5 border-primary/20'}`}>
                <div className="flex flex-col items-center gap-2 pt-1 flex-shrink-0">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1">
                  <Link href={`/profile/${notif.fromUser?.id}`}>
                    <Avatar className="w-8 h-8 mb-2 cursor-pointer">
                      <AvatarImage src={notif.fromUser?.avatarUrl || ""} />
                      <AvatarFallback>{notif.fromUser?.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  
                  <p className="text-sm text-muted-foreground mb-1">
                    {getText(notif.type, notif.fromUser?.displayName || "Birisi")}
                  </p>
                  
                  {notif.post && (
                    <p className="text-sm line-clamp-2 text-foreground/80 pl-3 border-l-2 border-border mt-2">
                      {notif.post.content}
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-2 font-medium">
                    {formatDistanceToNow(new Date(notif.createdAt), { locale: tr, addSuffix: true })}
                  </p>
                </div>
                
                {!notif.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
