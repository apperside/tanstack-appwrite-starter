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
/** The longest display name Appwrite accepts. */
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

const tokenSchema = z.string().check(z.minLength(1));

export const requestResetSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
	userId: tokenSchema,
	secret: tokenSchema,
	password: passwordSchema,
});
export const confirmVerificationSchema = z.object({
	userId: tokenSchema,
	secret: tokenSchema,
});

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

/** A link credential: the router reads an all-digits value as a number. */
const linkTokenSchema = z.catch(
	z.optional(
		z.pipe(
			z.pipe(z.union([z.string(), z.number()]), z.transform(String)),
			tokenSchema,
		),
	),
	undefined,
);

/** `/reset-password`, `/verify-email`: the credentials of an emailed link (absent when malformed). */
export const emailLinkSearchSchema = z.object({
	userId: linkTokenSchema,
	secret: linkTokenSchema,
});

export type SignInInput = z.output<typeof signInSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type RequestResetInput = z.output<typeof requestResetSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
export type ConfirmVerificationInput = z.output<
	typeof confirmVerificationSchema
>;
