import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";

type SystemWarning = {
  id: number;
  title: string;
  message: string;
  testPreview: boolean;
};

const systemWarningsQueryKey = (userId: number | undefined) => ["system-warnings", userId] as const;

export function SystemWarningPopup() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const shownIds = useRef(new Set<number>());
  const [warning, setWarning] = useState<SystemWarning | null>(null);
  const { data: warnings } = useQuery({
    queryKey: systemWarningsQueryKey(user?.id),
    enabled: Boolean(user) && !isLoading,
    refetchInterval: user && !isLoading ? 3000 : false,
    staleTime: 0,
    queryFn: async (): Promise<SystemWarning[]> => {
      const response = await fetch("/api/notifications/system-warnings/unread", { credentials: "include" });
      if (!response.ok) throw new Error("Sistem uyarıları yüklenemedi");
      return response.json();
    },
  });

  useEffect(() => {
    const pendingWarning = warnings?.find((item) => !shownIds.current.has(item.id));
    if (!pendingWarning) return;

    shownIds.current.add(pendingWarning.id);
    setWarning({
      id: pendingWarning.id,
      title: pendingWarning.title,
      message: pendingWarning.message,
      testPreview: pendingWarning.testPreview,
    });
  }, [warnings]);

  const acknowledgeWarning = async () => {
    if (!warning) return;
    try {
      const response = await fetch(`/api/notifications/system-warnings/${warning.id}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Uyarı okundu olarak işaretlenemedi");
      setWarning(null);
      await queryClient.invalidateQueries({ queryKey: systemWarningsQueryKey(user?.id) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uyarı kapatılamadı");
    }
  };

  return (
    <Dialog open={Boolean(warning)} onOpenChange={(open) => {
      if (!open && warning) void acknowledgeWarning();
    }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-3xl border-destructive/25 p-6">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <DialogTitle className="text-lg">{warning?.title}</DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground">
            {warning?.message}
          </DialogDescription>
        </DialogHeader>
        {warning?.testPreview && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-medium text-amber-800 dark:text-amber-200">
            Bu yalnızca bir görünüm testidir; gerçek bir ihbar veya yaptırım değildir.
          </p>
        )}
        <Button className="w-full" onClick={() => void acknowledgeWarning()}>Anladım</Button>
      </DialogContent>
    </Dialog>
  );
}
