import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/server/auth-middleware";
import {
	changeEmailSchema,
	changeNameSchema,
	changePasswordSchema,
	updatePreferencesSchema,
} from "./account.schemas";

/* v8 ignore start -- thin createServerFn wiring: logic is tested via the handlers in account.handlers.server.ts; delegation only — no logic between these markers */
export const listSessions = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.handler(async ({ context }) =>
		(await import("./account.handlers.server")).listSessionsHandler({
			context,
		}),
	);

/** Consumed by the security settings' password form. */
export const changePassword = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(changePasswordSchema)
	.handler(async ({ data, context }) =>
		(await import("./account.handlers.server")).changePasswordHandler({
			data,
			context,
		}),
	);

/** Consumed by the profile settings' email form. */
export const changeEmail = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(changeEmailSchema)
	.handler(async ({ data, context }) =>
		(await import("./account.handlers.server")).changeEmailHandler({
			data,
			context,
		}),
	);

/** Consumed by the profile settings' name form. */
export const changeName = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(changeNameSchema)
	.handler(async ({ data, context }) =>
		(await import("./account.handlers.server")).changeNameHandler({
			data,
			context,
		}),
	);

/** Consumed by the language and theme switches. */
export const updatePreferences = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(updatePreferencesSchema)
	.handler(async ({ data, context }) =>
		(await import("./account.handlers.server")).updatePreferencesHandler({
			data,
			context,
		}),
	);
/* v8 ignore stop */
