CREATE TABLE `x_bookmarks` (
	`user_id` text NOT NULL,
	`bookmark_id` text NOT NULL,
	`text` text NOT NULL,
	`author_id` text,
	`created_at` text NOT NULL,
	`raw_json` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `bookmark_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `x_bookmarks_user_created_idx` ON `x_bookmarks` (`user_id`,`created_at`,`bookmark_id`);
--> statement-breakpoint
CREATE TABLE `x_bookmark_media` (
	`user_id` text NOT NULL,
	`bookmark_id` text NOT NULL,
	`media_key` text NOT NULL,
	`type` text NOT NULL,
	`url` text,
	`preview_image_url` text,
	`alt_text` text,
	`width` integer,
	`height` integer,
	PRIMARY KEY(`user_id`, `bookmark_id`, `media_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `x_bookmark_media_user_bookmark_idx` ON `x_bookmark_media` (`user_id`,`bookmark_id`);
--> statement-breakpoint
CREATE TABLE `x_bookmark_sync_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_synced_at` integer,
	`next_pagination_token` text,
	`last_sync_status` text,
	`last_error` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
