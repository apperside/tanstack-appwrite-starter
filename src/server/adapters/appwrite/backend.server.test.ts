import { describe, expect, it, vi } from "vitest";
import { createAppwriteBackend } from "./backend.server";
import { createAdminClient } from "./server-client.server";

vi.mock("./server-client.server", () => ({
	createAdminClient: vi.fn(() => ({ tables: { typed: {} } })),
	createAnonymousClient: vi.fn(),
	createUserClient: vi.fn(),
}));

describe("createAppwriteBackend", () => {
	it("creates sessions with an admin client that forwards the visitor's user agent", async () => {
		const backend = createAppwriteBackend();
		const auth = backend.auth({ userAgent: "Firefox/140.0" });
		// Any admin call builds the client; its own rejection does not matter here.
		await auth.startGuest().catch(() => {});
		expect(createAdminClient).toHaveBeenCalledWith({
			forwardedUserAgent: "Firefox/140.0",
		});
		expect(backend.data.todos).toBeDefined();
	});
});
