const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// Appwrite's defaults, so every backend behaves alike.
/** How long a session lasts, in ms. */
export const SESSION_TTL = 365 * DAY;
/** How long an email-verification link is valid, in ms. */
export const VERIFICATION_TTL = 7 * DAY;
/** How long a password-recovery link is valid, in ms. */
export const RECOVERY_TTL = 60 * MINUTE;
