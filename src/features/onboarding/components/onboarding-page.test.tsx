import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { getCurrentUser } from "#/features/auth/auth.functions";
import { completeOnboarding } from "#/features/onboarding/onboarding.functions";
import { DEFAULT_PREFS } from "#/lib/appwrite/app-models";
import { AppError } from "#/lib/errors";
import { aGuest, aUser } from "#/test/fixtures";
import { renderWithRouter } from "#/test/router";
import { OnboardingPage } from "./onboarding-page";

vi.mock("#/features/auth/auth.functions", () => ({ getCurrentUser: vi.fn() }));
vi.mock("#/features/onboarding/onboarding.functions", () => ({
	completeOnboarding: vi.fn(),
}));

const onboarded = { ...DEFAULT_PREFS, onboardingCompleted: true };

function renderOnboarding(user = aUser({ name: "Ada" })) {
	return renderWithRouter(<OnboardingPage />, { path: "/onboarding", user });
}

describe("OnboardingPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(completeOnboarding).mockResolvedValue(onboarded);
		vi.mocked(getCurrentUser).mockResolvedValue(aUser({ prefs: onboarded }));
	});

	it("completes onboarding with the name, refreshes the user and goes home", async () => {
		const { user, router, queryClient } = await renderOnboarding();
		const name = screen.getByLabelText("Your name");
		expect(name).toHaveValue("Ada");
		await user.clear(name);
		await user.type(name, "Ada Lovelace");
		await user.click(screen.getByRole("button", { name: "Get started" }));

		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
		expect(completeOnboarding).toHaveBeenCalledWith({
			data: { name: "Ada Lovelace" },
		});
		expect(queryClient.getQueryData(["currentUser"])).toMatchObject({
			prefs: { onboardingCompleted: true },
		});
	});

	it("starts empty for a guest, and the name is optional", async () => {
		const { user, router } = await renderOnboarding(aGuest());
		expect(screen.getByLabelText("Your name")).toHaveValue("");
		await user.click(screen.getByRole("button", { name: "Get started" }));

		await waitFor(() => expect(router.state.location.pathname).toBe("/"));
		expect(completeOnboarding).toHaveBeenCalledWith({ data: {} });
	});

	it("shows a failure as a form error and stays", async () => {
		vi.mocked(completeOnboarding).mockRejectedValue(new AppError("NETWORK"));
		const { user, router } = await renderOnboarding();
		await user.click(screen.getByRole("button", { name: "Get started" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Can't reach the server.",
		);
		expect(router.state.location.pathname).toBe("/onboarding");
	});

	it("is translated and accessible", async () => {
		const { container } = await renderWithRouter(<OnboardingPage />, {
			path: "/onboarding",
			user: aUser(),
			locale: "it",
		});
		expect(screen.getByRole("button", { name: "Inizia" })).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();
	});
});
