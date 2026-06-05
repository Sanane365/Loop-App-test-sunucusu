import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import postsRouter from "./posts";
import storiesRouter from "./stories";
import chatRouter from "./chat";
import notificationsRouter from "./notifications";
import exploreRouter from "./explore";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(storiesRouter);
router.use(chatRouter);
router.use(notificationsRouter);
router.use(exploreRouter);

export default router;
