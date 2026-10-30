import { z } from "zod/mini";
import type { AppPrefs } from "#/core/prefs";
import { emailSchema, nameSchema, passwordSchema } from "./auth.schemas";

export const changePasswordSchema = z.object({
	currentPassword: z.string().check(z.minLength(1)),
	newPassword: passwordSchema,
});
export const changeEmailSchema = z.object({
	email: emailSchema,
	password: z.string().check(z.minLength(1)),
});
export const changeNameSchema = z.object({ name: nameSchema });

const prefsShape = z.object({
	locale: z.enum(["en", "it"]),
	theme: z.enum(["light", "dark", "system"]),
	onboardingCompleted: z.boolean(),
}) satisfies z.ZodMiniType<AppPrefs>;
export const updatePreferencesSchema = z.partial(prefsShape);

export type ChangePasswordInput = z.output<typeof changePasswordSchema>;
export type ChangeEmailInput = z.output<typeof changeEmailSchema>;
export type ChangeNameInput = z.output<typeof changeNameSchema>;
export type UpdatePreferencesInput = z.output<typeof updatePreferencesSchema>;
