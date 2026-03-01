CREATE TABLE `x_scheduled_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`scheduled_for` integer NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`x_tweet_id` text,
	`sent_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `x_scheduled_posts_status_scheduled_for_idx` ON `x_scheduled_posts` (`status`,`scheduled_for`);
--> statement-breakpoint
CREATE INDEX `x_scheduled_posts_user_id_scheduled_for_idx` ON `x_scheduled_posts` (`user_id`,`scheduled_for`);
