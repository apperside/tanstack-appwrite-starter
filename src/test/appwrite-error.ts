import { AppwriteException } from "node-appwrite";

/** Builds a real `AppwriteException` with the given Appwrite error `type`. */
export function appwriteError(type: string, code = 400): AppwriteException {
	return new AppwriteException(type, code, type);
}
