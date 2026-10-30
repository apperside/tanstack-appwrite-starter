import {
	deleteCookie,
	getRequestHeader,
	setCookie,
} from "@tanstack/react-start/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	readLocaleHints,
	requestCookieHeader,
	requestPreferenceCookies,
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

describe("requestCookieHeader", () => {
	it("is the request's Cookie header, empty when absent", () => {
		vi.mocked(getRequestHeader).mockReturnValue("locale=it; theme=dark");
		expect(requestCookieHeader()).toBe("locale=it; theme=dark");
		expect(getRequestHeader).toHaveBeenCalledWith("cookie");
		vi.mocked(getRequestHeader).mockReturnValue(undefined);
		expect(requestCookieHeader()).toBe("");
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
