import { type Models, Query, type TablesDB } from "node-appwrite";
import { describe, expect, it, vi } from "vitest";
import { AdminTables, AppTables, MAX_PAGE_SIZE } from "./app-tables";
import { ownerPermissions } from "./permissions";

type RowsFn = (params: {
	databaseId: string;
	tableId: string;
	rows: object[];
	transactionId?: string;
}) => Promise<Models.RowList<Models.DefaultRow>>;
type ListFn = (params: {
	databaseId: string;
	tableId: string;
	queries?: string[];
}) => Promise<Models.RowList<Models.DefaultRow>>;
type WriteFn = (params: {
	databaseId: string;
	tableId: string;
	rowId: string;
	data?: object;
	permissions?: string[];
	transactionId?: string;
}) => Promise<Models.DefaultRow>;

function rowList(ids: string[]): Models.RowList<Models.DefaultRow> {
	return {
		total: ids.length,
		rows: ids.map((id) => ({ $id: id }) as Models.DefaultRow),
	};
}

function makeFake() {
	const fns = {
		getRow: vi.fn<WriteFn>(),
		listRows: vi.fn<ListFn>(),
		createRow: vi.fn<WriteFn>(),
		updateRow: vi.fn<WriteFn>(),
		upsertRow: vi.fn<WriteFn>(),
		deleteRow: vi.fn<WriteFn>(),
		createRows: vi.fn<RowsFn>(),
		upsertRows: vi.fn<RowsFn>(),
		deleteRows: vi.fn<ListFn>(),
	};
	return { fns, tables: fns as unknown as TablesDB };
}

describe("AppTables", () => {
	it("getRow and listRows bind the database id", async () => {
		const { fns, tables } = makeFake();
		fns.getRow.mockResolvedValue({ $id: "t1" } as Models.DefaultRow);
		fns.listRows.mockResolvedValue(rowList(["t1"]));
		const app = new AppTables(tables, "db");

		await app.getRow("todos", "t1");
		await app.listRows("todos", ["q"]);

		expect(fns.getRow).toHaveBeenCalledWith({
			databaseId: "db",
			tableId: "todos",
			rowId: "t1",
			queries: [],
		});
		expect(fns.listRows).toHaveBeenCalledWith({
			databaseId: "db",
			tableId: "todos",
			queries: ["q"],
		});
	});

	describe("listAllRows", () => {
		it("pages with limit then cursorAfter until a short page, in order", async () => {
			const { fns, tables } = makeFake();
			const full = Array.from({ length: MAX_PAGE_SIZE }, (_, i) => `a${i}`);
			fns.listRows
				.mockResolvedValueOnce(rowList(full))
				.mockResolvedValueOnce(rowList(["b0", "b1"]));

			const rows = await new AppTables(tables, "db").listAllRows("todos", [
				Query.equal("priority", "normal"),
			]);

			expect(rows.map((r) => (r as { $id?: string }).$id)).toEqual([
				...full,
				"b0",
				"b1",
			]);
			expect(fns.listRows).toHaveBeenCalledTimes(2);
			expect(fns.listRows.mock.calls[0]?.[0].queries).toEqual([
				Query.equal("priority", "normal"),
				Query.limit(MAX_PAGE_SIZE),
			]);
			expect(fns.listRows.mock.calls[1]?.[0].queries).toEqual([
				Query.equal("priority", "normal"),
				Query.limit(MAX_PAGE_SIZE),
				Query.cursorAfter(`a${MAX_PAGE_SIZE - 1}`),
			]);
		});

		it("stops on an empty page", async () => {
			const { fns, tables } = makeFake();
			fns.listRows.mockResolvedValue(rowList([]));
			expect(await new AppTables(tables, "db").listAllRows("todos")).toEqual(
				[],
			);
			expect(fns.listRows).toHaveBeenCalledTimes(1);
		});
	});

	it.each([
		"createRow",
		"updateRow",
		"upsertRow",
	] as const)("%s sends a patched payload", async (method) => {
		const { fns, tables } = makeFake();
		fns[method].mockResolvedValue({ $id: "t1" } as Models.DefaultRow);
		const row = {
			$createdAt: "x",
			title: "a",
			dueDate: undefined,
		};

		await new AppTables(tables, "db")[method](
			"todos",
			"t1",
			row as never,
			["p"],
			"tx",
		);

		expect(fns[method]).toHaveBeenCalledWith({
			databaseId: "db",
			tableId: "todos",
			rowId: "t1",
			data: { title: "a", dueDate: null },
			permissions: ["p"],
			transactionId: "tx",
		});
		expect(row.$createdAt).toBe("x");
	});

	it("deleteRow forwards ids", async () => {
		const { fns, tables } = makeFake();
		fns.deleteRow.mockResolvedValue({} as Models.DefaultRow);
		await new AppTables(tables, "db").deleteRow("todos", "t1", "tx");
		expect(fns.deleteRow).toHaveBeenCalledWith({
			databaseId: "db",
			tableId: "todos",
			rowId: "t1",
			transactionId: "tx",
		});
	});
});

