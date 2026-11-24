import { Router, type IRouter } from "express";

// Tüm alt rotaları içeri aktarıyoruz
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import chatRouter from "./chat";
import notificationsRouter from "./notifications";
import exploreRouter from "./explore";
import adminRouter from "./admin";
import dmRouter from "./dm";
import loopRouter from "./loop";
import callsRouter from "./calls";
import gifRouter from "./gif";
import companionsRouter, { seedBuiltinCompanions, ensureCompanionsPublishedColumn } from "./companions";
import gamesRouter, { ensureGameScoresTable } from "./games";
import booksRouter from "./books";
import interactiveRouter from "./interactive";
import liveRouter from "./live";
import universesRouter from "./universes";
import reportsRouter from "./reports";
import brandingRouter from "./branding";
import highlightsRouter from "./highlights";
import communitiesRouter from "./communities";

// Yerleşik yoldaşları ilk açılışta DB'ye ekle
seedBuiltinCompanions();
// published sütununu ekle (migration-less)
ensureCompanionsPublishedColumn();
// Oyun skoru tablosunu oluştur
ensureGameScoresTable();

const router: IRouter = Router();

// Rotaları Express Router'a kaydediyoruz
router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(chatRouter);
router.use(notificationsRouter);
router.use(exploreRouter);
router.use("/admin", adminRouter);
router.use(brandingRouter);
router.use(highlightsRouter);
router.use(dmRouter);
router.use(callsRouter);
router.use(gifRouter);
router.use(companionsRouter);
router.use(gamesRouter);
router.use(booksRouter);
router.use(interactiveRouter);
router.use(liveRouter);
router.use(communitiesRouter);
router.use(universesRouter);
router.use(reportsRouter);
router.use(loopRouter);

// ÖNEMLİ: React kodlarını (createRoot, App, vs.) BURADAN SİLMELİSİN!
// Bu dosya sadece API'yi yönetmeli.

export default router;
