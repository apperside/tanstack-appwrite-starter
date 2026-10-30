import { randomUUID } from "node:crypto";
import { pageSize } from "#/core/data/page";
import type { Todo, TodoRepository } from "#/core/data/todos";
import { AppError } from "#/lib/errors";

/** The todos table in process memory, newest first. */
export function createMemoryTodos({
	now,
}: {
	now: () => number;
}): TodoRepository {
	/** Insertion order, newest last: the list order, even within one millisecond. */
	const rows: Todo[] = [];

	function owned(ownerId: string, id: string): Todo {
		const row = rows.find((todo) => todo.id === id);
		if (!row || row.ownerId !== ownerId) throw new AppError("NOT_FOUND");
		return row;
	}

	return {
		list: async (ownerId, request) => {
			const limit = pageSize(request);
			const mine = rows.filter((todo) => todo.ownerId === ownerId).reverse();
			const start = request?.cursor
				? mine.findIndex((todo) => todo.id === request.cursor) + 1
				: 0;
			const items = mine
				.slice(start, start + limit)
				.map((todo) => ({ ...todo }));
			const more = start + limit < mine.length;
			return { items, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
		},
		get: async (ownerId, id) => ({ ...owned(ownerId, id) }),
		create: async (ownerId, input) => {
			const at = new Date(now()).toISOString();
			const todo: Todo = {
				completed: false,
				priority: "normal",
				dueDate: null,
				...input,
				id: randomUUID(),
				ownerId,
				createdAt: at,
				updatedAt: at,
			};
			rows.push(todo);
			return { ...todo };
		},
		update: async (ownerId, id, patch) => {
			const row = owned(ownerId, id);
			Object.assign(row, patch, { updatedAt: new Date(now()).toISOString() });
			return { ...row };
		},
		delete: async (ownerId, id) => {
			rows.splice(rows.indexOf(owned(ownerId, id)), 1);
		},
		transferOwnership: async (fromOwnerId, toOwnerId) => {
			for (const row of rows) {
				if (row.ownerId === fromOwnerId) row.ownerId = toOwnerId;
			}
		},
	};
}
