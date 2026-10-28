import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "#/server/auth-middleware";
import { completeOnboardingSchema } from "./onboarding.schemas";

/* v8 ignore start -- thin createServerFn wiring: logic is tested via the handlers in onboarding.handlers.server.ts; delegation only — no logic between these markers */
/** Consumed by the onboarding form. */
export const completeOnboarding = createServerFn({ method: "POST" })
	.middleware([authMiddleware])
	.validator(completeOnboardingSchema)
	.handler(async ({ data, context }) =>
		(await import("./onboarding.handlers.server")).completeOnboardingHandler({
			data,
			context,
		}),
	);
/* v8 ignore stop */
