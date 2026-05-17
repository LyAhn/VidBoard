import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  artistName: text("artist_name").notNull().default(""),
  trackTitle: text("track_title").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // Full AppState as JSON (images excluded — stored on disk, paths in frame data)
  stateJson: text("state_json").notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type InsertProjectRow = typeof projects.$inferInsert;
