import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "#/lib/errors";
import type { MailTransport } from "./mail";
import { createMailer, loadTransport } from "./mailer.server";

const email = {
	to: "ann@example.test",
	purpose: "recovery",
	url: "https://app.test/reset-password?token=t",
	locale: "en",
} as const;

afterEach(() => vi.restoreAllMocks());

describe("createMailer", () => {
	it("renders and sends with the sender", async () => {
		const send = vi.fn<MailTransport["send"]>().mockResolvedValue();
		await createMailer({
			transport: { send },
			from: "App <a@b.c>",
			provider: "smtp",
		})(email);
		expect(send).toHaveBeenCalledWith({
			to: email.to,
			from: "App <a@b.c>",
			subject: expect.any(String),
			text: expect.stringContaining(email.url),
			html: expect.stringContaining(email.url),
		});
	});

	it("wraps a transport failure as UNKNOWN, logging the provider only", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const cause = new Error("key-123 leaked");
		const sendEmail = createMailer({
			transport: { send: () => Promise.reject(cause) },
			from: "a@b.c",
			provider: "smtp",
		});
		await expect(sendEmail(email)).rejects.toMatchObject({
			code: "UNKNOWN",
			cause,
		});
		await expect(sendEmail(email)).rejects.toBeInstanceOf(AppError);
		expect(error).toHaveBeenCalledWith(expect.stringContaining("smtp"));
		for (const call of error.mock.calls) {
			expect(JSON.stringify(call)).not.toContain("key-123");
		}
	});
});

describe("loadTransport", () => {
	it("loads the transport named by the provider", async () => {
		await expect(loadTransport("console")).resolves.toHaveProperty("send");
	});
});
