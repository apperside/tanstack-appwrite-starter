import { readCookie } from "./cookies";

/** The client-readable cookie holding the user's explicit sidebar choice. */
export const SIDEBAR_COOKIE = "sidebar_state";

/**
 * `auto` lets CSS pick by width (no layout shift): full from 1024px, icon rail
 * from 768px. `expanded` / `collapsed` are the user's explicit desktop choice.
 */
export type SidebarMode = "auto" | "expanded" | "collapsed";

/** The mode stored in a `Cookie` header / `document.cookie`; `auto` when absent or invalid. */
export function parseSidebarCookie(cookies: string): SidebarMode {
	const value = readCookie(cookies, SIDEBAR_COOKIE);
	return value === "expanded" || value === "collapsed" ? value : "auto";
}
