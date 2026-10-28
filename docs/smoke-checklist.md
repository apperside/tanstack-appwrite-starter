# Smoke checklist

Unit tests fake Appwrite, so they can't prove that a real instance behaves as
assumed: row permissions, guest upgrade keeping the user id, real emails. Run
this list against a real instance before a release.

## Setup

- **Run the production build:**
  ```bash
  pnpm build
  PORT=3013 node --env-file-if-exists=.env.local .output/server/index.mjs
  ```
- **Enable SMTP** on the Appwrite instance (console → Settings → SMTP). Without
  it, recovery and verification emails fail with `503 general_smtp_disabled`.
- **Use an inbox you control** for the email flows, and set `APP_URL` to the
  URL you open the app on. Email links point there.
- **Use throwaway users** (`smoke+<timestamp>@example.com`) for the other
  flows, and delete every test user afterwards.

## Flows

- [ ] **Sign up:** create an account, finish onboarding, reach home.
- [ ] **Log out:** user menu → Sign out → `/login`. The session cookie is
  cleared, and the user has 0 sessions in the Appwrite console.
- [ ] **Log in:** email + password → home. The user has 1 session.
- [ ] **Guest → upgrade:** Continue as guest → onboarding → guest banner →
  Save account. The user id is the same before and after, the email is set,
  and prefs are kept.
- [ ] **Guest → merge:** as a guest, open `/login` (you're sent to
  `?merge=1`). Sign in to an existing account: you land on its home as that
  user, and the guest user is deleted.
- [ ] **Verify email:**
  - Sign up with your inbox address and open the "Verify your email" link. You
    should get `/verify-email?userId=…&secret=…` showing "Your email is
    verified", and the user is verified in the console.
  - Open the same link again. Signed in, it shows "already verified"; signed
    out, it shows the invalid-link state.
- [ ] **Resend verification:** while unverified, open `/verify-email` and
  click "Send a new link". "A new link is on its way" appears and a second
  email arrives.
- [ ] **Forgot password:** signed out, open `/forgot-password` and enter your
  inbox address. "Check your email" appears and a recovery email arrives. An
  unknown address must show the same message (no account enumeration).
- [ ] **Reset password:**
  - Open the recovery link and set a new password. Signing in works with the
    new password and fails with the old one.
  - Opening the same link again shows the invalid-link state.
- [ ] **Change password:** Security → Update password shows a success toast.
  The old password is rejected and the new one works, on another device too.
- [ ] **Change email:** Profile → Change email (requires the current
  password). The console shows the new email on the same user id, and a
  verification email arrives at the new address.
- [ ] **Sign out everywhere:** with sessions on two devices, Security → Sign
  out everywhere → confirm. The user has 0 sessions. This device lands on
  `/login`, and the other one is sent to `/login?redirect=…` on its next
  navigation.
- [ ] **Clean up:** delete every test user.
