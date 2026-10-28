import { createIsomorphicFn } from "@tanstack/react-start";
import { parseSidebarCookie } from "#/lib/sidebar-state";

/**
 * The sidebar mode from the `sidebar_state` cookie: the request header during
 * SSR (so the first paint has the right width), `document.cookie` on client
 * navigations.
 */
/* v8 ignore start -- createIsomorphicFn wiring: both branches delegate to tested functions */
export const getSidebarMode = createIsomorphicFn()
	.server(async () =>
		(await import("./preference-cookies.server")).readSidebarCookie(),
	)
	.client(async () => parseSidebarCookie(document.cookie));
/* v8 ignore stop */
