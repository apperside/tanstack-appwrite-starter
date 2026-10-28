import type { AppClient } from "#/lib/appwrite/app-models";

/**
 * Extension points for app-specific behavior. Apps replace the implementations
 * in this file; the boilerplate's defaults do nothing.
 */
export const serverHooks = {
	/**
	 * Runs when a guest signs in to an existing account, before the guest user is
	 * deleted: move the guest's data to `userId` here. If it rejects, the guest is
	 * kept and the sign-in fails.
	 * Must be idempotent: the user may retry, which runs it again.
	 */
	async onGuestMerge(_args: {
		guestUserId: string;
		userId: string;
		admin: AppClient<"admin">;
	}): Promise<void> {},
};
