import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Building2, Crown, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from "@capgo/native-purchases";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";

type PlanId = "monthly" | "annual";
type MembershipPackage = {
  id: string;
  productId: string;
  name: string;
  benefits: string[];
  plans: Array<{ id: PlanId; interval: string; referencePriceTry: string; discountPercent?: number }>;
};
type MembershipState = {
  id: string;
  productId: string;
  name: string;
  expiresAt: string;
};

const icons = [Sparkles, BadgeCheck, ShieldCheck, Building2];

export default function Memberships() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAndroid = Capacitor.getPlatform() === "android";
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [googlePlayReady, setGooglePlayReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeMemberships, setActiveMemberships] = useState<MembershipState[]>([]);
  const [plan, setPlan] = useState<PlanId>("monthly");
  const [loading, setLoading] = useState(true);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadActiveMemberships = useCallback(async () => {
    const response = await fetch("/api/live/subscriptions", { credentials: "include", cache: "no-store" });
    const result = await response.json().catch(() => ({})) as {
      error?: string;
      activeSubscriptions?: MembershipState[];
      googlePlayReady?: boolean;
    };
    if (!response.ok) throw new Error(result.error || "Üyelik bilgileri alınamadı.");
    setActiveMemberships(Array.isArray(result.activeSubscriptions) ? result.activeSubscriptions : []);
    setGooglePlayReady(result.googlePlayReady === true);
  }, []);

  const verifyPurchase = useCallback(async (transaction: Transaction, fallbackProductId?: string, fallbackPlan?: PlanId) => {
    if (!transaction.purchaseToken) throw new Error("Google Play satın alma tokenı alınamadı.");
    const productId = fallbackProductId ?? transaction.productIdentifier;
    const response = await fetch("/api/live/subscriptions/google-play/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        ...(fallbackPlan ? { planId: fallbackPlan } : {}),
        purchaseToken: transaction.purchaseToken,
      }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string; acknowledgementPending?: boolean };
    if (!response.ok) throw new Error(result.error || "Google Play aboneliği doğrulanamadı.");
    if (result.acknowledgementPending) {
      setNotice("Aboneliğin doğrulandı. Google Play son onayı tekrar denenecek.");
    } else {
      setNotice("Aboneliğin etkinleştirildi.");
    }
    await loadActiveMemberships();
  }, [loadActiveMemberships]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [catalogResponse, membershipResponse] = await Promise.all([
          fetch("/api/live/subscription-packages", { cache: "no-store" }),
          fetch("/api/live/subscriptions", { credentials: "include", cache: "no-store" }),
        ]);
        const catalog = await catalogResponse.json().catch(() => ({})) as {
          error?: string;
          googlePlayReady?: boolean;
          packages?: MembershipPackage[];
        };
        const membershipData = await membershipResponse.json().catch(() => ({})) as {
          error?: string;
          googlePlayReady?: boolean;
          activeSubscriptions?: MembershipState[];
        };
        if (!catalogResponse.ok) throw new Error(catalog.error || "Üyelik paketleri yüklenemedi.");
        if (!membershipResponse.ok) throw new Error(membershipData.error || "Aktif üyelikler yüklenemedi.");
        if (cancelled) return;
        const catalogPackages = Array.isArray(catalog.packages) ? catalog.packages : [];
        setPackages(catalogPackages);
        setGooglePlayReady(catalog.googlePlayReady === true && membershipData.googlePlayReady === true);
        setActiveMemberships(Array.isArray(membershipData.activeSubscriptions) ? membershipData.activeSubscriptions : []);

        if (Capacitor.getPlatform() !== "android" || !catalog.googlePlayReady || catalogPackages.length === 0) return;
        await NativePurchases.configure({ autoFinishTransactions: false });
        const { products: storeProducts } = await NativePurchases.getProducts({
          productIdentifiers: catalogPackages.map((item) => item.productId),
          productType: PURCHASE_TYPE.SUBS,
        });
        if (cancelled) return;
        setProducts(storeProducts);

        const { transactions } = await NativePurchases.getUnfinishedTransactions();
        for (const transaction of transactions) {
          if (cancelled) return;
          const knownPackage = catalogPackages.find((item) => item.productId === transaction.productIdentifier);
          if (!knownPackage) continue;
          try {
            await verifyPurchase(transaction);
          } catch (recoveryError) {
            console.error("Bekleyen Google Play aboneliği doğrulanamadı:", recoveryError);
            if (!cancelled) setError(recoveryError instanceof Error ? recoveryError.message : "Bekleyen satın alma doğrulanamadı.");
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Üyelik paketleri yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, verifyPurchase]);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.identifier === plan),
    [products, plan],
  );
  const priceFor = (productId: string) => visibleProducts.find((product) => product.planIdentifier === productId)?.priceString;

  const restorePurchases = async () => {
    if (!isAndroid || !googlePlayReady) return;
    setBusyPackageId("restore");
    setError("");
    setNotice("");
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
      for (const transaction of purchases) {
        const knownPackage = packages.find((item) => item.productId === transaction.productIdentifier);
        if (knownPackage && transaction.purchaseToken) await verifyPurchase(transaction);
      }
      await loadActiveMemberships();
      setNotice("Google Play aboneliklerin kontrol edildi.");
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Satın alımlar geri yüklenemedi.");
    } finally {
      setBusyPackageId(null);
    }
  };

  const buyPackage = async (membership: MembershipPackage) => {
    if (!isAndroid || !googlePlayReady || busyPackageId) return;
    const storeProduct = visibleProducts.find((product) => product.planIdentifier === membership.productId);
    if (!storeProduct) {
      setError("Bu dönem için ürün Google Play'de bulunamadı. Play Console ürün ve temel plan ayarlarını kontrol edin.");
      return;
    }
    setBusyPackageId(membership.id);
    setError("");
    setNotice("");
    try {
      const accountDigest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`loop:${user?.id}`),
      );
      const appAccountToken = Array.from(new Uint8Array(accountDigest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: membership.productId,
        planIdentifier: plan,
        ...(storeProduct.offerToken ? { offerToken: storeProduct.offerToken } : {}),
        productType: PURCHASE_TYPE.SUBS,
        appAccountToken,
        autoAcknowledgePurchases: false,
      });
      await verifyPurchase(transaction, membership.productId, plan);
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "Satın alma tamamlanamadı.");
    } finally {
      setBusyPackageId(null);
    }
  };

  return (
    <AppLayout>
      <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 pb-24">
        <header className="sticky top-0 z-10 -mx-4 mb-5 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
          <button type="button" onClick={() => setLocation("/settings")} aria-label="Ayarlara dön" className="rounded-full p-2 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black">Loop üyelik paketleri</h1>
            <p className="text-xs text-muted-foreground">Satın almalar Google Play üzerinden güvenli şekilde doğrulanır.</p>
          </div>
          {isAndroid && googlePlayReady && (
            <button type="button" onClick={() => void restorePurchases()} disabled={busyPackageId !== null} aria-label="Satın alımları geri yükle" className="rounded-full p-2 hover:bg-muted disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${busyPackageId === "restore" ? "animate-spin" : ""}`} />
            </button>
          )}
        </header>

        {!isAndroid && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">Üyelikler Google Play üzerinden Android uygulamasında satın alınabilir. Paketleri Android uygulamasında açın.</p>}
        {isAndroid && !googlePlayReady && <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200">Google Play doğrulama sunucu ayarları henüz tamamlanmadı; satın alma başlatılamıyor.</p>}
        {activeMemberships.length > 0 && (
          <section className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <h2 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Etkin üyeliklerin</h2>
            <ul className="mt-2 space-y-1">
              {activeMemberships.map((membership) => (
                <li key={`${membership.id}-${membership.expiresAt}`} className="flex items-center justify-between gap-3 text-sm">
                  <span>{membership.name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(membership.expiresAt).toLocaleDateString("tr-TR")} tarihine kadar</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1">
          {(["monthly", "annual"] as const).map((period) => (
            <button key={period} type="button" onClick={() => setPlan(period)} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${plan === period ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
              {period === "monthly" ? "Aylık" : "Yıllık · %16,7 indirim"}
            </button>
          ))}
        </div>

        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Paketler yükleniyor...</p>}
        {error && <p role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

        <div className="space-y-3">
          {packages.map((membership, index) => {
            const Icon = icons[index] ?? Crown;
            const alreadyActive = activeMemberships.some((item) => item.id === membership.id);
            const price = priceFor(membership.productId);
            return (
              <article key={membership.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-black">{membership.name}</h2>
                      <strong className="text-sm">{price ?? (isAndroid ? "Google Play fiyatı yükleniyor" : "Google Play’de görüntülenir")}{price ? (plan === "monthly" ? " / ay" : " / yıl") : ""}</strong>
                    </div>
                    {plan === "annual" && <p className="mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Aylık ödemeye göre %16,7 indirim</p>}
                  </div>
                </div>
                <ul className="mt-3 space-y-1.5 pl-1">
                  {membership.benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2 text-xs text-muted-foreground"><span className="mt-0.5 text-primary">✓</span><span>{benefit}</span></li>)}
                </ul>
                <button
                  type="button"
                  disabled={!isAndroid || !googlePlayReady || !price || Boolean(busyPackageId) || alreadyActive}
                  onClick={() => void buyPackage(membership)}
                  className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {alreadyActive ? "Üyelik etkin" : busyPackageId === membership.id ? "Google Play doğrulanıyor..." : "Google Play ile abone ol"}
                </button>
              </article>
            );
          })}
          {!loading && packages.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Üyelik paketleri şu anda yüklenemedi.</p>}
        </div>
      </main>
    </AppLayout>
  );
}
