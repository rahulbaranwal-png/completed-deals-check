import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const originBaseline = sqliteTable("origin_baseline", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
  savedAt: text("saved_at").notNull(),
  sourceFileName: text("source_file_name").notNull(),
  newestDealKey: text("newest_deal_key").notNull(),
  newestTarget: text("newest_target").notNull(),
  newestSourceDate: text("newest_source_date").notNull(),
  dealKeysJson: text("deal_keys_json").notNull(),
  totalChecked: integer("total_checked").notNull(),
});
