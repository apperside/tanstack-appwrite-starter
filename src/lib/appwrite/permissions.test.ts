import { describe, expect, it } from "vitest";
import { ownerPermissions } from "./permissions";

describe("ownerPermissions", () => {
	it("grants read, update and delete to the user only", () => {
		expect(ownerPermissions("u1")).toEqual([
			'read("user:u1")',
			'update("user:u1")',
			'delete("user:u1")',
		]);
	});
});
