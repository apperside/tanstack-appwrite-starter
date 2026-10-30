import { randomUUID } from "node:crypto";
import { and, desc, eq, lt } from "drizzle-orm";
import { pageSize } from "#/core/data/page";
import type { Todo, TodoRepository } from "#/core/data/todos";
import { AppError } from "#/lib/errors";
import type { PostgresDb } from "./db.server";
import { translateErrors } from "./errors";
import { todos } from "./schema";
import { isUuid } from "./uuid";

type Row = typeof todos.$inferSelect;

function toTodo(row: Row): Todo {
	return {
		id: row.id,
		ownerId: row.ownerId,
		title: row.title,
		completed: row.completed,
		priority: row.priority,
		dueDate: row.dueDate?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

const toCursor = (seq: number) =>
	Buffer.from(String(seq)).toString("base64url");

/** The `seq` a cursor names, or `undefined` for a malformed one. */
function fromCursor(cursor: string | undefined): number | undefined {
	if (!cursor) return undefined;
	const text = Buffer.from(cursor, "base64url").toString();
	const seq = /^\d+$/.test(text) ? Number(text) : Number.NaN;
	return Number.isSafeInteger(seq) ? seq : undefined;
}

/** The todos table in Postgres, newest first (by insertion order). */
export function createPostgresTodos({
	db,
	now,
}: {
	db: PostgresDb;
	now: () => number;
}): TodoRepository {
	const at = () => new Date(now());

	return translateErrors<TodoRepository>({
		list: async (ownerId, request) => {
			const limit = pageSize(request);
			const before = fromCursor(request?.cursor);
			const rows = await db
				.select()
				.from(todos)
				.where(
					and(
						eq(todos.ownerId, ownerId),
						before === undefined ? undefined : lt(todos.seq, before),
					),
				)
				.orderBy(desc(todos.seq))
				.limit(limit + 1);
			const page = rows.slice(0, limit);
			const last = page.at(-1);
			return {
				items: page.map(toTodo),
				nextCursor: rows.length > limit && last ? toCursor(last.seq) : null,
			};
		},
		get: async (ownerId, id) => {
			if (!isUuid(id)) throw new AppError("NOT_FOUND");
			const [row] = await db
				.select()
				.from(todos)
				.where(and(eq(todos.id, id), eq(todos.ownerId, ownerId)));
			if (!row) throw new AppError("NOT_FOUND");
			return toTodo(row);
		},
		create: async (ownerId, input) => {
			const [row] = await db
				.insert(todos)
				.values({
					completed: false,
					priority: "normal",
					...input,
					dueDate: input.dueDate ? new Date(input.dueDate) : null,
					id: randomUUID(),
					ownerId,
					createdAt: at(),
					updatedAt: at(),
				})
				.returning();
			return toTodo(row);
		},
		update: async (ownerId, id, patch) => {
			if (!isUuid(id)) throw new AppError("NOT_FOUND");
			const { dueDate, ...rest } = patch;
			const [row] = await db
				.update(todos)
				.set({
					...rest,
					...(dueDate !== undefined && {
						dueDate: dueDate ? new Date(dueDate) : null,
					}),
					updatedAt: at(),
				})
				.where(and(eq(todos.id, id), eq(todos.ownerId, ownerId)))
				.returning();
			if (!row) throw new AppError("NOT_FOUND");
			return toTodo(row);
		},
		delete: async (ownerId, id) => {
			if (!isUuid(id)) throw new AppError("NOT_FOUND");
			const rows = await db
				.delete(todos)
				.where(and(eq(todos.id, id), eq(todos.ownerId, ownerId)))
				.returning({ id: todos.id });
			if (rows.length === 0) throw new AppError("NOT_FOUND");
		},
		transferOwnership: async (fromOwnerId, toOwnerId) => {
			await db
				.update(todos)
				.set({ ownerId: toOwnerId })
				.where(eq(todos.ownerId, fromOwnerId));
		},
	});
}
