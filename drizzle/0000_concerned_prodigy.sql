CREATE TABLE `origin_baseline` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`saved_at` text NOT NULL,
	`source_file_name` text NOT NULL,
	`newest_deal_key` text NOT NULL,
	`newest_target` text NOT NULL,
	`newest_source_date` text NOT NULL,
	`deal_keys_json` text NOT NULL,
	`total_checked` integer NOT NULL
);
