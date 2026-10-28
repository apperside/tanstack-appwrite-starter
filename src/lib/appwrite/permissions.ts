import { Permission, Role } from "appwrite";

/**
 * Read/update/delete permissions for a single owner.
 * @public
 */
export function ownerPermissions(userId: string): string[] {
	const user = Role.user(userId);
	return [
		Permission.read(user),
		Permission.update(user),
		Permission.delete(user),
	];
}
