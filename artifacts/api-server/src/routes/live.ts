import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import Iyzipay, { type CheckoutInitializeRequest, type CheckoutInitializeResponse, type CheckoutRetrieveResponse } from "iyzipay";
import { db, usersTable } from "@workspace/db";
import { inArray, sql } from "drizzle-orm";
import { requireAuth, isPrivilegedUser } from "../lib/auth";
import {
  acknowledgeGoogleSubscription,
  consumeGoogleProductPurchase,
  getGooglePlayAccountId,
  getGooglePlayPurchaseReferenceId,
  getActiveGooglePlayProductIds,
  getGoogleProductPurchase,
  getGoogleSubscriptionPurchase,
  googlePlaySchemaReady,
  isGooglePlayBillingReady,
} from "../lib/googlePlayBilling";

const router = Router();
const dataDir = path.resolve(import.meta.dirname, "..", "data");
const settingsFile = path.join(dataDir, "live-settings.json");
const animationsFile = path.join(dataDir, "live-animations.json");
const battleResultAnimationsFile = path.join(dataDir, "live-battle-result-animations.json");
const eventsFile = path.join(dataDir, "live-events.json");
const arenaAssetsFile = path.join(dataDir, "live-arena-assets.json");
const buttonAssetsFile = path.join(dataDir, "live-button-assets.json");
const broadcastsFile = path.join(dataDir, "live-broadcasts.json");
const broadcastArchiveFile = path.join(dataDir, "live-broadcast-history.json");
const commentsFile = path.join(dataDir, "live-comments.json");
const giftsFile = path.join(dataDir, "live-gifts.json");
const supporterProgressFile = path.join(dataDir, "live-supporter-progress.json");
const leagueProgressFile = path.join(dataDir, "live-league-progress.json");
const creatorClubMembersFile = path.join(dataDir, "live-creator-club-members.json");
const creatorClubProgressFile = path.join(dataDir, "live-creator-club-progress.json");
const creatorClubNamesFile = path.join(dataDir, "live-creator-club-names.json");
const coinWalletsFile = path.join(dataDir, "live-coin-wallets.json");
const coinTransactionsFile = path.join(dataDir, "live-coin-transactions.json");
const coinStateFile = path.join(dataDir, "live-coin-state.json");
const audienceHistoryFile = path.join(dataDir, "live-audience-history.json");
const likesFile = path.join(dataDir, "live-likes.json");
const joinRequestsFile = path.join(dataDir, "live-join-requests.json");
const battlesFile = path.join(dataDir, "live-battles.json");
const battleOffersFile = path.join(dataDir, "live-battle-offers.json");
const animationDir = path.resolve(import.meta.dirname, "..", "uploads", "live-animations");
const battleResultAnimationDir = path.resolve(import.meta.dirname, "..", "uploads", "live-battle-results");
const giftCoverDir = path.resolve(import.meta.dirname, "..", "uploads", "live-gift-covers");
const eventImageDir = path.resolve(import.meta.dirname, "..", "uploads", "live-events");
const arenaAssetDir = path.resolve(import.meta.dirname, "..", "uploads", "live-arena-assets");
const buttonAssetDir = path.resolve(import.meta.dirname, "..", "uploads", "live-button-assets");
const liveSignals = new Map<string, { offers: Map<string, string>; answers: Map<string, string>; guestOffers: Map<string, string>; guestAnswers: Map<string, string>; viewers: Set<string>; viewerUsers: Map<string, LiveGiftEvent["user"]>; lastSeen: Map<string, number> }>();

