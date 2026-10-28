import { useSearch } from "@tanstack/react-router";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { resetPassword } from "#/features/auth/auth.functions";
import { AppError } from "#/lib/errors";
import { renderWithRouter } from "#/test/router";
import { ResetPasswordPage } from "./reset-password-page";

const hydration = vi.hoisted(() => ({ done: true }));
vi.mock("#/hooks/use-hydrated", () => ({ useHydrated: () => hydration.done }));
vi.mock("#/features/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	resetPassword: vi.fn(),
}));
const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("#/components/ui/toast", () => ({
	toast: { success: toastSuccess, error: vi.fn() },
}));

const LINK = { userId: "65e12", secret: "s3cret" };
const INVALID = "This link is invalid or has expired";

function renderReset(props: Parameters<typeof ResetPasswordPage>[0] = LINK) {
	return renderWithRouter(<ResetPasswordPage {...props} />, {
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
			data: { ...LINK, password: "a much longer passphrase" },
		});
		expect(toastSuccess).toHaveBeenCalledWith(
			"Password updated. Sign in with your new password.",
		);
	});

	it("takes the link's secret out of the URL once read, and still uses it", async () => {
		function FromUrl() {
			const { userId, secret } = useSearch({ strict: false }) as {
				userId?: string;
				secret?: string;
			};
			return <ResetPasswordPage userId={userId} secret={secret} />;
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
				data: { ...LINK, password: "a much longer passphrase" },
			}),
		);
	});

	it("after a reload (no link in the URL), reads the link back from history state", async () => {
		const { user } = await renderWithRouter(<ResetPasswordPage />, {
			path: "/reset-password",
			historyState: { emailLink: LINK },
		});
		expect(
			screen.queryByRole("heading", { name: INVALID }),
		).not.toBeInTheDocument();
		await submit(user);
		await waitFor(() =>
			expect(resetPassword).toHaveBeenCalledWith({
				data: { ...LINK, password: "a much longer passphrase" },
			}),
		);
	});

	it("ignores a malformed link in history state", async () => {
		await renderWithRouter(<ResetPasswordPage />, {
			path: "/reset-password",
			historyState: { emailLink: { userId: 42, secret: "" } },
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

	it.each([
		["no secret", { userId: "u1" }],
		["no userId", { secret: "s1" }],
		["nothing", {}],
	])("with %s, shows the invalid-link state without calling the server (Review Focus 5)", async (_, props) => {
		await renderReset(props);
		expect(screen.getByRole("heading", { name: INVALID })).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Request a new link" }),
		).toHaveAttribute("href", "/forgot-password");
		expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
		expect(resetPassword).not.toHaveBeenCalled();
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
