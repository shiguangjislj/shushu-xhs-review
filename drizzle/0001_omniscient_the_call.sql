CREATE TABLE `account_daily_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`metric_date` text NOT NULL,
	`views` integer,
	`avg_watch_ms` integer,
	`home_views` integer,
	`likes` integer,
	`collects` integer,
	`comments` integer,
	`danmaku` integer,
	`shares` integer,
	`interactions` integer,
	`followers_gained` integer,
	`collected_at` text NOT NULL,
	`raw_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_daily_metrics_account_date_unique` ON `account_daily_metrics` (`account_id`,`metric_date`);