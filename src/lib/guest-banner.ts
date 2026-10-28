import { readCookie } from "./cookies";

/**
 * Session cookie set when a guest dismisses the "save your account" banner.
 * A cookie (not storage) so the server renders the banner's final state: no
 * layout shift on reload.
 */
export const GUEST_BANNER_COOKIE = "guest_banner_dismissed";

/** Whether a `Cookie` header / `document.cookie` holds the dismissal. */
export function parseGuestBannerCookie(cookies: string): boolean {
	return readCookie(cookies, GUEST_BANNER_COOKIE) === "1";
}
