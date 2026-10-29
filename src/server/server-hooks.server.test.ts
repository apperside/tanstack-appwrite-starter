import { describe, expect, it } from "vitest";
import { createMemoryBackend } from "#/adapters/memory/backend.server";
import { serverHooks } from "./server-hooks.server";

describe("serverHooks", () => {
	it("moves the guest's todos on guest merge by default, idempotently", async () => {
		const { data } = createMemoryBackend();
		await data.todos.create("guest-1", { title: "mine" });
		const args = { guestUserId: "guest-1", userId: "user-1", data };
		await serverHooks.onGuestMerge(args);
		await serverHooks.onGuestMerge(args);
		expect((await data.todos.list("user-1")).items).toHaveLength(1);
		expect((await data.todos.list("guest-1")).items).toEqual([]);
	});
});
