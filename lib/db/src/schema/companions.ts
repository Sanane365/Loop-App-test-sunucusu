import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const companionsTable = pgTable("companions", {
  id:          serial("id").primaryKey(),
  slug:        text("slug").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description"),
  imageUrl:    text("image_url").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});
