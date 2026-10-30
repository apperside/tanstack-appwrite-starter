import { describe, expect, it, vi } from "vitest";
import { createSmtpTransport, parseSmtpEnv } from "./smtp.server";

const message = {
	from: "App <no-reply@example.test>",
	to: "ann@example.test",
	subject: "Hi",
	text: "plain",
	html: "<p>html</p>",
};

function setup(raw: Record<string, unknown>) {
	const sendMail = vi.fn().mockResolvedValue(undefined);
	const create = vi.fn().mockReturnValue({ sendMail });
	const transport = createSmtpTransport(parseSmtpEnv(raw), create as never);
	return { sendMail, create, transport };
}

describe("parseSmtpEnv", () => {
	it("needs a host and a port", () => {
		expect(() => parseSmtpEnv({})).toThrow(/SMTP_HOST.*SMTP_PORT/);
	});

	it("is secure by default only on 465", () => {
		const base = { SMTP_HOST: "smtp.test" };
		expect(parseSmtpEnv({ ...base, SMTP_PORT: "465" }).SMTP_SECURE).toBe(true);
		expect(parseSmtpEnv({ ...base, SMTP_PORT: "1025" }).SMTP_SECURE).toBe(
			false,
		);
		expect(
			parseSmtpEnv({ ...base, SMTP_PORT: "587", SMTP_SECURE: "true" })
				.SMTP_SECURE,
		).toBe(true);
	});
});

describe("createSmtpTransport", () => {
	const base = { SMTP_HOST: "smtp.test", SMTP_PORT: "587" };

	it("authenticates only with both user and pass", () => {
		const both = setup({ ...base, SMTP_USER: "u", SMTP_PASS: "p" });
		expect(both.create.mock.calls[0]?.[0]).toMatchObject({
			auth: { user: "u", pass: "p" },
		});
		for (const partial of [{ SMTP_USER: "u" }, { SMTP_PASS: "p" }, {}]) {
			const { create } = setup({ ...base, ...partial });
			expect(create.mock.calls[0]?.[0]).not.toHaveProperty("auth");
		}
	});

	it("sends the message", async () => {
		const { sendMail, transport } = setup(base);
		await transport.send(message);
		expect(sendMail).toHaveBeenCalledWith(message);
		const failure = new Error("refused");
		sendMail.mockRejectedValueOnce(failure);
		await expect(transport.send(message)).rejects.toBe(failure);
	});
});