export type LiveStatus = "enabled" | "coming_soon" | "disabled";
type Animation = { id: string; name: string; url: string; mimeType: string; coverUrl?: string; coinValue?: number; transparencyMode: "auto" | "none" | "green" | "white"; edgeFade: "none" | "top-bottom"; published: boolean; createdAt: string };
type BattleResultAnimation = { id: string; name: string; outcome: "win" | "lose"; url: string; mimeType: string; transparencyMode: "auto" | "none" | "green" | "white"; edgeFade: "none" | "top-bottom"; published: boolean; createdAt: string };
type LiveEvent = { id: string; title: string; description: string; images: Array<{ id: string; url: string; mimeType: string }>; published: boolean; createdAt: string };
type ArenaAssetRole = "background" | "left-team" | "right-team" | "vs-emblem" | "score-bar" | "overlay";
type ArenaAsset = { id: string; name: string; role: ArenaAssetRole; url: string; mimeType: string; published: boolean; createdAt: string };
type ButtonAssetRole = "subscribe" | "guests" | "like" | "gift" | "share" | "comment" | "streak" | "ranking" | "collection" | "coin" | "general";
type ButtonAsset = { id: string; name: string; role: ButtonAssetRole; url: string; mimeType: string; published: boolean; createdAt: string };
type Broadcast = {
  id: string;
  title: string;
  content: string;
  type: "chat" | "game";
  startedAt: string;
  viewerCount: number;
  endedAt?: string;
  user: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
};
type LiveComment = {
  id: string;
  broadcastId: string;
  content: string;
  createdAt: string;
  user: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
  replyTo?: { id: string; username: string } | null;
};
type LiveGiftEvent = {
  id: string;
  broadcastId: string;
  giftId: string;
  giftName: string;
  coinValue?: number;
  createdAt: string;
  user: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
  recipient?: { id: number; username: string; displayName?: string | null; avatarUrl?: string | null };
};
type LiveSupporterProgress = {
  creatorId: number;
  supporter: LiveGiftEvent["user"];
  xp: number;
  updatedAt: string;
};
type LiveCreatorClubMember = {
  creatorId: number;
  user: LiveGiftEvent["user"];
  joinedAt: string;
};
type LiveCreatorClubName = {
  creatorId: number;
  name: string;
  updatedAt: string;
};
type LiveCreatorClubProgress = {
  creatorId: number;
  xp: number;
  updatedAt: string;
};
type LiveCoinWallet = { userId: number; balance: number; updatedAt: string };
type LiveCoinTransaction = {
  id: string;
  userId: number;
  type: "purchase" | "gift" | "test_purchase";
  amount: number;
  description: string;
  referenceId: string;
  createdAt: string;
};
type LiveCoinOrder = {
  id: string;
  userId: number;
  packageId: string;
  coins: number;
  amountTry: string;
  status: "pending" | "review" | "paid" | "failed";
  token?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
};
type LiveCoinState = {
  wallets: LiveCoinWallet[];
  transactions: LiveCoinTransaction[];
  orders: LiveCoinOrder[];
};
type LiveSupporterLevel = {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  progress: number;
};
type LiveLeagueProgress = {
  leagueIndex: number;
  stage: number;
  points: number;
  fragments: number;
  updatedAt: string;
};
type LiveLeagueState = {
  players: Record<string, LiveLeagueProgress>;
  processedPeriods: Record<string, number>;
};
const LIVE_LEAGUES = [
  { name: "Bronz", stages: 3, color: "#cd7f32" },
  { name: "Gümüş", stages: 3, color: "#c0c0c0" },
  { name: "Altın", stages: 4, color: "#d4af37" },
  { name: "Platin", stages: 5, color: "#aeb9c5" },
  { name: "Elmas", stages: 6, color: "#66d9ef" },
  { name: "Elit", stages: 6, color: "#c084fc" },
] as const;
const LEAGUE_POINTS_PER_STAGE = 3;
const LEAGUE_PERIOD_MS = 60 * 60 * 1000;
type LiveStats = {
  viewerCount: number;
  liveLikeCount: number;
  recipientCoinTotals: Record<number, number>;
  myWeeklyCoins?: number | null;
  hourlyRanking: Array<{ user: LiveGiftEvent["user"]; coins: number; league: ReturnType<typeof getLeagueProgress> }>;
  dailyRanking: Array<{ user: LiveGiftEvent["user"]; coins: number; league: ReturnType<typeof getLeagueProgress> }>;
  coinRanking: Array<{ user: LiveGiftEvent["user"]; coins: number; league: ReturnType<typeof getLeagueProgress> }>;
  liveSupporters: Array<{ user: LiveGiftEvent["user"]; coins: number; league?: ReturnType<typeof getLeagueProgress> }>;
  myLeague?: ReturnType<typeof getLeagueProgress>;
  collection: { collected: number; total: number; gifts: string[]; featuredGiftIds: string[] };
  activeAudience: Array<AudienceHistory>;
  audienceHistory: Array<AudienceHistory>;
  supporterHistory: Array<{ user: LiveGiftEvent["user"]; coins: number; firstSupportAt: string; lastSupportAt: string }>;
};
type AudienceHistory = {
  identity: string;
  viewerId: number;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  totalSeconds: number;
  firstJoinedAt: string;
  lastSeenAt: string;
  firstBroadcastId: string;
  lastBroadcastId: string;
  likeCount: number;
  firstBroadcastStartedAt?: string;
  firstBroadcastEndedAt?: string;
};
type LiveLike = { broadcastId: string; broadcasterId: number; user: LiveGiftEvent["user"]; createdAt: string };
type LiveJoinRequest = {
  id: string;
  broadcastId: string;
  user: LiveGiftEvent["user"];
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
};
type LivePkPaletteId = "classic" | "ember" | "grove" | "nebula" | "gold";
type LiveBattle = { broadcastId: string; opponentBroadcastId?: string; opponentUser?: LiveGiftEvent["user"]; matchId?: string; startedAt: string; endedAt?: string; durationSeconds: number; participantIds: number[]; teamAssignments?: Record<string, "red" | "blue">; paletteId?: LivePkPaletteId };
type LiveBattleOffer = { id: string; broadcastId: string; fromBroadcastId?: string; from: LiveGiftEvent["user"]; status: "pending" | "accepted" | "rejected"; createdAt: string };
const BATTLE_TEAM_PICK_SECONDS = 15;
const MAX_CHAT_GUESTS = 16;
const LIVE_PK_PALETTES = new Set<LivePkPaletteId>(["classic", "ember", "grove", "nebula", "gold"]);
const LIVE_COIN_PACKAGES = [
  { id: "starter", name: "Kıvılcım", coins: 100, bonus: 0, amountTry: "29.99", playProductId: "loop_coins_starter" },
  { id: "spark", name: "Işık", coins: 550, bonus: 50, amountTry: "149.99", playProductId: "loop_coins_spark" },
  { id: "orbit", name: "Yörünge", coins: 1200, bonus: 200, amountTry: "299.99", playProductId: "loop_coins_orbit" },
  { id: "galaxy", name: "Galaksi", coins: 3500, bonus: 500, amountTry: "799.99", playProductId: "loop_coins_galaxy" },
] as const;
const LIVE_PREMIUM_PRODUCT_ID = "loop_premium_monthly";
const LIVE_MEMBERSHIP_PACKAGES = [
  {
    id: "premium_writer",
    productId: "loop_premium_writer",
    name: "Premium Yazar",
    monthlyPriceTry: "249.90",
    annualPriceTry: "2498.00",
    benefits: ["Premium Yazar rozeti", "Premium Yazarlardan bölümünde görünme"],
  },
  {
    id: "blue_verified",
    productId: "loop_blue_verified",
    name: "Mavi Tik",
    monthlyPriceTry: "350.00",
    annualPriceTry: "3498.60",
    benefits: ["Onaylı mavi tik rozeti"],
  },
  {
    id: "gold_basic",
    productId: "loop_gold_basic",
    name: "Altın Tik Basic",
    monthlyPriceTry: "7499.90",
    annualPriceTry: "74969.00",
    benefits: [
      "Altın tik",
      "Resmi marka hesabı (yakında)",
      "Taklit hesaplar için öncelikli koruma (yakında)",
      "Marka adına özel profil bağlantısı (yakında)",
      "Genişletilmiş profil kapak alanı (yakında)",
      "2 yetkili hesap (yakında)",
    ],
  },
  {
    id: "gold_full",
    productId: "loop_gold_full",
    name: "Altın Tik Full",
    monthlyPriceTry: "35999.90",
    annualPriceTry: "359855.00",
    benefits: [
      "Altın tik",
      "Kurumsal profil (yakında)",
      "Gelişmiş taklit hesap koruması (yakında)",
      "Profil giriş animasyonu",
      "Özel reklam, duyuru veya etkinlik kartı (yakında)",
      "Kampanya raporları (yakında)",
      "Dışa aktarılabilir raporlar (yakında)",
      "Marka adına özel topluluk (yakında)",
      "15 yetkili kullanıcı (yakında)",
      "Öncelikli destek (yakında)",
      "Özel marka destek danışmanlığı (yakında)",
    ],
  },
] as const;
const LIVE_MEMBERSHIP_PLAN_IDS = ["monthly", "annual"] as const;
function getCoinState(): LiveCoinState {
  const savedState = readJson<LiveCoinState | null>(coinStateFile, null);
  if (savedState && Array.isArray(savedState.wallets) && Array.isArray(savedState.transactions) && Array.isArray(savedState.orders)) return savedState;
  return {
    wallets: readJson<LiveCoinWallet[]>(coinWalletsFile, []).map((wallet) => ({ ...wallet, balance: 0 })),
    transactions: [],
    orders: [],
  };
}
function saveCoinState(state: LiveCoinState) {
  const temporaryFile = `${coinStateFile}.${uuidv4()}.tmp`;
  writeJson(temporaryFile, state);
  fs.renameSync(temporaryFile, coinStateFile);
}
function getWallet(state: LiveCoinState, userId: number) {
  let wallet = state.wallets.find((item) => item.userId === userId);
  if (!wallet) {
    wallet = { userId, balance: 0, updatedAt: new Date().toISOString() };
    state.wallets.push(wallet);
  }
  return wallet;
}
function getIyzicoConfig() {
  const apiKey = process.env.IYZIPAY_API_KEY?.trim() ?? "";
  const secretKey = process.env.IYZIPAY_SECRET_KEY?.trim() ?? "";
  const uri = process.env.IYZIPAY_URI?.trim() || "https://api.iyzipay.com";
  const publicAppUrl = process.env.PUBLIC_APP_URL?.trim() ?? "";
  let callbackUrl = "";
  try {
    const url = new URL(publicAppUrl);
    if (url.protocol === "https:") {
      callbackUrl = process.env.IYZIPAY_CALLBACK_URL?.trim() || new URL("/api/live/coin-wallet/iyzico-callback", url.origin).toString();
      if (new URL(callbackUrl).protocol !== "https:") callbackUrl = "";
    }
  } catch {
    callbackUrl = "";
  }
  return {
    apiKey,
    secretKey,
    uri,
    callbackUrl,
    ready: Boolean(apiKey && secretKey && callbackUrl),
    testMode: uri.includes("sandbox"),
  };
}
function getIyzicoClient() {
  const config = getIyzicoConfig();
  if (!config.ready) throw new Error("iyzico ödeme ayarları henüz tamamlanmadı");
  return new Iyzipay({ apiKey: config.apiKey, secretKey: config.secretKey, uri: config.uri });
}
function initializeIyzicoCheckout(client: Iyzipay, request: CheckoutInitializeRequest) {
  return new Promise<CheckoutInitializeResponse>((resolve, reject) => {
    client.checkoutFormInitialize.create(request, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}
function retrieveIyzicoCheckout(order: LiveCoinOrder) {
  const client = getIyzicoClient();
  const token = order.token;
  if (!token) throw new Error("iyzico ödeme tokenı bulunamadı");
  return new Promise<CheckoutRetrieveResponse>((resolve, reject) => {
    client.checkoutForm.retrieve(
      { locale: Iyzipay.LOCALE.TR, conversationId: order.id, token },
      (error, response) => {
        if (error) reject(error);
        else resolve(response);
      },
    );
  });
}
function toMinorCurrencyUnits(value: string | number | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
function applyIyzicoResult(orderId: string, result: CheckoutRetrieveResponse) {
  const state = getCoinState();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return { status: "not_found" as const };
  if (order.status === "paid") return { status: "paid" as const, balance: getWallet(state, order.userId).balance };
  const expectedAmount = toMinorCurrencyUnits(order.amountTry);
  const paidAmount = toMinorCurrencyUnits(result.paidPrice);
  const basketAmount = toMinorCurrencyUnits(result.price);
  const verified = result.status === "success"
    && result.paymentStatus === "SUCCESS"
    && result.fraudStatus === 1
    && result.conversationId === order.id
    && result.currency === "TRY"
    && result.paymentId
    && expectedAmount !== null
    && paidAmount === expectedAmount
    && basketAmount === expectedAmount;
  if (verified) {
    const alreadyCredited = state.transactions.some((item) => item.type === "purchase" && item.referenceId === order.id);
    const wallet = getWallet(state, order.userId);
    if (!alreadyCredited) {
      wallet.balance += order.coins;
      wallet.updatedAt = new Date().toISOString();
      state.transactions.push({
        id: uuidv4(),
        userId: order.userId,
        type: "purchase",
        amount: order.coins,
        description: `${LIVE_COIN_PACKAGES.find((item) => item.id === order.packageId)?.name ?? "Loop"} coin paketi`,
        referenceId: order.id,
        createdAt: wallet.updatedAt,
      });
    }
    order.status = "paid";
    order.paymentId = result.paymentId;
    order.updatedAt = new Date().toISOString();
    saveCoinState(state);
    return { status: "paid" as const, balance: wallet.balance };
  }
  order.status = result.status === "success" && result.fraudStatus === 0 ? "review" : "failed";
  order.updatedAt = new Date().toISOString();
  saveCoinState(state);
  return { status: order.status };
}
function isLivePkPaletteId(value: unknown): value is LivePkPaletteId {
  return typeof value === "string" && LIVE_PK_PALETTES.has(value as LivePkPaletteId);
}
function getLiveSupporterLevel(xp: number): LiveSupporterLevel {
  const levelForXp = (level: number) => 100 * level * (level - 1) / 2;
  let level = 1;
  while (level < 100 && xp >= levelForXp(level + 1)) level += 1;
  const currentLevelXp = levelForXp(level);
  const nextLevelXp = level < 100 ? levelForXp(level + 1) : null;
  return {
    level,
    xp,
    currentLevelXp,
    nextLevelXp,
    progress: nextLevelXp === null ? 100 : Math.min(100, ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100),
  };
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as T; } catch { return fallback; }
}
function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}
function getLeagueProgress(userId: number, state = readJson<LiveLeagueState>(leagueProgressFile, { players: {}, processedPeriods: {} })) {
  const saved = state.players[String(userId)] ?? { leagueIndex: 0, stage: 1, points: 0, fragments: 0, updatedAt: new Date(0).toISOString() };
  const league = LIVE_LEAGUES[saved.leagueIndex] ?? LIVE_LEAGUES[0];
  const isEliteSix = saved.leagueIndex === LIVE_LEAGUES.length - 1 && saved.stage === league.stages;
  return {
    name: league.name,
    stage: saved.stage,
    stageCount: league.stages,
    points: saved.points,
    pointsPerStage: LEAGUE_POINTS_PER_STAGE,
    fragments: saved.fragments,
    fragmentCount: isEliteSix ? 3 : 0,
    label: isEliteSix ? `${league.name} ${saved.stage}/${league.stages} · ${saved.fragments}/3 parça` : `${league.name} ${saved.stage}/${league.stages} · ${saved.points}/${LEAGUE_POINTS_PER_STAGE} puan`,
  };
}
function changeLeagueProgress(state: LiveLeagueState, userId: number, change: 1 | -1, updatedAt: string) {
  const key = String(userId);
  const progress = state.players[key] ?? { leagueIndex: 0, stage: 1, points: 0, fragments: 0, updatedAt };
  const league = LIVE_LEAGUES[progress.leagueIndex]!;
  const isEliteSix = progress.leagueIndex === LIVE_LEAGUES.length - 1 && progress.stage === league.stages;
  if (isEliteSix) {
    progress.fragments = change > 0 ? Math.min(3, progress.fragments + 1) : Math.max(0, progress.fragments - 1);
    if (progress.fragments === 0 && change < 0) {
      progress.stage -= 1;
      progress.points = 0;
    }
  } else if (change > 0) {
    progress.points += 1;
    if (progress.points >= LEAGUE_POINTS_PER_STAGE) {
      progress.points = 0;
      if (progress.stage < league.stages) {
        progress.stage += 1;
        if (progress.leagueIndex === LIVE_LEAGUES.length - 1 && progress.stage === league.stages) progress.fragments = 3;
      } else if (progress.leagueIndex < LIVE_LEAGUES.length - 1) {
        progress.leagueIndex += 1;
        progress.stage = 1;
        progress.fragments = progress.leagueIndex === LIVE_LEAGUES.length - 1 ? 0 : 0;
      }
    }
  } else if (progress.points > 0) {
    progress.points -= 1;
  } else if (progress.stage > 1) {
    progress.stage -= 1;
    progress.points = LEAGUE_POINTS_PER_STAGE - 1;
  } else if (progress.leagueIndex > 0) {
    progress.leagueIndex -= 1;
    progress.stage = LIVE_LEAGUES[progress.leagueIndex]!.stages;
    progress.points = LEAGUE_POINTS_PER_STAGE - 1;
  }
  progress.updatedAt = updatedAt;
  state.players[key] = progress;
}
function processLeaguePeriods(broadcast: Broadcast, endAt: number | string = Date.now(), finalizePartialPeriod = false) {
  const state = readJson<LiveLeagueState>(leagueProgressFile, { players: {}, processedPeriods: {} });
  const startAt = Date.parse(broadcast.startedAt);
  const endedAt = typeof endAt === "number" ? endAt : Date.parse(endAt);
  if (!Number.isFinite(startAt) || !Number.isFinite(endedAt) || endedAt <= startAt) return state;
  const completePeriods = Math.floor((endedAt - startAt) / LEAGUE_PERIOD_MS);
  const lastPeriod = finalizePartialPeriod
    ? Math.ceil((endedAt - startAt) / LEAGUE_PERIOD_MS) - 1
    : completePeriods - 1;
  const lastProcessed = state.processedPeriods[broadcast.id] ?? -1;
  if (lastPeriod <= lastProcessed) return state;
  const gifts = readJson<LiveGiftEvent[]>(giftsFile, []).filter((gift) => gift.broadcastId === broadcast.id);
  for (let period = lastProcessed + 1; period <= lastPeriod; period += 1) {
    const periodStart = startAt + period * LEAGUE_PERIOD_MS;
    const periodEnd = periodStart + LEAGUE_PERIOD_MS;
    const totals = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
    for (const gift of gifts) {
      const createdAt = Date.parse(gift.createdAt);
      if (createdAt < periodStart || createdAt >= periodEnd) continue;
      const current = totals.get(gift.user.id) ?? { user: gift.user, coins: 0 };
      current.coins += gift.coinValue ?? 1;
      totals.set(gift.user.id, current);
    }
    const ranked = [...totals.entries()].sort((left, right) => right[1].coins - left[1].coins);
    if (ranked.length > 1) {
      const groupSize = Math.max(1, Math.ceil(ranked.length * 0.2));
      const processedAt = new Date(periodEnd).toISOString();
      ranked.slice(0, groupSize).forEach(([userId]) => changeLeagueProgress(state, userId, 1, processedAt));
      ranked.slice(-groupSize).forEach(([userId]) => changeLeagueProgress(state, userId, -1, processedAt));
    }
    state.processedPeriods[broadcast.id] = period;
  }
  writeJson(leagueProgressFile, state);
  return state;
}
function endBattlesForBroadcast(broadcastId: string) {
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const endedAt = new Date().toISOString();
  let changed = false;
  battles.forEach((battle) => {
    if (!battle.endedAt && (battle.broadcastId === broadcastId || battle.opponentBroadcastId === broadcastId)) {
      battle.endedAt = endedAt;
      changed = true;
    }
  });
  if (changed) writeJson(battlesFile, battles);
}
function adminOnly(req: any, res: any, next: any) {
  if (!req.user || !isPrivilegedUser(req.user)) return res.status(403).json({ error: "Yetersiz yetki" });
  next();
}
type StoredLiveSettings = {
  status?: LiveStatus;
  collectionGiftIds?: string[];
  collectionTotal?: number;
  restrictedMode?: boolean;
  allowedUserIds?: number[];
  membershipBadgeAssetIds?: Partial<Record<"premium_writer" | "blue_verified" | "gold", number>>;
};

function settings() {
  const stored = readJson<StoredLiveSettings>(settingsFile, { status: "coming_soon" });
  return {
    status: stored.status ?? "coming_soon",
    collectionGiftIds: Array.isArray(stored.collectionGiftIds) ? stored.collectionGiftIds : [],
    collectionTotal: typeof stored.collectionTotal === "number" && Number.isInteger(stored.collectionTotal)
      ? Math.min(30, Math.max(1, stored.collectionTotal))
      : 10,
    restrictedMode: stored.restrictedMode === true,
    allowedUserIds: Array.isArray(stored.allowedUserIds)
      ? [...new Set(stored.allowedUserIds.filter(id => Number.isSafeInteger(id) && id > 0))]
      : [],
    membershipBadgeAssetIds: stored.membershipBadgeAssetIds ?? {},
  };
}

function effectiveLiveStatus(userId?: number) {
  const liveSettings = settings();
  if (liveSettings.status !== "enabled") return liveSettings.status;
  if (liveSettings.restrictedMode && (!userId || !liveSettings.allowedUserIds.includes(userId))) {
    return "coming_soon";
  }
  return "enabled";
}

function canUseLive(userId?: number) {
  return effectiveLiveStatus(userId) === "enabled";
}

function pruneViewers(signal: ReturnType<typeof getSignal>) {
  const cutoff = Date.now() - 10_000;
  for (const [viewerId, lastSeen] of signal.lastSeen) {
    if (lastSeen < cutoff) {
      signal.lastSeen.delete(viewerId);
      signal.viewers.delete(viewerId);
    }
  }
}

function getSignal(broadcastId: string) {
  const signal = liveSignals.get(broadcastId) ?? { offers: new Map<string, string>(), answers: new Map<string, string>(), guestOffers: new Map<string, string>(), guestAnswers: new Map<string, string>(), viewers: new Set<string>(), viewerUsers: new Map<string, LiveGiftEvent["user"]>(), lastSeen: new Map<string, number>() };
  liveSignals.set(broadcastId, signal);
  return signal;
}

fs.mkdirSync(animationDir, { recursive: true });
fs.mkdirSync(battleResultAnimationDir, { recursive: true });
fs.mkdirSync(giftCoverDir, { recursive: true });
fs.mkdirSync(eventImageDir, { recursive: true });
fs.mkdirSync(arenaAssetDir, { recursive: true });
fs.mkdirSync(buttonAssetDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, animationDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".webm"}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("video/") || file.mimetype === "image/gif"),
});
const giftCoverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, giftCoverDir),
    filename: (_req, file, cb) => {
      const extension = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[file.mimetype] ?? ".jpg";
      cb(null, `${uuidv4()}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)),
});
const battleResultUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, battleResultAnimationDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".webm"}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("video/") || file.mimetype === "image/gif"),
});
const arenaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, arenaAssetDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".png"}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")),
});
const buttonUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, buttonAssetDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".png"}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")),
});
const liveEventUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, eventImageDir),
    filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase() || ".jpg"}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

router.get("/live/status", (req, res) => res.json({ status: effectiveLiveStatus(req.user?.id) }));
router.get("/live/subscription-packages", (_req, res) => {
  res.json({
    googlePlayReady: isGooglePlayBillingReady(),
    annualDiscountPercent: 16.7,
    packages: LIVE_MEMBERSHIP_PACKAGES.map((membership) => ({
      ...membership,
      plans: [
        { id: "monthly", interval: "month", referencePriceTry: membership.monthlyPriceTry },
        { id: "annual", interval: "year", referencePriceTry: membership.annualPriceTry, discountPercent: 16.7 },
      ],
    })),
  });
});
router.get("/live/membership-benefits/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    return res.status(400).json({ error: "Kullanıcı kimliği geçersiz." });
  }
  try {
    const activeProductIds = new Set(await getActiveGooglePlayProductIds(userId));
    const activeMemberships = LIVE_MEMBERSHIP_PACKAGES.filter((item) => activeProductIds.has(item.productId));
    const badgeMembership = ([
      "gold_full",
      "gold_basic",
      "blue_verified",
      "premium_writer",
    ] as const)
      .map((id) => activeMemberships.find((item) => item.id === id))
      .find(Boolean);
    const badgeAssetKey = badgeMembership?.id === "premium_writer"
      ? "premium_writer"
      : badgeMembership?.id === "blue_verified"
        ? "blue_verified"
        : badgeMembership ? "gold" : null;
    const badgeAssetId = badgeAssetKey ? settings().membershipBadgeAssetIds[badgeAssetKey] : undefined;
    const badgeAssetUrl = badgeAssetId
      ? (await db.execute(sql`SELECT image_url FROM badge_assets WHERE id = ${badgeAssetId} AND published = true LIMIT 1`)).rows[0]?.image_url ?? null
      : null;
    const isGoldMember = activeMemberships.some((item) => item.id === "gold_basic" || item.id === "gold_full");
    res.json({
      activeMemberships: activeMemberships.map(({ id, name, benefits }) => ({ id, name, benefits })),
      badge: badgeMembership?.id === "premium_writer" ? "writer" : badgeMembership ? "verified" : null,
      badgeLabel: badgeMembership?.name ?? null,
      badgeAssetUrl,
      isBrandMember: isGoldMember,
      canUseProfileIntroVideo: activeProductIds.has("loop_gold_full"),
      canCreateBrandedCommunity: activeProductIds.has("loop_gold_full"),
      authorizedAccountLimit: activeProductIds.has("loop_gold_full") ? 15 : isGoldMember ? 2 : 0,
    });
  } catch (error) {
    console.error("Membership benefits could not be loaded:", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ error: "Üyelik hakları yüklenemedi." });
  }
});
router.get("/live/subscriptions", requireAuth, async (req, res) => {
  try {
    await googlePlaySchemaReady;
    const result = await db.execute(sql`
      SELECT purchase_token, product_id, status, expires_at
      FROM google_play_purchases
      WHERE user_id = ${req.user!.id} AND purchase_type = 'subscription'
      ORDER BY updated_at DESC
    `);
    const records = result.rows as Array<{
      purchase_token: string;
      product_id: string;
      status: string;
      expires_at: Date | string | null;
    }>;
    const activeSubscriptions = [];
    for (const record of records) {
      const membership = LIVE_MEMBERSHIP_PACKAGES.find((item) => item.productId === record.product_id);
      if (!membership) continue;

      let status = record.status;
      let expiresAt = record.expires_at ? new Date(record.expires_at) : null;
      if (isGooglePlayBillingReady()) {
        try {
          const purchase = await getGoogleSubscriptionPurchase(record.purchase_token);
          const lineItem = purchase.lineItems?.find((item) => item.productId === membership.productId);
          expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
          const notExpired = expiresAt !== null && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
          const validState = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(purchase.subscriptionState ?? "");
          status = notExpired && validState ? "active" : "inactive";
          await db.execute(sql`
            UPDATE google_play_purchases
            SET status = ${status}, expires_at = ${expiresAt}, order_id = ${purchase.latestOrderId ?? null}, updated_at = now()
            WHERE purchase_token = ${record.purchase_token} AND user_id = ${req.user!.id}
          `);
        } catch (error) {
          console.error("Google Play membership refresh failed:", error instanceof Error ? error.message : "unknown error");
        }
      }

      const validExpiry = expiresAt !== null && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
      if (status === "active" && validExpiry) {
        activeSubscriptions.push({
          id: membership.id,
          productId: membership.productId,
          name: membership.name,
          expiresAt: expiresAt!.toISOString(),
        });
      }
    }

    res.json({
      googlePlayReady: isGooglePlayBillingReady(),
      activeSubscriptions,
    });
  } catch (error) {
    console.error("Google Play memberships could not be loaded:", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ error: "Abonelik bilgileri yüklenemedi." });
  }
});
router.post("/live/subscriptions/google-play/verify", requireAuth, async (req, res) => {
  if (isPrivilegedUser(req.user!)) {
    return res.status(403).json({ error: "Bu hesapta ücretli üyelik satın alımı devre dışıdır." });
  }
  if (!isGooglePlayBillingReady()) {
    return res.status(503).json({ error: "Google Play Billing sunucu ayarları henüz tamamlanmadı." });
  }

  const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
  const requestedPlanId = typeof req.body?.planId === "string" ? req.body.planId.trim() : "";
  const purchaseToken = typeof req.body?.purchaseToken === "string" ? req.body.purchaseToken.trim() : "";
  const membership = LIVE_MEMBERSHIP_PACKAGES.find((item) => item.productId === productId);
  if (!membership) return res.status(400).json({ error: "Google Play üyelik paketi tanınmıyor." });
  if (requestedPlanId && !(LIVE_MEMBERSHIP_PLAN_IDS as readonly string[]).includes(requestedPlanId)) {
    return res.status(400).json({ error: "Google Play abonelik dönemi geçersiz." });
  }
  if (!purchaseToken || purchaseToken.length > 4096) {
    return res.status(400).json({ error: "Google Play abonelik tokenı geçersiz." });
  }

  try {
    await googlePlaySchemaReady;
    const purchase = await getGoogleSubscriptionPurchase(purchaseToken);
    const lineItem = purchase.lineItems?.find((item) =>
      item.productId === membership.productId
      && (LIVE_MEMBERSHIP_PLAN_IDS as readonly string[]).includes(item.offerDetails?.basePlanId ?? "")
      && (!requestedPlanId || item.offerDetails?.basePlanId === requestedPlanId),
    );
    const planId = lineItem?.offerDetails?.basePlanId ?? "";
    const expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
    const isActive = expiresAt !== null
      && Number.isFinite(expiresAt.getTime())
      && expiresAt.getTime() > Date.now()
      && ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(purchase.subscriptionState ?? "");

    if (!isActive || purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== getGooglePlayAccountId(req.user!.id)) {
      return res.status(400).json({ error: "Abonelik doğrulanamadı veya bu Loop hesabına ait değil." });
    }

    const stored = await db.execute(sql`
      INSERT INTO google_play_purchases (purchase_token, user_id, product_id, purchase_type, status, order_id, expires_at)
      VALUES (${purchaseToken}, ${req.user!.id}, ${membership.productId}, 'subscription', 'active', ${purchase.latestOrderId ?? null}, ${expiresAt})
      ON CONFLICT (purchase_token) DO UPDATE
      SET status = 'active', order_id = EXCLUDED.order_id, expires_at = EXCLUDED.expires_at, updated_at = now()
      WHERE google_play_purchases.user_id = EXCLUDED.user_id
        AND google_play_purchases.product_id = EXCLUDED.product_id
        AND google_play_purchases.purchase_type = 'subscription'
      RETURNING user_id
    `);
    if (stored.rows.length === 0) {
      return res.status(409).json({ error: "Bu Google Play aboneliği başka bir hesapta kullanılıyor." });
    }

    let acknowledgementPending = false;
    if (purchase.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      try {
        await acknowledgeGoogleSubscription(membership.productId, purchaseToken);
      } catch (error) {
        acknowledgementPending = true;
        console.error("Google Play membership acknowledgement failed:", error instanceof Error ? error.message : "unknown error");
      }
    }
    res.json({
      status: "active",
      membership: membership.id,
      planId,
      expiresAt: expiresAt!.toISOString(),
      acknowledgementPending,
    });
  } catch (error) {
    console.error("Google Play membership verification failed:", error instanceof Error ? error.message : "unknown error");
    res.status(502).json({ error: "Google Play aboneliği şu anda doğrulanamadı. Lütfen daha sonra tekrar deneyin." });
  }
});
router.get("/live/animations", (_req, res) => res.json(readJson<Animation[]>(animationsFile, []).filter(item => item.published).map(item => ({ ...item, coverUrl: item.coverUrl ?? null, coinValue: item.coinValue ?? 1, transparencyMode: item.transparencyMode ?? "none", edgeFade: item.edgeFade ?? "top-bottom" }))));
router.get("/live/battle-result-animations", (_req, res) => res.json(readJson<BattleResultAnimation[]>(battleResultAnimationsFile, []).filter(item => item.published)));
router.get("/live/arena-assets", (_req, res) => res.json(readJson<ArenaAsset[]>(arenaAssetsFile, []).filter(item => item.published)));
router.get("/live/button-assets", (_req, res) => res.json(readJson<ButtonAsset[]>(buttonAssetsFile, []).filter(item => item.published)));
router.get("/live/events", (_req, res) => res.json(readJson<LiveEvent[]>(eventsFile, []).filter(item => item.published)));
router.get("/live/broadcasts", (req, res) => {
  res.json(canUseLive(req.user?.id) ? readJson<Broadcast[]>(broadcastsFile, []).filter(broadcast => !broadcast.endedAt) : []);
});
router.use("/live/broadcasts/:id", (req, res, next) => {
  const broadcast = readJson<Broadcast[]>(broadcastsFile, []).find(item => item.id === req.params.id);
  if (!broadcast) return next();
  if (req.method === "DELETE" && req.user?.id === broadcast.user.id) return next();
  if (!canUseLive(req.user?.id)) {
    return res.status(403).json({ error: "Canlı yayın yakında", status: effectiveLiveStatus(req.user?.id) });
  }
  next();
});
router.get("/live/broadcasts/:id/join-requests", (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []).filter((item) => item.broadcastId === broadcast.id);
  const participants = requests.filter((item) => item.status === "accepted").map((item) => item.user);
  if (!req.user) return res.json({ request: null, participants });
  if (broadcast.user.id === req.user.id) return res.json({ requests: requests.filter((item) => item.status === "pending"), participants });
  const request = requests.find((item) => item.user.id === req.user!.id);
  res.json({ request: request ?? null, participants: requests.filter((item) => item.status === "accepted").map((item) => item.user) });
});
router.post("/live/broadcasts/:id/join-requests", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id === req.user!.id) return res.status(400).json({ error: "Kendi yayınınıza katılamazsınız" });
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []);
  const existing = requests.find((item) => item.broadcastId === broadcast.id && item.user.id === req.user!.id);
  if (existing && existing.status === "accepted") return res.json(existing);
  const acceptedGuestCount = requests.filter((item) => item.broadcastId === broadcast.id && item.status === "accepted" && item.user.id !== broadcast.user.id).length;
  if (broadcast.type === "chat" && acceptedGuestCount >= MAX_CHAT_GUESTS) return res.status(409).json({ error: "Sohbet yayını konuk kapasitesi dolu" });
  const now = new Date().toISOString();
  const request: LiveJoinRequest = existing
    ? { ...existing, status: "pending", updatedAt: now }
    : {
        id: uuidv4(),
        broadcastId: broadcast.id,
        user: { id: req.user!.id, username: req.user!.username, displayName: req.user!.displayName, avatarUrl: req.user!.avatarUrl },
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
  writeJson(joinRequestsFile, [...requests.filter((item) => item.id !== request.id), request].slice(-10000));
  res.status(existing ? 200 : 201).json(request);
});
router.patch("/live/broadcasts/:id/join-requests/:requestId", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id !== req.user!.id) return res.status(403).json({ error: "Yalnızca yayıncı istekleri yönetebilir" });
  const status = req.body?.status === "accepted" ? "accepted" : req.body?.status === "rejected" ? "rejected" : null;
  if (!status) return res.status(400).json({ error: "Geçersiz istek durumu" });
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []);
  const request = requests.find((item) => item.id === req.params.requestId && item.broadcastId === broadcast.id);
  if (!request) return res.status(404).json({ error: "Katılma isteği bulunamadı" });
  if (status === "accepted" && broadcast.type === "chat") {
    const acceptedGuestCount = requests.filter((item) => item.broadcastId === broadcast.id && item.status === "accepted" && item.user.id !== broadcast.user.id).length;
    if (request.status !== "accepted" && acceptedGuestCount >= MAX_CHAT_GUESTS) return res.status(409).json({ error: "Sohbet yayını konuk kapasitesi dolu" });
  }
  request.status = status;
  request.updatedAt = new Date().toISOString();
  writeJson(joinRequestsFile, requests);
  res.json(request);
});
router.post("/live/broadcasts/:id/battle", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id !== req.user!.id) return res.status(403).json({ error: "Yalnızca yayıncı Kapışma başlatabilir" });
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []).filter((item) => item.broadcastId === broadcast.id && item.status === "accepted");
  const participantIds = requests.map((item) => item.user.id).filter((id) => id !== broadcast.user.id).slice(0, 5);
  if (participantIds.length < 1) return res.status(400).json({ error: "Kapışma için en az bir konuk gerekli" });
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const now = Date.now();
  if (battles.some((item) => item.broadcastId === broadcast.id && !item.endedAt && now - Date.parse(item.startedAt) < item.durationSeconds * 1000)) {
    return res.status(409).json({ error: "Bu yayında zaten aktif bir Kapışma var" });
  }
  const teamAssignments: Record<string, "red" | "blue"> = { [String(broadcast.user.id)]: "red" };
  participantIds.forEach((id) => { teamAssignments[String(id)] = "blue"; });
  const battle: LiveBattle = { broadcastId: broadcast.id, matchId: uuidv4(), startedAt: new Date(Date.now() + BATTLE_TEAM_PICK_SECONDS * 1000).toISOString(), durationSeconds: 180, participantIds, teamAssignments };
  writeJson(battlesFile, [...battles.filter((item) => item.broadcastId !== broadcast.id), battle]);
  res.status(201).json(battle);
});
router.post("/live/broadcasts/:id/battle/team", requireAuth, (req, res) => {
  const broadcast = readJson<Broadcast[]>(broadcastsFile, []).find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const battle = battles.find((item) => item.broadcastId === broadcast.id && !item.endedAt && Date.now() - Date.parse(item.startedAt) < item.durationSeconds * 1000);
  if (!battle) return res.status(404).json({ error: "Aktif takım Kapışması bulunamadı" });
  if (Date.now() >= Date.parse(battle.startedAt)) return res.status(409).json({ error: "Takım seçme süresi sona erdi" });
  const userId = req.user!.id;
  if (broadcast.user.id !== userId && !battle.participantIds.includes(userId)) return res.status(403).json({ error: "Yalnızca Kapışma katılımcıları takım seçebilir" });
  const team = req.body?.team;
  if (team !== "red" && team !== "blue") return res.status(400).json({ error: "Takım kırmızı veya mavi olmalı" });
  const updatedAssignments = { ...(battle.teamAssignments ?? {}), [String(userId)]: team };
  for (const item of battles) {
    if (battle.matchId ? item.matchId === battle.matchId : item.broadcastId === battle.broadcastId) {
      item.teamAssignments = updatedAssignments;
    }
  }
  writeJson(battlesFile, battles);
  res.json({ success: true, teamAssignments: updatedAssignments });
});
router.post("/live/broadcasts/:id/battle/palette", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const battle = battles.find((item) => item.broadcastId === broadcast.id && !item.endedAt && Date.now() - Date.parse(item.startedAt) < item.durationSeconds * 1000);
  if (!battle) return res.status(404).json({ error: "Aktif Kapışma bulunamadı" });
  if (Date.now() >= Date.parse(battle.startedAt)) return res.status(409).json({ error: "Renk paleti yalnızca takım seçimi sırasında değiştirilebilir" });
  const userId = req.user!.id;
  const isBroadcaster = [battle.broadcastId, battle.opponentBroadcastId]
    .filter((broadcastId): broadcastId is string => Boolean(broadcastId))
    .some((broadcastId) => broadcasts.find((item) => item.id === broadcastId)?.user.id === userId);
  if (!isBroadcaster) return res.status(403).json({ error: "Renk paletini yalnızca yayıncılar değiştirebilir" });
  const paletteId: unknown = req.body?.paletteId;
  if (!isLivePkPaletteId(paletteId)) {
    return res.status(400).json({ error: "Geçersiz renk paleti" });
  }
  for (const item of battles) {
    if (battle.matchId ? item.matchId === battle.matchId : item.broadcastId === battle.broadcastId) {
      item.paletteId = paletteId;
    }
  }
  writeJson(battlesFile, battles);
  res.json({ success: true, paletteId });
});
router.post("/live/broadcasts/:id/battle/offers", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const targetBroadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!targetBroadcast) return res.status(404).json({ error: "Hedef yayın bulunamadı" });
  const sourceBroadcast = broadcasts.find((item) => item.user.id === req.user!.id);
  if (!sourceBroadcast) return res.status(403).json({ error: "Kapışma daveti için kendi canlı yayınınız açık olmalı" });
  if (sourceBroadcast.id === targetBroadcast.id) return res.status(400).json({ error: "Kendi yayınınıza Kapışma daveti gönderemezsiniz" });
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const now = Date.now();
  if (battles.some((item) => [item.broadcastId, item.opponentBroadcastId].includes(sourceBroadcast.id) || [item.broadcastId, item.opponentBroadcastId].includes(targetBroadcast.id) ? !item.endedAt && now - Date.parse(item.startedAt) < item.durationSeconds * 1000 : false)) {
    return res.status(409).json({ error: "Taraflardan biri zaten aktif bir Kapışma içinde" });
  }
  const offers = readJson<LiveBattleOffer[]>(battleOffersFile, []);
  const existing = offers.find((item) => item.broadcastId === targetBroadcast.id && item.fromBroadcastId === sourceBroadcast.id && item.status === "pending");
  if (existing) return res.json(existing);
  const offer: LiveBattleOffer = { id: uuidv4(), broadcastId: targetBroadcast.id, fromBroadcastId: sourceBroadcast.id, from: { id: req.user!.id, username: req.user!.username, displayName: req.user!.displayName, avatarUrl: req.user!.avatarUrl }, status: "pending", createdAt: new Date().toISOString() };
  writeJson(battleOffersFile, [...offers, offer].slice(-10000));
  res.status(201).json(offer);
});
router.post("/live/broadcasts/:id/battle/offers/:offerId/accept", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id !== req.user!.id) return res.status(403).json({ error: "Yalnızca yayıncı teklifi kabul edebilir" });
  const offers = readJson<LiveBattleOffer[]>(battleOffersFile, []);
  const offer = offers.find((item) => item.id === req.params.offerId && item.broadcastId === broadcast.id && item.status === "pending");
  if (!offer) return res.status(404).json({ error: "Kapışma teklifi bulunamadı" });
  offer.status = "accepted";
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const sourceBroadcast = offer.fromBroadcastId ? broadcasts.find((item) => item.id === offer.fromBroadcastId && item.user.id === offer.from.id) : undefined;
  if (offer.fromBroadcastId && !sourceBroadcast) return res.status(409).json({ error: "Davet gönderen yayın artık yayında değil" });
  const now = Date.now();
  const involvedBroadcastIds = [broadcast.id, sourceBroadcast?.id].filter((id): id is string => Boolean(id));
  if (battles.some((item) => involvedBroadcastIds.includes(item.broadcastId) && !item.endedAt && now - Date.parse(item.startedAt) < item.durationSeconds * 1000)) {
    return res.status(409).json({ error: "Taraflardan biri zaten aktif bir Kapışmada" });
  }
  const startedAt = new Date(Date.now() + BATTLE_TEAM_PICK_SECONDS * 1000).toISOString();
  const matchId = uuidv4();
  const teamAssignments: Record<string, "red" | "blue"> = {
    [String(broadcast.user.id)]: "red",
    [String(offer.from.id)]: "blue",
  };
  const battle: LiveBattle = sourceBroadcast
    ? { broadcastId: broadcast.id, opponentBroadcastId: sourceBroadcast.id, opponentUser: sourceBroadcast.user, matchId, startedAt, durationSeconds: 180, participantIds: [broadcast.user.id, sourceBroadcast.user.id], teamAssignments }
    : { broadcastId: broadcast.id, startedAt, durationSeconds: 180, participantIds: [offer.from.id], teamAssignments };
  writeJson(battleOffersFile, offers);
  const nextBattles = battles.filter((item) => !involvedBroadcastIds.includes(item.broadcastId));
  if (sourceBroadcast) {
    nextBattles.push({ broadcastId: sourceBroadcast.id, opponentBroadcastId: broadcast.id, opponentUser: broadcast.user, matchId, startedAt, durationSeconds: 180, participantIds: [sourceBroadcast.user.id, broadcast.user.id], teamAssignments });
  }
  nextBattles.push(battle);
  writeJson(battlesFile, nextBattles);
  res.status(201).json(battle);
});
router.post("/live/broadcasts/:id/battle/offers/:offerId/reject", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id !== req.user!.id) return res.status(403).json({ error: "Yalnızca yayıncı teklifi reddedebilir" });
  const offers = readJson<LiveBattleOffer[]>(battleOffersFile, []);
  const offer = offers.find((item) => item.id === req.params.offerId && item.broadcastId === broadcast.id && item.status === "pending");
  if (!offer) return res.status(404).json({ error: "Battle teklifi bulunamadı" });
  offer.status = "rejected";
  writeJson(battleOffersFile, offers);
  res.json({ success: true, offer });
});
router.get("/live/broadcasts/:id/battle", (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const battle = readJson<LiveBattle[]>(battlesFile, []).find((item) => item.broadcastId === broadcast.id);
  const offers = readJson<LiveBattleOffer[]>(battleOffersFile, []).filter((item) => item.broadcastId === broadcast.id && item.status === "pending");
  const isBroadcaster = req.user?.id === broadcast.user.id;
  const myOffer = req.user ? readJson<LiveBattleOffer[]>(battleOffersFile, []).find((item) => item.broadcastId === broadcast.id && item.from.id === req.user!.id && item.status === "pending") ?? null : null;
  if (!battle) return res.json({ active: false, offers: isBroadcaster ? offers : [], myOffer });
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []);
  const opponentBroadcast = battle.opponentBroadcastId ? broadcasts.find((item) => item.id === battle.opponentBroadcastId) : undefined;
  const opponentUser = opponentBroadcast?.user ?? battle.opponentUser;
  const users: LiveGiftEvent["user"][] = opponentUser
    ? [broadcast.user, opponentUser]
    : [broadcast.user, ...battle.participantIds.map((id) => requests.find((item) => item.broadcastId === broadcast.id && item.user.id === id)?.user).filter((participant): participant is LiveGiftEvent["user"] => Boolean(participant))];
  const relatedBroadcastIds = battle.opponentBroadcastId ? [broadcast.id, battle.opponentBroadcastId] : [broadcast.id];
  const matchStartedAt = Date.parse(battle.startedAt);
  const scoreEndsAt = Math.min(battle.endedAt ? Date.parse(battle.endedAt) : Date.now(), matchStartedAt + battle.durationSeconds * 1000);
  const gifts = readJson<LiveGiftEvent[]>(giftsFile, []).filter((item) => relatedBroadcastIds.includes(item.broadcastId) && Date.parse(item.createdAt) >= matchStartedAt && Date.parse(item.createdAt) <= scoreEndsAt);
  const scores = users.map((user) => {
    const supporters = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
    const teamGifts = gifts.filter((gift) => gift.recipient?.id === user.id);
    for (const gift of teamGifts) {
      const supporter = supporters.get(gift.user.id) ?? { user: gift.user, coins: 0 };
      supporter.coins += gift.coinValue ?? 1;
      supporters.set(gift.user.id, supporter);
    }
    return {
      user,
      score: teamGifts.reduce((total, gift) => total + (gift.coinValue ?? 1), 0),
      team: battle.teamAssignments?.[String(user.id)] ?? (user.id === broadcast.user.id ? "red" : "blue"),
      supporters: [...supporters.values()].sort((left, right) => right.coins - left.coins).slice(0, 3),
    };
  });
  const elapsed = Math.floor((Date.now() - Date.parse(battle.startedAt)) / 1000);
  const preparing = !battle.endedAt && Date.now() < matchStartedAt;
  const active = !battle.endedAt && elapsed < battle.durationSeconds;
  const elapsedSeconds = battle.endedAt ? battle.durationSeconds : Math.max(0, Math.min(battle.durationSeconds, elapsed));
  const remainingSeconds = active ? Math.max(0, battle.durationSeconds - elapsed) : 0;
  const preparationSecondsRemaining = preparing ? Math.max(0, Math.ceil((matchStartedAt - Date.now()) / 1000)) : 0;
  const redScore = scores.filter((entry) => entry.team === "red").reduce((total, entry) => total + entry.score, 0);
  const blueScore = scores.filter((entry) => entry.team === "blue").reduce((total, entry) => total + entry.score, 0);
  const teamBattle = Boolean(battle.teamAssignments);
  const isDraw = !active && (teamBattle ? redScore === blueScore : scores.length > 1 && scores.every((entry) => entry.score === scores[0]!.score));
  const winnerTeam = teamBattle && !active && !isDraw ? (redScore > blueScore ? "red" : "blue") : undefined;
  const winner = !active && !isDraw
    ? (winnerTeam ? scores.find((entry) => entry.team === winnerTeam)?.user ?? null : scores.reduce((leader, entry) => entry.score > leader.score ? entry : leader, scores[0]!).user)
    : null;
  res.json({ active, preparing, preparationSecondsRemaining, matchId: battle.matchId, opponentBroadcastId: opponentBroadcast?.id, startedAt: battle.startedAt, durationSeconds: battle.durationSeconds, elapsedSeconds, remainingSeconds, winner, winnerTeam, isDraw, teamAssignments: battle.teamAssignments, paletteId: battle.paletteId ?? "classic", scores, offers: isBroadcaster ? offers : [], myOffer });
});
router.post("/live/broadcasts/:id/battle/end", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const battles = readJson<LiveBattle[]>(battlesFile, []);
  const battle = battles.find((item) => item.broadcastId === broadcast.id && !item.endedAt && Date.now() - Date.parse(item.startedAt) < item.durationSeconds * 1000);
  if (!battle) return res.status(404).json({ error: "Aktif Kapışma bulunamadı" });
  if (broadcast.user.id !== req.user!.id && !battle.participantIds.includes(req.user!.id)) return res.status(403).json({ error: "Bu Kapışmayı yalnızca yarışmacılar kapatabilir" });
  const endedAt = new Date().toISOString();
  for (const item of battles) {
    if (battle.matchId ? item.matchId === battle.matchId : item.broadcastId === battle.broadcastId) item.endedAt = endedAt;
  }
  writeJson(battlesFile, battles);
  res.json({ success: true, endedAt, matchId: battle.matchId });
});
router.post("/live/broadcasts", requireAuth, (req, res) => {
  if (!canUseLive(req.user!.id)) {
    res.status(403).json({ error: "Canlı yayın yakında", status: effectiveLiveStatus(req.user!.id) });
    return;
  }
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const user = req.user!;
  const existing = broadcasts.find(item => item.user.id === user.id);
  if (existing) {
    endBattlesForBroadcast(existing.id);
    processLeaguePeriods(existing, Date.now(), true);
    const archive = readJson<Broadcast[]>(broadcastArchiveFile, []);
    archive.push({ ...existing, endedAt: existing.endedAt ?? new Date().toISOString() });
    writeJson(broadcastArchiveFile, archive.slice(-10000));
  }
  const broadcast: Broadcast = {
    id: uuidv4(),
    title: String(req.body?.title || "Canlı yayın").trim().slice(0, 120),
    content: String(req.body?.content || "Canlı yayına başladım.").trim().slice(0, 500),
    type: req.body?.type === "game" ? "game" : "chat",
    startedAt: new Date().toISOString(),
    viewerCount: existing?.viewerCount ?? 0,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  };
  writeJson(broadcastsFile, [broadcast, ...broadcasts.filter(item => item.user.id !== user.id)]);
  liveSignals.set(broadcast.id, { offers: new Map<string, string>(), answers: new Map<string, string>(), guestOffers: new Map<string, string>(), guestAnswers: new Map<string, string>(), viewers: new Set<string>(), viewerUsers: new Map<string, LiveGiftEvent["user"]>(), lastSeen: new Map<string, number>() });
  res.status(201).json(broadcast);
});
router.delete("/live/broadcasts/:id", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find(item => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  if (broadcast.user.id !== req.user!.id) return res.status(403).json({ error: "Bu yayını kapatamazsınız" });
  endBattlesForBroadcast(broadcast.id);
  const endedAt = new Date().toISOString();
  processLeaguePeriods(broadcast, endedAt, true);
  const archive = readJson<Broadcast[]>(broadcastArchiveFile, []);
  archive.push({ ...broadcast, endedAt });
  writeJson(broadcastArchiveFile, archive.slice(-10000));
  writeJson(broadcastsFile, broadcasts.filter(item => item.id !== broadcast.id));
  liveSignals.delete(broadcast.id);
  res.json({ success: true });
});
router.get("/live/broadcasts/:id/signal", (_req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  if (!broadcasts.some((item) => item.id === _req.params.id)) return res.status(404).json({ error: "Yayın bulunamadı" });
  const signal = getSignal(_req.params.id);
  pruneViewers(signal);
  if (_req.query.role === "broadcaster") return res.json({ viewers: [...signal.viewers], viewerUsers: Object.fromEntries(signal.viewerUsers), answers: Object.fromEntries(signal.answers), guestOffers: Object.fromEntries(signal.guestOffers), guestAnswers: Object.fromEntries(signal.guestAnswers) });
  const viewerId = String(_req.query.viewerId || "");
  if (!viewerId) return res.status(400).json({ error: "viewerId gerekli" });
  signal.viewers.add(viewerId);
  signal.lastSeen.set(viewerId, Date.now());
  if (_req.user) signal.viewerUsers.set(viewerId, { id: _req.user.id, username: _req.user.username, displayName: _req.user.displayName, avatarUrl: _req.user.avatarUrl });
  const broadcast = broadcasts.find((item) => item.id === _req.params.id);
  const currentUser = _req.user;
  const identity = currentUser ? `user:${currentUser.id}` : `viewer:${viewerId}`;
  if (broadcast) {
    const history = readJson<AudienceHistory[]>(audienceHistoryFile, []);
    const now = new Date().toISOString();
    const item = history.find((entry) => entry.identity === identity && entry.lastBroadcastId === broadcast.id);
    if (item) {
      const elapsed = Math.min(15, Math.max(0, (Date.now() - Date.parse(item.lastSeenAt)) / 1000));
      item.totalSeconds += elapsed;
      item.lastSeenAt = now;
    } else {
      history.push({ identity, viewerId: currentUser?.id ?? 0, username: currentUser?.username ?? "ziyaretçi", displayName: currentUser?.displayName, avatarUrl: currentUser?.avatarUrl, totalSeconds: 0, firstJoinedAt: now, lastSeenAt: now, firstBroadcastId: broadcast.id, lastBroadcastId: broadcast.id, likeCount: 0, firstBroadcastStartedAt: broadcast.startedAt });
    }
    writeJson(audienceHistoryFile, history.slice(-10000));
  }
  res.json({ offer: signal.offers.get(viewerId) ?? null, guestAnswer: signal.guestAnswers.get(viewerId) ?? null });
});
router.post("/live/broadcasts/:id/signal", (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find(item => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const role = req.body?.role;
  const description = String(req.body?.description || "");
  if (!description || !["offer", "answer", "guest-offer", "guest-answer"].includes(role)) return res.status(400).json({ error: "Geçersiz yayın sinyali" });
  const signal = getSignal(broadcast.id);
  const viewerId = String(req.body?.viewerId || "");
  if (!viewerId) return res.status(400).json({ error: "viewerId gerekli" });
  if (role === "offer") {
    if (!req.user || broadcast.user.id !== req.user.id) return res.status(403).json({ error: "Yalnızca yayıncı teklif gönderebilir" });
    signal.offers.set(viewerId, description);
  } else if (role === "answer") {
    signal.answers.set(viewerId, description);
  } else if (role === "guest-offer") {
    signal.guestOffers.set(viewerId, description);
  } else {
    if (!req.user || broadcast.user.id !== req.user.id) return res.status(403).json({ error: "Yalnızca yayıncı konuk cevabı gönderebilir" });
    signal.guestAnswers.set(viewerId, description);
  }
  liveSignals.set(broadcast.id, signal);
  res.status(201).json({ success: true });
});
router.get("/live/broadcasts/:id/comments", (req, res) => {
  const comments = readJson<LiveComment[]>(commentsFile, []);
  res.json(comments.filter(comment => comment.broadcastId === req.params.id));
});
router.post("/live/broadcasts/:id/comments", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  if (!broadcasts.some(broadcast => broadcast.id === req.params.id)) return res.status(404).json({ error: "Yayın bulunamadı" });
  const content = String(req.body?.content || "").trim().slice(0, 500);
  if (!content) return res.status(400).json({ error: "Yorum boş olamaz" });
  const replyToId = String(req.body?.replyToId || "").trim();
  const user = req.user!;
  const comments = readJson<LiveComment[]>(commentsFile, []);
  const replyTo = replyToId
    ? comments.find((comment) => comment.id === replyToId && comment.broadcastId === req.params.id)
    : undefined;
  if (replyToId && !replyTo) return res.status(400).json({ error: "Yanıtlanacak yorum bulunamadı" });
  const comment: LiveComment = {
    id: uuidv4(),
    broadcastId: req.params.id,
    content,
    createdAt: new Date().toISOString(),
    user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
    replyTo: replyTo ? { id: replyTo.id, username: replyTo.user.username } : null,
  };
  writeJson(commentsFile, [...comments, comment].slice(-5000));
  res.status(201).json(comment);
});

router.get("/live/coin-wallet", requireAuth, (req, res) => {
  const config = getIyzicoConfig();
  const demoGiftMode = process.env.NODE_ENV !== "production";
  if (isPrivilegedUser(req.user!)) {
    return res.json({ balance: null, currency: "LOOP_COIN", paymentExempt: true, demoGiftMode, paymentReady: false, googlePlayReady: false, testMode: false, packages: [], transactions: [] });
  }
  const state = getCoinState();
  const wallet = getWallet(state, req.user!.id);
  saveCoinState(state);
  const transactions = state.transactions
    .filter((item) => item.userId === req.user!.id)
    .slice(-20)
    .reverse();
  const packages = LIVE_COIN_PACKAGES.map(({ id, name, coins, bonus, amountTry, playProductId }) => ({
    id,
    name,
    coins,
    bonus,
    amountTry,
    playProductId,
    currency: "TRY",
  }));
  return res.json({
    balance: wallet.balance,
    currency: "LOOP_COIN",
    paymentExempt: false,
    demoGiftMode,
    paymentReady: config.ready,
    googlePlayReady: isGooglePlayBillingReady(),
    testMode: config.testMode,
    packages,
    transactions,
  });
});
router.post("/live/coin-wallet/google-play/verify", requireAuth, async (req, res) => {
  if (isPrivilegedUser(req.user!)) return res.status(403).json({ error: "Yönetici hesaplarında coin satın alma devre dışıdır" });
  if (!isGooglePlayBillingReady()) return res.status(503).json({ error: "Google Play Billing sunucu ayarları henüz tamamlanmadı" });
  const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
  const purchaseToken = typeof req.body?.purchaseToken === "string" ? req.body.purchaseToken.trim() : "";
  const packageInfo = LIVE_COIN_PACKAGES.find((item) => item.playProductId === productId);
  if (!packageInfo) return res.status(400).json({ error: "Google Play coin ürünü tanınmıyor" });
  if (!purchaseToken || purchaseToken.length > 4096) return res.status(400).json({ error: "Google Play satın alma tokenı geçersiz" });

  try {
    await googlePlaySchemaReady;
    const purchase = await getGoogleProductPurchase(productId, purchaseToken);
    if (purchase.purchaseState !== 0
      || (purchase.productId && purchase.productId !== productId)
      || (purchase.purchaseToken && purchase.purchaseToken !== purchaseToken)
      || (purchase.quantity !== undefined && purchase.quantity !== 1)
      || purchase.obfuscatedExternalAccountId !== getGooglePlayAccountId(req.user!.id)) {
      return res.status(400).json({ error: "Google Play satın alması doğrulanamadı veya bu hesaba ait değil" });
    }
    if (purchase.consumptionState === 1) {
      const saved = await db.execute(sql`
        SELECT user_id, product_id, purchase_type
        FROM google_play_purchases
        WHERE purchase_token = ${purchaseToken}
        LIMIT 1
      `);
      const previous = saved.rows[0] as { user_id: number; product_id: string; purchase_type: string } | undefined;
      if (!previous || previous.user_id !== req.user!.id || previous.product_id !== productId || previous.purchase_type !== "coin_pack") {
        return res.status(409).json({ error: "Bu Google Play satın alması daha önce kullanılmış" });
      }
    }

    const credit = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(74261, ${req.user!.id})`);
      const priorRows = await tx.execute(sql`
        SELECT user_id, product_id, purchase_type
        FROM google_play_purchases
        WHERE purchase_token = ${purchaseToken}
        LIMIT 1
      `);
      const prior = priorRows.rows[0] as { user_id: number; product_id: string; purchase_type: string } | undefined;
      if (prior && (prior.user_id !== req.user!.id || prior.product_id !== productId || prior.purchase_type !== "coin_pack")) {
        return { conflict: true as const };
      }

      const state = getCoinState();
      const wallet = getWallet(state, req.user!.id);
      const referenceId = getGooglePlayPurchaseReferenceId(purchaseToken);
      const alreadyCredited = state.transactions.some((item) =>
        item.type === "purchase" && item.referenceId === referenceId && item.userId === req.user!.id,
      );
      if (!prior && !alreadyCredited) {
        const amount = packageInfo.coins + packageInfo.bonus;
        wallet.balance += amount;
        wallet.updatedAt = new Date().toISOString();
        state.transactions.push({
          id: uuidv4(),
          userId: req.user!.id,
          type: "purchase",
          amount,
          description: `${packageInfo.name} Google Play coin paketi`,
          referenceId,
          createdAt: wallet.updatedAt,
        });
      }
      saveCoinState(state);
      await tx.execute(sql`
        INSERT INTO google_play_purchases (purchase_token, user_id, product_id, purchase_type, status, order_id)
        VALUES (${purchaseToken}, ${req.user!.id}, ${productId}, 'coin_pack', 'credited', ${purchase.orderId ?? null})
        ON CONFLICT (purchase_token) DO NOTHING
      `);
      return { conflict: false as const, balance: wallet.balance };
    });
    if (credit.conflict) return res.status(409).json({ error: "Bu Google Play satın alması başka bir hesapta kullanılmış" });

    let finalizationPending = false;
    if (purchase.consumptionState !== 1) {
      try {
        await consumeGoogleProductPurchase(productId, purchaseToken);
      } catch (error) {
        finalizationPending = true;
        console.error("Google Play coin purchase consumption failed:", error instanceof Error ? error.message : "unknown error");
      }
    }
    return res.json({ status: "paid", balance: credit.balance, finalizationPending });
  } catch (error) {
    console.error("Google Play coin purchase verification failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Google Play satın alması şu anda doğrulanamadı. Lütfen biraz sonra tekrar dene." });
  }
});
router.get("/live/premium", requireAuth, async (req, res) => {
  if (!isGooglePlayBillingReady()) return res.status(503).json({ error: "Google Play Billing sunucu ayarları henüz tamamlanmadı" });
  try {
    await googlePlaySchemaReady;
    const rows = await db.execute(sql`
      SELECT purchase_token, product_id
      FROM google_play_purchases
      WHERE user_id = ${req.user!.id} AND purchase_type = 'subscription'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const subscription = rows.rows[0] as { purchase_token: string; product_id: string } | undefined;
    if (!subscription) return res.json({ productId: LIVE_PREMIUM_PRODUCT_ID, active: false, expiresAt: null, status: "not_purchased" });

    const purchase = await getGoogleSubscriptionPurchase(subscription.purchase_token);
    const lineItem = purchase.lineItems?.find((item) => item.productId === LIVE_PREMIUM_PRODUCT_ID);
    if (purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== getGooglePlayAccountId(req.user!.id)) {
      return res.status(409).json({ error: "Premium aboneliği bu hesaba bağlı değil" });
    }
    const expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
    const remainsActive = expiresAt !== null && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
    const state = purchase.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
    const active = remainsActive && ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(state);
    const status = active ? (state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ? "in_grace_period" : "active") : "inactive";
    await db.execute(sql`
      UPDATE google_play_purchases
      SET status = ${status}, expires_at = ${expiresAt}, order_id = ${purchase.latestOrderId ?? null}, updated_at = now()
      WHERE purchase_token = ${subscription.purchase_token} AND user_id = ${req.user!.id}
    `);
    return res.json({
      productId: LIVE_PREMIUM_PRODUCT_ID,
      active,
      expiresAt: expiresAt?.toISOString() ?? null,
      status,
    });
  } catch (error) {
    console.error("Google Play Premium entitlement refresh failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Premium abonelik durumu Google Play'den doğrulanamadı" });
  }
});
router.post("/live/premium/google-play/verify", requireAuth, async (req, res) => {
  if (!isGooglePlayBillingReady()) return res.status(503).json({ error: "Google Play Billing sunucu ayarları henüz tamamlanmadı" });
  const productId = typeof req.body?.productId === "string" ? req.body.productId.trim() : "";
  const purchaseToken = typeof req.body?.purchaseToken === "string" ? req.body.purchaseToken.trim() : "";
  if (productId !== LIVE_PREMIUM_PRODUCT_ID) return res.status(400).json({ error: "Premium abonelik ürünü tanınmıyor" });
  if (!purchaseToken || purchaseToken.length > 4096) return res.status(400).json({ error: "Google Play abonelik tokenı geçersiz" });

  try {
    await googlePlaySchemaReady;
    const purchase = await getGoogleSubscriptionPurchase(purchaseToken);
    const lineItem = purchase.lineItems?.find((item) => item.productId === LIVE_PREMIUM_PRODUCT_ID);
    const expiresAt = lineItem?.expiryTime ? new Date(lineItem.expiryTime) : null;
    const remainsActive = expiresAt !== null && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
    const subscriptionState = purchase.subscriptionState ?? "";
    const active = remainsActive && ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(subscriptionState);
    if (!active || purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId !== getGooglePlayAccountId(req.user!.id)) {
      return res.status(400).json({ error: "Google Play Premium aboneliği doğrulanamadı veya bu hesaba ait değil" });
    }

    const stored = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(74261, ${req.user!.id})`);
      const result = await tx.execute(sql`
        INSERT INTO google_play_purchases
          (purchase_token, user_id, product_id, purchase_type, status, order_id, expires_at)
        VALUES
          (${purchaseToken}, ${req.user!.id}, ${LIVE_PREMIUM_PRODUCT_ID}, 'subscription', 'active', ${purchase.latestOrderId ?? null}, ${expiresAt})
        ON CONFLICT (purchase_token) DO UPDATE
          SET status = EXCLUDED.status, order_id = EXCLUDED.order_id, expires_at = EXCLUDED.expires_at, updated_at = now()
          WHERE google_play_purchases.user_id = EXCLUDED.user_id
            AND google_play_purchases.product_id = EXCLUDED.product_id
            AND google_play_purchases.purchase_type = 'subscription'
        RETURNING purchase_token
      `);
      return result.rows.length > 0;
    });
    if (!stored) return res.status(409).json({ error: "Bu Google Play aboneliği başka bir hesapta kullanılmış" });

    let acknowledgementPending = false;
    if (purchase.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      try {
        await acknowledgeGoogleSubscription(LIVE_PREMIUM_PRODUCT_ID, purchaseToken);
      } catch (error) {
        acknowledgementPending = true;
        console.error("Google Play Premium acknowledgement failed:", error instanceof Error ? error.message : "unknown error");
      }
    }
    return res.json({ status: "active", active: true, expiresAt: expiresAt!.toISOString(), acknowledgementPending });
  } catch (error) {
    console.error("Google Play Premium purchase verification failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "Google Play aboneliği şu anda doğrulanamadı. Lütfen biraz sonra tekrar dene." });
  }
});
router.post("/live/coin-wallet/checkout", requireAuth, async (req, res) => {
  if (isPrivilegedUser(req.user!)) return res.status(403).json({ error: "Yönetici hesaplarında coin satın alma ve ödeme devre dışıdır" });
  const config = getIyzicoConfig();
  if (!config.ready) return res.status(503).json({ error: "Gerçek ödeme şu anda hazır değil. iyzico anahtarları ve HTTPS dönüş adresi yapılandırılmalı." });
  const packageId = req.body?.packageId;
  const packageInfo = LIVE_COIN_PACKAGES.find((item) => item.id === packageId);
  if (!packageInfo) return res.status(400).json({ error: "Coin paketi bulunamadı" });
  const buyerInput = req.body?.buyer;
  const requiredBuyerFields = ["name", "surname", "identityNumber", "email", "phone", "address", "city", "country", "zipCode"] as const;
  if (!buyerInput || requiredBuyerFields.some((field) => typeof buyerInput[field] !== "string" || !buyerInput[field].trim())) {
    return res.status(400).json({ error: "Ödeme için fatura ve alıcı bilgileri eksiksiz girilmeli" });
  }
  const buyer = Object.fromEntries(requiredBuyerFields.map((field) => [field, String(buyerInput[field]).trim()])) as Record<(typeof requiredBuyerFields)[number], string>;
  if (buyer.name.length > 100 || buyer.surname.length > 100 || buyer.identityNumber.length > 32 || buyer.email.length > 254
    || buyer.phone.length > 32 || buyer.address.length > 300 || buyer.city.length > 100 || buyer.country.length > 100 || buyer.zipCode.length > 20
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) {
    return res.status(400).json({ error: "Alıcı veya fatura bilgileri geçersiz" });
  }
  const orderId = uuidv4();
  const state = getCoinState();
  const order: LiveCoinOrder = {
    id: orderId,
    userId: req.user!.id,
    packageId: packageInfo.id,
    coins: packageInfo.coins + packageInfo.bonus,
    amountTry: packageInfo.amountTry,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.orders.push(order);
  saveCoinState(state);
  const contactName = `${buyer.name} ${buyer.surname}`.trim();
  const address = {
    address: buyer.address,
    contactName,
    city: buyer.city,
    country: buyer.country,
    zipCode: buyer.zipCode,
  };
  const request: CheckoutInitializeRequest = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: order.id,
    price: packageInfo.amountTry,
    paidPrice: packageInfo.amountTry,
    currency: Iyzipay.CURRENCY.TRY,
    basketId: order.id,
    paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
    callbackUrl: config.callbackUrl,
    buyer: {
      id: String(req.user!.id),
      name: buyer.name,
      surname: buyer.surname,
      identityNumber: buyer.identityNumber,
      email: buyer.email,
      gsmNumber: buyer.phone,
      registrationAddress: buyer.address,
      city: buyer.city,
      country: buyer.country,
      zipCode: buyer.zipCode,
      ip: req.ip || req.socket.remoteAddress || "0.0.0.0",
    },
    billingAddress: address,
    basketItems: [{
      id: packageInfo.id,
      name: `${packageInfo.name} Loop Coin Paketi`,
      category1: "Dijital Ürün",
      itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
      price: packageInfo.amountTry,
    }],
  };
  try {
    const iyzipay = getIyzicoClient();
    const result = await initializeIyzicoCheckout(iyzipay, request);
    if (result.status !== "success" || !result.token || !result.paymentPageUrl) {
      order.status = "failed";
      order.updatedAt = new Date().toISOString();
      saveCoinState(state);
      return res.status(502).json({ error: result.errorMessage || "iyzico ödeme oturumu oluşturamadı" });
    }
    order.token = result.token;
    order.updatedAt = new Date().toISOString();
    saveCoinState(state);
    return res.status(201).json({ orderId: order.id, paymentPageUrl: result.paymentPageUrl, amountTry: order.amountTry, coins: order.coins, testMode: config.testMode });
  } catch (error) {
    order.status = "failed";
    order.updatedAt = new Date().toISOString();
    saveCoinState(state);
    console.error("iyzico Checkout Form initialization failed:", error instanceof Error ? error.message : "unknown error");
    return res.status(502).json({ error: "iyzico ödeme oturumu başlatılamadı. Lütfen daha sonra tekrar deneyin." });
  }
});
router.post("/live/coin-wallet/iyzico-callback", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  if (!token || token.length > 512) return res.status(400).send("Geçersiz iyzico ödeme tokenı");
  const state = getCoinState();
  const order = state.orders.find((item) => item.token === token);
  if (!order) return res.status(404).send("Ödeme siparişi bulunamadı");
  try {
    const result = await retrieveIyzicoCheckout(order);
    applyIyzicoResult(order.id, result);
  } catch (error) {
    console.error("iyzico Checkout Form retrieve failed:", error instanceof Error ? error.message : "unknown error");
  }
  const publicUrl = new URL(process.env.PUBLIC_APP_URL!);
  publicUrl.pathname = "/loops";
  publicUrl.search = new URLSearchParams({ coinOrder: order.id }).toString();
  return res.redirect(303, publicUrl.toString());
});
router.get("/live/coin-wallet/orders/:orderId", requireAuth, async (req, res) => {
  const state = getCoinState();
  const order = state.orders.find((item) => item.id === req.params.orderId && item.userId === req.user!.id);
  if (!order) return res.status(404).json({ error: "Ödeme siparişi bulunamadı" });
  if ((order.status === "pending" || order.status === "review") && order.token) {
    try {
      const result = await retrieveIyzicoCheckout(order);
      const updated = applyIyzicoResult(order.id, result);
      const latestState = getCoinState();
      return res.json({ orderId: order.id, status: updated.status, balance: getWallet(latestState, req.user!.id).balance });
    } catch (error) {
      console.error("iyzico order status retrieval failed:", error instanceof Error ? error.message : "unknown error");
    }
  }
  const latestState = getCoinState();
  return res.json({ orderId: order.id, status: order.status, balance: getWallet(latestState, req.user!.id).balance });
});
router.post("/live/broadcasts/:id/gifts", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const giftId = String(req.body?.giftId || "").trim();
  const animation = readJson<Animation[]>(animationsFile, []).find((item) => item.id === giftId && item.published);
  if (!animation) return res.status(400).json({ error: "Hediye bulunamadı veya yayında değil" });
  const recipientId = Number(req.body?.recipientId || broadcast.user.id);
  const requests = readJson<LiveJoinRequest[]>(joinRequestsFile, []);
  const currentBattle = readJson<LiveBattle[]>(battlesFile, []).find((item) => item.broadcastId === broadcast.id);
  const battleIsActive = currentBattle && !currentBattle.endedAt && Date.now() - Date.parse(currentBattle.startedAt) < currentBattle.durationSeconds * 1000;
  const recipientRequest = requests.find((item) => item.broadcastId === broadcast.id && item.status === "accepted" && item.user.id === recipientId);
  const isBattleOpponent = !battleIsActive || currentBattle.participantIds.includes(recipientId);
  const opponentBroadcast = currentBattle?.opponentBroadcastId ? broadcasts.find((item) => item.id === currentBattle.opponentBroadcastId) : undefined;
  const recipient = recipientId === broadcast.user.id
    ? broadcast.user
    : recipientId === opponentBroadcast?.user.id
      ? opponentBroadcast.user
      : isBattleOpponent ? recipientRequest?.user : undefined;
  if (!recipient) return res.status(400).json({ error: "Hedef katılımcı bulunamadı" });
  if (recipient.id === req.user!.id) return res.status(400).json({ error: "Kendinize hediye gönderemezsiniz" });
  const coinCost = Math.max(1, Math.floor(animation.coinValue ?? 1));
  const paymentExempt = isPrivilegedUser(req.user!);
  const demoGiftMode = process.env.NODE_ENV !== "production";
  const coinState = getCoinState();
  const wallet = paymentExempt || demoGiftMode ? null : getWallet(coinState, req.user!.id);
  if (wallet && wallet.balance < coinCost) return res.status(402).json({ error: "Yetersiz coin bakiyesi", balance: wallet.balance, required: coinCost });
  const gift: LiveGiftEvent = {
    id: uuidv4(),
    broadcastId: String(req.params.id),
    giftId: animation.id,
    giftName: animation.name,
    coinValue: coinCost,
    createdAt: new Date().toISOString(),
    user: { id: req.user!.id, username: req.user!.username, displayName: req.user!.displayName, avatarUrl: req.user!.avatarUrl },
    recipient,
  };
  const gifts = readJson<LiveGiftEvent[]>(giftsFile, []);
  const nextGifts = [...gifts, gift].slice(-5000);
  if (wallet) {
    wallet.balance -= coinCost;
    wallet.updatedAt = gift.createdAt;
    coinState.transactions.push({
      id: uuidv4(),
      userId: req.user!.id,
      type: "gift",
      amount: -coinCost,
      description: `${animation.name} hediyesi`,
      referenceId: gift.id,
      createdAt: gift.createdAt,
    });
    saveCoinState(coinState);
  }
  writeJson(giftsFile, nextGifts);
  if (gift.recipient) {
    const progress = readJson<LiveSupporterProgress[]>(supporterProgressFile, []);
    const existingProgress = progress.find((item) => item.creatorId === gift.recipient!.id && item.supporter.id === gift.user.id);
    if (existingProgress) {
      existingProgress.xp += gift.coinValue ?? 1;
      existingProgress.supporter = gift.user;
      existingProgress.updatedAt = gift.createdAt;
    } else {
      progress.push({ creatorId: gift.recipient.id, supporter: gift.user, xp: gift.coinValue ?? 1, updatedAt: gift.createdAt });
    }
    writeJson(supporterProgressFile, progress);
    const memberships = readJson<LiveCreatorClubMember[]>(creatorClubMembersFile, []);
    if (memberships.some((item) => item.creatorId === gift.recipient!.id && item.user.id === gift.user.id)) {
      const clubProgress = readJson<LiveCreatorClubProgress[]>(creatorClubProgressFile, []);
      let creatorProgress = clubProgress.find((item) => item.creatorId === gift.recipient!.id);
      if (!creatorProgress) {
        const memberIds = new Set(memberships.filter((item) => item.creatorId === gift.recipient!.id).map((item) => item.user.id));
        creatorProgress = {
          creatorId: gift.recipient.id,
          xp: progress.reduce((total, item) => total + (item.creatorId === gift.recipient!.id && memberIds.has(item.supporter.id) ? item.xp : 0), 0) - (gift.coinValue ?? 1),
          updatedAt: gift.createdAt,
        };
        clubProgress.push(creatorProgress);
      }
      creatorProgress.xp += gift.coinValue ?? 1;
      creatorProgress.updatedAt = gift.createdAt;
      writeJson(creatorClubProgressFile, clubProgress);
    }
  }
  const liveSupporters = new Set(nextGifts.filter((item) => item.broadcastId === req.params.id).map((item) => item.user.id));
  return res.status(201).json({ success: true, gift, supporterCount: liveSupporters.size, balance: wallet?.balance ?? null, paymentExempt, demoGiftMode });
});
router.get("/live/creators/:creatorId/yanki-kulubu", (req, res) => {
  const creatorId = Number(req.params.creatorId);
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return res.status(400).json({ error: "Geçersiz içerik üreticisi" });
  const creator = [...readJson<Broadcast[]>(broadcastsFile, []), ...readJson<Broadcast[]>(broadcastArchiveFile, [])]
    .find((item) => item.user.id === creatorId)?.user;
  if (!creator) return res.status(404).json({ error: "İçerik üreticisi bulunamadı" });
  const progress = readJson<LiveSupporterProgress[]>(supporterProgressFile, []).filter((item) => item.creatorId === creatorId);
  const memberships = readJson<LiveCreatorClubMember[]>(creatorClubMembersFile, []).filter((item) => item.creatorId === creatorId);
  const clubName = readJson<LiveCreatorClubName[]>(creatorClubNamesFile, []).find((item) => item.creatorId === creatorId)?.name ?? "Topluluğum";
  const me = req.user ? progress.find((item) => item.supporter.id === req.user!.id) : undefined;
  const memberIds = new Set(memberships.map((item) => item.user.id));
  const savedClubProgress = readJson<LiveCreatorClubProgress[]>(creatorClubProgressFile, []).find((item) => item.creatorId === creatorId);
  const clubXp = savedClubProgress?.xp ?? progress.reduce((total, item) => total + (memberIds.has(item.supporter.id) ? item.xp : 0), 0);
  const rankedMembers = memberships
    .map((membership) => {
      const supporterProgress = progress.find((item) => item.supporter.id === membership.user.id);
      const xp = supporterProgress?.xp ?? 0;
      return { user: membership.user, joinedAt: membership.joinedAt, ...getLiveSupporterLevel(xp) };
    })
    .sort((left, right) => right.xp - left.xp || Date.parse(left.joinedAt) - Date.parse(right.joinedAt))
  const myRank = req.user ? rankedMembers.findIndex((member) => member.user.id === req.user!.id) + 1 : 0;
  res.json({
    creator,
    clubName,
    isOwner: req.user?.id === creatorId,
    memberCount: memberships.length,
    isMember: Boolean(req.user && memberships.some((item) => item.user.id === req.user!.id)),
    myRank: myRank || null,
    myProgress: getLiveSupporterLevel(me?.xp ?? 0),
    clubProgress: getLiveSupporterLevel(clubXp),
    topMembers: progress
      .map((item) => ({ user: item.supporter, ...getLiveSupporterLevel(item.xp) }))
      .sort((left, right) => right.xp - left.xp)
      .slice(0, 10),
    members: rankedMembers.slice(0, 20),
  });
});
router.patch("/live/creators/:creatorId/yanki-kulubu/ad", requireAuth, (req, res) => {
  const creatorId = Number(req.params.creatorId);
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return res.status(400).json({ error: "Geçersiz içerik üreticisi" });
  if (req.user!.id !== creatorId) return res.status(403).json({ error: "Topluluk adını yalnızca sahibi değiştirebilir" });
  const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 32) return res.status(400).json({ error: "Topluluk adı 2 ile 32 karakter arasında olmalı" });
  const names = readJson<LiveCreatorClubName[]>(creatorClubNamesFile, []);
  const existing = names.find((item) => item.creatorId === creatorId);
  if (existing) {
    existing.name = name;
    existing.updatedAt = new Date().toISOString();
  } else {
    names.push({ creatorId, name, updatedAt: new Date().toISOString() });
  }
  writeJson(creatorClubNamesFile, names);
  res.json({ success: true, clubName: name });
});
router.post("/live/creators/:creatorId/yanki-kulubu/katil", requireAuth, (req, res) => {
  const creatorId = Number(req.params.creatorId);
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return res.status(400).json({ error: "Geçersiz içerik üreticisi" });
  const creator = [...readJson<Broadcast[]>(broadcastsFile, []), ...readJson<Broadcast[]>(broadcastArchiveFile, [])]
    .find((item) => item.user.id === creatorId)?.user;
  if (!creator) return res.status(404).json({ error: "İçerik üreticisi bulunamadı" });
  if (creator.id === req.user!.id) return res.status(400).json({ error: "Kendi topluluğunuza katılamazsınız" });
  const memberships = readJson<LiveCreatorClubMember[]>(creatorClubMembersFile, []);
  if (!memberships.some((item) => item.creatorId === creatorId && item.user.id === req.user!.id)) {
    memberships.push({
      creatorId,
      user: { id: req.user!.id, username: req.user!.username, displayName: req.user!.displayName, avatarUrl: req.user!.avatarUrl },
      joinedAt: new Date().toISOString(),
    });
    writeJson(creatorClubMembersFile, memberships);
  }
  res.status(200).json({ success: true, isMember: true, memberCount: memberships.filter((item) => item.creatorId === creatorId).length });
});
router.delete("/live/creators/:creatorId/yanki-kulubu/uyelik", requireAuth, (req, res) => {
  const creatorId = Number(req.params.creatorId);
  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return res.status(400).json({ error: "Geçersiz içerik üreticisi" });
  const memberships = readJson<LiveCreatorClubMember[]>(creatorClubMembersFile, []);
  const nextMemberships = memberships.filter((item) => !(item.creatorId === creatorId && item.user.id === req.user!.id));
  if (nextMemberships.length !== memberships.length) writeJson(creatorClubMembersFile, nextMemberships);
  res.json({ success: true, isMember: false, memberCount: nextMemberships.filter((item) => item.creatorId === creatorId).length });
});
router.post("/live/broadcasts/:id/like", requireAuth, (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcast = broadcasts.find((item) => item.id === req.params.id);
  if (!broadcast) return res.status(404).json({ error: "Yayın bulunamadı" });
  const likes = readJson<LiveLike[]>(likesFile, []);
  const user = req.user!;
  const nextLikes = [...likes, { broadcastId: broadcast.id, broadcasterId: broadcast.user.id, user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }, createdAt: new Date().toISOString() }];
  writeJson(likesFile, nextLikes.slice(-20000));
  res.status(201).json({ success: true, likeCount: nextLikes.filter((item) => item.broadcastId === req.params.id).length });
});
router.get("/live/broadcasts/:id/gifts", (req, res) => {
  const gifts = readJson<LiveGiftEvent[]>(giftsFile, [])
    .filter((gift) => gift.broadcastId === req.params.id)
    .slice(-50)
    .map((gift) => {
      const animation = readJson<Animation[]>(animationsFile, []).find((item) => item.id === gift.giftId);
      return { ...gift, url: animation?.url ?? null, mimeType: animation?.mimeType ?? null, transparencyMode: animation?.transparencyMode ?? "none", edgeFade: animation?.edgeFade ?? "top-bottom" };
    })
    .filter((gift) => gift.url);
  res.json(gifts);
});
router.get("/live/broadcasts/:id/stats", (req, res) => {
  const broadcasts = readJson<Broadcast[]>(broadcastsFile, []);
  const broadcastArchive = readJson<Broadcast[]>(broadcastArchiveFile, []);
  if (!broadcasts.some((broadcast) => broadcast.id === req.params.id)) return res.status(404).json({ error: "Yayın bulunamadı" });
  const broadcast = broadcasts.find((item) => item.id === req.params.id)!;
  const leagueState = processLeaguePeriods(broadcast);
  const now = Date.now();
  const events = readJson<LiveGiftEvent[]>(giftsFile, []).filter((gift) => gift.broadcastId === req.params.id);
  const recipientCoinTotals: Record<number, number> = {};
  for (const gift of events) {
    const recipientId = gift.recipient?.id ?? broadcast.user.id;
    recipientCoinTotals[recipientId] = (recipientCoinTotals[recipientId] ?? 0) + (gift.coinValue ?? 1);
  }
  const withinLast = (createdAt: string, durationMs: number) => {
    const timestamp = Date.parse(createdAt);
    return Number.isFinite(timestamp) && timestamp >= now - durationMs && timestamp <= now;
  };
  const hourlyEvents = events.filter((gift) => withinLast(gift.createdAt, 60 * 60 * 1000));
    const hourlyRanking = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
    for (const gift of hourlyEvents) {
      const current = hourlyRanking.get(gift.user.id) ?? { user: gift.user, coins: 0 };
      current.coins += gift.coinValue ?? 1;
      hourlyRanking.set(gift.user.id, current);
    }
  const dailyEvents = events.filter((gift) => withinLast(gift.createdAt, 24 * 60 * 60 * 1000));
  const weeklyEvents = events.filter((gift) => withinLast(gift.createdAt, 7 * 24 * 60 * 60 * 1000));
  const dailyRanking = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
  for (const gift of dailyEvents) {
    const current = dailyRanking.get(gift.user.id) ?? { user: gift.user, coins: 0 };
    current.coins += gift.coinValue ?? 1;
    dailyRanking.set(gift.user.id, current);
  }
  const ranking = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
  for (const gift of weeklyEvents) {
    const current = ranking.get(gift.user.id) ?? { user: gift.user, coins: 0 };
    current.coins += gift.coinValue ?? 1;
    ranking.set(gift.user.id, current);
  }
  const currentBroadcastSupporters = new Map<number, { user: LiveGiftEvent["user"]; coins: number }>();
  for (const gift of events) {
    const current = currentBroadcastSupporters.get(gift.user.id) ?? { user: gift.user, coins: 0 };
    current.coins += gift.coinValue ?? 1;
    currentBroadcastSupporters.set(gift.user.id, current);
  }
  const signal = getSignal(req.params.id);
  pruneViewers(signal);
  const activeIdentities = new Set<string>();
  const history = readJson<AudienceHistory[]>(audienceHistoryFile, []);
  for (const entry of history) {
    if (entry.lastBroadcastId === req.params.id && Date.now() - Date.parse(entry.lastSeenAt) < 10_000) activeIdentities.add(entry.identity);
  }
  const likes = readJson<LiveLike[]>(likesFile, []);
  const likesByIdentity = new Map<string, number>();
  for (const like of likes.filter((item) => item.broadcasterId === broadcast.user.id)) {
    const identity = `user:${like.user.id}`;
    likesByIdentity.set(identity, (likesByIdentity.get(identity) ?? 0) + 1);
  }
  const audienceByIdentity = new Map<string, AudienceHistory>();
  const allBroadcasts = [...broadcasts, ...broadcastArchive];
  for (const entry of history.filter((item) => !activeIdentities.has(item.identity))) {
    const firstBroadcast = allBroadcasts.find((item) => item.id === entry.firstBroadcastId);
    const enrichedEntry = {
      ...entry,
      firstBroadcastStartedAt: entry.firstBroadcastStartedAt ?? firstBroadcast?.startedAt,
      firstBroadcastEndedAt: firstBroadcast?.endedAt,
      likeCount: likesByIdentity.get(entry.identity) ?? entry.likeCount,
    };
    const current = audienceByIdentity.get(entry.identity);
    if (!current) audienceByIdentity.set(entry.identity, enrichedEntry);
    else {
      current.totalSeconds += entry.totalSeconds;
      current.firstJoinedAt = current.firstJoinedAt < entry.firstJoinedAt ? current.firstJoinedAt : entry.firstJoinedAt;
      current.lastSeenAt = current.lastSeenAt > entry.lastSeenAt ? current.lastSeenAt : entry.lastSeenAt;
      current.lastBroadcastId = current.lastBroadcastId === entry.lastBroadcastId ? current.lastBroadcastId : entry.lastBroadcastId;
      current.likeCount = likesByIdentity.get(entry.identity) ?? current.likeCount;
    }
  }
  const supporterHistory = new Map<number, { user: LiveGiftEvent["user"]; coins: number; firstSupportAt: string; lastSupportAt: string }>();
  const creatorBroadcasts = [...broadcasts, ...broadcastArchive].filter((item) => item.user.id === broadcast.user.id);
  const allBroadcastIds = new Set(creatorBroadcasts.filter((item) => item.id !== broadcast.id).map((item) => item.id));
  for (const gift of readJson<LiveGiftEvent[]>(giftsFile, []).filter((item) => allBroadcastIds.has(item.broadcastId))) {
    const current = supporterHistory.get(gift.user.id) ?? { user: gift.user, coins: 0, firstSupportAt: gift.createdAt, lastSupportAt: gift.createdAt };
    current.coins += gift.coinValue ?? 1;
    current.firstSupportAt = current.firstSupportAt < gift.createdAt ? current.firstSupportAt : gift.createdAt;
    current.lastSupportAt = current.lastSupportAt > gift.createdAt ? current.lastSupportAt : gift.createdAt;
    supporterHistory.set(gift.user.id, current);
  }
  const liveSettings = settings();
  const publishedGiftIds = new Set(readJson<Animation[]>(animationsFile, []).filter(item => item.published).map(item => item.id));
  const featuredGiftIds = liveSettings.collectionGiftIds.length
    ? liveSettings.collectionGiftIds.filter(id => publishedGiftIds.has(id))
    : readJson<Animation[]>(animationsFile, []).filter(item => item.published).slice(0, liveSettings.collectionTotal).map(item => item.id);
  const featuredGiftSet = new Set(featuredGiftIds);
  const uniqueGifts = [...new Set(weeklyEvents.map((gift) => gift.giftId).filter(id => featuredGiftSet.has(id)))];
  const data: LiveStats = {
    viewerCount: signal.viewers.size,
    liveLikeCount: likes.filter((item) => item.broadcastId === req.params.id).length,
    recipientCoinTotals,
    myWeeklyCoins: req.user
      ? weeklyEvents.filter((gift) => gift.user.id === req.user!.id).reduce((total, gift) => total + (gift.coinValue ?? 1), 0)
      : null,
    hourlyRanking: [...hourlyRanking.values()].sort((a, b) => b.coins - a.coins).slice(0, 10).map((entry) => ({ ...entry, league: getLeagueProgress(entry.user.id, leagueState) })),
    dailyRanking: [...dailyRanking.values()].sort((a, b) => b.coins - a.coins).slice(0, 10).map((entry) => ({ ...entry, league: getLeagueProgress(entry.user.id, leagueState) })),
    coinRanking: [...ranking.values()].sort((a, b) => b.coins - a.coins).slice(0, 10).map((entry) => ({ ...entry, league: getLeagueProgress(entry.user.id, leagueState) })),
    liveSupporters: [...currentBroadcastSupporters.values()].sort((a, b) => b.coins - a.coins).map((entry) => ({ ...entry, league: getLeagueProgress(entry.user.id, leagueState) })),
    myLeague: req.user ? getLeagueProgress(req.user.id, leagueState) : undefined,
    collection: {
      collected: uniqueGifts.length,
      total: liveSettings.collectionGiftIds.length ? featuredGiftIds.length : featuredGiftIds.length || liveSettings.collectionTotal,
      gifts: uniqueGifts,
      featuredGiftIds,
    },
    activeAudience: history.filter((entry) => activeIdentities.has(entry.identity)).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 50),
    audienceHistory: [...audienceByIdentity.values()].sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 50),
    supporterHistory: [...supporterHistory.values()].sort((a, b) => b.coins - a.coins).slice(0, 50),
  };
  res.json(data);
});

