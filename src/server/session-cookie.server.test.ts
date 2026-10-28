import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { aSession } from "#/test/fixtures";
import { requestSessionCookie, SESSION_COOKIE } from "./session-cookie.server";

vi.mock("@tanstack/react-start/server", () => ({
	getCookie: vi.fn(),
	setCookie: vi.fn(),
	deleteCookie: vi.fn(),
}));

const env = vi.hoisted(() => ({ APP_URL: "https://app.test" }));
vi.mock("#/config/env", () => ({ serverEnv: () => env }));

describe("requestSessionCookie", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		env.APP_URL = "https://app.test";
	});

	it("names the cookie app_session", () => {
		expect(SESSION_COOKIE).toBe("app_session");
	});

	it("reads the session secret from the request cookie", () => {
		vi.mocked(getCookie).mockReturnValue("secret");
		expect(requestSessionCookie().read()).toBe("secret");
		expect(getCookie).toHaveBeenCalledWith("app_session");
	});

	it("writes a secure, http-only, lax cookie expiring with the session", () => {
		const session = aSession();
		requestSessionCookie().write(session);
		expect(setCookie).toHaveBeenCalledWith("app_session", session.secret, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			expires: new Date(session.expire),
		});
	});

	it.each([
		["http://localhost:3000", false],
		["http://127.0.0.1:3000", false],
		["http://[::1]:3000", false],
		["https://localhost:3000", true],
		["http://localhost.example.com", true],
		["http://app.test", true],
	])("sets secure for %s to %s", (appUrl, secure) => {
		env.APP_URL = appUrl;
		requestSessionCookie().write(aSession());
		expect(setCookie).toHaveBeenCalledWith(
			"app_session",
			expect.any(String),
			expect.objectContaining({ secure }),
		);
	});

	it("clears the cookie with the same scope it was set with", () => {
		requestSessionCookie().clear();
		expect(deleteCookie).toHaveBeenCalledWith("app_session", {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
		});
	});
});
