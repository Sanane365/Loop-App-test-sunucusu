import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const gameScoresTable = pgTable("game_scores", {
  id:             serial("id").primaryKey(),
  userId:         integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gameSlug:       text("game_slug").notNull(),          // "wordle"
  wins:           integer("wins").notNull().default(0),
  losses:         integer("losses").notNull().default(0),
  gamesPlayed:    integer("games_played").notNull().default(0),
  currentStreak:  integer("current_streak").notNull().default(0),
  bestStreak:     integer("best_streak").notNull().default(0),
  lastPlayedDate: text("last_played_date"),             // "YYYY-MM-DD" — günde 1 oyun
  lastResult:     text("last_result"),                  // "won" | "lost"
  lastAttempts:   integer("last_attempts"),             // kaç denemede bitti
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});