describe("AdminTables", () => {
	it("bulkUpsertRows stamps owner permissions on every row", async () => {
		const { fns, tables } = makeFake();
		fns.upsertRows.mockResolvedValue(rowList(["a", "b"]));

		const result = await new AdminTables(tables, "db").bulkUpsertRows(
			"todos",
			[
				{ $id: "a", title: "A" },
				{ $id: "b", title: "B", $createdAt: "x" } as never,
			],
			"u1",
		);

		const sent = fns.upsertRows.mock.calls[0]?.[0].rows as {
			$permissions: string[];
			$createdAt?: string;
		}[];
		expect(sent).toHaveLength(2);
		for (const row of sent) {
			expect(row.$permissions).toEqual(ownerPermissions("u1"));
			expect(row).not.toHaveProperty("$createdAt");
		}
		expect(result.success).toBe(2);
		expect(result.errors).toEqual([]);
		expect(result.rows).toHaveLength(2);
	});

	it("bulkCreateRows awaits the write and splits into batches", async () => {
		const { fns, tables } = makeFake();
		fns.createRows.mockImplementation(async ({ rows }) => {
			await Promise.resolve();
			return rowList(rows.map((_, i) => `r${i}`));
		});
		const rows = Array.from({ length: 150 }, (_, i) => ({ title: `t${i}` }));

		const result = await new AdminTables(tables, "db").bulkCreateRows(
			"todos",
			rows as never[],
			"u1",
			"tx",
		);

		expect(fns.createRows).toHaveBeenCalledTimes(2);
		expect(fns.createRows.mock.calls[0]?.[0].transactionId).toBe("tx");
		expect(result.success).toBe(150);
		expect(result.rows).toHaveLength(150);
	});

	it("collects a rejected batch in errors without throwing", async () => {
		const { fns, tables } = makeFake();
		fns.createRows
			.mockRejectedValueOnce(new Error("boom"))
			.mockRejectedValueOnce("plain");
		const rows = Array.from({ length: 101 }, () => ({ title: "t" }));

		const result = await new AdminTables(tables, "db").bulkCreateRows(
			"todos",
			rows as never[],
			"u1",
		);

		expect(result.success).toBe(0);
		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([
			"Batch 1 failed: boom",
			"Batch 2 failed: plain",
		]);
	});

	it("deleteRows forwards queries", async () => {
		const { fns, tables } = makeFake();
		fns.deleteRows.mockResolvedValue(rowList([]));
		await new AdminTables(tables, "db").deleteRows("todos", ["q"], "tx");
		expect(fns.deleteRows).toHaveBeenCalledWith({
			databaseId: "db",
			tableId: "todos",
			queries: ["q"],
			transactionId: "tx",
		});
	});
});
