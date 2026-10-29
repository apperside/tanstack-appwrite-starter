import type { AppPrefs } from "../prefs";
import type {
	AuthSession,
	Credentials,
	DeviceSession,
	EmailLinkParams,
	SignUpData,
	User,
} from "./types";

/*
 * The auth surface the app needs from a backend. An adapter implements it
 * over its vendor (Appwrite, a database, ...) and rejects only with `AppError`
 * codes, so the handlers never see a vendor error. The contract tests in
 * `auth.contract.ts` pin the behavior every adapter must share.
 */

/** Auth operations that need no session. Built per request (see `Backend`). */
export interface AuthService {
	/** Creates an account and signs it in. `EMAIL_TAKEN`, `WEAK_PASSWORD`. */
	signUp(input: SignUpData): Promise<AuthSession>;
	/** `INVALID_CREDENTIALS` for an unknown email or a wrong password. */
	signIn(input: Credentials): Promise<AuthSession>;
	/** Creates a guest account (see `User.isGuest`) and signs it in. */
	startGuest(): Promise<AuthSession>;
	/**
	 * Emails a password-reset link to `redirectUrl`, with the credential in its
	 * query (`EmailLinkParams`). `NOT_FOUND` for an email with no account.
	 */
	requestPasswordReset(input: {
		email: string;
		redirectUrl: string;
	}): Promise<void>;
	/** `INVALID_TOKEN` for a link that is malformed, used or expired. */
	resetPassword(input: {
		link: EmailLinkParams;
		password: string;
	}): Promise<void>;
	/** `INVALID_TOKEN` for a link that is malformed, used or expired. */
	confirmVerification(link: EmailLinkParams): Promise<void>;
	/** Acts as the holder of `token`; nothing is checked until a call. */
	session(token: string): SessionAuth;
	/** Privileged operations, outside any user's permissions. */
	admin: AdminAuth;
}

/** Auth operations of one session's holder. */
export interface SessionAuth {
	/** `UNAUTHENTICATED` once the session expired or was revoked (as every method here). */
	getUser(): Promise<User>;
	signOut(): Promise<void>;
	signOutEverywhere(): Promise<void>;
	listSessions(): Promise<DeviceSession[]>;
	updateName(name: string): Promise<void>;
	/** The new email is unverified. `INVALID_CREDENTIALS`, `EMAIL_TAKEN`. */
	updateEmail(input: Credentials): Promise<void>;
	/** `INVALID_CREDENTIALS` for a wrong `oldPassword`; `WEAK_PASSWORD`. */
	updatePassword(input: {
		password: string;
		oldPassword: string;
	}): Promise<void>;
	/** Emails a verification link to `redirectUrl` (see `requestPasswordReset`). */
	sendVerification(input: { redirectUrl: string }): Promise<void>;
	/** Merges `patch` into the stored prefs and resolves the stored result. */
	updatePrefs(patch: Partial<AppPrefs>): Promise<Partial<AppPrefs>>;
	/**
	 * Turns this guest into a registered (unverified) account, keeping its id
	 * and so its data. Resolves the session to use from now on: this one, or a
	 * new one when the backend ends it. `EMAIL_TAKEN`, `WEAK_PASSWORD`.
	 */
	upgradeGuest(input: SignUpData): Promise<AuthSession>;
}

export interface AdminAuth {
	/** Deletes the account and ends its sessions. */
	deleteUser(userId: string): Promise<void>;
	deleteSession(input: { userId: string; sessionId: string }): Promise<void>;
}
