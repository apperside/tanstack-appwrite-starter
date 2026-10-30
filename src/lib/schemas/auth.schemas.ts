// zod/mini: these schemas ship to the browser (forms, route search), and the
// functional API tree-shakes to the checks actually used.
import { z } from "zod/mini";

export const emailSchema = z.pipe(
	z.string().check(z.trim(), z.toLowerCase()),
	z.email(),
);
export const passwordSchema = z
	.string()
	.check(z.minLength(8), z.maxLength(256));
/** The longest display name Appwrite accepts (the strictest backend so far). */
export const NAME_MAX_LENGTH = 128;
export const nameSchema = z
	.string()
	.check(z.trim(), z.minLength(1), z.maxLength(NAME_MAX_LENGTH));

export const signInSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
});
export const signUpSchema = z.object({
	name: nameSchema,
	email: emailSchema,
	password: passwordSchema,
});

/**
 * An emailed link's credential: its query parameters, whichever the backend
 * uses (`EmailLinkParams`). Bounded, as it comes from the client.
 */
const linkParamsSchema = z
	.record(
		z.string().check(z.minLength(1), z.maxLength(64)),
		z.string().check(z.minLength(1), z.maxLength(2048)),
	)
	.check(
		z.refine((link) => {
			const size = Object.keys(link).length;
			return size >= 1 && size <= 8;
		}),
	);

export const requestResetSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
	link: linkParamsSchema,
	password: passwordSchema,
});
export const confirmVerificationSchema = z.object({ link: linkParamsSchema });

/**
 * A flag in a page URL, `?name=1`. The router parses search values as JSON, so
 * it is the number 1 (a string "1" would serialize as `%221%22`); anything else
 * reads as absent.
 */
const flagSchema = z.catch(z.optional(z.literal(1)), undefined);

/** `/login`: where to go afterwards, and `merge=1` for a guest signing in to an existing account. */
export const loginSearchSchema = z.object({
	redirect: z.catch(z.optional(z.string()), undefined),
	merge: flagSchema,
});
/** `/signup`: `upgrade=1` for a guest saving their account. */
export const signupSearchSchema = z.object({ upgrade: flagSchema });

/**
 * `/reset-password`, `/verify-email`: an emailed link's parameters, passed to
 * the backend as they are (it knows which carry the credential). The router
 * reads an all-digits value as a number; other non-strings and empty values
 * are dropped.
 */
export const emailLinkSearchSchema = z.catch(
	z.pipe(
		z.record(z.string(), z.unknown()),
		z.transform(
			(search): Record<string, string> =>
				Object.fromEntries(
					Object.entries(search).flatMap(([key, value]) =>
						(typeof value === "string" && value !== "") ||
						typeof value === "number"
							? [[key, String(value)]]
							: [],
					),
				),
		),
	),
	{},
);

export type SignInInput = z.output<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type RequestResetInput = z.output<typeof requestResetSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
export type ConfirmVerificationInput = z.output<
	typeof confirmVerificationSchema
>;
