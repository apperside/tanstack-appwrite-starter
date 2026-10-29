import { Query } from "appwrite";
import type { Models, TablesDB } from "node-appwrite";
import type { AppTablesTypeMap } from "./app-models";
import { patchAppwritePayload } from "./payload";
import { ownerPermissions } from "./permissions";

// Measured against the self-hosted 2.6.1 instance: Query.limit(5000) is accepted (as are 10000 and 100000), so 5000 is a safe page size.
export const MAX_PAGE_SIZE = 5000;

/** Rows per bulk write request (Appwrite's default batch cap). */
const BULK_BATCH_SIZE = 100;

type RelationOrId<T> = T extends (infer U)[]
	? U extends { $id?: string }
		? U[] | string[]
		: T
	: T extends { $id?: string }
		? T | string
		: T;

/**
 * Row input where relation fields accept either objects or string ids.
 * @public
 */
export type CreateRowInput<T> = {
	[K in keyof T]: RelationOrId<T[K]>;
};

type TableId = keyof AppTablesTypeMap;
type RowInput<K extends TableId> = Partial<CreateRowInput<AppTablesTypeMap[K]>>;

/** Result of a bulk write; failed batches are reported in `errors`. @public */
export interface BulkResult<Row> {
	success: number;
	errors: string[];
	rows: Row[];
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Typed wrapper around `TablesDB` bound to one database.
 * Accepts either SDK's `TablesDB` (typed as the `node-appwrite` one).
 * @public
 */
export class AppTables {
	constructor(
		protected readonly tables: TablesDB,
		protected readonly databaseId: string,
	) {}

	getRow<K extends TableId>(
		tableId: K,
		rowId: string,
		queries: string[] = [],
	): Promise<AppTablesTypeMap[K]> {
		return this.tables.getRow({
			databaseId: this.databaseId,
			tableId,
			rowId,
			queries,
		}) as unknown as Promise<AppTablesTypeMap[K]>;
	}

	listRows<K extends TableId>(
		tableId: K,
		queries: string[] = [],
	): Promise<{ rows: AppTablesTypeMap[K][]; total: number }> {
		return this.tables.listRows({
			databaseId: this.databaseId,
			tableId,
			queries,
		}) as unknown as Promise<{ rows: AppTablesTypeMap[K][]; total: number }>;
	}

	/** Fetches every matching row using cursor pagination. */
	async listAllRows<K extends TableId>(
		tableId: K,
		queries: string[] = [],
	): Promise<AppTablesTypeMap[K][]> {
		const all: AppTablesTypeMap[K][] = [];
		let cursor: string | undefined;

		for (;;) {
			const page = (await this.tables.listRows({
				databaseId: this.databaseId,
				tableId,
				queries: [
					...queries,
					Query.limit(MAX_PAGE_SIZE),
					...(cursor ? [Query.cursorAfter(cursor)] : []),
				],
			})) as unknown as { rows: (AppTablesTypeMap[K] & { $id: string })[] };

			all.push(...page.rows);
			const last = page.rows.at(-1);
			if (!last || page.rows.length < MAX_PAGE_SIZE) {
				return all;
			}
			cursor = last.$id;
		}
	}

	createRow<K extends TableId>(
		tableId: K,
		rowId: string,
		row: RowInput<K>,
		permissions?: string[],
		transactionId?: string,
	): Promise<AppTablesTypeMap[K]> {
		return this.tables.createRow({
			databaseId: this.databaseId,
			tableId,
			rowId,
			data: patchAppwritePayload(row),
			permissions,
			transactionId,
		}) as unknown as Promise<AppTablesTypeMap[K]>;
	}

	updateRow<K extends TableId>(
		tableId: K,
		rowId: string,
		row: RowInput<K>,
		permissions?: string[],
		transactionId?: string,
	): Promise<AppTablesTypeMap[K]> {
		return this.tables.updateRow({
			databaseId: this.databaseId,
			tableId,
			rowId,
			data: patchAppwritePayload(row),
			permissions,
			transactionId,
		}) as unknown as Promise<AppTablesTypeMap[K]>;
	}

	upsertRow<K extends TableId>(
		tableId: K,
		rowId: string,
		row: RowInput<K>,
		permissions?: string[],
		transactionId?: string,
	): Promise<AppTablesTypeMap[K]> {
		return this.tables.upsertRow({
			databaseId: this.databaseId,
			tableId,
			rowId,
			data: patchAppwritePayload(row),
			permissions,
			transactionId,
		}) as unknown as Promise<AppTablesTypeMap[K]>;
	}

	async deleteRow<K extends TableId>(
		tableId: K,
		rowId: string,
		transactionId?: string,
	): Promise<void> {
		await this.tables.deleteRow({
			databaseId: this.databaseId,
			tableId,
			rowId,
			transactionId,
		});
	}
}

/**
 * Bulk operations for server-side use with an admin (API key) client.
 * @public
 */
export class AdminTables extends AppTables {
	bulkCreateRows<K extends TableId>(
		tableId: K,
		rows: RowInput<K>[],
		ownerId: string,
		transactionId?: string,
	): Promise<BulkResult<AppTablesTypeMap[K]>> {
		return this.bulkWrite(tableId, rows, ownerId, transactionId, (args) =>
			this.tables.createRows(args),
		);
	}

	bulkUpsertRows<K extends TableId>(
		tableId: K,
		rows: RowInput<K>[],
		ownerId: string,
		transactionId?: string,
	): Promise<BulkResult<AppTablesTypeMap[K]>> {
		return this.bulkWrite(tableId, rows, ownerId, transactionId, (args) =>
			this.tables.upsertRows(args),
		);
	}

	deleteRows<K extends TableId>(
		tableId: K,
		queries: string[],
		transactionId?: string,
	): Promise<Models.RowList<Models.DefaultRow>> {
		return this.tables.deleteRows({
			databaseId: this.databaseId,
			tableId,
			queries,
			transactionId,
		});
	}

	private async bulkWrite<K extends TableId>(
		tableId: K,
		rows: RowInput<K>[],
		ownerId: string,
		transactionId: string | undefined,
		write: (args: {
			databaseId: string;
			tableId: string;
			rows: object[];
			transactionId?: string;
		}) => Promise<Models.RowList<Models.DefaultRow>>,
	): Promise<BulkResult<AppTablesTypeMap[K]>> {
		const result: BulkResult<AppTablesTypeMap[K]> = {
			success: 0,
			errors: [],
			rows: [],
		};
		const permissions = ownerPermissions(ownerId);

		for (let i = 0; i < rows.length; i += BULK_BATCH_SIZE) {
			const batch = rows.slice(i, i + BULK_BATCH_SIZE);
			const batchNumber = i / BULK_BATCH_SIZE + 1;
			try {
				const response = await write({
					databaseId: this.databaseId,
					tableId,
					rows: batch.map((row) => ({
						...patchAppwritePayload(row),
						$permissions: permissions,
					})),
					transactionId,
				});
				result.success += batch.length;
				result.rows.push(
					...(response.rows as unknown as AppTablesTypeMap[K][]),
				);
			} catch (error) {
				result.errors.push(
					`Batch ${batchNumber} failed: ${errorMessage(error)}`,
				);
			}
		}
		return result;
	}
}
