import { useSearch } from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { EmailLinkParams } from "#/core/auth/types";
import { AppError } from "#/lib/errors";
import { resetPassword } from "#/server/api/auth/auth.functions";
import { renderWithRouter } from "#/test/router";
import { ResetPasswordPage } from "./reset-password-page";

const hydration = vi.hoisted(() => ({ done: true }));
vi.mock("#/client/hooks/use-hydrated", () => ({
	useHydrated: () => hydration.done,
}));
vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	resetPassword: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("#/client/components/ui/toast", () => ({
	toast: { success: toastSuccess, error: vi.fn() },
}));

const LINK = { userId: "65e12", secret: "s3cret" };
const INVALID = "This link is invalid or has expired";

function renderReset(link: EmailLinkParams = LINK) {
	return renderWithRouter(<ResetPasswordPage link={link} />, {
		path: "/reset-password",
	});
}

async function submit(
	user: Awaited<ReturnType<typeof renderReset>>["user"],
	password = "a much longer passphrase",
) {
	await user.type(screen.getByLabelText("New password"), password);
	await user.click(screen.getByRole("button", { name: "Update password" }));
}

describe("ResetPasswordPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resetPassword).mockResolvedValue({ ok: true });
	});

	it("sets the new password, confirms and goes to sign in", async () => {
		const { user, router } = await renderReset();
		await submit(user);

		await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
		expect(resetPassword).toHaveBeenCalledWith({
			data: { link: LINK, password: "a much longer passphrase" },
		});
		expect(toastSuccess).toHaveBeenCalledWith(
			"Password updated. Sign in with your new password.",
		);
	});

	it("takes the link's secret out of the URL once read, and still uses it", async () => {
		function FromUrl() {
			const search = useSearch({ strict: false }) as EmailLinkParams;
			return <ResetPasswordPage link={search} />;
		}
		const { user, router } = await renderWithRouter(<FromUrl />, {
			path: "/reset-password",
			search: `?userId=${LINK.userId}&secret=${LINK.secret}`,
		});
		await waitFor(() => expect(router.state.location.search).toEqual({}));
		expect(router.history.location.search).not.toContain(LINK.secret);
		// Kept for a reload, out of the URL (and so of any Referer).
		expect(router.state.location.state).toMatchObject({ emailLink: LINK });

		await submit(user);
		await waitFor(() =>
			expect(resetPassword).toHaveBeenCalledWith({
				data: { link: LINK, password: "a much longer passphrase" },
			}),
		);
	});

	it("after a reload (no link in the URL), reads the link back from history state", async () => {
		const { user } = await renderWithRouter(<ResetPasswordPage link={{}} />, {
			path: "/reset-password",
			historyState: { emailLink: LINK },
		});
		expect(
			screen.queryByRole("heading", { name: INVALID }),
		).not.toBeInTheDocument();
		await submit(user);
		await waitFor(() =>
			expect(resetPassword).toHaveBeenCalledWith({
				data: { link: LINK, password: "a much longer passphrase" },
			}),
		);
	});

	it.each([
		["empty values", { userId: "", secret: "" }],
		["not an object", "junk"],
	])("ignores a link in history state with %s", async (_, emailLink) => {
		await renderWithRouter(<ResetPasswordPage link={{}} />, {
			path: "/reset-password",
			historyState: { emailLink },
		});
		expect(screen.getByRole("heading", { name: INVALID })).toBeInTheDocument();
	});

	it("before hydration without a link in the URL, renders a neutral placeholder (no invalid flash)", async () => {
		hydration.done = false;
		try {
			await renderReset({});
			expect(
				screen.queryByRole("heading", { name: INVALID }),
			).not.toBeInTheDocument();
			expect(screen.getByRole("status", { busy: true })).toBeInTheDocument();
		} finally {
			hydration.done = true;
		}
	});

	it("shows a strength meter", async () => {
		const { user } = await renderReset();
		await user.type(screen.getByLabelText("New password"), "abc");
		expect(screen.getByTestId("password-strength")).toHaveTextContent(
			"too weak",
		);
	});

	it("without a link, shows the invalid-link state without calling the server (Review Focus 5)", async () => {
		await renderReset({});
		expect(screen.getByRole("heading", { name: INVALID })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Request a new link" }),
		).toHaveAttribute("href", "/forgot-password");
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
		expect(resetPassword).not.toHaveBeenCalled();
	});

	it("passes a link through as it is: the backend decides what is malformed", async () => {
		vi.mocked(resetPassword).mockRejectedValue(new AppError("INVALID_TOKEN"));
		const { user } = await renderReset({ userId: "u1" });
		await submit(user);
		expect(
			await screen.findByRole("heading", { name: INVALID }),
		).toBeInTheDocument();
		expect(resetPassword).toHaveBeenCalledWith({
			data: { link: { userId: "u1" }, password: "a much longer passphrase" },
		});
	});

	it("switches to the invalid-link state when the server rejects the link", async () => {
		vi.mocked(resetPassword).mockRejectedValue(new AppError("INVALID_TOKEN"));
		const { user, router } = await renderReset();
		await submit(user);

		const heading = await screen.findByRole("heading", { name: INVALID });
		await waitFor(() => expect(heading).toHaveFocus());
		expect(router.state.location.pathname).toBe("/reset-password");
	});

	it("puts a weak password on the field", async () => {
		vi.mocked(resetPassword).mockRejectedValue(new AppError("WEAK_PASSWORD"));
		const { user } = await renderReset();
		await submit(user);
		await waitFor(() =>
			expect(screen.getByLabelText("New password")).toHaveAccessibleDescription(
				/too easy to guess/,
			),
		);
	});

	it("is accessible in both states", async () => {
		const form = await renderReset();
		expect(await axe(form.container)).toHaveNoViolations();
		form.unmount();
		const invalid = await renderReset({});
		expect(await axe(invalid.container)).toHaveNoViolations();
	});
});
