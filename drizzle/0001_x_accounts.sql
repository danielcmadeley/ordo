CREATE TABLE `x_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`x_user_id` text NOT NULL,
	`username` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`scope` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `x_accounts_user_id_unique` ON `x_accounts` (`user_id`);
