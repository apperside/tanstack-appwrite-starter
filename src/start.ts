import { createStart } from "@tanstack/react-start";
import { compressionMiddleware } from "./server/compression";
import { csrfMiddleware } from "./server/csrf";

export const startInstance = createStart(() => ({
	// CSRF first: a refused request skips everything else.
	requestMiddleware: [csrfMiddleware, compressionMiddleware],
}));
