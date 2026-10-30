import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import type { TodoRepository } from "./todos";

const notFound = new AppError("NOT_FOUND");

/**
 * The behavior every `TodoRepository` adapter shares. Run it from the
 * adapter's own test file with a fresh, empty repository per test.
 */
export function describeTodosContract(
	name: string,
	setup: () => TodoRepository | Promise<TodoRepository>,
) {
	describe(`todos contract: ${name}`, () => {
		let todos: TodoRepository;

		beforeEach(async () => {
			todos = await setup();
		});

		it("creates a todo with the defaults", async () => {
			const todo = await todos.create("ann", { title: "Write tests" });
			expect(todo).toMatchObject({
				ownerId: "ann",
				title: "Write tests",
				completed: false,
				priority: "normal",
				dueDate: null,
			});
			await expect(todos.get("ann", todo.id)).resolves.toEqual(todo);
		});

		it("lists an owner's todos newest first, page by page", async () => {
			for (const title of ["a", "b", "c"]) await todos.create("ann", { title });
			await todos.create("bob", { title: "not ann's" });
			const first = await todos.list("ann", { limit: 2 });
			expect(first.items.map((t) => t.title)).toEqual(["c", "b"]);
			const cursor = first.nextCursor as string;
			expect(cursor).toEqual(expect.any(String));
			const second = await todos.list("ann", { limit: 2, cursor });
			expect(second.items.map((t) => t.title)).toEqual(["a"]);
			expect(second.nextCursor).toBeNull();
		});

		it("updates and deletes a todo", async () => {
			const { id } = await todos.create("ann", { title: "Draft" });
			await expect(
				todos.update("ann", id, { completed: true, priority: "high" }),
			).resolves.toMatchObject({ completed: true, priority: "high" });
			await todos.delete("ann", id);
			await expect(todos.get("ann", id)).rejects.toEqual(notFound);
		});

		it("treats another owner's todo as missing", async () => {
			const { id } = await todos.create("ann", { title: "Private" });
			await expect(todos.get("bob", id)).rejects.toEqual(notFound);
			await expect(todos.update("bob", id, { title: "x" })).rejects.toEqual(
				notFound,
			);
			await expect(todos.delete("bob", id)).rejects.toEqual(notFound);
			await expect(todos.get("ann", id)).resolves.toMatchObject({
				title: "Private",
			});
		});

		it("transfers every todo of one owner to another", async () => {
			await todos.create("guest", { title: "one" });
			await todos.create("guest", { title: "two" });
			await todos.transferOwnership("guest", "ann");
			await todos.transferOwnership("guest", "ann");
			expect((await todos.list("guest")).items).toEqual([]);
			expect((await todos.list("ann")).items.map((t) => t.title)).toEqual([
				"two",
				"one",
			]);
		});
	});
}
