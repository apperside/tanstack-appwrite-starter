import type { AppData } from "#/core/backend";

/**
 * Extension points for app-specific behavior. Apps replace the implementations
 * in this file.
 */
export const serverHooks = {
	/**
	 * Runs when a guest signs in to an existing account, before the guest user is
	 * deleted: move the guest's data to `userId` here. If it rejects, the guest is
	 * kept and the sign-in fails.
	 * Must be idempotent: the user may retry, which runs it again.
	 * The default moves the example table's rows.
	 */
	async onGuestMerge({
		guestUserId,
		userId,
		data,
	}: {
		guestUserId: string;
		userId: string;
		data: AppData;
	}): Promise<void> {
		await data.todos.transferOwnership(guestUserId, userId);
	},
};
