/**
 * An absolute link to `path` in the app, for emails. `APP_URL` may carry a
 * sub-path (`https://example.com/app`), which `new URL("/x", APP_URL)` would drop.
 */
export function appLink(appUrl: string, path: string): string {
	const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
	return new URL(path.replace(/^\/+/, ""), base).toString();
}
