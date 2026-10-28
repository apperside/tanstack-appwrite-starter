import {
	deleteCookie,
	getRequestHeader,
	setCookie,
} from "@tanstack/react-start/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	LOCALE_COOKIE,
	readGuestBannerDismissed,
	readLocaleHints,
	readSidebarCookie,
	readThemeCookie,
	requestPreferenceCookies,
	THEME_COOKIE,
} from "./preference-cookies.server";

vi.mock("@tanstack/react-start/server", () => ({
	setCookie: vi.fn(),
	deleteCookie: vi.fn(),
	getRequestHeader: vi.fn(),
}));

const env = vi.hoisted(() => ({ APP_URL: "https://app.test" }));
vi.mock("#/config/env", () => ({ serverEnv: () => env }));

describe("requestPreferenceCookies", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		env.APP_URL = "https://app.test";
	});

	it("names the cookies locale and theme", () => {
		expect([LOCALE_COOKIE, THEME_COOKIE]).toEqual(["locale", "theme"]);
	});

	it("writes a one-year, lax, client-readable locale cookie", () => {
		requestPreferenceCookies().writeLocale("it");
		expect(setCookie).toHaveBeenCalledWith("locale", "it", {
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: 31_536_000,
		});
	});

	it("writes the theme cookie, never httpOnly", () => {
		requestPreferenceCookies().writeTheme("dark");
		const [name, value, options] = vi.mocked(setCookie).mock.calls[0];
		expect([name, value]).toEqual(["theme", "dark"]);
		expect(options).not.toHaveProperty("httpOnly");
	});

	it("deletes the guest banner's dismissal, scoped like the client wrote it", () => {
		requestPreferenceCookies().clearGuestBannerDismissed();
		expect(deleteCookie).toHaveBeenCalledWith("guest_banner_dismissed", {
			path: "/",
		});
	});

	it("is not secure on plain-http loopback", () => {
		env.APP_URL = "http://localhost:3000";
		requestPreferenceCookies().writeTheme("light");
		expect(setCookie).toHaveBeenCalledWith(
			"theme",
			"light",
			expect.objectContaining({ secure: false }),
		);
	});
});

describe("readThemeCookie", () => {
	it("reads the request's theme cookie", () => {
		vi.mocked(getRequestHeader).mockReturnValue("locale=it; theme=dark");
		expect(readThemeCookie()).toBe("dark");
		expect(getRequestHeader).toHaveBeenCalledWith("cookie");
	});

	it("is system without a cookie header", () => {
		vi.mocked(getRequestHeader).mockReturnValue(undefined);
		expect(readThemeCookie()).toBe("system");
	});
});

describe("readLocaleHints", () => {
	it("reads the locale cookie and Accept-Language", () => {
		vi.mocked(getRequestHeader).mockImplementation((name) =>
			name === "cookie" ? "theme=dark; locale=it" : "en-US,en;q=0.9",
		);
		expect(readLocaleHints()).toEqual({
			cookieLocale: "it",
			acceptLanguage: "en-US,en;q=0.9",
		});
	});

	it("is empty without headers", () => {
		vi.mocked(getRequestHeader).mockReturnValue(undefined);
		expect(readLocaleHints()).toEqual({
			cookieLocale: undefined,
			acceptLanguage: undefined,
		});
	});
});

describe("readSidebarCookie", () => {
	it("reads the request's sidebar state, auto when absent", () => {
		vi.mocked(getRequestHeader).mockReturnValue("sidebar_state=collapsed");
		expect(readSidebarCookie()).toBe("collapsed");
		vi.mocked(getRequestHeader).mockReturnValue(undefined);
		expect(readSidebarCookie()).toBe("auto");
	});
});

describe("readGuestBannerDismissed", () => {
	it("reads the request's guest-banner cookie, false when absent", () => {
		vi.mocked(getRequestHeader).mockReturnValue("guest_banner_dismissed=1");
		expect(readGuestBannerDismissed()).toBe(true);
		vi.mocked(getRequestHeader).mockReturnValue(undefined);
		expect(readGuestBannerDismissed()).toBe(false);
	});
});
