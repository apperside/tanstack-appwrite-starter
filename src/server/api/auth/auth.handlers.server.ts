import type { AuthSession, User } from "#/core/auth/types";
import { AppError, toAppError } from "#/lib/errors";
import { isGuest } from "#/lib/guards";
import type {
	ConfirmVerificationInput,
	RequestResetInput,
	ResetPasswordInput,
	SignInInput,
	SignUpInput,
} from "#/lib/schemas/auth.schemas";
import type {
	HandlerArgs,
	Ok,
	ServerContext,
} from "#/server/context/context.types";
import { requireRegisteredUser, requireUser } from "#/server/require-user";
import { serverHooks } from "#/server/server-hooks.server";
import {
	seedPrefs,
	writePreferenceCookies,
} from "#/server/utils/account-prefs.server";

type NoInput = Pick<HandlerArgs<undefined>, "context">;

/**
 * The user behind a session just created, with their locale and theme
 * mirrored into the cookies: the account's preferences win (R39).
 */
async function sessionUser(
	context: ServerContext,
	session: AuthSession,
): Promise<User> {
	const user = await context.auth.session(session.token).getUser();
	writePreferenceCookies(context, user.prefs);
	return user;
}

/** Seeds a new account's prefs; a failure only logs, as readers fall back to the defaults. */
async function seedNewAccountPrefs(context: ServerContext, token: string) {
	try {
		await context.auth.session(token).updatePrefs(seedPrefs(context));
	} catch (error) {
		console.warn("Could not save the default preferences", error);
	}
}

/** Sends a verification email; a failure only logs, as the user can request another. */
async function trySendVerification(context: ServerContext, token: string) {
	try {
		await context.auth
			.session(token)
			.sendVerification({ redirectUrl: context.appLink("/verify-email") });
	} catch (error) {
		console.warn("Could not send the verification email", error);
	}
}

/** The signed-in user, or `null`. */
export async function getCurrentUserHandler({
	context,
}: NoInput): Promise<User | null> {
	return context.getUser();
}

/** Signs in with email and password, starts the session cookie and returns the user. */
export async function signInHandler({
	data,
	context,
}: HandlerArgs<SignInInput>): Promise<User> {
	const { email, password } = data;
	context.rateLimit("signIn", context.clientIp);
	context.rateLimit("signInEmail", `${context.clientIp}|${email}`);
	const session = await context.auth.signIn({ email, password });
	context.sessionCookie.write(session);
	return sessionUser(context, session);
}

/** Creates an account, signs it in and sends the verification email. */
export async function signUpHandler({
	data,
	context,
}: HandlerArgs<SignUpInput>): Promise<User> {
	context.rateLimit("signUp", context.clientIp);
	const session = await context.auth.signUp(data);
	context.sessionCookie.write(session);
	await seedNewAccountPrefs(context, session.token);
	await trySendVerification(context, session.token);
	return sessionUser(context, session);
}

/**
 * Ends the current session. The cookie is cleared even when the backend
 * rejects (e.g. it already expired), and so is the guest banner's dismissal.
 */
export async function signOutHandler({ context }: NoInput): Promise<void> {
	try {
		await context.session().signOut();
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
		await context.session().signOutEverywhere();
	} catch (error) {
		if (toAppError(error).code !== "UNAUTHENTICATED") throw error;
	}
	context.sessionCookie.clear();
	context.preferenceCookies.clearGuestBannerDismissed();
}

/** Starts an anonymous session (a guest account) and returns the guest. */
export async function startGuestSessionHandler({
	context,
}: NoInput): Promise<User> {
	context.rateLimit("guest", context.clientIp);
	const session = await context.auth.startGuest();
	context.sessionCookie.write(session);
	context.preferenceCookies.clearGuestBannerDismissed();
	await seedNewAccountPrefs(context, session.token);
	return sessionUser(context, session);
}

/**
 * Turns the current guest into a regular account in place (same id, so its
 * data stays). The backend resolves the session to keep; its cookie is
 * written before anything else can fail.
 */
export async function upgradeGuestHandler({
	data,
	context,
}: HandlerArgs<SignUpInput>): Promise<User> {
	context.rateLimit("signUp", context.clientIp);
	const user = await requireUser(context);
	if (!isGuest(user)) throw new AppError("FORBIDDEN");
	const session = await context.session().upgradeGuest(data);
	context.sessionCookie.write(session);
	await trySendVerification(context, session.token);
	return sessionUser(context, session);
}

/**
 * A guest signs in to an existing account. The order is fixed: the credentials are
 * validated first (signing in), so nothing is destroyed on a typo; then the merge
 * hook runs while the guest still exists; only then the guest is deleted.
 */
export async function signInAndMergeGuestHandler({
	data,
	context,
}: HandlerArgs<SignInInput>): Promise<User> {
	const { email, password } = data;
	context.rateLimit("signIn", context.clientIp);
	context.rateLimit("signInEmail", `${context.clientIp}|${email}`);
	const guest = await requireUser(context);
	if (!isGuest(guest)) throw new AppError("FORBIDDEN");
	const session = await context.auth.signIn({ email, password });
	try {
		await serverHooks.onGuestMerge({
			guestUserId: guest.id,
			userId: session.userId,
			data: context.data,
		});
		await context.auth.admin.deleteUser(guest.id);
	} catch (error) {
		// Do not leave an orphan session in the real user's session list.
		await context.auth.admin
			.deleteSession({ userId: session.userId, sessionId: session.id })
			.catch((cleanupError: unknown) =>
				console.warn("Could not delete the unused session", cleanupError),
			);
		throw error;
	}
	context.sessionCookie.write(session);
	return sessionUser(context, session);
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
		await context.auth.requestPasswordReset({
			email,
			redirectUrl: context.appLink("/reset-password"),
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
	await context.auth.resetPassword(data);
	return { ok: true };
}

/** Emails the signed-in user a verification link. Guests have no email, so they cannot. */
export async function sendVerificationHandler({
	context,
}: NoInput): Promise<Ok> {
	await requireRegisteredUser(context);
	await context
		.session()
		.sendVerification({ redirectUrl: context.appLink("/verify-email") });
	return { ok: true };
}

/** Confirms an email from its link; the link may be opened signed out. */
export async function confirmVerificationHandler({
	data,
	context,
}: HandlerArgs<ConfirmVerificationInput>): Promise<Ok> {
	await context.auth.confirmVerification(data.link);
	return { ok: true };
}
