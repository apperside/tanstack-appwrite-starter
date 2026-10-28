import type { Models } from "node-appwrite";
import { type AppUser, DEFAULT_PREFS } from "#/lib/appwrite/app-models";

/** Fixed "now" for every fixture, so tests never depend on the clock. */
const REFERENCE_DATE = "2026-01-01T00:00:00.000+00:00";
const ONE_YEAR_LATER = "2027-01-01T00:00:00.000+00:00";

export function aUser(overrides: Partial<AppUser> = {}): AppUser {
	return {
		$id: "user-1",
		$createdAt: REFERENCE_DATE,
		$updatedAt: REFERENCE_DATE,
		name: "Test User",
		registration: REFERENCE_DATE,
		status: true,
		labels: [],
		passwordUpdate: REFERENCE_DATE,
		email: "user@example.test",
		phone: "",
		emailVerification: true,
		phoneVerification: false,
		mfa: false,
		prefs: { ...DEFAULT_PREFS },
		targets: [],
		accessedAt: REFERENCE_DATE,
		...overrides,
	};
}

/** An anonymous (guest) account: no email, name or password. */
export function aGuest(overrides: Partial<AppUser> = {}): AppUser {
	return aUser({
		$id: "guest-1",
		name: "",
		email: "",
		emailVerification: false,
		passwordUpdate: "",
		...overrides,
	});
}

export function aSession(
	overrides: Partial<Models.Session> = {},
): Models.Session {
	return {
		$id: "session-1",
		$createdAt: REFERENCE_DATE,
		$updatedAt: REFERENCE_DATE,
		userId: "user-1",
		expire: ONE_YEAR_LATER,
		provider: "email",
		providerUid: "user@example.test",
		providerAccessToken: "",
		providerAccessTokenExpiry: "",
		providerRefreshToken: "",
		ip: "127.0.0.1",
		osCode: "",
		osName: "",
		osVersion: "",
		clientType: "",
		clientCode: "",
		clientName: "",
		clientVersion: "",
		clientEngine: "",
		clientEngineVersion: "",
		deviceName: "",
		deviceBrand: "",
		deviceModel: "",
		countryCode: "",
		countryName: "",
		current: true,
		factors: ["password"],
		secret: "session-secret",
		mfaUpdatedAt: "",
		...overrides,
	};
}

export function aJwt(overrides: Partial<Models.Jwt> = {}): Models.Jwt {
	return { jwt: "jwt-token", ...overrides };
}

/** A session of an anonymous (guest) account. */
export function aGuestSession(
	overrides: Partial<Models.Session> = {},
): Models.Session {
	return aSession({
		userId: "guest-1",
		provider: "anonymous",
		providerUid: "",
		factors: [],
		...overrides,
	});
}
