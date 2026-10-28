import { ID } from "appwrite";
import type { AppUser } from "#/lib/appwrite/app-models";
import { AppError, toAppError } from "#/lib/errors";
import { isGuest } from "#/lib/guards";
import {
	seedPrefs,
	writePreferenceCookies,
} from "#/server/account-prefs.server";
import type { HandlerArgs, Ok, ServerContext } from "#/server/context";
import { requireRegisteredUser, requireUser } from "#/server/require-user";
import { serverHooks } from "#/server/server-hooks.server";
import type {
	ConfirmVerificationInput,
	RequestResetInput,
	ResetPasswordInput,
	SignInInput,
	SignUpInput,
} from "./auth.schemas";

type NoInput = Pick<HandlerArgs<undefined>, "context">;

/**
 * The user behind a session just created, with their locale and theme
 * mirrored into the cookies: the account's preferences win (R39).
 */
async function sessionUser(
	context: ServerContext,
	sessionSecret: string,
): Promise<AppUser> {
	const user = await context.appwrite
		.forSession(sessionSecret)
		.account.get<AppUser["prefs"]>();
	writePreferenceCookies(context, user.prefs);
	return user;
}

/** The signed-in user, or `null`. */
export async function getCurrentUserHandler({
	context,
}: NoInput): Promise<AppUser | null> {
	return context.getUser();
}

/** A short-lived JWT for the browser SDK (realtime), bound to the current session. */
export async function issueBrowserJwtHandler({
	context,
}: NoInput): Promise<{ jwt: string }> {
	const user = await requireUser(context);
	const session = await context.appwrite
		.user()
		.account.getSession({ sessionId: "current" });
	const { jwt } = await context.appwrite
		.admin()
		.users.createJWT({ userId: user.$id, sessionId: session.$id });
	return { jwt };
}

/** Signs in with email and password, starts the session cookie and returns the user. */
export async function signInHandler({
	data,
	context,
}: HandlerArgs<SignInInput>): Promise<AppUser> {
	const { email, password } = data;
	context.rateLimit("signIn", context.clientIp);
	context.rateLimit("signInEmail", `${context.clientIp}|${email}`);
	const session = await context.appwrite
		.admin()
		.account.createEmailPasswordSession({ email, password });
	context.sessionCookie.write(session);
	return sessionUser(context, session.secret);
}

/** Creates an account, signs it in and sends the verification email. */
export async function signUpHandler({
	data,
	context,
}: HandlerArgs<SignUpInput>): Promise<AppUser> {
	const { name, email, password } = data;
	context.rateLimit("signUp", context.clientIp);
	const { account } = context.appwrite.admin();
	await account.create({ userId: ID.unique(), email, password, name });
	const session = await account.createEmailPasswordSession({
		email,
		password,
	});
	context.sessionCookie.write(session);
	const userAccount = context.appwrite.forSession(session.secret).account;
	try {
		await userAccount.updatePrefs({ prefs: seedPrefs(context) });
	} catch (error) {
		// Readers fall back to the defaults; signup itself succeeded.
		console.warn("Could not save the default preferences", error);
	}
	try {
		await userAccount.createVerification({
			url: context.appLink("/verify-email"),
		});
	} catch (error) {
		// The user can request another email later; signup itself succeeded.
		console.warn("Could not send the verification email", error);
	}
	return sessionUser(context, session.secret);
}

/**
 * Ends the current session. The cookie is cleared even when Appwrite rejects
 * (e.g. it already expired), and so is the guest banner's dismissal.
 */
export async function signOutHandler({ context }: NoInput): Promise<void> {
	try {
		await context.appwrite
			.user()
			.account.deleteSession({ sessionId: "current" });
	} catch (error) {
		console.warn("Could not delete the current session", error);
	} finally {
		context.sessionCookie.clear();
		context.preferenceCookies.clearGuestBannerDismissed();
	}
}

/**
 * Ends every session of the signed-in user, then clears the cookie. A missing or
 * expired session already means "signed out", so that also clears the cookie and resolves.
 */
export async function signOutEverywhereHandler({
	context,
}: NoInput): Promise<void> {
	try {
		await context.appwrite.user().account.deleteSessions();
	} catch (error) {
		if (toAppError(error).code !== "UNAUTHENTICATED") throw error;
	}
	context.sessionCookie.clear();
	context.preferenceCookies.clearGuestBannerDismissed();
}

/** Starts an anonymous session (a guest account) and returns the guest. */
export async function startGuestSessionHandler({
	context,
}: NoInput): Promise<AppUser> {
	context.rateLimit("guest", context.clientIp);
	const session = await context.appwrite
		.admin()
		.account.createAnonymousSession();
	context.sessionCookie.write(session);
	context.preferenceCookies.clearGuestBannerDismissed();
	const { account } = context.appwrite.forSession(session.secret);
	try {
		await account.updatePrefs({ prefs: seedPrefs(context) });
	} catch (error) {
		// Readers fall back to the defaults; the guest session itself started.
		console.warn("Could not save the default preferences", error);
	}
	return sessionUser(context, session.secret);
}

