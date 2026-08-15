CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`platform` text DEFAULT 'xiaohongshu' NOT NULL,
	`platform_account_id` text,
	`nickname` text NOT NULL,
	`avatar_url` text,
	`connection_status` text DEFAULT 'pending' NOT NULL,
	`last_verified_at` text,
	`last_successful_collection_at` text,
	`last_failed_collection_at` text,
	`collector_version` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `accounts_workspace_idx` ON `accounts` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_platform_account_unique` ON `accounts` (`platform`,`platform_account_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `change_events` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`from_version_id` text,
	`to_version_id` text NOT NULL,
	`change_types_json` text NOT NULL,
	`summary` text NOT NULL,
	`hypothesis` text,
	`target_metric` text,
	`effective_at` text NOT NULL,
	`operator_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_version_id`) REFERENCES `video_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_version_id`) REFERENCES `video_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `change_events_video_time_idx` ON `change_events` (`video_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `collection_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`video_id` text,
	`job_type` text NOT NULL,
	`target_node_hours` integer,
	`scheduled_for` text NOT NULL,
	`executed_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_retry_at` text,
	`error_code` text,
	`error_message` text,
	`is_backfill` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_jobs_video_node_unique` ON `collection_jobs` (`video_id`,`job_type`,`target_node_hours`);--> statement-breakpoint
CREATE INDEX `collection_jobs_due_idx` ON `collection_jobs` (`account_id`,`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `diagnoses` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`node_hours` integer NOT NULL,
	`primary_stage` text NOT NULL,
	`secondary_stage` text,
	`confidence` text NOT NULL,
	`evidence_json` text NOT NULL,
	`normal_stages_json` text NOT NULL,
	`limitations_json` text NOT NULL,
	`possible_reasons_json` text NOT NULL,
	`rule_version` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`snapshot_id`) REFERENCES `metric_snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diagnoses_video_snapshot_unique` ON `diagnoses` (`video_id`,`snapshot_id`);--> statement-breakpoint
CREATE TABLE `experience_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`source_review_id` text,
	`title` text NOT NULL,
	`scope` text NOT NULL,
	`observation` text NOT NULL,
	`evidence_json` text NOT NULL,
	`related_changes_json` text,
	`action` text NOT NULL,
	`confidence` text DEFAULT 'low' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `experience_cards_workspace_idx` ON `experience_cards` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`video_id` text,
	`source_key` text NOT NULL,
	`collected_at` text NOT NULL,
	`age_hours` real,
	`target_node_hours` integer,
	`is_backfill` integer DEFAULT false NOT NULL,
	`completeness` text DEFAULT 'complete' NOT NULL,
	`missing_fields_json` text,
	`raw_json` text NOT NULL,
	`followers` integer,
	`views_7d` integer,
	`views_30d` integer,
	`interactions_7d` integer,
	`interactions_30d` integer,
	`followers_gained_7d` integer,
	`followers_gained_30d` integer,
	`exposures` integer,
	`views` integer,
	`cover_click_rate` real,
	`avg_watch_seconds` real,
	`completion_rate` real,
	`likes` integer,
	`comments` integer,
	`collects` integer,
	`shares` integer,
	`followers_gained` integer,
	`traffic_sources_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metric_snapshots_source_unique` ON `metric_snapshots` (`account_id`,`source_key`);--> statement-breakpoint
CREATE INDEX `metric_snapshots_video_time_idx` ON `metric_snapshots` (`video_id`,`collected_at`);--> statement-breakpoint
CREATE INDEX `metric_snapshots_baseline_idx` ON `metric_snapshots` (`account_id`,`target_node_hours`,`collected_at`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`diagnosis_id` text NOT NULL,
	`action` text NOT NULL,
	`object` text NOT NULL,
	`target_metric` text NOT NULL,
	`verification_method` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`diagnosis_id`) REFERENCES `diagnoses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recommendations_diagnosis_idx` ON `recommendations` (`diagnosis_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`system_summary` text NOT NULL,
	`human_summary` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`confirmed_by` text,
	`confirmed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_video_unique` ON `reviews` (`video_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `video_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`effective_at` text NOT NULL,
	`title` text NOT NULL,
	`cover_url` text,
	`cover_object_key` text,
	`video_url` text,
	`video_object_key` text,
	`video_file_name` text,
	`video_hash` text,
	`duration_seconds` real,
	`body` text,
	`topics_json` text,
	`publishing_strategy` text,
	`tags_json` text,
	`created_by` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_versions_number_unique` ON `video_versions` (`video_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `video_versions_effective_idx` ON `video_versions` (`video_id`,`effective_at`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`platform_video_id` text NOT NULL,
	`url` text,
	`title` text NOT NULL,
	`cover_url` text,
	`video_url` text,
	`published_at` text NOT NULL,
	`synced_at` text NOT NULL,
	`duration_seconds` real,
	`content_type` text DEFAULT 'video' NOT NULL,
	`category` text,
	`tags_json` text,
	`status` text DEFAULT 'monitoring' NOT NULL,
	`current_version_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_account_platform_unique` ON `videos` (`account_id`,`platform_video_id`);--> statement-breakpoint
CREATE INDEX `videos_account_published_idx` ON `videos` (`account_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
