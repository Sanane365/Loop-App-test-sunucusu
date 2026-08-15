import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const companionsTable = pgTable("companions", {
  id:          serial("id").primaryKey(),
  slug:        text("slug").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description"),
  imageUrl:    text("image_url").notNull(),
  published:   boolean("published").notNull().default(false),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