/**
 * Turns the current guest into a regular account in place (same `$id`, so its data
 * stays), then swaps the guest session for an email session. `updateEmail` is the
 * commit point; the rest is ordered so a failure never leaves the user without a
 * working session: the new session is created and its cookie written before the old
 * guest session is dropped.
 */
export async function upgradeGuestHandler({
	data,
	context,
}: HandlerArgs<SignUpInput>): Promise<AppUser> {
	const { name, email, password } = data;
	context.rateLimit("signUp", context.clientIp);
	const user = await requireUser(context);
	if (!isGuest(user)) throw new AppError("FORBIDDEN");
	// Taken before the cookie changes, so it is still the guest's client.
	const guestClient = context.appwrite.user();
	await guestClient.account.updateEmail({ email, password });
	try {
		await guestClient.account.updateName({ name });
	} catch (error) {
		// The email is already converted; the name can be set again later.
		console.warn("Could not save the name", error);
	}
	const session = await context.appwrite
		.admin()
		.account.createEmailPasswordSession({ email, password });
	context.sessionCookie.write(session);
	try {
		await guestClient.account.deleteSession({ sessionId: "current" });
	} catch (error) {
		// The guest session expires on its own.
		console.warn("Could not delete the guest session", error);
	}
	const { account } = context.appwrite.forSession(session.secret);
	try {
		await account.createVerification({
			url: context.appLink("/verify-email"),
		});
	} catch (error) {
		console.warn("Could not send the verification email", error);
	}
	return sessionUser(context, session.secret);
}

/**
 * A guest signs in to an existing account. The order is fixed: the credentials are
 * validated first (the admin creates the session), so nothing is destroyed on a typo;
 * then the merge hook runs while the guest still exists; only then the guest is deleted.
 */
export async function signInAndMergeGuestHandler({
	data,
	context,
}: HandlerArgs<SignInInput>): Promise<AppUser> {
	const { email, password } = data;
	context.rateLimit("signIn", context.clientIp);
	context.rateLimit("signInEmail", `${context.clientIp}|${email}`);
	const guest = await requireUser(context);
	if (!isGuest(guest)) throw new AppError("FORBIDDEN");
	const admin = context.appwrite.admin();
	const session = await admin.account.createEmailPasswordSession({
		email,
		password,
	});
	try {
		await serverHooks.onGuestMerge({
			guestUserId: guest.$id,
			userId: session.userId,
			admin,
		});
		await admin.users.delete({ userId: guest.$id });
	} catch (error) {
		// Do not leave an orphan session in the real user's session list.
		await admin.users
			.deleteSession({ userId: session.userId, sessionId: session.$id })
			.catch((cleanupError: unknown) =>
				console.warn("Could not delete the unused session", cleanupError),
			);
		throw error;
	}
	context.sessionCookie.write(session);
	return sessionUser(context, session.secret);
}

/**
 * Emails a password-recovery link. Always resolves `{ ok: true }` for a well-formed
 * request, so accounts cannot be enumerated: an unknown email is swallowed, and so
 * is a failure to send (logged), which only an existing email can reach. Only rate
 * limits surface.
 */
export async function requestPasswordResetHandler({
	data,
	context,
}: HandlerArgs<RequestResetInput>): Promise<Ok> {
	const { email } = data;
	context.rateLimit("passwordResetIp", context.clientIp);
	context.rateLimit("passwordReset", `${context.clientIp}|${email}`);
	try {
		await context.appwrite.admin().account.createRecovery({
			email,
			url: context.appLink("/reset-password"),
		});
	} catch (error) {
		const { code } = toAppError(error);
		if (code === "RATE_LIMITED") throw error;
		if (code !== "NOT_FOUND") {
			console.error("Could not send the password-recovery email", error);
		}
	}
	return { ok: true };
}

/** Sets a new password from a recovery link; an expired or invalid link is `INVALID_TOKEN`. */
export async function resetPasswordHandler({
	data,
	context,
}: HandlerArgs<ResetPasswordInput>): Promise<Ok> {
	await context.appwrite.admin().account.updateRecovery(data);
	return { ok: true };
}

/** Emails the signed-in user a verification link. Guests have no email, so they cannot. */
export async function sendVerificationHandler({
	context,
}: NoInput): Promise<Ok> {
	await requireRegisteredUser(context);
	await context.appwrite.user().account.createVerification({
		url: context.appLink("/verify-email"),
	});
	return { ok: true };
}

/**
 * Confirms an email from its link, as nobody: the link may be opened signed
 * out, and Appwrite refuses this call with an API key (`general_unauthorized_scope`).
 */
export async function confirmVerificationHandler({
	data,
	context,
}: HandlerArgs<ConfirmVerificationInput>): Promise<Ok> {
	await context.appwrite.anonymous().account.updateVerification(data);
	return { ok: true };
}
