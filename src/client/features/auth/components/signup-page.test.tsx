import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AppError } from "#/lib/errors";
import { signUp, upgradeGuest } from "#/server/api/auth/auth.functions";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { SignupPage } from "./signup-page";

vi.mock("#/server/api/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	signUp: vi.fn(),
	upgradeGuest: vi.fn(),
}));

function renderSignup(
	props: Parameters<typeof SignupPage>[0] = {},
	options: Parameters<typeof renderWithRouter>[1] = {},
) {
	return renderWithRouter(<SignupPage {...props} />, {
		path: "/signup",
		...options,
	});
}

const VALUES = {
	name: "Ada Lovelace",
	email: "ada@example.com",
	password: "analytical engine 1843",
};

async function fillAndSubmit(
	user: Awaited<ReturnType<typeof renderSignup>>["user"],
	button: string,
) {
	await user.type(screen.getByLabelText("Name"), VALUES.name);
	await user.type(screen.getByLabelText("Email"), VALUES.email);
	await user.type(screen.getByLabelText("Password"), VALUES.password);
	await user.click(screen.getByRole("button", { name: button }));
}

describe("SignupPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(signUp).mockResolvedValue(aUser());
		vi.mocked(upgradeGuest).mockResolvedValue(aGuest({ email: VALUES.email }));
	});

	it("creates the account, then onboards", async () => {
		const { user, router } = await renderSignup();
		await fillAndSubmit(user, "Create account");

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/onboarding"),
		);
		expect(signUp).toHaveBeenCalledWith({ data: VALUES });
		expect(upgradeGuest).not.toHaveBeenCalled();
	});

	it("shows a strength meter on the password", async () => {
		const { user } = await renderSignup();
		await user.type(screen.getByLabelText("Password"), "abc");
		expect(screen.getByTestId("password-strength")).toHaveTextContent(
			"Password strength: too weak",
		);
		expect(screen.getByLabelText("Password")).toHaveAttribute(
			"autocomplete",
			"new-password",
		);
	});

	it("puts a taken email on the email field", async () => {
		vi.mocked(signUp).mockRejectedValue(new AppError("EMAIL_TAKEN"));
		const { user } = await renderSignup();
		await fillAndSubmit(user, "Create account");

		await waitFor(() =>
			expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
				/An account with this email already exists/,
			),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("puts a weak password on the password field", async () => {
		vi.mocked(signUp).mockRejectedValue(new AppError("WEAK_PASSWORD"));
		const { user } = await renderSignup();
		await fillAndSubmit(user, "Create account");
		await waitFor(() =>
			expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
				/too easy to guess/,
			),
		);
	});

	it("shows rate limiting as a form error", async () => {
		vi.mocked(signUp).mockRejectedValue(new AppError("RATE_LIMITED"));
		const { user } = await renderSignup();
		await fillAndSubmit(user, "Create account");
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Too many attempts.",
		);
	});

	it("with upgrade=1, saves a guest's account in place instead of creating one", async () => {
		const { user, router } = await renderSignup(
			{ upgrade: true },
			{ user: aGuest() },
		);
		expect(
			screen.getByRole("heading", { name: "Save your account" }),
		).toBeInTheDocument();
		await fillAndSubmit(user, "Save account");

		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
		expect(upgradeGuest).toHaveBeenCalledWith({ data: VALUES });
		expect(signUp).not.toHaveBeenCalled();
	});

	it("with upgrade=1, offers signing in to an existing account (merge)", async () => {
		await renderSignup({ upgrade: true }, { user: aGuest() });
		expect(
			screen.getByRole("link", { name: "I already have an account" }),
		).toHaveAttribute("href", "/login?merge=1");
	});

	it("ignores upgrade=1 without a guest", async () => {
		const { user } = await renderSignup({ upgrade: true });
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
			"href",
			"/login",
		);
		await fillAndSubmit(user, "Create account");
		await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
		expect(upgradeGuest).not.toHaveBeenCalled();
	});

	it("is accessible", async () => {
		const { container } = await renderSignup({}, { locale: "it" });
		expect(
			screen.getByRole("heading", { name: "Crea il tuo account" }),
		).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();
	});
});
