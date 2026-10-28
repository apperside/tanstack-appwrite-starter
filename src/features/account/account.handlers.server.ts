import type { AppPrefs } from "#/lib/appwrite/app-models";
import { savePrefs } from "#/server/account-prefs.server";
import type { HandlerArgs, Ok } from "#/server/context";
import { requireRegisteredUser, requireUser } from "#/server/require-user";
import type {
	ChangeEmailInput,
	ChangeNameInput,
	ChangePasswordInput,
	UpdatePreferencesInput,
} from "./account.schemas";
import type { SessionInfo } from "./account.types";

/** The user's sessions, the current one first, then newest first. */
export async function listSessionsHandler({
	context,
}: Pick<HandlerArgs<undefined>, "context">): Promise<SessionInfo[]> {
	await requireUser(context);
	const { sessions } = await context.appwrite.user().account.listSessions();
	return sessions
		.map(
			(s): SessionInfo => ({
				id: s.$id,
				current: s.current,
				clientName: s.clientName,
				osName: s.osName,
				deviceName: s.deviceName,
				createdAt: s.$createdAt,
			}),
		)
		.sort(
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
	await context.appwrite.user().account.updatePassword({
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
	const { account } = context.appwrite.user();
	await account.updateEmail(data);
	try {
		await account.createVerification({
			url: context.appLink("/verify-email"),
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
	await context.appwrite.user().account.updateName({ name: data.name });
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
