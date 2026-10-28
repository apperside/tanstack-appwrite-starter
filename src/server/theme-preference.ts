import { createIsomorphicFn } from "@tanstack/react-start";
import { parseThemeCookie } from "#/lib/theme";

/**
 * The user's theme preference, read from the `theme` cookie on whichever side runs:
 * the request header during SSR (so `<html>` ships with its class, no flash even
 * without JS), `document.cookie` on client navigations (no round-trip).
 */
/* v8 ignore start -- createIsomorphicFn wiring: both branches delegate to tested functions */
export const getThemePreference = createIsomorphicFn()
	.server(async () =>
		(await import("./preference-cookies.server")).readThemeCookie(),
	)
	.client(async () => parseThemeCookie(document.cookie));
/* v8 ignore stop */
