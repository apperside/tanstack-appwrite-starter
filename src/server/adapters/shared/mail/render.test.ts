import { describe, expect, it } from "vitest";
import en from "#/i18n/locales/en/emails.json";
import it_ from "#/i18n/locales/it/emails.json";
import type { EmailPurpose } from "./mail";
import { renderAuthEmail } from "./render";

const strings = { en, it: it_ };

describe("renderAuthEmail", () => {
	const url = "https://app.test/verify-email?token=abc";

	it.each(["en", "it"] as const)("renders in %s", (locale) => {
		for (const purpose of ["verification", "recovery"] as EmailPurpose[]) {
			const mail = renderAuthEmail({ to: "a@b.c", purpose, url, locale });
			expect(mail.to).toBe("a@b.c");
			expect(mail.subject).toBe(strings[locale][purpose].subject);
			expect(mail.text).toContain(url);
			expect(mail.html).toContain(`<a href="${url}">`);
		}
	});

	it("escapes the URL in HTML", () => {
		const nasty = 'https://app.test/?a="&b=<>';
		const mail = renderAuthEmail({
			to: "a@b.c",
			purpose: "recovery",
			url: nasty,
			locale: "en",
		});
		expect(mail.text).toContain(nasty);
		expect(mail.html).toContain("https://app.test/?a=&quot;&amp;b=&lt;&gt;");
		expect(mail.html).not.toContain(nasty);
	});
});
