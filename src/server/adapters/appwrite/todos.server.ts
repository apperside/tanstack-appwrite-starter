import { ID, Query } from "node-appwrite";
import { type Page, pageSize } from "#/core/data/page";
import type { Todo, TodoRepository } from "#/core/data/todos";
import { AppError } from "#/lib/errors";
import { APP_TABLES } from "./app-models";
import type { AdminTables } from "./app-tables";
import { translateErrors } from "./errors";
import type { Todos } from "./generated/appwrite";
import { ownerPermissions } from "./permissions";

function toTodo(row: Todos): Todo {
	return {
		id: row.$id,
		ownerId: row.ownerId,
		title: row.title,
		completed: row.completed,
		priority: row.priority,
		dueDate: row.dueDate,
		createdAt: row.$createdAt,
		updatedAt: row.$updatedAt,
	};
}

/**
 * The todos table over the API key. Rows also carry their owner's
 * permissions, so a client reading Appwrite directly (realtime) sees only its own.
 */
export function createAppwriteTodos(tables: () => AdminTables): TodoRepository {
	const { TODOS } = APP_TABLES;

	/** The row, if `ownerId` owns it; `NOT_FOUND` otherwise. */
	async function owned(ownerId: string, id: string): Promise<Todos> {
		const row = (await tables().getRow(TODOS, id)) as unknown as Todos;
		if (row.ownerId !== ownerId) throw new AppError("NOT_FOUND");
		return row;
	}

	return translateErrors<TodoRepository>({
		list: async (ownerId, request) => {
			const limit = pageSize(request);
			const { rows } = await tables().listRows(TODOS, [
				Query.equal("ownerId", ownerId),
				Query.orderDesc("$createdAt"),
				// One more than asked tells whether there is a next page.
				Query.limit(limit + 1),
				...(request?.cursor ? [Query.cursorAfter(request.cursor)] : []),
			]);
			const items = (rows as unknown as Todos[]).slice(0, limit).map(toTodo);
			const page: Page<Todo> = {
				items,
				nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
			};
			return page;
		},
		get: async (ownerId, id) => toTodo(await owned(ownerId, id)),
		create: async (ownerId, input) =>
			toTodo(
				(await tables().createRow(
					TODOS,
					ID.unique(),
					{
						completed: false,
						priority: "normal",
						dueDate: null,
						...input,
						ownerId,
					},
					ownerPermissions(ownerId),
				)) as unknown as Todos,
			),
		update: async (ownerId, id, patch) => {
			await owned(ownerId, id);
			return toTodo(
				(await tables().updateRow(TODOS, id, patch)) as unknown as Todos,
			);
		},
		delete: async (ownerId, id) => {
			await owned(ownerId, id);
			await tables().deleteRow(TODOS, id);
		},
		transferOwnership: async (fromOwnerId, toOwnerId) => {
			const rows = await tables().listAllRows(TODOS, [
				Query.equal("ownerId", fromOwnerId),
			]);
			for (const row of rows as unknown as Todos[]) {
				await tables().updateRow(
					TODOS,
					row.$id,
					{ ownerId: toOwnerId },
					ownerPermissions(toOwnerId),
				);
			}
		},
	});
}
