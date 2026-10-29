import type { Models } from "node-appwrite";
import { DEFAULT_PREFS } from "#/core/prefs";

/*
 * Appwrite SDK objects, for the Appwrite adapter's tests. Every other test
 * uses the backend-neutral fixtures in `./fixtures`.
 */

const REFERENCE_DATE = "2026-01-01T00:00:00.000+00:00";
const ONE_YEAR_LATER = "2027-01-01T00:00:00.000+00:00";

type AppwriteUser = Models.User<Models.Preferences>;

export function anAppwriteUser(
	overrides: Partial<AppwriteUser> = {},
): AppwriteUser {
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

export function anAppwriteSession(
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
export function anAppwriteGuestSession(
	overrides: Partial<Models.Session> = {},
): Models.Session {
	return anAppwriteSession({
		userId: "guest-1",
		provider: "anonymous",
		providerUid: "",
		factors: [],
		...overrides,
	});
}
