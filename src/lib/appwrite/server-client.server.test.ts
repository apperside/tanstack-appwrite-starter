import { describe, expect, it, vi } from "vitest";
import { AdminTables, AppTables } from "./app-tables";
import {
	createAdminClient,
	createAnonymousClient,
	createUserClient,
} from "./server-client.server";

vi.mock("#/config/env", () => ({
	publicEnv: {
		APPWRITE_ENDPOINT: "https://appwrite.test/v1",
		APPWRITE_PROJECT_ID: "project",
		APPWRITE_DATABASE_ID: "db",
	},
	serverEnv: () => ({ APPWRITE_API_KEY: "key", APP_URL: "https://app.test" }),
}));

describe("server clients", () => {
	it("builds a new user client on every call", () => {
		const a = createUserClient("secret");
		const b = createUserClient("secret");
		expect(a.client).not.toBe(b.client);
		expect(a.tables.typed).toBeInstanceOf(AppTables);
		expect(a.tables.typed).not.toBeInstanceOf(AdminTables);
		expect("users" in a).toBe(false);
	});

	it("builds a new admin client with users and admin tables", () => {
		const a = createAdminClient();
		expect(a.client).not.toBe(createAdminClient().client);
		expect(a.tables.typed).toBeInstanceOf(AdminTables);
		expect(a.users).toBeDefined();
	});

	it("forwards the visitor's user agent, so sessions it creates name their browser", () => {
		const ua = "Mozilla/5.0 (Macintosh) Firefox/140.0";
		expect(
			createAdminClient({ forwardedUserAgent: ua }).client.headers,
		).toMatchObject({ "X-Forwarded-User-Agent": ua });
		expect(createAdminClient().client.headers).not.toHaveProperty(
			"X-Forwarded-User-Agent",
		);
	});

	it("builds a new anonymous client with neither key nor session", () => {
		const a = createAnonymousClient();
		expect(a.client).not.toBe(createAnonymousClient().client);
		expect(a.client.headers).not.toHaveProperty("X-Appwrite-Key");
		expect(a.client.headers).not.toHaveProperty("X-Appwrite-Session");
		expect("users" in a).toBe(false);
	});
});
