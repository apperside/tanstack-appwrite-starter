import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "#/lib/errors";
import type { MailTransport } from "./mail";
import { createMailer, getSendEmail, loadTransport } from "./mailer.server";

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

describe("getSendEmail", () => {
	it("rejects a bad setup as UNKNOWN, then recovers once it is fixed", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const sendEmail = getSendEmail();
		vi.stubEnv("MAIL_PROVIDER", "pigeon");
		await expect(sendEmail(email)).rejects.toMatchObject({ code: "UNKNOWN" });
		vi.stubEnv("MAIL_PROVIDER", "console");
		await sendEmail(email);
		expect(info).toHaveBeenCalledTimes(1);
		vi.unstubAllEnvs();
	});

	it("warns once in production when mail only goes to the log", async () => {
		vi.resetModules();
		const { getSendEmail: fresh } = await import("./mailer.server");
		vi.spyOn(console, "info").mockImplementation(() => {});
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.stubEnv("MAIL_PROVIDER", "console");
		vi.stubEnv("NODE_ENV", "production");
		const sendEmail = fresh();
		await sendEmail(email);
		await sendEmail(email);
		expect(warn).toHaveBeenCalledTimes(1);
		vi.unstubAllEnvs();
	});
});
