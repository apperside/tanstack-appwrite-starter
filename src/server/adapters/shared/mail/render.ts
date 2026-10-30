import en from "#/i18n/locales/en/emails.json";
import it from "#/i18n/locales/it/emails.json";
import type { AuthEmail, MailMessage } from "./mail";

const strings = { en, it };

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

const escapeHtml = (value: string) =>
	value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

/** The email's subject, plain text and HTML, in the recipient's locale. */
export function renderAuthEmail({
	to,
	purpose,
	url,
	locale,
}: AuthEmail): MailMessage {
	const { subject, text } = strings[locale][purpose];
	const [before = "", after = ""] = text.split("{{url}}");
	const link = escapeHtml(url);
	return {
		to,
		subject,
		text: text.replace("{{url}}", () => url),
		html: `<p>${escapeHtml(before)}<a href="${link}">${link}</a>${escapeHtml(after)}</p>`,
	};
}
