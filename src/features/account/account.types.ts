/**
 * A session as the settings show it. No IP or country: sessions are created
 * server-side, so Appwrite records the app server's address, not the visitor's.
 */
export type SessionInfo = {
	id: string;
	current: boolean;
	clientName: string;
	osName: string;
	deviceName: string;
	createdAt: string;
};
