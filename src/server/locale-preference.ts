import { createIsomorphicFn } from "@tanstack/react-start";
import { clientLocaleHints } from "#/i18n/locale";

/**
 * The locale hints below the account preference, read on whichever side runs:
 * the request's `locale` cookie and `Accept-Language` during SSR; on client
 * navigations the cookie and the SSR-resolved `<html lang>` (no round-trip, and
 * the language never flips on navigation).
 */
/* v8 ignore start -- createIsomorphicFn wiring: both branches delegate to tested functions */
export const getLocaleHints = createIsomorphicFn()
	.server(async () =>
		(await import("./preference-cookies.server")).readLocaleHints(),
	)
	.client(async () => clientLocaleHints(document));
/* v8 ignore stop */
