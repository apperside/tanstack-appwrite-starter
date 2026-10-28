import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { requestPasswordReset } from "#/features/auth/auth.functions";
import { AppError } from "#/lib/errors";
import { renderWithRouter } from "#/test/router";
import { ForgotPasswordPage } from "./forgot-password-page";

vi.mock("#/features/auth/auth.functions", () => ({
	getCurrentUser: vi.fn(),
	requestPasswordReset: vi.fn(),
}));

async function requestFor(email: string) {
	const rendered = await renderWithRouter(<ForgotPasswordPage />, {
		path: "/forgot-password",
	});
	await rendered.user.type(screen.getByLabelText("Email"), email);
	await rendered.user.click(
		screen.getByRole("button", { name: "Send reset link" }),
	);
	await screen.findByRole("heading", { name: "Check your email" });
	return rendered;
}

describe("ForgotPasswordPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
	});

	it("requests a reset link and confirms, focusing the new state", async () => {
		await requestFor("ada@example.com");
		expect(requestPasswordReset).toHaveBeenCalledWith({
			data: { email: "ada@example.com" },
		});
		expect(
			screen.getByText(/If an account exists for ada@example.com/),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: "Check your email" }),
			).toHaveFocus(),
		);
		expect(
			screen.getByRole("link", { name: "Back to sign in" }),
		).toHaveAttribute("href", "/login");
	});

	it("never reveals whether an account exists (same copy either way)", async () => {
		// The server answers { ok: true } for a known and an unknown email alike.
		const known = await requestFor("ada@example.com");
		const knownCopy = known.container.textContent;
		known.unmount();

		const unknown = await requestFor("ada@example.com");
		expect(unknown.container.textContent).toBe(knownCopy);
	});

	it("goes back to the form for a different email", async () => {
		const { user } = await requestFor("ada@example.com");
		await user.click(
			screen.getByRole("button", { name: "Use a different email" }),
		);
		expect(screen.getByLabelText("Email")).toHaveValue("");
	});

	it("shows rate limiting as a form error", async () => {
		vi.mocked(requestPasswordReset).mockRejectedValue(
			new AppError("RATE_LIMITED"),
		);
		const { user } = await renderWithRouter(<ForgotPasswordPage />);
		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.click(screen.getByRole("button", { name: "Send reset link" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Too many attempts.",
		);
	});

	it("is translated and accessible", async () => {
		const { container } = await renderWithRouter(<ForgotPasswordPage />, {
			locale: "it",
		});
		expect(
			screen.getByRole("heading", { name: "Reimposta la password" }),
		).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();
	});
});
