import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { AppPrefs } from "#/core/prefs";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey(),
		/** `null` means a guest. */
		email: text("email"),
		name: text("name").notNull().default(""),
		passwordHash: text("password_hash"),
		emailVerified: boolean("email_verified").notNull().default(false),
		prefs: jsonb("prefs").$type<Partial<AppPrefs>>().notNull().default({}),
		createdAt: timestamptz("created_at").notNull(),
	},
	(table) => [uniqueIndex("users_email_key").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull().unique(),
		userAgent: text("user_agent"),
		createdAt: timestamptz("created_at").notNull(),
		expiresAt: timestamptz("expires_at").notNull(),
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		index("sessions_expires_at_idx").on(table.expiresAt),
	],
);

export const emailLinks = pgTable(
	"email_links",
	{
		tokenHash: text("token_hash").primaryKey(),
		purpose: text("purpose").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** The address the link was sent to. */
		email: text("email").notNull(),
		expiresAt: timestamptz("expires_at").notNull(),
	},
	(table) => [
		check(
			"email_links_purpose_check",
			sql`${table.purpose} in ('verification', 'recovery')`,
		),
	],
);

export const todos = pgTable(
	"todos",
	{
		id: uuid("id").primaryKey(),
		/** Insertion order; never exposed except as the list cursor. */
		seq: bigint("seq", { mode: "number" })
			.generatedAlwaysAsIdentity()
			.notNull(),
		ownerId: text("owner_id").notNull(),
		title: text("title").notNull(),
		completed: boolean("completed").notNull(),
		priority: text("priority").$type<"low" | "normal" | "high">().notNull(),
		dueDate: timestamptz("due_date"),
		createdAt: timestamptz("created_at").notNull(),
		updatedAt: timestamptz("updated_at").notNull(),
	},
	(table) => [
		index("todos_owner_seq_idx").on(
			table.ownerId,
			table.seq.desc().nullsFirst(),
		),
		check(
			"todos_priority_check",
			sql`${table.priority} in ('low', 'normal', 'high')`,
		),
	],
);
