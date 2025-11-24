CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bounties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`deadline` text NOT NULL,
	`created_at` integer NOT NULL,
	`creator` text NOT NULL,
	`reward` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `commits` (
	`repo_full_name` text,
	`author` text,
	`date` text,
	`message` text,
	`avatar_url` text
);
--> statement-breakpoint
CREATE TABLE `cron_job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`start_timestamp` text NOT NULL,
	`end_timestamp` text,
	`status` text NOT NULL,
	`duration_ms` integer
);
--> statement-breakpoint
CREATE TABLE `developer_profiles` (
	`github_login` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`bio` text,
	`twitter_username` text,
	`website` text,
	`nano_address` text,
	`gh_sponsors` integer,
	`patreon_url` text,
	`goal_title` text,
	`goal_amount` integer,
	`goal_nano_address` text,
	`goal_website` text,
	`goal_description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `developer_profiles_user_id_unique` ON `developer_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_run_id` integer NOT NULL,
	`timestamp` text NOT NULL,
	`level` text NOT NULL,
	`message` text NOT NULL,
	`duration_ms` integer
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`title` text,
	`open_issues` integer,
	`closed_issues` integer,
	`url` text,
	`number` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `misc` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `node_events` (
	`event` text,
	`type` text,
	`author` text,
	`avatar_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `public_nodes` (
	`endpoint` text,
	`website` text,
	`websocket` text,
	`up` integer,
	`resp_time` integer,
	`version` text,
	`error` text,
	`deprecated` integer
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`full_name` text PRIMARY KEY NOT NULL,
	`name` text,
	`created_at` integer NOT NULL,
	`stargazers_count` integer,
	`prs_30d` integer DEFAULT 0,
	`prs_7d` integer DEFAULT 0,
	`commits_30d` integer DEFAULT 0,
	`commits_7d` integer DEFAULT 0,
	`description` text,
	`avatar_url` text
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
