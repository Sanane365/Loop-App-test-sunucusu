import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, followsTable } from "@workspace/db";
import { eq, notInArray, ne } from "drizzle-orm";
import { getUserWithStats } from "../lib/helpers";

const router = Router();

router.get("/explore/suggested-users", async (req, res) => {
  try {
    const viewerId = req.user?.id;

    let users;
    if (viewerId) {
      const following = await db
        .select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, viewerId));

      const followingIds = following.map((f) => f.followingId);
      const excludeIds = [...followingIds, viewerId];

      users = await db
        .select()
        .from(usersTable)
        .where(notInArray(usersTable.id, excludeIds))
        .limit(10);
    } else {
      users = await db.select().from(usersTable).limit(10);
    }

    const enriched = await Promise.all(users.map((u) => getUserWithStats(u.id, viewerId)));
    res.json(enriched.filter(Boolean));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
