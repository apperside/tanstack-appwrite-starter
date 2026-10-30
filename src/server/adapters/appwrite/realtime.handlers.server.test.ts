import { describe, expect, it, vi } from "vitest";
import { AppError } from "#/lib/errors";
import { appwriteError } from "#/test/appwrite-error";
import { fakeAppwriteClients } from "#/test/appwrite-fakes";
import { aJwt, anAppwriteSession } from "#/test/appwrite-fixtures";
import { createTestContext } from "#/test/test-context";
import { throughMiddleware } from "#/test/through-middleware";
import { issueBrowserJwtHandler } from "./realtime.handlers.server";

let backend = "appwrite";
vi.mock("#/config/env", () => ({ serverEnv: () => ({ BACKEND: backend }) }));

describe("issueBrowserJwtHandler", () => {
	it("mints a JWT for the user and current session", async () => {
		const test = createTestContext();
		const { user, session } = await test.seedUser();
		const fakes = fakeAppwriteClients();
		fakes.userAccount.getSession.mockResolvedValue(
			anAppwriteSession({ $id: "s-9" }),
		);
		fakes.adminUsers.createJWT.mockResolvedValue(aJwt());

		await expect(
			issueBrowserJwtHandler({ context: test.context }, fakes.clients),
		).resolves.toEqual({ jwt: aJwt().jwt });

		expect(fakes.clients.forSession).toHaveBeenCalledWith(session.token);
		expect(fakes.userAccount.getSession).toHaveBeenCalledWith({
			sessionId: "current",
		});
		expect(fakes.adminUsers.createJWT).toHaveBeenCalledWith({
			userId: user.id,
			sessionId: "s-9",
		});
	});

	it("translates Appwrite errors", async () => {
		const test = createTestContext();
		await test.seedUser();
		const fakes = fakeAppwriteClients();
		fakes.userAccount.getSession.mockRejectedValue(
			appwriteError("user_unauthorized", 401),
		);
		await expect(
			issueBrowserJwtHandler({ context: test.context }, fakes.clients),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
	});

	it("rejects with UNAUTHENTICATED without touching admin when signed out", async () => {
		const { context } = createTestContext();
		const fakes = fakeAppwriteClients();
		await expect(
			throughMiddleware(issueBrowserJwtHandler({ context }, fakes.clients)),
		).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(fakes.adminUsers.createJWT).not.toHaveBeenCalled();
	});

	it("refuses another backend: the browser would have no Appwrite to talk to", async () => {
		backend = "memory";
		const { context } = createTestContext();
		await expect(issueBrowserJwtHandler({ context })).rejects.toThrow(
			"BACKEND=appwrite",
		);
		backend = "appwrite";
	});
});
