import type { Account, Client, Models, TablesDB, Users } from "node-appwrite";
import type { AdminTables, AppTables } from "./app-tables";
import type { Todos } from "./generated/appwrite";

/** The generated schema's enums. @public */
export { TodosPriority } from "./generated/appwrite";

export type Locale = "en" | "it";

export type ThemePreference = "light" | "dark" | "system";

/**
 * User preferences stored in the Appwrite account prefs.
 * An interface so apps can extend it by declaration merging.
 */
export interface AppPrefs {
	onboardingCompleted: boolean;
	locale: Locale;
	theme: ThemePreference;
}

export const DEFAULT_PREFS: AppPrefs = {
	onboardingCompleted: false,
	locale: "en",
	theme: "system",
};

export type AppUser = Models.User<AppPrefs & Models.Preferences>;

type Omitable = "$collectionId" | "$tableId" | "$databaseId" | keyof Models.Row;

/** Maps string enums to their literal unions so `"normal"` and `TodosPriority.NORMAL` both fit. */
type LiteralOf<P> = P extends string ? `${P}` : P;

/**
 * A row without Appwrite metadata; `$id` is optional (set on create).
 * @public
 */
export type AppDocument<T> = {
	[K in keyof Omit<T, Omitable>]: LiteralOf<T[K]>;
} & { $id?: string };

/** @public */
export type AppTodo = AppDocument<Todos>;

/** Table id to app row type. */
export type AppTablesTypeMap = {
	todos: AppTodo;
};

export const APP_TABLES = {
	TODOS: "todos",
} as const satisfies Record<string, keyof AppTablesTypeMap>;

/** Per-request Appwrite handles; `admin` adds the `users` service and unrestricted typed tables. */
export type AppClient<K extends "server" | "admin"> = {
	client: Client;
	account: Account;
	tables: TablesDB & { typed: K extends "admin" ? AdminTables : AppTables };
} & (K extends "admin" ? { users: Users } : unknown);
