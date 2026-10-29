import { useSearch } from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { EmailLinkParams } from "#/core/auth/types";
import {
	confirmVerification,
	getCurrentUser,
	sendVerification,
	signOut,
} from "#/features/auth/auth.functions";
import { AppError } from "#/lib/errors";
import { aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { VerifyEmailPage } from "./verify-email-page";

vi.mock("#/features/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	confirmVerification: vi.fn(),
	sendVerification: vi.fn(),
	signOut: vi.fn(),
}));

const LINK = { userId: "u1", secret: "s1" };
const unverified = () => aUser({ emailVerified: false });

function renderVerify(
	link: EmailLinkParams,
	options: Parameters<typeof renderWithRouter>[1] = {},
) {
	return renderWithRouter(<VerifyEmailPage link={link} />, {
		path: "/verify-email",
		...options,
	});
}

describe("VerifyEmailPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(confirmVerification).mockResolvedValue({ ok: true });
		vi.mocked(sendVerification).mockResolvedValue({ ok: true });
		vi.mocked(signOut).mockResolvedValue(undefined);
		vi.mocked(getCurrentUser).mockResolvedValue(aUser());
	});

	it("confirms a link exactly once, even under StrictMode's double mount (Review Focus 5)", async () => {
		await renderVerify(LINK, { user: unverified(), strictMode: true });
		expect(
			await screen.findByRole("heading", { name: "Email verified" }),
		).toBeInTheDocument();
		expect(confirmVerification).toHaveBeenCalledTimes(1);
		expect(confirmVerification).toHaveBeenCalledWith({ data: { link: LINK } });
	});

	it("refreshes the user so the guards see the verified email", async () => {
		const { queryClient } = await renderVerify(LINK, { user: unverified() });
		await screen.findByRole("heading", { name: "Email verified" });
		await waitFor(() =>
			expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
				emailVerified: true,
			}),
		);
		expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	it("works signed out, then offers sign in", async () => {
		vi.mocked(getCurrentUser).mockResolvedValue(null);
		await renderVerify(LINK);
		await screen.findByRole("heading", { name: "Email verified" });
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/login",
		);
	});

	it("shows the invalid state for a rejected link; signed out, a new link needs sign-in", async () => {
		vi.mocked(confirmVerification).mockRejectedValue(
			new AppError("INVALID_TOKEN"),
		);
		await renderVerify(LINK);
		expect(
			await screen.findByRole("heading", {
				name: "This link is invalid or has expired",
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Send a new link" }),
		).toHaveAttribute("href", "/login?redirect=%2Fverify-email");
	});

	it("signed in, sends a new link from the invalid state", async () => {
		vi.mocked(confirmVerification).mockRejectedValue(
			new AppError("INVALID_TOKEN"),
		);
		const { user } = await renderVerify(LINK, { user: unverified() });
		await user.click(
			await screen.findByRole("button", { name: "Send a new link" }),
		);
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"A new link is on its way to user@example.test.",
			),
		);
		expect(sendVerification).toHaveBeenCalledTimes(1);
	});

	it("shows the verified state, not an invalid link, when a verified user opens a used link again", async () => {
		vi.mocked(confirmVerification).mockRejectedValue(
			new AppError("INVALID_TOKEN"),
		);
		await renderVerify({ userId: "user-1", secret: "used" }, { user: aUser() });
		expect(
			await screen.findByRole("heading", { name: "Your email is verified" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	it("still calls a used link invalid for an unverified user", async () => {
		vi.mocked(confirmVerification).mockRejectedValue(
			new AppError("INVALID_TOKEN"),
		);
		await renderVerify(
			{ userId: "user-1", secret: "used" },
			{ user: unverified() },
		);
		expect(
			await screen.findByRole("heading", {
				name: "This link is invalid or has expired",
			}),
		).toBeInTheDocument();
	});

	it("takes the link's secret out of the URL once read, and still confirms it", async () => {
		function FromUrl() {
			const search = useSearch({ strict: false }) as EmailLinkParams;
			return <VerifyEmailPage link={search} />;
		}
		const { router } = await renderWithRouter(<FromUrl />, {
			path: "/verify-email",
			search: "?userId=u1&secret=s1",
			user: unverified(),
		});
		expect(
			await screen.findByRole("heading", { name: "Email verified" }),
		).toBeInTheDocument();
		expect(confirmVerification).toHaveBeenCalledWith({ data: { link: LINK } });
		await waitFor(() => expect(router.state.location.search).toEqual({}));
		expect(router.history.location.search).not.toContain("s1");
	});

	it("offers a retry for other failures", async () => {
		vi.mocked(confirmVerification)
			.mockRejectedValueOnce(new AppError("UNKNOWN"))
			.mockResolvedValueOnce({ ok: true });
		const { user } = await renderVerify(LINK);
		await user.click(await screen.findByRole("button", { name: "Try again" }));
		expect(
			await screen.findByRole("heading", { name: "Email verified" }),
		).toBeInTheDocument();
		expect(confirmVerification).toHaveBeenCalledTimes(2);
	});

	it("without a link, asks a signed-in user to check their inbox and can resend", async () => {
		const { user } = await renderVerify({}, { user: unverified() });
		expect(
			screen.getByRole("heading", { name: "Check your inbox" }),
		).toBeInTheDocument();
		expect(screen.getByText(/user@example.test/)).toBeInTheDocument();
		expect(confirmVerification).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", { name: "Send a new link" }));
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"A new link is on its way",
			),
		);
	});

	it("without a link, lets a user stuck on the wrong account sign out", async () => {
		const { user, router } = await renderVerify({}, { user: unverified() });
		await user.click(screen.getByRole("button", { name: "Sign out" }));
		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(signOut).toHaveBeenCalledTimes(1);
	});

	it("is accessible", async () => {
		const { container } = await renderVerify({}, { user: unverified() });
		expect(await axe(container)).toHaveNoViolations();
	});
});
