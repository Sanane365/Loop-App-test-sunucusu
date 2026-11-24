import { useState } from "react";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { ArrowRight, Globe2, ShieldAlert } from "lucide-react";
import { LANGUAGES, useLanguage } from "@/hooks/use-language";

const loginSchema = z.object({
  username: z.string().min(1, "Kullanıcı adı veya e-posta gerekli"),
  password: z.string().min(1, "Şifre gerekli"),
});

export default function Login() {
  const login = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [, setLocation] = useLocation();
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    setSystemMessage(null);
    login.mutate({ data: values }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: t("loginSuccess") });
        setLocation("/");
      },
      onError: (err: any) => {
        if (err?.status === 403 || err?.data?.error === "account_suspended") {
          setSystemMessage(err?.data?.message || "Hesabınız askıya alınmıştır.");
          return;
        }
        toast({ title: "Hata", description: err.message || "Giriş yapılamadı", variant: "destructive" });
      }
    });
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#080914] px-4 py-10 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.13),transparent_55%)]" />
      </div>
      <section className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="absolute -inset-2 rounded-[1.6rem] bg-gradient-to-br from-violet-500/60 to-cyan-400/60 opacity-70 blur-md" />
            <img src="/loop-app-logo.png" alt="Loop App" className="relative h-[4.5rem] w-[4.5rem] rounded-2xl border border-white/20 object-cover shadow-2xl" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/80">LOOP · KENDİNİ ANLAT</p>
          <h1 className="mt-3 max-w-sm text-3xl font-black leading-tight tracking-tight sm:text-4xl">Sen de <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">Loop diye</span> aramıza katıl.</h1>
          <p className="mt-2 text-sm text-slate-400">{t("loginTitle")} · Hikâyeni, sesini ve dünyanı paylaş.</p>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {systemMessage && (
                <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="text-sm font-bold">{t("notifications")}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-foreground">{systemMessage}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Spam nedeniyle hesabınıza erişim kısıtlanmıştır.</p>
                </div>
              )}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("usernameOrEmail")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-login-username" autoComplete="username" className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-cyan-300/60 focus-visible:ring-cyan-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("password")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-login-password" autoComplete="current-password" className="h-12 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-violet-300/60 focus-visible:ring-violet-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110" disabled={login.isPending} data-testid="btn-login-submit">
                {login.isPending ? t("loggingIn") : <>{t("login")}<ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>
          </Form>
          <p className="mt-6 text-center text-sm text-slate-400">
            {t("noAccount")} <Link href="/register" className="font-bold text-cyan-200 transition hover:text-white">{t("signUp")}</Link>
          </p>
          <label className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
            <Globe2 className="h-4 w-4 text-cyan-200" />
            <span className="sr-only">{t("language")}</span>
            <select value={language} onChange={event => setLanguage(event.target.value)} aria-label={t("language")} className="max-w-40 cursor-pointer bg-transparent text-xs font-semibold text-white outline-none">
              {LANGUAGES.map(option => <option key={option.value} value={option.value} className="bg-slate-900 text-white">{option.label}</option>)}
            </select>
          </label>
          <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-center text-[11px] leading-relaxed text-amber-100/75">
            <span className="font-bold text-amber-100">Ücretsiz test sürümü:</span> Servis boşta kalınca uykuya geçebilir ve yeniden açılması gecikebilir. Ücretsiz veritabanı 30 gün sonra sona erebilir; test süresince oluşturduğunuz içerik ve yüklediğiniz dosyalar kalıcı olarak saklanmayabilir.
          </p>
        </div>
        <p className="mt-5 text-center text-[10px] font-medium tracking-wide text-slate-500">Kendi ritmini bul · Loop’ta yerini al</p>
      </section>
    </main>
  );
}