router.get("/admin/live/settings", requireAuth, adminOnly, (_req, res) => res.json(settings()));
router.get("/admin/live/events", requireAuth, adminOnly, (_req, res) => res.json(readJson<LiveEvent[]>(eventsFile, [])));
router.post("/admin/live/events", requireAuth, adminOnly, liveEventUpload.array("images", 10), (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  const title = String(req.body?.title || "").trim();
  if (!title || files.length === 0) {
    files.forEach((file) => fs.rmSync(file.path, { force: true }));
    return res.status(400).json({ error: "Etkinlik başlığı ve en az bir görsel gerekli" });
  }
  const event: LiveEvent = {
    id: uuidv4(),
    title: title.slice(0, 120),
    description: String(req.body?.description || "").trim().slice(0, 500),
    images: files.map((file) => ({ id: uuidv4(), url: `/api/uploads/live-events/${file.filename}`, mimeType: file.mimetype })),
    published: false,
    createdAt: new Date().toISOString(),
  };
  const events = readJson<LiveEvent[]>(eventsFile, []);
  events.unshift(event);
  writeJson(eventsFile, events);
  res.status(201).json(event);
});
router.patch("/admin/live/events/:id/publish", requireAuth, adminOnly, (req, res) => {
  const events = readJson<LiveEvent[]>(eventsFile, []);
  const event = events.find((item) => item.id === req.params.id);
  if (!event) return res.status(404).json({ error: "Etkinlik bulunamadı" });
  event.published = !event.published;
  writeJson(eventsFile, events);
  res.json(event);
});
router.delete("/admin/live/events/:id", requireAuth, adminOnly, (req, res) => {
  const events = readJson<LiveEvent[]>(eventsFile, []);
  const event = events.find((item) => item.id === req.params.id);
  if (!event) return res.status(404).json({ error: "Etkinlik bulunamadı" });
  event.images.forEach((image) => fs.rmSync(path.join(eventImageDir, path.basename(image.url)), { force: true }));
  writeJson(eventsFile, events.filter((item) => item.id !== event.id));
  res.json({ success: true });
});
router.patch("/admin/live/settings", requireAuth, adminOnly, async (req, res) => {
  const current = settings();
  const next = { ...current };
  if (req.body?.status !== undefined) {
    const status = req.body.status as LiveStatus;
    if (!["enabled", "coming_soon", "disabled"].includes(status)) {
      res.status(400).json({ error: "Geçersiz yayın durumu" });
      return;
    }
    next.status = status;
  }
  if (req.body?.restrictedMode !== undefined) {
    if (typeof req.body.restrictedMode !== "boolean") {
      res.status(400).json({ error: "Canlı yayın kısıtlama ayarı geçersiz" });
      return;
    }
    next.restrictedMode = req.body.restrictedMode;
  }
  if (req.body?.allowedUserIds !== undefined) {
    if (
      !Array.isArray(req.body.allowedUserIds)
      || req.body.allowedUserIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0)
    ) {
      res.status(400).json({ error: "Canlı yayın için seçilen kullanıcılar geçersiz" });
      return;
    }
    const allowedUserIds = [...new Set<number>(req.body.allowedUserIds)];
    let existingUsers: { id: number }[];
    try {
      existingUsers = allowedUserIds.length === 0
        ? []
        : await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(inArray(usersTable.id, allowedUserIds));
    } catch (error) {
      console.error("Canlı yayın erişimi için kullanıcılar doğrulanamadı:", error);
      res.status(500).json({ error: "Seçilen kullanıcılar doğrulanamadı. Lütfen tekrar deneyin." });
      return;
    }
    if (existingUsers.length !== allowedUserIds.length) {
      res.status(400).json({ error: "Seçilen kullanıcılardan biri bulunamadı" });
      return;
    }
    next.allowedUserIds = allowedUserIds;
  }
  if (req.body?.membershipBadgeAssetIds !== undefined) {
    const value = req.body.membershipBadgeAssetIds;
    const validKeys = ["premium_writer", "blue_verified", "gold"];
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.entries(value).some(([key, id]) => !validKeys.includes(key)
        || (id !== null && (!Number.isSafeInteger(id) || Number(id) <= 0)))) {
      res.status(400).json({ error: "Üyelik rozet eşleştirmesi geçersiz." });
      return;
    }
    const badgeIds = Object.values(value).filter((id): id is number => typeof id === "number");
    const existingBadges = await Promise.all(badgeIds.map((id) =>
      db.execute(sql`SELECT id FROM badge_assets WHERE id = ${id} AND published = true LIMIT 1`),
    ));
    if (existingBadges.some((result) => result.rows.length !== 1)) {
      res.status(400).json({ error: "Yalnızca yayındaki rozet görselleri seçilebilir." });
      return;
    }
    next.membershipBadgeAssetIds = Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
    ) as Partial<Record<"premium_writer" | "blue_verified" | "gold", number>>;
  }
  if (req.body?.collectionGiftIds !== undefined || req.body?.collectionTotal !== undefined) {
    if (req.body?.collectionGiftIds !== undefined && (!Array.isArray(req.body.collectionGiftIds) || req.body.collectionGiftIds.some((id: unknown) => typeof id !== "string"))) {
      res.status(400).json({ error: "Koleksiyon hediyeleri geçersiz" });
      return;
    }
    const collectionGiftIds = [...new Set<string>(req.body?.collectionGiftIds ?? current.collectionGiftIds)];
    const collectionTotal = Number(req.body?.collectionTotal ?? collectionGiftIds.length);
    if (!Number.isInteger(collectionTotal) || collectionTotal < 1 || collectionTotal > 30) {
      res.status(400).json({ error: "Koleksiyon vitrini 1 ile 30 hediye arasında olmalı" });
      return;
    }
    if (collectionGiftIds.length !== collectionTotal) {
      res.status(400).json({ error: `Vitrin sayısı ${collectionTotal}; aynı sayıda hediye seçin` });
      return;
    }
    const animations = readJson<Animation[]>(animationsFile, []);
    const publishedIds = new Set(animations.filter(item => item.published).map(item => item.id));
    if (collectionGiftIds.some(id => !publishedIds.has(id))) {
      res.status(400).json({ error: "Vitrine yalnızca yayındaki hediyeler eklenebilir" });
      return;
    }
    next.collectionGiftIds = collectionGiftIds;
    next.collectionTotal = collectionTotal;
  }
  writeJson(settingsFile, next);
  res.json(next);
});
router.get("/admin/live/animations", requireAuth, adminOnly, (_req, res) => res.json(readJson<Animation[]>(animationsFile, []).map(item => ({ ...item, coinValue: item.coinValue ?? 1, transparencyMode: item.transparencyMode ?? "none", edgeFade: item.edgeFade ?? "top-bottom" }))));
router.post("/admin/live/animations/:id/cover", requireAuth, adminOnly, giftCoverUpload.single("cover"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Hediye kapağı için JPG, PNG, WEBP veya GIF görseli gerekli" });
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(404).json({ error: "Hediye animasyonu bulunamadı" });
  }
  if (item.coverUrl) {
    fs.rmSync(path.join(giftCoverDir, path.basename(item.coverUrl)), { force: true });
  }
  item.coverUrl = `/api/uploads/live-gift-covers/${req.file.filename}`;
  writeJson(animationsFile, animations);
  return res.json(item);
});
router.delete("/admin/live/animations/:id/cover", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Hediye animasyonu bulunamadı" });
  if (item.coverUrl) {
    fs.rmSync(path.join(giftCoverDir, path.basename(item.coverUrl)), { force: true });
    delete item.coverUrl;
    writeJson(animationsFile, animations);
  }
  return res.json(item);
});
router.get("/admin/live/battle-result-animations", requireAuth, adminOnly, (_req, res) => res.json(readJson<BattleResultAnimation[]>(battleResultAnimationsFile, [])));
router.get("/admin/live/arena-assets", requireAuth, adminOnly, (_req, res) => res.json(readJson<ArenaAsset[]>(arenaAssetsFile, [])));
router.get("/admin/live/button-assets", requireAuth, adminOnly, (_req, res) => res.json(readJson<ButtonAsset[]>(buttonAssetsFile, [])));
router.post("/admin/live/button-assets", requireAuth, adminOnly, buttonUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Görsel veya video gerekli" });
  const roles: ButtonAssetRole[] = ["subscribe", "guests", "like", "gift", "share", "comment", "streak", "ranking", "collection", "coin", "general"];
  const role = String(req.body?.role || "general") as ButtonAssetRole;
  if (!roles.includes(role)) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: "Geçersiz buton türü" }); }
  const assets = readJson<ButtonAsset[]>(buttonAssetsFile, []);
  const item: ButtonAsset = { id: uuidv4(), name: String(req.body?.name || req.file.originalname).slice(0, 120), role, url: `/api/uploads/live-button-assets/${req.file.filename}`, mimeType: req.file.mimetype, published: false, createdAt: new Date().toISOString() };
  assets.unshift(item);
  writeJson(buttonAssetsFile, assets);
  res.status(201).json(item);
});
router.patch("/admin/live/button-assets/:id/publish", requireAuth, adminOnly, (req, res) => {
  const assets = readJson<ButtonAsset[]>(buttonAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Canlı yayın buton asset'i bulunamadı" });
  item.published = !item.published;
  writeJson(buttonAssetsFile, assets);
  res.json(item);
});
router.patch("/admin/live/button-assets/:id/role", requireAuth, adminOnly, (req, res) => {
  const roles: ButtonAssetRole[] = ["subscribe", "guests", "like", "gift", "share", "comment", "streak", "ranking", "collection", "coin", "general"];
  const role = String(req.body?.role || "") as ButtonAssetRole;
  if (!roles.includes(role)) return res.status(400).json({ error: "Geçersiz buton türü" });
  const assets = readJson<ButtonAsset[]>(buttonAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Canlı yayın buton asset'i bulunamadı" });
  item.role = role;
  writeJson(buttonAssetsFile, assets);
  res.json(item);
});
router.delete("/admin/live/button-assets/:id", requireAuth, adminOnly, (req, res) => {
  const assets = readJson<ButtonAsset[]>(buttonAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Canlı yayın buton asset'i bulunamadı" });
  fs.rmSync(path.join(buttonAssetDir, path.basename(item.url)), { force: true });
  writeJson(buttonAssetsFile, assets.filter(asset => asset.id !== item.id));
  res.json({ success: true });
});
router.post("/admin/live/arena-assets", requireAuth, adminOnly, arenaUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Görsel veya video gerekli" });
  const roles: ArenaAssetRole[] = ["background", "left-team", "right-team", "vs-emblem", "score-bar", "overlay"];
  const role = String(req.body?.role || "background") as ArenaAssetRole;
  if (!roles.includes(role)) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: "Geçersiz arena rolü" }); }
  const assets = readJson<ArenaAsset[]>(arenaAssetsFile, []);
  const item: ArenaAsset = { id: uuidv4(), name: String(req.body?.name || req.file.originalname).slice(0, 120), role, url: `/api/uploads/live-arena-assets/${req.file.filename}`, mimeType: req.file.mimetype, published: false, createdAt: new Date().toISOString() };
  assets.unshift(item);
  writeJson(arenaAssetsFile, assets);
  res.status(201).json(item);
});
router.patch("/admin/live/arena-assets/:id/publish", requireAuth, adminOnly, (req, res) => {
  const assets = readJson<ArenaAsset[]>(arenaAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Arena asset'i bulunamadı" });
  item.published = !item.published;
  writeJson(arenaAssetsFile, assets);
  res.json(item);
});
router.patch("/admin/live/arena-assets/:id/role", requireAuth, adminOnly, (req, res) => {
  const roles: ArenaAssetRole[] = ["background", "left-team", "right-team", "vs-emblem", "score-bar", "overlay"];
  const role = String(req.body?.role || "") as ArenaAssetRole;
  if (!roles.includes(role)) return res.status(400).json({ error: "Geçersiz arena rolü" });
  const assets = readJson<ArenaAsset[]>(arenaAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Arena asset'i bulunamadı" });
  item.role = role;
  writeJson(arenaAssetsFile, assets);
  res.json(item);
});
router.delete("/admin/live/arena-assets/:id", requireAuth, adminOnly, (req, res) => {
  const assets = readJson<ArenaAsset[]>(arenaAssetsFile, []);
  const item = assets.find(asset => asset.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Arena asset'i bulunamadı" });
  fs.rmSync(path.join(arenaAssetDir, path.basename(item.url)), { force: true });
  writeJson(arenaAssetsFile, assets.filter(asset => asset.id !== item.id));
  res.json({ success: true });
});
router.post("/admin/live/animations", requireAuth, adminOnly, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Video veya GIF gerekli" });
  const coinValue = Number(req.body?.coinValue ?? 1);
  if (!Number.isInteger(coinValue) || coinValue < 0 || coinValue > 1_000_000) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: "Coin bedeli 0 ile 1.000.000 arasında tam sayı olmalı" });
  }
  const animations = readJson<Animation[]>(animationsFile, []);
  const requestedMode = String(req.body?.transparencyMode || "none");
  const transparencyMode = requestedMode === "green" || requestedMode === "white" || requestedMode === "none" ? requestedMode : "auto";
  const edgeFade = req.body?.edgeFade === "top-bottom" ? "top-bottom" : "none";
  const item: Animation = { id: uuidv4(), name: String(req.body?.name || req.file.originalname).slice(0, 120), url: `/api/uploads/live-animations/${req.file.filename}`, mimeType: req.file.mimetype, coinValue, transparencyMode, edgeFade, published: false, createdAt: new Date().toISOString() };
  animations.unshift(item);
  writeJson(animationsFile, animations);
  res.status(201).json(item);
});
router.patch("/admin/live/animations/:id/publish", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Animasyon bulunamadı" });
  item.published = !item.published;
  writeJson(animationsFile, animations);
  res.json(item);
});
router.patch("/admin/live/animations/:id/coin-value", requireAuth, adminOnly, (req, res) => {
  const coinValue = Number(req.body?.coinValue);
  if (!Number.isInteger(coinValue) || coinValue < 0 || coinValue > 1_000_000) return res.status(400).json({ error: "Coin bedeli 0 ile 1.000.000 arasında tam sayı olmalı" });
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Animasyon bulunamadı" });
  item.coinValue = coinValue;
  writeJson(animationsFile, animations);
  res.json(item);
});
router.patch("/admin/live/animations/:id/transparency", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Animasyon bulunamadı" });
  const mode = String(req.body?.transparencyMode || "none");
  if (mode !== "auto" && mode !== "none" && mode !== "green" && mode !== "white") return res.status(400).json({ error: "Geçersiz şeffaflaştırma modu" });
  item.transparencyMode = mode;
  writeJson(animationsFile, animations);
  res.json(item);
});
router.patch("/admin/live/animations/:id/edge-fade", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Animasyon bulunamadı" });
  const edgeFade = String(req.body?.edgeFade || "none");
  if (edgeFade !== "none" && edgeFade !== "top-bottom") return res.status(400).json({ error: "Geçersiz kenar geçişi" });
  item.edgeFade = edgeFade;
  writeJson(animationsFile, animations);
  res.json(item);
});
router.delete("/admin/live/animations/:id", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<Animation[]>(animationsFile, []);
  const item = animations.find(animation => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Animasyon bulunamadı" });
  const file = path.basename(item.url);
  fs.rmSync(path.join(animationDir, file), { force: true });
  if (item.coverUrl) fs.rmSync(path.join(giftCoverDir, path.basename(item.coverUrl)), { force: true });
  writeJson(animationsFile, animations.filter(animation => animation.id !== item.id));
  res.json({ success: true });
});
router.post("/admin/live/battle-result-animations", requireAuth, adminOnly, battleResultUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Video veya GIF gerekli" });
  const outcome = String(req.body?.outcome || "") as BattleResultAnimation["outcome"];
  if (outcome !== "win" && outcome !== "lose") {
    fs.rmSync(req.file.path, { force: true });
    return res.status(400).json({ error: "Sonuç türü kazanma veya kaybetme olmalı" });
  }
  const requestedMode = String(req.body?.transparencyMode || "none");
  const transparencyMode = requestedMode === "green" || requestedMode === "white" || requestedMode === "none" ? requestedMode : "auto";
  const edgeFade = req.body?.edgeFade === "top-bottom" ? "top-bottom" : "none";
  const animations = readJson<BattleResultAnimation[]>(battleResultAnimationsFile, []);
  const item: BattleResultAnimation = {
    id: uuidv4(),
    name: String(req.body?.name || req.file.originalname).slice(0, 120),
    outcome,
    url: `/api/uploads/live-battle-results/${req.file.filename}`,
    mimeType: req.file.mimetype,
    transparencyMode,
    edgeFade,
    published: false,
    createdAt: new Date().toISOString(),
  };
  animations.unshift(item);
  writeJson(battleResultAnimationsFile, animations);
  res.status(201).json(item);
});
router.patch("/admin/live/battle-result-animations/:id/publish", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<BattleResultAnimation[]>(battleResultAnimationsFile, []);
  const item = animations.find((animation) => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Kapışma sonuç animasyonu bulunamadı" });
  const publish = !item.published;
  if (publish) animations.forEach((animation) => {
    if (animation.outcome === item.outcome) animation.published = false;
  });
  item.published = publish;
  writeJson(battleResultAnimationsFile, animations);
  res.json(item);
});
router.delete("/admin/live/battle-result-animations/:id", requireAuth, adminOnly, (req, res) => {
  const animations = readJson<BattleResultAnimation[]>(battleResultAnimationsFile, []);
  const item = animations.find((animation) => animation.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Kapışma sonuç animasyonu bulunamadı" });
  fs.rmSync(path.join(battleResultAnimationDir, path.basename(item.url)), { force: true });
  writeJson(battleResultAnimationsFile, animations.filter((animation) => animation.id !== item.id));
  res.json({ success: true });
});

export default router;
