import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "#/test/pglite";
import {
	hashPassword,
	LOW_SCRYPT,
	OWASP_SCRYPT,
} from "../shared/passwords.server";
import { createPostgresBackend } from "./backend.server";

vi.mock("#/server/adapters/shared/passwords.server", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("#/server/adapters/shared/passwords.server")
		>();
	return { ...original, hashPassword: vi.fn(original.hashPassword) };
});

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
	testDb = await createTestDb();
});

afterAll(async () => {
	await testDb.client.close();
});

const ann = { name: "Ann", email: "ann@example.test", password: "password1" };

describe("createPostgresBackend", () => {
	it("bundles auth and todos over one database", async () => {
		await testDb.reset();
		const backend = createPostgresBackend({
			db: testDb.db,
			passwordCost: LOW_SCRYPT,
			sendEmail: vi.fn(),
		});
		const { userId } = await backend.auth({ userAgent: undefined }).signUp(ann);
		await backend.data.todos.create(userId, { title: "a" });
		const { items } = await backend.data.todos.list(userId);
		expect(items.map((todo) => todo.title)).toEqual(["a"]);
	});

	it("uses OWASP cost by default", async () => {
		await testDb.reset();
		const backend = createPostgresBackend({
			db: testDb.db,
			sendEmail: vi.fn(),
		});
		vi.mocked(hashPassword).mockClear();
		await backend.auth({ userAgent: undefined }).signUp(ann);
		expect(hashPassword).toHaveBeenCalledWith(ann.password, OWASP_SCRYPT);
		expect(hashPassword).not.toHaveBeenCalledWith(ann.password, LOW_SCRYPT);
	});
});
