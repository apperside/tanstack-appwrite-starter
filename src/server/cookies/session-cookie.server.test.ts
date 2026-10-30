import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aSession } from "#/test/fixtures";
import {
	requestSessionCookie,
	sessionCookieName,
} from "./session-cookie.server";

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: vi.fn(),
	setCookie: vi.fn(),
	deleteCookie: vi.fn(),
}));

const env = vi.hoisted(() => ({ APP_URL: "https://app.test" }));
vi.mock("#/config/env", () => ({ serverEnv: () => env }));

describe("sessionCookieName", () => {
	it("uses the __Host- prefix only when the cookie is Secure", () => {
		expect(sessionCookieName(true)).toBe("__Host-app_session");
		expect(sessionCookieName(false)).toBe("app_session");
	});
});

describe("requestSessionCookie", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		env.APP_URL = "https://app.test";
	});

	it("reads the session secret from the request cookie", () => {
		vi.mocked(getCookie).mockReturnValue("secret");
		expect(requestSessionCookie().read()).toBe("secret");
		expect(getCookie).toHaveBeenCalledWith("__Host-app_session");
	});

	it("writes a secure, http-only, lax cookie expiring with the session", () => {
		const session = aSession();
		requestSessionCookie().write(session);
		expect(setCookie).toHaveBeenCalledWith(
			"__Host-app_session",
			session.token,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
				expires: new Date(session.expiresAt),
			},
		);
	});

	it.each([
		["http://localhost:3000", false],
		["http://127.0.0.1:3000", false],
		["http://[::1]:3000", false],
		["https://localhost:3000", true],
		["http://localhost.example.com", true],
		["http://app.test", true],
	])("sets secure for %s to %s, naming the cookie to match", (appUrl, secure) => {
		env.APP_URL = appUrl;
		requestSessionCookie().write(aSession());
		expect(setCookie).toHaveBeenCalledWith(
			sessionCookieName(secure),
			expect.any(String),
			expect.objectContaining({ secure }),
		);
	});

	it("clears the cookie with the same name and scope it was set with", () => {
		requestSessionCookie().clear();
		expect(deleteCookie).toHaveBeenCalledWith("__Host-app_session", {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
		});
	});
});
