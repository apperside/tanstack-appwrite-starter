import { describe, expect, it, vi } from "vitest";
import { AppError } from "./errors";
import { createQueryClient } from "./query-client";

function retryFn(): (failureCount: number, error: Error) => boolean {
	const retry = createQueryClient().getDefaultOptions().queries?.retry;
	if (typeof retry !== "function") throw new Error("retry must be a function");
	return retry;
}

describe("createQueryClient", () => {
	it("sets the default stale time", () => {
		const { queries } = createQueryClient().getDefaultOptions();
		expect(queries?.staleTime).toBe(30_000);
	});

	it("returns a fresh instance each call", () => {
		expect(createQueryClient()).not.toBe(createQueryClient());
	});

	it("retries network failures twice", () => {
		const retry = retryFn();
		const error = new TypeError("Failed to fetch");
		expect(retry(0, error)).toBe(true);
		expect(retry(1, error)).toBe(true);
		expect(retry(2, error)).toBe(false);
	});

	it("does not retry other errors", () => {
		const retry = retryFn();
		expect(retry(0, new AppError("FORBIDDEN"))).toBe(false);
		expect(retry(0, new Error("boom"))).toBe(false);
	});
});

describe("createQueryClient onUnauthenticated", () => {
	it("is called when a query fails with UNAUTHENTICATED", async () => {
		const onUnauthenticated = vi.fn();
		const client = createQueryClient({ onUnauthenticated });
		await client
			.fetchQuery({
				queryKey: ["sessions"],
				queryFn: () => Promise.reject(new Error("UNAUTHENTICATED")),
			})
			.catch(() => {});
		expect(onUnauthenticated).toHaveBeenCalledTimes(1);
	});

	it("is called when a mutation fails with UNAUTHENTICATED", async () => {
		const onUnauthenticated = vi.fn();
		const client = createQueryClient({ onUnauthenticated });
		const mutation = client.getMutationCache().build(client, {
			mutationFn: () => Promise.reject(new AppError("UNAUTHENTICATED")),
		});
		await mutation.execute(undefined).catch(() => {});
		expect(onUnauthenticated).toHaveBeenCalledTimes(1);
	});

	it("is not called for other failures", async () => {
		const onUnauthenticated = vi.fn();
		const client = createQueryClient({ onUnauthenticated });
		await client
			.fetchQuery({
				queryKey: ["x"],
				queryFn: () => Promise.reject(new AppError("FORBIDDEN")),
			})
			.catch(() => {});
		expect(onUnauthenticated).not.toHaveBeenCalled();
	});
});
