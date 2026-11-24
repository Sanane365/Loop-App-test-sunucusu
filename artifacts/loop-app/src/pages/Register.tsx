import { useState } from "react";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { ArrowRight, Globe2 } from "lucide-react";
import { LANGUAGES } from "@/hooks/use-language";

const registerSchema = z.object({
  username: z.string().min(1, "Kullanıcı adı gerekli"),
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  displayName: z.string().min(1, "Görünen ad gerekli"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export default function Register() {
  const register = useRegister();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", displayName: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    register.mutate({ data: values }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: t("registerSuccess") });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({ title: "Hata", description: err.message || "Kayıt olunamadı", variant: "destructive" });
      }
    });
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#080914] px-4 py-8 text-white sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-violet-600/25 blur-[100px]" />
        <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.13),transparent_55%)]" />
      </div>
      <section className="relative w-full max-w-md">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="absolute -inset-2 rounded-[1.6rem] bg-gradient-to-br from-violet-500/60 to-cyan-400/60 opacity-70 blur-md" />
            <img src="/loop-app-logo.png" alt="Loop App" className="relative h-[4.25rem] w-[4.25rem] rounded-2xl border border-white/20 object-cover shadow-2xl" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/80">LOOP · YENİ BİR BAŞLANGIÇ</p>
          <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl"><span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">Loop diye</span> kayıt ol :D</h1>
          <p className="mt-2 text-sm text-slate-400">{t("registerTitle")} · Aramıza katıl, kendi dünyanı oluştur.</p>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("displayName")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-register-display-name" autoComplete="name" className="h-11 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-cyan-300/60 focus-visible:ring-cyan-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("username")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-register-username" autoComplete="username" className="h-11 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-violet-300/60 focus-visible:ring-violet-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="input-register-email" autoComplete="email" className="h-11 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-cyan-300/60 focus-visible:ring-cyan-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-slate-300">{t("password")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} data-testid="input-register-password" autoComplete="new-password" className="h-11 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-slate-500 focus-visible:border-violet-300/60 focus-visible:ring-violet-300/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="mt-1 h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-bold text-white shadow-lg shadow-violet-950/30 transition hover:brightness-110" disabled={register.isPending} data-testid="btn-register-submit">
                {register.isPending ? t("registering") : <>{t("register")}<ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </form>
          </Form>
          <p className="mt-5 text-center text-sm text-slate-400">
            {t("hasAccount")} <Link href="/login" className="font-bold text-cyan-200 transition hover:text-white">{t("signIn")}</Link>
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
        <p className="mt-4 text-center text-[10px] font-medium tracking-wide text-slate-500">Kendi ritmini bul · Loop’ta yerini al</p>
      </section>
    </main>
  );
}
