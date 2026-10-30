import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import { fakeAppwriteClients } from "#/test/appwrite-fakes";
import type { Todos } from "./generated/appwrite";
import { ownerPermissions } from "./permissions";
import { createAppwriteTodos } from "./todos.server";

function aRow(overrides: Partial<Todos> = {}): Todos {
	return {
		$id: "t1",
		$sequence: "1",
		$tableId: "todos",
		$databaseId: "test-db",
		$createdAt: "2026-01-01T00:00:00.000+00:00",
		$updatedAt: "2026-01-02T00:00:00.000+00:00",
		$permissions: [],
		title: "Write tests",
		completed: false,
		priority: "normal" as Todos["priority"],
		dueDate: null,
		ownerId: "ann",
		...overrides,
	};
}

function setup() {
	const { clients, adminTables } = fakeAppwriteClients();
	const todos = createAppwriteTodos(() => clients.admin().tables.typed);
	return { todos, adminTables };
}

describe("createAppwriteTodos", () => {
	it("maps rows to todos", async () => {
		const { todos, adminTables } = setup();
		adminTables.getRow.mockResolvedValue(aRow());
		await expect(todos.get("ann", "t1")).resolves.toEqual({
			id: "t1",
			ownerId: "ann",
			title: "Write tests",
			completed: false,
			priority: "normal",
			dueDate: null,
			createdAt: aRow().$createdAt,
			updatedAt: aRow().$updatedAt,
		});
	});

	it("hides another owner's row as NOT_FOUND, writing nothing", async () => {
		const { todos, adminTables } = setup();
		adminTables.getRow.mockResolvedValue(aRow({ ownerId: "bob" }));
		await expect(todos.get("ann", "t1")).rejects.toEqual(
			new AppError("NOT_FOUND"),
		);
		await expect(todos.update("ann", "t1", { title: "x" })).rejects.toEqual(
			new AppError("NOT_FOUND"),
		);
		await expect(todos.delete("ann", "t1")).rejects.toEqual(
			new AppError("NOT_FOUND"),
		);
		expect(adminTables.updateRow).not.toHaveBeenCalled();
		expect(adminTables.deleteRow).not.toHaveBeenCalled();
	});

	it("creates rows with the defaults and the owner's permissions", async () => {
		const { todos, adminTables } = setup();
		adminTables.createRow.mockResolvedValue(aRow());
		await todos.create("ann", { title: "Write tests" });
		expect(adminTables.createRow).toHaveBeenCalledWith(
			expect.objectContaining({
				tableId: "todos",
				data: {
					title: "Write tests",
					completed: false,
					priority: "normal",
					dueDate: null,
					ownerId: "ann",
				},
				permissions: ownerPermissions("ann"),
			}),
		);
	});

	it("lists one page past the limit to know whether there is a next one", async () => {
		const { todos, adminTables } = setup();
		adminTables.listRows.mockResolvedValue({
			total: 3,
			rows: [aRow({ $id: "a" }), aRow({ $id: "b" }), aRow({ $id: "c" })],
		});
		const page = await todos.list("ann", { limit: 2, cursor: "z" });
		expect(page.items.map((t) => t.id)).toEqual(["a", "b"]);
		expect(page.nextCursor).toBe("b");
		const [{ queries }] = adminTables.listRows.mock.calls[0] as [
			{ queries: string[] },
		];
		expect(queries.map((q) => JSON.parse(q).method)).toEqual([
			"equal",
			"orderDesc",
			"limit",
			"cursorAfter",
		]);
		adminTables.listRows.mockResolvedValue({ total: 1, rows: [aRow()] });
		await expect(todos.list("ann", { limit: 2 })).resolves.toMatchObject({
			nextCursor: null,
		});
	});

	it("updates and deletes an owned row", async () => {
		const { todos, adminTables } = setup();
		adminTables.getRow.mockResolvedValue(aRow());
		adminTables.updateRow.mockResolvedValue(aRow({ completed: true }));
		adminTables.deleteRow.mockResolvedValue({});
		await expect(
			todos.update("ann", "t1", { completed: true }),
		).resolves.toMatchObject({ completed: true });
		await todos.delete("ann", "t1");
		expect(adminTables.deleteRow).toHaveBeenCalledWith(
			expect.objectContaining({ tableId: "todos", rowId: "t1" }),
		);
	});

	it("moves every row and its permissions to the new owner", async () => {
		const { todos, adminTables } = setup();
		adminTables.listRows.mockResolvedValue({
			total: 2,
			rows: [aRow({ $id: "a" }), aRow({ $id: "b" })],
		});
		adminTables.updateRow.mockResolvedValue(aRow());
		await todos.transferOwnership("guest", "ann");
		expect(adminTables.updateRow).toHaveBeenCalledTimes(2);
		expect(adminTables.updateRow).toHaveBeenCalledWith(
			expect.objectContaining({
				rowId: "a",
				data: { ownerId: "ann" },
				permissions: ownerPermissions("ann"),
			}),
		);
	});
});
