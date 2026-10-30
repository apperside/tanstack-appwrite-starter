/** Cursor pagination: pass `nextCursor` back as `cursor` for the next page. */
export type PageRequest = { cursor?: string; limit?: number };

export type Page<T> = {
	items: T[];
	/** `null` on the last page. */
	nextCursor: string | null;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** The page size to use for `request`, within 1..MAX_PAGE_SIZE. */
export function pageSize(request: PageRequest = {}): number {
	const limit = Math.trunc(request.limit ?? DEFAULT_PAGE_SIZE);
	return Math.min(Math.max(limit, 1), MAX_PAGE_SIZE);
}
