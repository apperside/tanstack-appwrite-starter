import type { DeviceSession } from "#/core/auth/types";
import type { AppPrefs } from "#/core/prefs";
import { savePrefs } from "#/server/account-prefs.server";
import type { HandlerArgs, Ok } from "#/server/context";
import { requireRegisteredUser, requireUser } from "#/server/require-user";
import type {
	ChangeEmailInput,
	ChangeNameInput,
	ChangePasswordInput,
	UpdatePreferencesInput,
} from "./account.schemas";

/** The user's sessions, the current one first, then newest first. */
export async function listSessionsHandler({
	context,
}: Pick<HandlerArgs<undefined>, "context">): Promise<DeviceSession[]> {
	await requireUser(context);
	const sessions = await context.session().listSessions();
	return sessions.sort(
		(a, b) =>
			Number(b.current) - Number(a.current) ||
			Date.parse(b.createdAt) - Date.parse(a.createdAt),
	);
}

/** Changes the password; a wrong current password is `INVALID_CREDENTIALS`. */
export async function changePasswordHandler({
	data,
	context,
}: HandlerArgs<ChangePasswordInput>): Promise<Ok> {
	await requireRegisteredUser(context);
	await context.session().updatePassword({
		password: data.newPassword,
		oldPassword: data.currentPassword,
	});
	return { ok: true };
}

/** Changes the email (the new one is unverified) and sends the verification email. */
export async function changeEmailHandler({
	data,
	context,
}: HandlerArgs<ChangeEmailInput>): Promise<Ok> {
	await requireRegisteredUser(context);
	const session = context.session();
	await session.updateEmail(data);
	try {
		await session.sendVerification({
			redirectUrl: context.appLink("/verify-email"),
		});
	} catch (error) {
		// The email is already changed; the user can request another link later.
		console.warn("Could not send the verification email", error);
	}
	return { ok: true };
}

/** Changes the display name. */
export async function changeNameHandler({
	data,
	context,
}: HandlerArgs<ChangeNameInput>): Promise<Ok> {
	await requireUser(context);
	await context.session().updateName(data.name);
	return { ok: true };
}

/** Saves language, theme or onboarding state (see `savePrefs`) and returns the stored prefs. */
export async function updatePreferencesHandler({
	data,
	context,
}: HandlerArgs<UpdatePreferencesInput>): Promise<Partial<AppPrefs>> {
	await requireUser(context);
	return savePrefs(context, data);
}
