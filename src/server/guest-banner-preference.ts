import { createIsomorphicFn } from "@tanstack/react-start";
import { parseGuestBannerCookie } from "#/lib/guest-banner";

/**
 * Whether the guest dismissed the banner this browser session: the request
 * header during SSR (so the first paint is final), `document.cookie` on
 * client navigations.
 */
/* v8 ignore start -- createIsomorphicFn wiring: both branches delegate to tested functions */
export const getGuestBannerDismissed = createIsomorphicFn()
	.server(async () =>
		(await import("./preference-cookies.server")).readGuestBannerDismissed(),
	)
	.client(async () => parseGuestBannerCookie(document.cookie));
/* v8 ignore stop */
