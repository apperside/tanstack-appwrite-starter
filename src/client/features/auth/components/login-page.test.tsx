import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AppError } from "#/lib/errors";
import {
	signIn,
	signInAndMergeGuest,
	startGuestSession,
} from "#/server/api/auth/auth.functions";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { LoginPage } from "./login-page";

vi.mock("#/server/api/auth/auth.functions", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("#/server/api/auth/auth.functions")
	>()),
	getCurrentUser: vi.fn(),
	signIn: vi.fn(),
	signInAndMergeGuest: vi.fn(),
	startGuestSession: vi.fn(),
}));

function renderLogin(
	props: Parameters<typeof LoginPage>[0] = {},
	options: Parameters<typeof renderWithRouter>[1] = {},
) {
	return renderWithRouter(<LoginPage {...props} />, {
		path: "/login",
		...options,
	});
}

async function fillAndSubmit(
	user: Awaited<ReturnType<typeof renderLogin>>["user"],
	{ email = "ada@example.com", password = "correct horse" } = {},
) {
	await user.type(screen.getByLabelText("Email"), email);
	await user.type(screen.getByLabelText("Password"), password);
	await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(signIn).mockResolvedValue(aUser());
		vi.mocked(signInAndMergeGuest).mockResolvedValue(aUser());
		vi.mocked(startGuestSession).mockResolvedValue(aGuest());
	});

	it("signs in and goes to the requested page", async () => {
		const { user, router } = await renderLogin({
			redirect: "/settings?tab=1",
		});
		await fillAndSubmit(user);

		await waitFor(() =>
			expect(router.state.location.href).toBe("/settings?tab=1"),
		);
		expect(signIn).toHaveBeenCalledTimes(1);
		expect(signIn).toHaveBeenCalledWith({
			data: { email: "ada@example.com", password: "correct horse" },
		});
	});

	it("never follows an off-site redirect (Review Focus 2)", async () => {
		const { user, router } = await renderLogin({ redirect: "//evil.com" });
		await fillAndSubmit(user);

		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
		expect(screen.getByText("Home page")).toBeInTheDocument();
	});

	it("shows wrong credentials as a form error and stays", async () => {
		vi.mocked(signIn).mockRejectedValue(new AppError("INVALID_CREDENTIALS"));
		const { user, router } = await renderLogin();
		await fillAndSubmit(user);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"That email and password don't match.",
		);
		expect(router.state.location.pathname).toBe("/login");
	});

	it("shows rate limiting as a form error", async () => {
		vi.mocked(signIn).mockRejectedValue(new AppError("RATE_LIMITED"));
		const { user } = await renderLogin();
		await fillAndSubmit(user);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Too many attempts.",
		);
	});

	it("validates before calling the server", async () => {
		const { user } = await renderLogin();
		await user.click(screen.getByRole("button", { name: "Sign in" }));
		expect(
			await screen.findByText("Enter a valid email address"),
		).toBeInTheDocument();
		expect(signIn).not.toHaveBeenCalled();
	});

	it("links to sign up and to password recovery", async () => {
		await renderLogin();
		expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
			"href",
			"/signup",
		);
		expect(
			screen.getByRole("link", { name: "Forgot password?" }),
		).toHaveAttribute("href", "/forgot-password");
	});

	it("continues as a guest, then onboards", async () => {
		const { user, router } = await renderLogin();
		await user.click(screen.getByRole("button", { name: "Continue as guest" }));

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/onboarding"),
		);
		expect(startGuestSession).toHaveBeenCalledTimes(1);
	});

	it("in merge mode, signs a guest in to an existing account and keeps their work", async () => {
		const { user, router } = await renderLogin(
			{ merge: true },
			{ user: aGuest() },
		);
		expect(
			screen.getByRole("heading", { name: "Sign in to your account" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Continue as guest" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Save your guest account" }),
		).toHaveAttribute("href", "/signup?upgrade=1");

		await fillAndSubmit(user);
		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
		expect(signInAndMergeGuest).toHaveBeenCalledTimes(1);
		expect(signIn).not.toHaveBeenCalled();
	});

	it("ignores merge mode without a guest to merge", async () => {
		await renderLogin({ merge: true });
		expect(
			screen.getByRole("heading", { level: 1, name: "Sign in" }),
		).toBeInTheDocument();
	});

	it("is translated and accessible, also with errors shown", async () => {
		vi.mocked(signIn).mockRejectedValue(new AppError("INVALID_CREDENTIALS"));
		const { container, user } = await renderLogin({}, { locale: "it" });
		expect(
			screen.getByRole("heading", { level: 1, name: "Accedi" }),
		).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();

		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "correct horse");
		await user.click(screen.getByRole("button", { name: "Accedi" }));
		await screen.findByRole("alert");
		expect(await axe(container)).toHaveNoViolations();
	});
});
