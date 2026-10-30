import type { Backend } from "#/core/backend";
import { createMemoryAuth, type SentEmail } from "./auth.server";
import { createMemoryTodos } from "./todos.server";

export type MemoryBackendOptions = {
	/** Injectable clock, for tests. */
	now?: () => number;
	/** Receives every email; the default prints the link to the server log. */
	sendEmail?: (email: SentEmail) => void;
};

function logEmail({ to, purpose, url }: SentEmail) {
	console.info(`[memory backend] ${purpose} email to ${to}: ${url}`);
}

/**
 * A backend in process memory: no service to run, nothing survives a restart,
 * and each server instance has its own. For development, demos and tests.
 */
export function createMemoryBackend({
	now = Date.now,
	sendEmail = logEmail,
}: MemoryBackendOptions = {}): Backend {
	const auth = createMemoryAuth({ now, sendEmail });
	return {
		auth: auth.forRequest,
		data: { todos: createMemoryTodos({ now }) },
	};
}
