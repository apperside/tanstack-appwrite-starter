import type { AppPrefs } from "../prefs";

/** An account as the app sees it. Each backend maps its own user to this. */
export type User = {
	id: string;
	/** Empty for a guest. */
	email: string;
	name: string;
	emailVerified: boolean;
	/** An anonymous account: no email or password until it is upgraded. */
	isGuest: boolean;
	/** What was stored; readers fall back to `DEFAULT_PREFS` for the rest. */
	prefs: Partial<AppPrefs>;
	createdAt: string;
};

/** A session just created. Its `token` is what the session cookie holds. */
export type AuthSession = {
	id: string;
	userId: string;
	token: string;
	expiresAt: string;
};

/**
 * A session as the settings list it. No IP or country: sessions are created
 * server-side, so a backend records the app server's address, not the visitor's.
 */
export type DeviceSession = {
	id: string;
	current: boolean;
	/** Empty when unknown. */
	clientName: string;
	osName: string;
	deviceName: string;
	createdAt: string;
};

/**
 * The query parameters of an emailed link (email verification, password
 * reset). Which ones carry the credential is the backend's business: the app
 * passes them through untouched.
 */
export type EmailLinkParams = Record<string, string>;

export type Credentials = { email: string; password: string };

export type SignUpData = Credentials & { name: string };
