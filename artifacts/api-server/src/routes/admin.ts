import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const allUsers = await db.select().from(usersTable);
    res.json(allUsers);
  } catch (error) {
    console.error("Veritabanı hatası:", error);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

export default router;