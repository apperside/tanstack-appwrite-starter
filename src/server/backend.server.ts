import { type BACKENDS, serverEnv } from "#/config/env";
import type { Backend } from "#/core/backend";

type BackendName = (typeof BACKENDS)[number];

/**
 * Loads the adapter named by `BACKEND`. Each is imported on demand, so a
 * server only loads (and needs the environment of) the one it uses.
 * Adding a backend: implement `Backend` under `#/adapters/<name>`, add the
 * name to `BACKENDS` and a case here.
 */
export async function loadBackend(name: BackendName): Promise<Backend> {
	switch (name) {
		case "appwrite":
			return (
				await import("#/adapters/appwrite/backend.server")
			).createAppwriteBackend();
		case "memory": {
			if (process.env.NODE_ENV === "production") {
				console.warn(
					"BACKEND=memory: every account and row lives in this process and is lost on restart.",
				);
			}
			return (
				await import("#/adapters/memory/backend.server")
			).createMemoryBackend();
		}
	}
}

let backend: Promise<Backend> | undefined;

/** The backend in use: one per process, shared by every request. */
export function getBackend(): Promise<Backend> {
	backend ??= loadBackend(serverEnv().BACKEND);
	return backend;
}
