import { createIsomorphicFn } from "@tanstack/react-start";
import { clientLocaleHints } from "#/i18n/locale";
import { parseGuestBannerCookie } from "#/lib/guest-banner";
import { parseSidebarCookie } from "#/lib/sidebar-state";
import { parseThemeCookie } from "#/lib/theme";

/*
 * The preferences a page renders with, read on whichever side runs: the
 * request during SSR (so the first paint is final, even without JS), the
 * document on client navigations (no round-trip).
 */

/* v8 ignore start -- createIsomorphicFn wiring: both branches delegate to tested functions */
const cookieHeader = createIsomorphicFn()
	.server(async () =>
		(
			await import("#/server/cookies/preference-cookies.server")
		).requestCookieHeader(),
	)
	.client(async () => document.cookie);

/**
 * The locale hints below the account preference: the `locale` cookie, then
 * `Accept-Language` during SSR or the SSR-resolved `<html lang>` on the client
 * (so the language never flips on navigation).
 */
export const getLocaleHints = createIsomorphicFn()
	.server(async () =>
		(
			await import("#/server/cookies/preference-cookies.server")
		).readLocaleHints(),
	)
	.client(async () => clientLocaleHints(document));
/* v8 ignore stop */

/** The `theme` cookie; `system` when absent or invalid. */
export const getThemePreference = async () =>
	parseThemeCookie(await cookieHeader());

/** The `sidebar_state` cookie; `auto` when absent or invalid. */
export const getSidebarMode = async () =>
	parseSidebarCookie(await cookieHeader());

/** Whether the guest dismissed the banner this browser session. */
export const getGuestBannerDismissed = async () =>
	parseGuestBannerCookie(await cookieHeader());
