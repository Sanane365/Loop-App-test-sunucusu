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

const loginSchema = z.object({
  username: z.string().min(1, "Kullanıcı adı veya e-posta gerekli"),
  password: z.string().min(1, "Şifre gerekli"),
});

export default function Login() {
  const login = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    login.mutate({ data: values }, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        await queryClient.refetchQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Giriş başarılı" });
        setLocation("/");
      },
      onError: (err: any) => {
        toast({ title: "Hata", description: err.message || "Giriş yapılamadı", variant: "destructive" });
      }
    });
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl">
            ∞
          </div>
          <h1 className="text-2xl font-bold">Loop'a Giriş Yap</h1>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kullanıcı Adı veya E-posta</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-login-username" />
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
                    <Input type="password" {...field} data-testid="input-login-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full rounded-full" disabled={login.isPending} data-testid="btn-login-submit">
              {login.isPending ? "Giriş yapılıyor..." : "Giriş Yap"}
            </Button>
          </form>
        </Form>
        <p className="text-center text-sm text-muted-foreground">
          Hesabın yok mu? <Link href="/register" className="text-primary hover:underline">Kayıt ol</Link>
        </p>
      </div>
    </div>
  );
}
