import { describe, expect, it } from "vitest";
import { patchAppwritePayload, patchAppwriteResponseObject } from "./payload";

describe("patchAppwritePayload", () => {
	it("removes Appwrite metadata fields", () => {
		const input = {
			$id: "doc-1",
			$collectionId: "col-1",
			$databaseId: "db-1",
			$createdAt: "2024-01-01",
			$updatedAt: "2024-01-02",
			$permissions: ['read("any")'],
			$tableId: "table-1",
			$sequence: 1,
			name: "Test",
			amount: 100,
		};

		const result = patchAppwritePayload(input);

		expect(result).toHaveProperty("$id", "doc-1");
		expect(result).toHaveProperty("name", "Test");
		expect(result).toHaveProperty("amount", 100);
		expect(result).not.toHaveProperty("$collectionId");
		expect(result).not.toHaveProperty("$databaseId");
		expect(result).not.toHaveProperty("$createdAt");
		expect(result).not.toHaveProperty("$updatedAt");
		expect(result).not.toHaveProperty("$permissions");
		expect(result).not.toHaveProperty("$tableId");
		expect(result).not.toHaveProperty("$sequence");
	});

	it("converts undefined values to null", () => {
		const input = {
			name: "Test",
			category: undefined,
		};

		const result = patchAppwritePayload(input);

		expect(result.name).toBe("Test");
		expect(result.category).toBeNull();
	});

	it("preserves null values", () => {
		const input = { name: null };
		const result = patchAppwritePayload(input);
		expect(result.name).toBeNull();
	});

	it("preserves arrays", () => {
		const input = { tags: ["a", "b", "c"] };
		const result = patchAppwritePayload(input);
		expect(result.tags).toEqual(["a", "b", "c"]);
	});

	it("recursively patches nested objects", () => {
		const input = {
			name: "Test",
			nested: {
				$collectionId: "should-be-removed",
				value: "kept",
				deep: undefined,
			},
		};

		const result = patchAppwritePayload(input);

		expect(result.nested).not.toHaveProperty("$collectionId");
		expect(result.nested).toHaveProperty("value", "kept");
		expect(result.nested).toHaveProperty("deep", null);
	});

	it("does not mutate the original object", () => {
		const input = {
			$collectionId: "col-1",
			name: "Test",
		};

		patchAppwritePayload(input);

		expect(input).toHaveProperty("$collectionId", "col-1");
	});

	it("handles empty object", () => {
		const result = patchAppwritePayload({});
		expect(result).toEqual({});
	});

	it("preserves primitive values", () => {
		const input = {
			str: "hello",
			num: 42,
			bool: true,
			zero: 0,
			empty: "",
		};

		const result = patchAppwritePayload(input);

		expect(result).toEqual(input);
	});
});

describe("patchAppwriteResponseObject", () => {
	it("removes response metadata fields from array of objects", () => {
		const input = [
			{
				$id: "doc-1",
				collectionId: "col-1",
				databaseId: "db-1",
				permissions: ['read("any")'],
				tableId: "table-1",
				sequence: 1,
				name: "Test",
			},
		];

		const result = patchAppwriteResponseObject(input);

		expect(result[0]).toHaveProperty("$id", "doc-1");
		expect(result[0]).toHaveProperty("name", "Test");
		expect(result[0]).not.toHaveProperty("collectionId");
		expect(result[0]).not.toHaveProperty("databaseId");
		expect(result[0]).not.toHaveProperty("permissions");
		expect(result[0]).not.toHaveProperty("tableId");
		expect(result[0]).not.toHaveProperty("sequence");
	});

	it("handles multiple items", () => {
		const input = [
			{ collectionId: "c1", name: "A" },
			{ collectionId: "c2", name: "B" },
		];

		const result = patchAppwriteResponseObject(input);

		expect(result).toHaveLength(2);
		expect(result[0]).not.toHaveProperty("collectionId");
		expect(result[0]).toHaveProperty("name", "A");
		expect(result[1]).not.toHaveProperty("collectionId");
		expect(result[1]).toHaveProperty("name", "B");
	});

	it("handles empty array", () => {
		const result = patchAppwriteResponseObject([]);
		expect(result).toEqual([]);
	});
});
