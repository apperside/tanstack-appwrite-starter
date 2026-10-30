import type { Backend } from "#/core/backend";
import type { SendEmail } from "../shared/mail/mail";
import { getSendEmail } from "../shared/mail/mailer.server";
import { createMemoryAuth } from "./auth.server";
import { createMemoryTodos } from "./todos.server";

export type MemoryBackendOptions = {
	/** Injectable clock, for tests. */
	now?: () => number;
	/** Receives every email; the default is the env-configured mailer. */
	sendEmail?: SendEmail;
};

/**
 * A backend in process memory: no service to run, nothing survives a restart,
 * and each server instance has its own. For development, demos and tests.
 */
export function createMemoryBackend({
	now = Date.now,
	sendEmail = getSendEmail(),
}: MemoryBackendOptions = {}): Backend {
	const auth = createMemoryAuth({ now, sendEmail });
	return {
		auth: auth.forRequest,
		data: { todos: createMemoryTodos({ now }) },
	};
}
