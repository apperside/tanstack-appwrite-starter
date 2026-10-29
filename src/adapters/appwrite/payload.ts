const APPWRITE_METADATA_KEYS = new Set([
	"$collectionId",
	"$tableId",
	"$permissions",
	"$sequence",
	"$createdAt",
	"$updatedAt",
	"$databaseId",
]);

/**
 * Removes Appwrite metadata fields and converts undefined values to null
 * before saving to Appwrite. Returns a new object without mutating the input.
 *
 * Appwrite returns metadata fields ($collectionId, $createdAt, etc.) when reading,
 * but rejects them when writing. Undefined values must become null for Appwrite
 * to clear column values.
 * @public
 */
export function patchAppwritePayload<T extends object>(obj: T): T {
	const result: Record<string, unknown> = {};

	for (const key of Object.keys(obj)) {
		if (APPWRITE_METADATA_KEYS.has(key)) {
			continue;
		}

		const value = obj[key as keyof T];

		if (value === undefined || value === null) {
			result[key] = null;
		} else if (typeof value === "object" && !Array.isArray(value)) {
			result[key] = patchAppwritePayload(value);
		} else {
			result[key] = value;
		}
	}

	return result as T;
}

const RESPONSE_METADATA_KEYS = [
	"collectionId",
	"tableId",
	"databaseId",
	"permissions",
	"sequence",
] as const;

/**
 * Removes Appwrite metadata fields from response objects.
 * Returns a new array of cleaned objects without mutating the input.
 * @public
 */
export function patchAppwriteResponseObject<T extends object[]>(rows: T): T {
	return rows.map((item) => {
		const cleaned: Record<string, unknown> = { ...item };
		for (const key of RESPONSE_METADATA_KEYS) {
			delete cleaned[key];
		}
		return cleaned;
	}) as T;
}
