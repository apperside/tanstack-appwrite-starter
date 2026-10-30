import { createServerFn } from "@tanstack/react-start";
import {
	confirmVerificationSchema,
	requestResetSchema,
	resetPasswordSchema,
	signInSchema,
	signUpSchema,
} from "#/lib/schemas/auth.schemas";
import { authMiddleware } from "#/server/middlewares/auth-middleware";

// The handlers live in a `*.server.ts` module that is imported dynamically, so
// neither they nor the backend adapters they use are reachable from the client bundle.
/* v8 ignore start -- thin createServerFn wiring: the compiler needs inline handlers, logic is tested via the handlers in auth.handlers.server.ts; delegation only — no logic between these markers */
export const getCurrentUser = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./auth.handlers.server")).getCurrentUserHandler({ context }),
	);

/** Consumed by the sign-in form. */
export const signIn = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(signInSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).signInHandler({ data, context }),
	);

/** Consumed by the sign-up form. */
export const signUp = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(signUpSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).signUpHandler({ data, context }),
	);

/** Consumed by the sign-out button. */
export const signOut = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./auth.handlers.server")).signOutHandler({ context }),
	);

/** Consumed by the security settings' "sign out everywhere". */
export const signOutEverywhere = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./auth.handlers.server")).signOutEverywhereHandler({
			context,
		}),
	);

/** Consumed by the "continue as guest" button. */
export const startGuestSession = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./auth.handlers.server")).startGuestSessionHandler({
			context,
		}),
	);

/** Consumed by the guest upgrade form. */
export const upgradeGuest = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(signUpSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).upgradeGuestHandler({
			data,
			context,
		}),
	);

/** Consumed by the sign-in form when the visitor is a guest. */
export const signInAndMergeGuest = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(signInSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).signInAndMergeGuestHandler({
			data,
			context,
		}),
	);

/** Consumed by the forgot-password form. */
export const requestPasswordReset = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(requestResetSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).requestPasswordResetHandler({
			data,
			context,
		}),
	);

/** Consumed by the reset-password form. */
export const resetPassword = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(resetPasswordSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).resetPasswordHandler({
			data,
			context,
		}),
	);

/** Consumed by the "resend verification email" button. */
export const sendVerification = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./auth.handlers.server")).sendVerificationHandler({
			context,
		}),
	);

/** Consumed by the verify-email page. */
export const confirmVerification = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(confirmVerificationSchema)
	.handler(async ({ data, context }) =>
		(await import("./auth.handlers.server")).confirmVerificationHandler({
			data,
			context,
		}),
	);
/* v8 ignore stop */
