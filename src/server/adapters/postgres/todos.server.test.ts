import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeTodosContract } from "#/core/data/todos.contract";
import { createTestDb } from "#/test/pglite";
import { createPostgresTodos } from "./todos.server";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	testDb = await createTestDb();
});

afterAll(async () => {
	await testDb.client.close();
});

async function freshTodos(now: () => number = Date.now) {
	await testDb.reset();
	return createPostgresTodos({ db: testDb.db, now });
}

describeTodosContract("postgres", () => freshTodos());

describe("postgres todos", () => {
	it("orders rows made in the same millisecond by insertion", async () => {
		const todos = await freshTodos(() => 0);
		for (const title of ["a", "b", "c"]) await todos.create("ann", { title });
		const { items } = await todos.list("ann");
		expect(items.map((todo) => todo.title)).toEqual(["c", "b", "a"]);
	});

	it("reads a malformed cursor as the first page", async () => {
		const todos = await freshTodos();
		await todos.create("ann", { title: "a" });
		const { items } = await todos.list("ann", { cursor: "%%%" });
		expect(items.map((todo) => todo.title)).toEqual(["a"]);
	});

	it.each(
		["100000000000000000000", "1e+21"].map((text) =>
			Buffer.from(text).toString("base64url"),
		),
	)("reads an unsafe cursor (%s) as the first page", async (cursor) => {
		const todos = await freshTodos();
		await todos.create("ann", { title: "a" });
		const { items } = await todos.list("ann", { cursor });
		expect(items).toHaveLength(1);
	});

	it("answers NOT_FOUND for an id that is not a uuid", async () => {
		const todos = await freshTodos();
		const gone = { code: "NOT_FOUND" };
		await expect(todos.get("ann", "nope")).rejects.toMatchObject(gone);
		await expect(todos.update("ann", "nope", {})).rejects.toMatchObject(gone);
		await expect(todos.delete("ann", "nope")).rejects.toMatchObject(gone);
	});

	it("never leaks another owner's rows through a cursor", async () => {
		const todos = await freshTodos();
		for (const title of ["a", "b"]) await todos.create("ann", { title });
		for (const title of ["x", "y", "z"]) await todos.create("bob", { title });
		const bobs = await todos.list("bob", { limit: 1 });
		expect(bobs.nextCursor).not.toBeNull();
		const { items } = await todos.list("ann", {
			cursor: bobs.nextCursor ?? undefined,
		});
		expect(items.every((todo) => todo.ownerId === "ann")).toBe(true);
	});

	it("stamps updatedAt on update", async () => {
		let time = 1000;
		const todos = await freshTodos(() => time);
		const created = await todos.create("ann", { title: "a" });
		time = 5000;
		const updated = await todos.update("ann", created.id, { completed: true });
		expect(updated.createdAt).toBe(new Date(1000).toISOString());
		expect(updated.updatedAt).toBe(new Date(5000).toISOString());
	});
});
