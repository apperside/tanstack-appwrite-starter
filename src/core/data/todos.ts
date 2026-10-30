import type { Page, PageRequest } from "./page";

/** @public */
export type TodoPriority = "low" | "normal" | "high";

export type Todo = {
	id: string;
	ownerId: string;
	title: string;
	completed: boolean;
	priority: TodoPriority;
	/** ISO 8601, or `null` for no due date. */
	dueDate: string | null;
	createdAt: string;
	updatedAt: string;
};

/** @public */
export type NewTodo = Pick<Todo, "title"> &
	Partial<Pick<Todo, "completed" | "priority" | "dueDate">>;

/** @public */
export type TodoPatch = Partial<
	Pick<Todo, "title" | "completed" | "priority" | "dueDate">
>;

/**
 * The example table's storage. Every method is scoped to an owner: a row of
 * another owner reads as `NOT_FOUND`, so ownership never depends on the
 * backend's permission model.
 */
export interface TodoRepository {
	/** Newest first. */
	list(ownerId: string, page?: PageRequest): Promise<Page<Todo>>;
	/** `NOT_FOUND` when missing or owned by someone else. */
	get(ownerId: string, id: string): Promise<Todo>;
	create(ownerId: string, input: NewTodo): Promise<Todo>;
	/** `NOT_FOUND` when missing or owned by someone else. */
	update(ownerId: string, id: string, patch: TodoPatch): Promise<Todo>;
	/** `NOT_FOUND` when missing or owned by someone else. */
	delete(ownerId: string, id: string): Promise<void>;
	/** Moves every row of `fromOwnerId` to `toOwnerId` (a guest merge); idempotent. */
	transferOwnership(fromOwnerId: string, toOwnerId: string): Promise<void>;
}
