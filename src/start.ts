import { createStart } from "@tanstack/react-start";
import { compressionMiddleware } from "./server/compression";

export const startInstance = createStart(() => ({
	requestMiddleware: [compressionMiddleware],
}));
