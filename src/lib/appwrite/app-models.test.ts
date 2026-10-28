import { describe, expect, expectTypeOf, it } from "vitest";
import {
	APP_TABLES,
	type AppTablesTypeMap,
	type AppTodo,
	DEFAULT_PREFS,
	TodosPriority,
} from "./app-models";

describe("app-models", () => {
	it("maps table ids to row types", () => {
		expectTypeOf<AppTablesTypeMap["todos"]>().toEqualTypeOf<AppTodo>();
		expect(APP_TABLES.TODOS).toBe("todos");
	});

	it("accepts literals and enum members for enum fields", () => {
		expectTypeOf<"normal">().toExtend<AppTodo["priority"]>();
		expectTypeOf<TodosPriority.NORMAL>().toExtend<AppTodo["priority"]>();
		expect(TodosPriority.NORMAL).toBe("normal");
	});

	it("strips Appwrite metadata and keeps $id optional", () => {
		expectTypeOf<AppTodo>().not.toHaveProperty("$createdAt");
		expectTypeOf<AppTodo>().toHaveProperty("$id");
		expectTypeOf<AppTodo["$id"]>().toEqualTypeOf<string | undefined>();
	});

	it("has the default prefs", () => {
		expect(DEFAULT_PREFS).toEqual({
			onboardingCompleted: false,
			locale: "en",
			theme: "system",
		});
	});
});
