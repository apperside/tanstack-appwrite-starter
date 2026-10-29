import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "#/core/auth/types";
import { getCurrentUser } from "#/features/auth/auth.functions";
import { AppError } from "#/lib/errors";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { signOutMutation } from "./auth.mutations";
import { useAuthMutation } from "./use-auth-mutation";
import { useCurrentUser } from "./use-current-user";

vi.mock("#/features/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	signOut: vi.fn(),
}));

const fetchUser = vi.mocked(getCurrentUser);

function Probe({
	mutationFn,
	onSuccess,
	nextUser,
}: {
	mutationFn: () => Promise<void>;
	onSuccess?: () => void;
	nextUser?: User | null;
}) {
	const user = useCurrentUser();
	const mutation = useAuthMutation({
		...signOutMutation,
		mutationFn,
		onSuccess,
		nextUser,
	});
	return (
		<>
			<p>{user ? `user:${user.id}` : "signed out"}</p>
			{mutation.isError && <p role="alert">{mutation.error.message}</p>}
			<button type="button" onClick={() => mutation.mutate()}>
				Run
			</button>
		</>
	);
}

function respondWith(user: User | null) {
	fetchUser.mockResolvedValue(
		user as Awaited<ReturnType<typeof getCurrentUser>>,
	);
}

describe("useAuthMutation", () => {
	beforeEach(() => fetchUser.mockReset());

	it("refreshes currentUser once per success, even when the cache came from SSR", async () => {
		// The seeded cache entry has no queryFn, like a dehydrated one.
		const { user, router } = await renderWithRouter(
			<Probe mutationFn={async () => {}} />,
			{ user: aGuest() },
		);
		respondWith(aUser());

		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("user:user-1")).toBeInTheDocument();
		expect(fetchUser).toHaveBeenCalledTimes(1);

		respondWith(null);
		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("signed out")).toBeInTheDocument();
		expect(fetchUser).toHaveBeenCalledTimes(2);
		expect(router.state.location.pathname).toBe("/");
	});

	it("updates the cache before the guards re-run, then calls the caller's onSuccess", async () => {
		const order: string[] = [];
		const onSuccess = vi.fn(() => {
			order.push("onSuccess");
		});
		const { user, router, queryClient } = await renderWithRouter(
			<Probe mutationFn={async () => {}} onSuccess={onSuccess} />,
			{ user: aUser() },
		);
		const invalidate = router.invalidate.bind(router);
		vi.spyOn(router, "invalidate").mockImplementation(async (options) => {
			order.push(
				`invalidate:${JSON.stringify(queryClient.getQueryData(["currentUser"]))}`,
			);
			return invalidate(options);
		});
		respondWith(null);

		await user.click(screen.getByRole("button", { name: "Run" }));
		await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
		expect(order).toEqual(["invalidate:null", "onSuccess"]);
	});

	it("drops every other cached query when the account changes", async () => {
		const { user, queryClient } = await renderWithRouter(
			<Probe mutationFn={async () => {}} />,
			{ user: aUser() },
		);
		queryClient.setQueryData(["sessions"], []);
		respondWith(aUser({ id: "user-2" }));

		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("user:user-2")).toBeInTheDocument();
		expect(queryClient.getQueryData(["sessions"])).toBeUndefined();
	});

	it("keeps other cached queries when the account stays the same", async () => {
		const { user, queryClient } = await renderWithRouter(
			<Probe mutationFn={async () => {}} />,
			{ user: aGuest() },
		);
		queryClient.setQueryData(["sessions"], []);
		// A guest upgrade keeps the same id.
		respondWith(aGuest({ email: "ada@example.test" }));

		await user.click(screen.getByRole("button", { name: "Run" }));
		await waitFor(() => expect(fetchUser).toHaveBeenCalledTimes(1));
		expect(queryClient.getQueryData(["sessions"])).toEqual([]);
	});

	it("leaves auth state alone when the mutation fails", async () => {
		const onSuccess = vi.fn();
		const { user, router } = await renderWithRouter(
			<Probe
				mutationFn={() => Promise.reject(new AppError("NETWORK"))}
				onSuccess={onSuccess}
			/>,
			{ user: aUser() },
		);
		const invalidate = vi.spyOn(router, "invalidate");

		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("NETWORK");
		expect(fetchUser).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
		expect(screen.getByText("user:user-1")).toBeInTheDocument();
	});

	it("uses the definition's known next user without a round trip", async () => {
		const { user, queryClient } = await renderWithRouter(
			<Probe mutationFn={async () => {}} nextUser={null} />,
			{ user: aUser() },
		);
		queryClient.setQueryData(["sessions"], []);

		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("signed out")).toBeInTheDocument();
		expect(fetchUser).not.toHaveBeenCalled();
		expect(queryClient.getQueryData(["sessions"])).toBeUndefined();
	});

	it("derives the next user from the mutation's data", async () => {
		function FromData() {
			const current = useCurrentUser();
			const mutation = useAuthMutation({
				...signOutMutation,
				mutationFn: async () => {},
				nextUser: () => aUser({ id: "user-9" }),
			});
			return (
				<>
					<p>{current ? `user:${current.id}` : "signed out"}</p>
					<button type="button" onClick={() => mutation.mutate()}>
						Run
					</button>
				</>
			);
		}
		const { user } = await renderWithRouter(<FromData />, { user: null });
		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("user:user-9")).toBeInTheDocument();
		expect(fetchUser).not.toHaveBeenCalled();
	});

	it("falls back to the guards' own refetch when re-reading the user fails", async () => {
		const onSuccess = vi.fn();
		const { user, router, queryClient } = await renderWithRouter(
			<Probe mutationFn={async () => {}} onSuccess={onSuccess} />,
			{ user: aGuest() },
		);
		queryClient.setQueryData(["sessions"], []);
		// The first read (right after the mutation) fails; the guards' retry succeeds.
		fetchUser
			.mockRejectedValueOnce(new AppError("UNKNOWN"))
			.mockResolvedValue(aUser() as Awaited<ReturnType<typeof getCurrentUser>>);
		const invalidate = vi.spyOn(router, "invalidate");

		await user.click(screen.getByRole("button", { name: "Run" }));
		expect(await screen.findByText("user:user-1")).toBeInTheDocument();
		expect(invalidate).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(fetchUser).toHaveBeenCalledTimes(2);
		// Unknown whether the account changed: nothing cached may outlive it.
		expect(queryClient.getQueryData(["sessions"])).toBeUndefined();
	});
});
