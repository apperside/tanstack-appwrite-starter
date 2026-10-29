import type { AuthSession, User } from "#/core/auth/types";
import { DEFAULT_PREFS } from "#/core/prefs";

/** Fixed "now" for every fixture, so tests never depend on the clock. */
const REFERENCE_DATE = "2026-01-01T00:00:00.000+00:00";
const ONE_YEAR_LATER = "2027-01-01T00:00:00.000+00:00";

export function aUser(overrides: Partial<User> = {}): User {
	return {
		id: "user-1",
		email: "user@example.test",
		name: "Test User",
		emailVerified: true,
		isGuest: false,
		prefs: { ...DEFAULT_PREFS },
		createdAt: REFERENCE_DATE,
		...overrides,
	};
}

/** An anonymous (guest) account: no email, name or password. */
export function aGuest(overrides: Partial<User> = {}): User {
	return aUser({
		id: "guest-1",
		name: "",
		email: "",
		emailVerified: false,
		isGuest: true,
		...overrides,
	});
}

export function aSession(overrides: Partial<AuthSession> = {}): AuthSession {
	return {
		id: "session-1",
		userId: "user-1",
		token: "session-secret",
		expiresAt: ONE_YEAR_LATER,
		...overrides,
	};
}
