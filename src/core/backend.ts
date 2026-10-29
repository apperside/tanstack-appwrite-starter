import type { AuthService } from "./auth/ports";
import type { TodoRepository } from "./data/todos";

/** What a backend knows about the request it serves. */
export type RequestInfo = {
	/** The visitor's `User-Agent`, so the sessions a backend creates show their browser. */
	userAgent: string | undefined;
};

/** The app's storage, one repository per table. */
export type AppData = {
	todos: TodoRepository;
};

/**
 * A backend: everything the app stores or authenticates against. One adapter
 * per vendor implements it; `#/server/backend.server` picks the one in use.
 */
export interface Backend {
	/** The auth operations for one request. */
	auth(request: RequestInfo): AuthService;
	/** The repositories; they enforce ownership themselves, so they run with full privileges. */
	data: AppData;
}
