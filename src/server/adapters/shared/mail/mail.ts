import type { Locale } from "#/core/prefs";

export type EmailPurpose = "verification" | "recovery";

/** What an auth backend asks to send: the link, not the wording. */
export type AuthEmail = {
	to: string;
	purpose: EmailPurpose;
	url: string;
	locale: Locale;
};

/** A rendered email, ready for a transport. */
export type MailMessage = {
	to: string;
	subject: string;
	text: string;
	html: string;
};

/** Delivers a rendered message; one implementation per provider. */
export interface MailTransport {
	send(message: MailMessage & { from: string }): Promise<void>;
}

/** Sends an auth email, rejecting with `AppError` on failure. */
export type SendEmail = (email: AuthEmail) => Promise<void>;
