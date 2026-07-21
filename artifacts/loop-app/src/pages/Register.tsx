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

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", displayName: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof registerSchema>) {
    register.mutate({ data: values }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Kayıt başarılı" });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({ title: "Hata", description: err.message || "Kayıt olunamadı", variant: "destructive" });
      }
    });
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl">
            ∞
          </div>
          <h1 className="text-2xl font-bold">Loop'a Katıl</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Görünen Ad</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-register-display-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kullanıcı Adı</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-register-username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} data-testid="input-register-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şifre</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} data-testid="input-register-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full rounded-full" disabled={register.isPending} data-testid="btn-register-submit">
              {register.isPending ? "Kayıt olunuyor..." : "Kayıt Ol"}
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabın var mı? <Link href="/login" className="text-primary hover:underline">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}
